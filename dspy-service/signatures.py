"""
One dspy.Signature per AgentSkillId. Field names are deliberately generic
(lesson_context, student_profile, ...) so the same signature shape can serve
every agentType that actually uses that skill (see AGENT_SKILL_MAP below) --
DSPy optimizes the instruction text and few-shot demos, not the field names,
so keep these stable once real traffic is flowing against them.
"""
import dspy

# Mirrors the Postgres enums exactly (AgentType, AgentSkillId) -- keep in sync
# with db/001_dspy_tables.sql / the app's Prisma schema.
AGENT_TYPES = ["COACH", "QUALITY", "PLAN_SYNTHESIS", "EVIDENCE", "ENGAGE"]

# skillId -> every agentType that actually calls it, mirroring the app's own
# source of truth: lib/agents/skills/index.ts's AGENT_SKILLS map. Omnis shares
# several skills across agents deliberately (a SEND adaptation drafted by COACH
# and one drafted by PLAN_SYNTHESIS are genuinely different tasks that happen to
# share a signature shape), so this is many-to-many, NOT skillId -> one owner.
#
# Each (agentType, skillId) pair in this map is optimized as its OWN independent
# AgentSkillVersion, trained only on that agentType's own AgentAuditEntry rows --
# see data.py. That's deliberate: the right instructions/demonstrations for
# BLOOMS_ANALYSIS as used by COACH (retention/gap-focused) can legitimately
# diverge from BLOOMS_ANALYSIS as used by QUALITY (marking/feedback-focused),
# even though both start from the same Signature class below.
#
# Keep this in sync with lib/agents/skills/index.ts by hand -- there is no
# shared source of truth across the repo boundary (this service only has DB
# access, not the Next.js codebase; see INTEGRATION.md). If the app's mapping
# changes, this needs a matching edit.
AGENT_SKILL_MAP = {
    "CURRICULUM_ALIGNMENT": ["COACH", "QUALITY"],
    "BLOOMS_ANALYSIS":      ["COACH", "QUALITY"],
    "SEND_DIFFERENTIATION": ["COACH", "QUALITY", "PLAN_SYNTHESIS", "EVIDENCE", "ENGAGE"],
    "RETRIEVAL_SPACING":    ["COACH", "ENGAGE"],
    "MARKING_CONSISTENCY":  ["QUALITY"],
    "APDR_CYCLE":           ["PLAN_SYNTHESIS", "EVIDENCE"],
    "FEEDBACK_QUALITY":     ["QUALITY"],
    "ENGAGEMENT_DESIGN":    ["ENGAGE"],
}


def agent_skill_pairs() -> list[tuple[str, str]]:
    """Every (skillId, agentType) pair the app can actually produce an
    AgentAuditEntry for -- the full list weekly_run.py iterates over. Flattens
    AGENT_SKILL_MAP so each pair is treated as its own optimization target."""
    return [
        (skill_id, agent_type)
        for skill_id, agent_types in AGENT_SKILL_MAP.items()
        for agent_type in agent_types
    ]


class CurriculumAlignment(dspy.Signature):
    """Judge or draft content against the lesson's stated learning objectives and
    the Oak curriculum reference for this unit. Flag anything unsupported by either."""

    lesson_objectives: str = dspy.InputField(desc="the lesson's numbered learning objectives")
    oak_curriculum_ref: str = dspy.InputField(desc="Oak unit/lesson curriculum tags and spec points")
    candidate_content: str = dspy.InputField(desc="the generated question, resource, or plan text to check")
    alignment_verdict: str = dspy.OutputField(desc="aligned | partially_aligned | unaligned")
    alignment_explanation: str = dspy.OutputField(desc="one or two sentences citing which objective/spec point")


class BloomsAnalysis(dspy.Signature):
    """Classify a question or task by Bloom's taxonomy level and check it matches
    the cognitive demand the lesson objective calls for."""

    learning_objective: str = dspy.InputField()
    question_or_task: str = dspy.InputField()
    blooms_level: str = dspy.OutputField(desc="remember | understand | apply | analyse | evaluate | create")
    matches_objective_demand: bool = dspy.OutputField()
    rationale: str = dspy.OutputField()


