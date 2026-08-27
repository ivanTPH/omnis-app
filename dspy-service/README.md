# Omnis DSPy Optimization Service

Offline prompt/few-shot optimizer for the Omnis agentic system (`COACH`, `QUALITY`,
`PLAN_SYNTHESIS`, `EVIDENCE`, `ENGAGE`), built on the DSPy framework.

**What this is not:** a runtime dependency of the Next.js app. DSPy only ever runs
here, offline, on a schedule. It reads training signal that the app already writes
to Postgres (`AgentAuditEntry`, `ResourceReview`/`ResourceVersion`, `SendQualityScore`),
and writes its output — an optimized instruction + a set of few-shot demonstrations —
to a new table, `AgentSkillVersion`. The Next.js app reads the *active* row for a given
`(agentType, skillId)` when it builds a prompt for that skill. Nothing about the request
path changes; only which instruction/demos it plugs in.

## Why this is safe to bolt on

Every table this reads already exists and is already being populated by the live app:

- `AgentAuditEntry` (19k+ rows today) already logs, per agent call: `inputRefs`,
  `standardsApplied`, `outputSummary`, `confidence`, and — critically — a teacher's
  `reviewOutcome` (`CONFIRMED` / `OVERRIDDEN` / `DISMISSED`) plus `reviewNote`. This is
  the human-feedback signal this design was built around; it was already being
  captured for the "AI Agent Insights" review queue, just not used to improve anything.
- `SendQualityScore` already runs an automated multi-dimension quality score
  (readability, visual load, cognitive load, language, structure) per Oak lesson.
- `skillVersion` on `AgentAuditEntry` already anticipates versioned prompts — this
  project is what makes that version number resolve to something real.

Two additive-only migrations are all that changed the schema (see `db/`):

1. `AgentSkillVersion` / `AgentOptimizationRun` — new tables, no existing table altered.
2. Three new nullable columns on `ResourceVersion` (`editSource`, `editDistance`,
   `diffSummary`) — `ResourceVersion` existed already but had 0 rows; these just give
   the app somewhere to record *what a teacher changed* when they edit AI output
   before publishing, which is the other half of the training signal.

**Action required from the app side** (see `INTEGRATION.md`) — this repo cannot do
these itself, since it only has database access, not the Next.js codebase:
1. Whenever a teacher edits AI-generated content before saving (homework questions,
   K Plan / ILP target drafts, engagement packages, adapted resources), write a
   `ResourceVersion` row with `editSource='teacher_edit'` and a diff.
2. When constructing the prompt for a given `(agentType, skillId)`, look up the
   `AgentSkillVersion` row where `isActive=true` and use its `instructions` +
   `demonstrations` instead of (or blended with) the hardcoded prompt.

## Layout

- `signatures.py` — one DSPy `Signature` per `AgentSkillId` value.
- `metrics.py` — the composite metric each signature is optimized against.
- `data.py` — pulls training/eval examples out of Postgres.
- `optimize.py` — the optimization run for one skill; writes `AgentSkillVersion`.
- `weekly_run.py` — entrypoint for the weekly cron; loops every skill, promotes
  improvements, records an `AgentOptimizationRun`.
- `db/001_dspy_tables.sql` — the migration already applied to the `Ivan Omnis`
  Supabase project (kept here so it's in version control / reviewable, and so your
  Prisma schema can be reconciled against it — see the warning in `INTEGRATION.md`).

## Running it

```bash
pip install -r requirements.txt
export DATABASE_URL="postgresql://...supabase connection string..."
export ANTHROPIC_API_KEY="..."   # or OPENAI_API_KEY, whichever LM you optimize against
python weekly_run.py --skills ENGAGEMENT_DESIGN,MARKING_CONSISTENCY --min-examples 40
```

`--skills` and `--agents` are both optional filters; omitted, `weekly_run.py` targets
every `(agentType, skillId)` pair from `signatures.AGENT_SKILL_MAP` that has at least
`--min-examples` new reviewed `AgentAuditEntry` rows since the last run. A skill used
by several agents (e.g. `SEND_DIFFERENTIATION`) is optimized once per agent, each
against only that agent's own data -- see DESIGN.md's "Multi-agent skill sharing".
