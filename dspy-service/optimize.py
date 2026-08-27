"""
Runs one DSPy optimization pass for a single (AgentSkillId, AgentType) pair and
returns the compiled program, ready for data.write_skill_version() to persist.

A skill used by multiple agents (see signatures.AGENT_SKILL_MAP) is optimized
once per agent that uses it, each against only that agent's own training data --
optimize_skill() is always called with one specific agent_type, never "the"
agent for a skill, since there usually isn't just one.
"""
import dspy

from signatures import SIGNATURES
from metrics import fast_metric
import data


class SkillModule(dspy.Module):
    """Thin wrapper so every skill goes through dspy.ChainOfThought uniformly --
    reasoning-then-answer measurably outperforms bare Predict on the judgment-heavy
    skills here (marking, alignment, differentiation), and costs little on the
    more mechanical ones (retrieval/spacing question generation)."""

    def __init__(self, signature):
        super().__init__()
        self.predict = dspy.ChainOfThought(signature)

    def forward(self, **kwargs):
        return self.predict(**kwargs)


def optimize_skill(skill_id: str, agent_type: str, min_examples: int = 40, eval_holdout: float = 0.2):
    signature = SIGNATURES[skill_id]
    examples = data.fetch_training_examples(skill_id, agent_type, since_run_id=None)

    if len(examples) < min_examples:
        return {
            "skipped": True,
            "reason": f"only {len(examples)} reviewed examples for {agent_type}/{skill_id}, need {min_examples}",
        }

    split = int(len(examples) * (1 - eval_holdout))
    trainset, evalset = examples[:split], examples[split:]

    baseline = SkillModule(signature)
    baseline_score = _evaluate(baseline, evalset)

    optimizer = dspy.MIPROv2(
        metric=fast_metric,
        auto="medium",           # bounded search budget -- this runs weekly, not once
        num_threads=8,
    )
    compiled = optimizer.compile(
        SkillModule(signature),
        trainset=trainset,
        requires_permission_to_run=False,
    )
    compiled_score = _evaluate(compiled, evalset)

    active = data.get_active_version(skill_id, agent_type)
    active_score = active["metricScore"] if active else None

    # Promote only if it beats BOTH the naive baseline and the currently-active
    # version (for this specific agentType) by a real margin -- small deltas on
    # a few hundred examples are noise.
    beats_active = active_score is None or compiled_score > active_score + 0.02
    promote = compiled_score > baseline_score + 0.02 and beats_active

    instructions, demos = _extract_program(compiled)

    return {
        "skipped": False,
        "instructions": instructions,
        "demonstrations": demos,
        "metric_score": compiled_score,
        "metric_breakdown": {
            "baseline_score": baseline_score,
            "active_score": active_score,
            "n_train": len(trainset),
            "n_eval": len(evalset),
        },
        "training_example_count": len(examples),
        "promote": promote,
    }


def _evaluate(module, evalset) -> float:
    if not evalset:
        return 0.0
    scores = []
    for ex in evalset:
        try:
            pred = module(**ex.inputs())
            scores.append(fast_metric(ex, pred))
        except Exception:
            scores.append(0.0)
    return sum(scores) / len(scores)


def _extract_program(compiled_module) -> tuple[str, list]:
    """Pull the optimized instruction string and selected few-shot demos back out
    of a compiled dspy.Module, in a form that's plain data (JSON-able) so the app
    can consume it without a DSPy dependency at request time."""
    predictor = compiled_module.predict
    instructions = predictor.signature.instructions
    demos = [
        {k: v for k, v in demo.items() if not k.startswith("_")}
        for demo in getattr(predictor, "demos", [])
    ]
    return instructions, demos