class SendDifferentiation(dspy.Signature):
    """Given a student's SEND category, K Plan strategies, and a piece of lesson
    content, produce (or judge) an adaptation: scaffolding, wording changes, or
    format changes that keep the same learning objective but make it accessible."""

    send_category: str = dspy.InputField(desc="e.g. ASD/Autism, Dyslexia, SLCN")
    k_plan_strategies: str = dspy.InputField(desc="active classroom strategies from the student's K Plan")
    original_content: str = dspy.InputField()
    adapted_content: str = dspy.OutputField()
    strategies_applied: str = dspy.OutputField(desc="which K Plan strategies this adaptation used, and how")


class RetrievalSpacing(dspy.Signature):
    """Design a spaced-retrieval engagement package (MCQs + vocab + core/challenge
    tasks) targeting a specific weak topic, timed for effective spacing."""

    weak_topic: str = dspy.InputField(desc="the topic/skill this student is underperforming on")
    prior_attempt_summary: str = dspy.InputField(desc="what the student got wrong and when")
    mcq_questions: str = dspy.OutputField(desc="3 MCQs targeting the misconception, not just recall")
    vocab_terms: str = dspy.OutputField()
    core_and_challenge_tasks: str = dspy.OutputField()


class MarkingConsistency(dspy.Signature):
    """Mark a student's short-answer/essay response against the mark scheme,
    the way a consistent, moderated human marker would."""

    question: str = dspy.InputField()
    mark_scheme: str = dspy.InputField()
    student_answer: str = dspy.InputField()
    marks_awarded: int = dspy.OutputField()
    marks_available: int = dspy.OutputField()
    feedback: str = dspy.OutputField(desc="specific, actionable, references the mark scheme criteria")


class ApdrCycle(dspy.Signature):
    """Draft the next Assess-Plan-Do-Review cycle stage for a student's ILP/K Plan,
    given the previous cycle's observations and evidence."""

    send_status: str = dspy.InputField()
    previous_cycle_summary: str = dspy.InputField()
    evidence_log: str = dspy.InputField(desc="homework/observation evidence linked since the last review")
    assess_summary: str = dspy.OutputField()
    plan_targets: str = dspy.OutputField(desc="specific, measurable targets with target dates")
    teaching_strategies: str = dspy.OutputField()


class FeedbackQuality(dspy.Signature):
    """Write feedback on a marked piece of work that is specific, actionable, and
    appropriately pitched for the student's SEND profile (not generic praise)."""

    question: str = dspy.InputField()
    student_answer: str = dspy.InputField()
    marks_awarded: str = dspy.InputField()
    send_context: str = dspy.InputField(desc="relevant SEND category/strategies, if any")
    feedback: str = dspy.OutputField()


class EngagementDesign(dspy.Signature):
    """Design an engagement package for one topic: MCQs, vocab, core+challenge
    tasks, and a SEND adaptation note, matched to the confidence level reported."""

    topic: str = dspy.InputField()
    performance_context: str = dspy.InputField(desc="e.g. '50% on rhetorical devices and unseen poetry'")
    send_adaptation_needed: bool = dspy.InputField()
    package_summary: str = dspy.OutputField()
    mcq_questions: str = dspy.OutputField()
    vocab_terms: str = dspy.OutputField()
    send_adaptation: str = dspy.OutputField()


SIGNATURES = {
    "CURRICULUM_ALIGNMENT": CurriculumAlignment,
    "BLOOMS_ANALYSIS": BloomsAnalysis,
    "SEND_DIFFERENTIATION": SendDifferentiation,
    "RETRIEVAL_SPACING": RetrievalSpacing,
    "MARKING_CONSISTENCY": MarkingConsistency,
    "APDR_CYCLE": ApdrCycle,
    "FEEDBACK_QUALITY": FeedbackQuality,
    "ENGAGEMENT_DESIGN": EngagementDesign,
}
