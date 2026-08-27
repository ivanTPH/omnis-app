# Design notes: DSPy optimization for Omnis's agentic system

## What exists already (found by inspecting the live "Ivan Omnis" Supabase project)

This wasn't designed from scratch — it was designed to fit what's already running:

- `AgentAuditEntry` (19,303 rows) logs every agent call: `agentType` (`COACH`,
  `QUALITY`, `PLAN_SYNTHESIS`, `EVIDENCE`, `ENGAGE`), `skillId` (`CURRICULUM_ALIGNMENT`,
  `BLOOMS_ANALYSIS`, `SEND_DIFFERENTIATION`, `RETRIEVAL_SPACING`, `MARKING_CONSISTENCY`,
  `APDR_CYCLE`, `FEEDBACK_QUALITY`, `ENGAGEMENT_DESIGN`), `skillVersion`, `inputRefs`,
  `standardsApplied`, `outputSummary`, `decision`, `confidence`, and a human review:
  `reviewOutcome` (`CONFIRMED` / `OVERRIDDEN` / `DISMISSED`), `reviewedById`, `reviewNote`.
  This is exactly the "AI Agent Insights" review queue in the SENCo dashboard —
  the confirm/override/dismiss actions teachers already take are the training signal.
- `SendQualityScore` already runs an automated multi-dimension quality score
  (readability, cognitive load, language, structure) per Oak lesson.
- `ResourceVersion` exists in the schema but has 0 rows — scaffolded, never wired up.
  This is where teacher-edit tracking belongs; see INTEGRATION.md.
- `ConsentPurpose`/`ConsentRecord`/`DataSubjectRequest` are a real, working GDPR
  consent system already (9 purposes, 85 records, DSAR tracking with status).

Two additive migrations close the gaps (full SQL in `db/001_dspy_tables.sql`,
already applied): `AgentSkillVersion` (the actual optimized-prompt registry that
`AgentAuditEntry.skillVersion` resolves to), `AgentOptimizationRun` (one row per
weekly pass), and three new columns on `ResourceVersion`.

## Why three signals, not one blended score

Curriculum/exam-spec alignment, teacher edits, and student completion/progress
resolve on wildly different timescales — instant, minutes-to-hours, and weeks.
DSPy's optimizer evaluates its metric once per candidate program per training
example during a single `compile()` call; a metric that takes six weeks to resolve
can't sit in that loop. So:

- **Fast metric** (`metrics.fast_metric`) — curriculum/SEND-quality alignment
  (automatic) blended with the review-outcome/edit-distance signal — is what
  DSPy's `MIPROv2` optimizer actually searches against.
- **Slow metric** (`metrics.slow_validation_summary`) — completion rate and a
  progress proxy — never touches the optimizer. It's a validation tripwire, checked
  the week AFTER a promotion, to catch an optimized prompt that técnically scores
  well on the fast metric but produces content students engage with less, or
  progress on less (e.g. an optimizer finding that blander, safer, lower-effort
  homework gets marked CONFIRMED more often — completion rate is exactly the check
  that would catch that starting to happen).

This is also the direct defence against Goodhart's law: any single metric a
generator can be optimized against eventually gets gamed if nothing else is
watching. Keeping the slow metric structurally separate — never in the fast loop,
always a post-hoc check — means a regression there pauses trust in future
auto-promotions for that skill rather than silently compounding.

## Promotion gate

A new `AgentSkillVersion` is written every run regardless of outcome (so the
history is complete), but only marked `isActive=true` — i.e. actually served to
production — if it beats both the naive un-optimized baseline AND the current
active version by more than a small margin (0.02 on the 0–1 fast-metric scale;
tune once real score distributions exist). `--dry-run` skips promotion entirely
and just records scores, useful for the first several weeks while trusting the
pipeline.

## Multi-agent skill sharing

Several skills are used by more than one agent -- `SEND_DIFFERENTIATION` is
used by all five (`COACH`, `QUALITY`, `PLAN_SYNTHESIS`, `EVIDENCE`, `ENGAGE`),
`BLOOMS_ANALYSIS` and `CURRICULUM_ALIGNMENT` by both `COACH` and `QUALITY`,
`RETRIEVAL_SPACING` by both `COACH` and `ENGAGE` -- because the same underlying
judgment (classify Bloom's level, check curriculum alignment, adapt for a SEND
need) shows up in genuinely different tasks: drafting a homework question vs.
marking a submission vs. drafting an ILP target vs. selecting evidence. Those
are different enough jobs that the best instructions/demonstrations for one
shouldn't be assumed to transfer to another, even though they share a signature
shape.

So `weekly_run.py` optimizes every `(agentType, skillId)` pair independently
(see `signatures.AGENT_SKILL_MAP`, now a skillId -> list-of-agentTypes map, and
`signatures.agent_skill_pairs()`), each trained only on that agent's own
`AgentAuditEntry` rows and promoted only against its own baseline/active
version. A skill with five agents using it can end up with five different
`AgentSkillVersion` rows active at once -- that's the point, not an accident.
The cost is that a shared skill needs `--min-examples` reviewed examples
*per agent*, not once total, before its first optimization pass runs for that
agent -- a skill five agents use lightly each will take longer to accumulate
enough per-agent signal than one agent using it heavily would.

One consequence worth flagging: `EVIDENCE` is mapped to `SEND_DIFFERENTIATION`
and `APDR_CYCLE` per the app's own `lib/agents/skills/index.ts`, but as of this
write-up `lib/agents/evidence-agent.ts` writes no `AgentAuditEntry` rows at all
(a pre-existing gap in the app, unrelated to this service). Those two pairs
will sit at 0 examples and never reach `--min-examples` until that's fixed on
the app side -- not a bug here, just something that silently caps coverage
until someone notices `EVIDENCE`'s rows never accumulate.

## Pilot recommendation

Start with `ENGAGEMENT_DESIGN` and/or `MARKING_CONSISTENCY` — both are high-volume
already (visible in the AI Insights queue), both have a clean review signal, and
`MARKING_CONSISTENCY` specifically has an unusually strong gold signal available:
a teacher's own mark award is close to ground truth for "was this marked right,"
which most of the other skills don't have as directly. Prove the pipeline and the
metric design on one or two skills for a few weekly cycles before generalizing
`weekly_run.py`'s default (currently: every skill with ≥40 new reviewed examples)
to run unattended across all eight.

## What this is not

Not a claim that any of this is validated yet — `slow_validation_summary`'s
`avg_score_delta` is a placeholder (see `data.completion_and_progress_window`) until
a real per-student progress-attribution query is agreed; shipping a naive version
of that (attributing a grade change to one homework task six weeks later) would be
worse than not having the check at all. Flagging it as unfinished here rather than
quietly stubbing it out.
