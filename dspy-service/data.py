"""
Pulls training/eval examples and validation windows out of Postgres.
Uses psycopg2 directly rather than an ORM -- this service reads a handful of
tables and writes two, an ORM would be pure overhead.

Every function here takes an explicit `agent_type` alongside `skill_id` --
skills are shared across multiple agents (see signatures.AGENT_SKILL_MAP), so
skill_id alone is never enough to pick a training set or an AgentSkillVersion
row. Each (skill_id, agent_type) pair is trained and scored independently, on
only the AgentAuditEntry rows that specific agent actually wrote.

Every query that reads AgentAuditEntry/Homework also joins School and filters
out isDemo = true. app/api/cron/demo-advance/route.ts writes scripted,
non-human reviewOutcome values for the synthetic demo school every week --
without this filter those auto-confirm/dismiss entries would silently mix
into real training data. See docs/audit/2026-08-27-dspy-agent-skill-optimization.md.
"""
import os
import json
import psycopg2
import psycopg2.extras
import dspy

from metrics import ExampleOutcome


def _conn():
    dsn = os.environ["DATABASE_URL"]
    return psycopg2.connect(dsn)


def fetch_training_examples(skill_id: str, agent_type: str, since_run_id: str | None, limit: int = 2000) -> list[dspy.Example]:
    """
    Every reviewed AgentAuditEntry for this (skill_id, agent_type) pair becomes
    one dspy.Example. `inputRefs` (jsonb) holds whatever the agent was given at
    call time -- we trust the app wrote sensible keys there (lesson objectives,
    student SEND profile, etc.); if a key the signature expects is missing we
    skip that field rather than fail the whole example, so schema drift on
    either side degrades gracefully.

    Joins ResourceVersion (via a `resourceId` key inside inputRefs, when present) to
    get editDistance, and SendQualityScore (via an `oakLessonSlug` key) for the
    automated quality dimensions. Both joins are best-effort/left joins -- most
    AgentAuditEntry rows won't have either, and that's fine, the metric handles it.
    """
    sql = """
        select
            aae.id, aae."inputRefs", aae."standardsApplied", aae."outputSummary",
            aae.decision, aae.confidence, aae."reviewOutcome", aae."reviewNote",
            aae."createdAt",
            rv."editDistance", rv."diffSummary",
            sqs."readabilityScore", sqs."cognitiveScore", sqs."languageScore", sqs."structureScore"
        from "AgentAuditEntry" aae
        join "School" sch on sch.id = aae."schoolId" and sch."isDemo" = false
        left join "ResourceVersion" rv
            on rv."resourceId" = (aae."inputRefs" ->> 'resourceId')
            and rv."editSource" = 'teacher_edit'
        left join "SendQualityScore" sqs
            on sqs."oakLessonSlug" = (aae."inputRefs" ->> 'oakLessonSlug')
        where aae."skillId" = %s
          and aae."agentType" = %s
          and aae."reviewOutcome" is not null
        order by aae."createdAt" desc
        limit %s
    """
    examples = []
    with _conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (skill_id, agent_type, limit))
        for row in cur.fetchall():
            refs = row["inputRefs"] or {}
            fields = {k: v for k, v in refs.items() if isinstance(v, str)}
            ex = dspy.Example(**fields, gold_output=row["outputSummary"]).with_inputs(*fields.keys())
            send_quality = None
            if row["readabilityScore"] is not None:
                send_quality = {
                    "readabilityScore": row["readabilityScore"],
                    "cognitiveScore": row["cognitiveScore"],
                    "languageScore": row["languageScore"],
                    "structureScore": row["structureScore"],
                }
            edit_distance = None
            if row["editDistance"] is not None:
                edit_distance = min(1.0, row["editDistance"] / 500.0)  # rough char-distance normalisation; tune once real data exists
            ex.outcome = ExampleOutcome(
                review_outcome=row["reviewOutcome"],
                confidence=row["confidence"],
                edit_distance=edit_distance,
                send_quality=send_quality,
            )
            examples.append(ex)
    return examples


def count_new_reviewed_examples(skill_id: str, agent_type: str, since: str | None) -> int:
    sql = """
        select count(*)
        from "AgentAuditEntry" aae
        join "School" sch on sch.id = aae."schoolId" and sch."isDemo" = false
        where aae."skillId" = %s and aae."agentType" = %s and aae."reviewOutcome" is not null
          and (%s::timestamp is null or aae."createdAt" > %s::timestamp)
    """
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(sql, (skill_id, agent_type, since, since))
        return cur.fetchone()[0]


