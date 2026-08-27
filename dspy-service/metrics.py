"""
Composite metric used as the DSPy optimization target, plus the slower validation
signal that is deliberately kept OUT of the optimizer's inner loop.

Design rationale (see the write-up in DESIGN.md for the full argument): DSPy's
optimizer evaluates a metric for every candidate program it tries during a single
`compile()` call. A metric that depends on outcomes which resolve weeks later
(homework completion, grade movement) can't sit in that loop -- you'd never finish
one optimization pass. So:

  FAST metric (used to optimize):      curriculum/spec alignment (automatic, instant)
                                        + teacher edit/accept signal (minutes-hours old)

  SLOW metric (used to validate/gate): completion rate + progress delta, computed
                                        over a holdout period AFTER a new
                                        AgentSkillVersion is proposed, before it's
                                        promoted to isActive=true.

Both are real signals already sitting in Postgres -- see data.py for the queries.
"""
from dataclasses import dataclass


@dataclass
class ExampleOutcome:
    """One training example's observed outcome, assembled by data.py from
    AgentAuditEntry (+ joined ResourceVersion / SendQualityScore where relevant)."""

    review_outcome: str | None   # 'CONFIRMED' | 'OVERRIDDEN' | 'DISMISSED' | None (not yet reviewed)
    confidence: int              # 0-100, as logged by the agent at generation time
    edit_distance: float | None  # normalised 0-1, from ResourceVersion.editDistance if content was edited
    send_quality: dict | None    # SendQualityScore dimension scores, if this content was scored


def fast_metric(example, prediction, trace=None) -> float:
    """
    The metric DSPy's optimizer actually searches against. Called once per candidate
    program per training example during compile(). Must be fast and side-effect-free.

    `example` carries `.outcome: ExampleOutcome` (attached by data.py when building
    the trainset) plus whatever the signature's gold/reference fields are, when we
    have them (e.g. a teacher's *final, edited* version of the content -- the best
    approximation of "what a good answer looks like" we can get without hand-labeling).

    Score is a weighted blend of three things that are all available immediately:
      1. Did a teacher confirm this without editing it? (best single signal)
      2. Automated curriculum/SEND-quality alignment score, if one exists for this
         content type (SendQualityScore, or a same-turn LLM-judge call for types
         SendQualityScore doesn't cover yet -- see judge_alignment() below).
      3. If there IS a teacher edit, how small was it? (small edit = close to right)
    """
    outcome: ExampleOutcome = getattr(example, "outcome", None)
    if outcome is None:
        # No review yet -- fall back to automated alignment only.
        return _alignment_component(prediction, example)

    review_component = {
        "CONFIRMED": 1.0,
        "OVERRIDDEN": 0.35,   # not zero: an override that kept most of the content is still partial credit
        "DISMISSED": 0.0,
    }.get(outcome.review_outcome, 0.5)  # unreviewed-but-has-other-signal: neutral prior

    edit_component = 1.0
    if outcome.edit_distance is not None:
        # edit_distance is normalised 0 (untouched) .. 1 (rewritten from scratch)
        edit_component = max(0.0, 1.0 - outcome.edit_distance)

    alignment_component = _alignment_component(prediction, example, outcome)

    return (
        0.45 * review_component +
        0.25 * edit_component +
        0.30 * alignment_component
    )


def _alignment_component(prediction, example, outcome: ExampleOutcome | None = None) -> float:
    """Automated, no-human-in-the-loop quality signal. Prefers a real SendQualityScore
    row if one exists for this content (already computed by the app's existing quality
    pipeline); otherwise falls back to a same-call LLM-judge using the CurriculumAlignment
    signature against the example's lesson_objectives/oak_curriculum_ref fields."""
    if outcome is not None and outcome.send_quality:
        dims = outcome.send_quality
        keys = ["readabilityScore", "cognitiveScore", "languageScore", "structureScore"]
        vals = [dims[k] for k in keys if k in dims and dims[k] is not None]
        if vals:
            return sum(vals) / len(vals) / 100.0

    import dspy
    from signatures import CurriculumAlignment
    judge = dspy.Predict(CurriculumAlignment)
    try:
        verdict = judge(
            lesson_objectives=getattr(example, "lesson_objectives", "") or getattr(example, "learning_objective", ""),
            oak_curriculum_ref=getattr(example, "oak_curriculum_ref", ""),
            candidate_content=str(prediction),
        )
        return {"aligned": 1.0, "partially_aligned": 0.5, "unaligned": 0.0}.get(
            verdict.alignment_verdict.strip().lower(), 0.5
        )
    except Exception:
        return 0.5  # judge call failed -- neutral, don't let it tank the whole optimization run


# ---------------------------------------------------------------------------
# SLOW metric: validation only. Never passed to dspy optimizers directly.
# Run by weekly_run.py AFTER a candidate AgentSkillVersion beats the fast metric,
# comparing the two-week window before vs after a *prior* promotion, so it never
# blocks on waiting for new data mid-run -- it's checking the LAST promotion's
# real-world effect, which gates whether the run keeps auto-promoting or pauses
# for human review.
# ---------------------------------------------------------------------------

def slow_validation_summary(before: dict, after: dict) -> dict:
    """`before`/`after` are pre-aggregated dicts from data.completion_and_progress_window():
    {completion_rate, avg_score_delta, n_submissions}. Returns a verdict, never a single
    scalar -- this is read by a human via the XAI/optimization-run view, not auto-acted-on
    beyond the conservative auto-pause rule in weekly_run.py."""
    completion_delta = after["completion_rate"] - before["completion_rate"]
    score_delta = after["avg_score_delta"] - before["avg_score_delta"]
    flags = []
    if completion_delta < -0.05:
        flags.append("completion_rate_dropped")
    if score_delta < -0.03 and after["n_submissions"] >= 20:
        flags.append("progress_regressed")
    return {
        "completion_delta": completion_delta,
        "score_delta": score_delta,
        "flags": flags,
        "regressed": len(flags) > 0,
    }