def get_active_version(skill_id: str, agent_type: str) -> dict | None:
    sql = """
        select id, version, instructions, demonstrations, "metricScore", "createdAt"
        from "AgentSkillVersion"
        where "skillId" = %s and "agentType" = %s and "isActive" = true
        limit 1
    """
    with _conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (skill_id, agent_type))
        return cur.fetchone()


def write_skill_version(skill_id: str, agent_type: str, instructions: str, demonstrations: list,
                         metric_score: float, metric_breakdown: dict,
                         training_example_count: int, optimizer_run_id: str,
                         promote: bool) -> str:
    import uuid
    new_id = f"asv_{uuid.uuid4().hex[:20]}"
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """select coalesce(max(version), 0) + 1 from "AgentSkillVersion"
               where "skillId" = %s and "agentType" = %s""",
            (skill_id, agent_type),
        )
        next_version = cur.fetchone()[0]

        if promote:
            cur.execute(
                """update "AgentSkillVersion" set "isActive" = false
                   where "skillId" = %s and "agentType" = %s and "isActive" = true""",
                (skill_id, agent_type),
            )
        cur.execute(
            """insert into "AgentSkillVersion"
               (id, "agentType", "skillId", version, instructions, demonstrations,
                "metricScore", "metricBreakdown", "trainingExampleCount",
                "optimizerRunId", "isActive", "createdAt", "promotedAt")
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now(), %s)""",
            (new_id, agent_type, skill_id, next_version, instructions,
             json.dumps(demonstrations), metric_score, json.dumps(metric_breakdown),
             training_example_count, optimizer_run_id, promote,
             "now()" if promote else None),
        )
        conn.commit()
    return new_id


def create_optimization_run(triggered_by: str, skills_targeted: list[dict]) -> str:
    import uuid
    run_id = f"aor_{uuid.uuid4().hex[:20]}"
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """insert into "AgentOptimizationRun" (id, "triggeredBy", status, "skillsTargeted")
               values (%s, %s, 'running', %s)""",
            (run_id, triggered_by, json.dumps(skills_targeted)),
        )
        conn.commit()
    return run_id


def finish_optimization_run(run_id: str, status: str, summary: dict, error_message: str | None = None):
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """update "AgentOptimizationRun"
               set status = %s, summary = %s, "errorMessage" = %s, "finishedAt" = now()
               where id = %s""",
            (status, json.dumps(summary), error_message, run_id),
        )
        conn.commit()


def completion_and_progress_window(skill_id: str, agent_type: str, start, end) -> dict:
    """Slow-metric validation window (see metrics.slow_validation_summary). Joins
    Homework/Submission for completion and Submission.score-over-time for a crude
    progress proxy. This is intentionally simple -- it's a regression *tripwire*,
    not a causal study; treat `flags` as "go look at this", not proof of causation.

    NOTE: this query does not currently scope by skill_id/agent_type at all --
    it's a school-wide completion-rate proxy, not per-skill. That's a pre-existing
    simplification (see DESIGN.md's "what this is not"), not something this pass
    changed; skill_id/agent_type are accepted here so call sites read correctly
    and so a future version can actually scope the window, but they're unused
    below until that query is written."""
    sql = """
        with hw as (
            select h.id, h."dueAt",
                   count(s.id) filter (where s.id is not null) as submitted,
                   count(*) as assigned
            from "Homework" h
            join "School" sch on sch.id = h."schoolId" and sch."isDemo" = false
            left join "Submission" s on s."homeworkId" = h.id
            where h."createdAt" between %s and %s
            group by h.id, h."dueAt"
        )
        select
            coalesce(avg(submitted::float / nullif(assigned,0)), 0) as completion_rate,
            count(*) as n_homeworks
        from hw
    """
    with _conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, (start, end))
        row = cur.fetchone()
    return {
        "completion_rate": row["completion_rate"] or 0.0,
        "avg_score_delta": 0.0,  # placeholder: wire to Submission score deltas once
                                  # a per-student baseline query is agreed (see DESIGN.md,
                                  # "attribution is hard" -- don't ship a naive version of this)
        "n_submissions": row["n_homeworks"] or 0,
    }
