# Omnis — DSPy weekly-optimization + XAI integration (2026-08-27)

Wiring an already-built, standalone DSPy weekly-optimization pipeline (Python service, separate from this repo) into the Next.js app, plus the explainability (XAI) layer it enables. Full design rationale lives in the Claude Project doc `dspy-optimization-and-xai-design.md`; this file tracks integration status against the pipeline's own `INTEGRATION.md`, which specifies three required app-side changes.

## STATUS: Steps 2 and (a scoped) XAI build are done and committed locally (2 commits, not yet pushed). isDemo exclusion done and applied to production. Two things need Ivan (or his local terminal) to finish: pushing the commits, and the crons-agents.yml + GitHub secrets change, which this remote session cannot write. Step 1 not started.

### Prerequisite — schema reconciliation (done)

The DSPy tables (`AgentOptimizationRun`, `AgentSkillVersion`) and the three new `ResourceVersion` columns (`editSource`, `editDistance`, `diffSummary`) were originally applied directly to the production Supabase DB via raw SQL, outside Prisma's migration flow. `prisma/schema.prisma` has been updated to declare both new models and the new fields, and a matching migration file (`prisma/migrations/20260826150000_add_dspy_agent_skill_optimization/migration.sql`) has been added documenting exactly what was already applied — including the RLS-enable statements added during the 2026-08-26 security review (see below).

**Still needed before any future `prisma migrate`/`db push`:** run, in order, `npx prisma generate` then `npx prisma migrate resolve --applied 20260826150000_add_dspy_agent_skill_optimization`, then `npx prisma migrate resolve --applied 20260827130000_add_school_is_demo` — otherwise Prisma will try to re-run migrations whose tables/columns already exist and fail. Not yet run.

### Security note — RLS on the new tables

Supabase flagged both new tables (`AgentOptimizationRun`, `AgentSkillVersion`) as missing Row Level Security during a routine advisory check. RLS has since been enabled on both (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, applied 2026-08-26). Since the app connects as the table owner via Prisma, this has no effect on the app itself — it only blocks Supabase's public REST API (anon/authenticated roles) from touching these tables, matching the pattern already used by every other table in the schema.

### Step 1 — Record teacher edits: NOT STARTED

Every time a teacher edits AI-generated content before saving, a `ResourceVersion` row should be written with `editSource: "teacher_edit"`, `editDistance` (string distance from the AI-generated original), and `diffSummary`. This is the signal the optimizer's fast metric partly trains against.

Investigation so far: the two surfaces with both original and edited content already available server-side are `updateIlpTargetText()` and `updateIlpDraft()` in `app/actions/send-support.ts`. `upsertKPlan()` in `app/actions/kplan.ts` would need an added read of the prior value first. Homework questions and AI-generated resources (`Resource` / `GeneratedResource`) have no edit-and-save surface at all yet — instrumenting those would mean building new edit UI first, which is likely out of scope for this pass and should be a separate decision.

### Step 2 — Consume the optimized prompt: DONE (2026-08-27)

`lib/agents/skill-prompt.ts` exposes `resolveSkillFragment(agentType, skillId, fallback)` and `resolveSkillVersion(agentType, skillId)`, wired into all four agents that call Claude directly (`coach.ts`, `quality.ts`, `plan-synthesis.ts`, `engage.ts`). Every lookup degrades gracefully: with zero `AgentSkillVersion` rows (true today), every call resolves `version: 0` and falls back to the existing hardcoded prompt — a no-op on the request path until the first successful weekly run promotes something. This resolution is already per-`(agentType, skillId)` pair, not per-skill.

**Still open:** `lib/agents/evidence-agent.ts` writes no `AgentAuditEntry` at all (pre-existing gap). `EVIDENCE`'s two skills (`SEND_DIFFERENTIATION`, `APDR_CYCLE`) will sit at 0 training examples until this is fixed.

### Multi-agent skill sharing — FIXED (DSPy service side)

The DSPy service's `AGENT_SKILL_MAP` was `skillId -> one agentType`, so a shared skill only ever trained/served one agent — every other agent sharing it permanently fell back to the hardcoded prompt. It also had a correctness bug: `MARKING_CONSISTENCY`/`FEEDBACK_QUALITY` were mapped to `EVIDENCE`, but the app's real usage of both is entirely inside `QUALITY`.

Fixed: `signatures.py`'s `AGENT_SKILL_MAP` is now `skillId -> list[agentType]`, matching `lib/agents/skills/index.ts`'s `AGENT_SKILLS` exactly. `data.py`, `optimize.py`, `weekly_run.py` all take an explicit `agent_type` parameter and optimize each `(skillId, agentType)` pair independently. `metrics.py` was already agent-agnostic.

**Consequence for coverage:** a shared skill now needs `--min-examples` reviewed examples *per agent*, not once total.

### Demo data excluded from DSPy training — DONE (2026-08-27)

Confirmed: `app/api/cron/demo-advance/route.ts` (runs Mondays 00:00 UTC via `crons-monthly.yml`) writes scripted, non-human `AgentAuditEntry.reviewOutcome` values for the demo school every week — straight into the table DSPy trains from, with nothing previously distinguishing it from real reviewed examples.

Fixed:
- Added `School.isDemo` (Boolean, default false) — schema change applied directly to the "Ivan Omnis" Supabase project via the Supabase MCP tool, migration file `prisma/migrations/20260827130000_add_school_is_demo/migration.sql` added to match. The existing demo school (`Omnis Demo School`) is backfilled `isDemo = true` — confirmed via query.
- `dspy-service/data.py`'s three training/validation queries (`fetch_training_examples`, `count_new_reviewed_examples`, `completion_and_progress_window`) now join `School` and filter `isDemo = false`.

### XAI explainability — StudentAiJourney tab: BUILT (2026-08-27)

Per `XAI.md`'s build scope, implemented (not just spec'd):

- `getStudentAiJourney(studentId)` in `app/actions/agent-insights.ts` — schoolId-scoped sweep of every `AgentAuditEntry` for one student, grouped by agent/skill, review-outcome counts, resolved `AgentSkillVersion` instructions per entry's own stamped version (not just the currently-active one), and `ai-decision-support` consent status (school-level `ConsentPurpose` + per-student `ConsentRecord` if one exists).
- `lib/agents/labels.ts` — shared plain-language labels for `AgentType`/`AgentSkillId`, so a parent or inspector reading the output sees "Coach" / "SEND differentiation", not enum names.
- `components/students/AiDecisionExplanation.tsx` — renders one entry using the exact template from `XAI.md`, template-filled from row data (not LLM-narrated, so it can't drift from what actually happened). Includes a collapsible "show the exact instructions this agent was optimized against" section once `AgentSkillVersion` rows exist.
- `components/students/AiJourneyTab.tsx` — the summary + timeline view: consent status card, review-outcome breakdown, skill filter chips, and the full chronological timeline.
- Wired as a new **"AI Journey"** tab on `app/students/[studentId]/page.tsx` (via `StudentFilePanel.tsx`), visible to the same staff roles already on that page (teacher, HOD, HOY, SENCO, SLT, school admin) — not an admin-dashboard feature, per `XAI.md`'s own design.

**Not built:** the DSAR bulk-export (item 4 in `XAI.md`'s build scope — reusing the existing `DataSubjectRequest` export flow to render a student's full AI journey to PDF). Deferred; flag if wanted next.

### Step 3 — Wire `weekly_run.py` into a scheduled job: drafted, blocked on Ivan

`.github/workflows/crons-agents.yml` is protected from remote-device writes (a safety guard against a cloud session silently altering CI) — this session drafted the change but could not write it. The plan: add `dspy-weekly-optimize` as a new step in the existing `cron` job, gated on a new Sunday `'30 2 * * 0'` schedule slot (30 min after `oak-sync`'s `'0 2 * * 0'`, so `CURRICULUM_ALIGNMENT` judging runs against freshly-synced Oak content), with `actions/checkout` + `actions/setup-python` steps added (nothing in this workflow currently checks out the repo — every other step is a pure `curl`). Needs two new GitHub Actions secrets: `DATABASE_URL`, `ANTHROPIC_API_KEY`. Full YAML content given to Ivan directly; not yet applied.

### Delivery and commit state (2026-08-27, updated)

All files this session produced were written directly into this repo (never zipped) via the device bridge, and two commits were made directly on `main` in this local working copy:

- `0d9de5b` — DSPy service (`dspy-service/`), `docs/audit/`, Step 2 wiring, `School.isDemo` + migration.
- `417a35d` — `StudentAiJourney` XAI tab and supporting files.

**Both commits are LOCAL ONLY — `git push` failed from this session** (`Host key verification failed` — this remote device-bridge shell isn't set up with GitHub SSH access, unlike Ivan's own Terminal app). `git status` shows `main...origin/main [ahead 2]`. Ivan needs to run `git push` himself (or via his own local terminal Claude session) to get these onto GitHub.

## Next steps (in order)

1. **Push the 2 local commits** — `git push` from Ivan's own Terminal.app in the `omnis-app` folder (this remote session cannot push).
2. **Add the `dspy-weekly-optimize` step to `.github/workflows/crons-agents.yml`** and **add the `DATABASE_URL`/`ANTHROPIC_API_KEY` GitHub Actions secrets** — both blocked on Ivan (protected file / no push+secrets access from this session). Exact YAML and secret values (already in `.env.local`) given directly to Ivan.
3. Run the three deferred local Prisma commands (`prisma generate`, `prisma migrate resolve --applied 20260826150000_...`, `prisma migrate resolve --applied 20260827130000_add_school_is_demo`), then the usual pre-deploy checklist.
4. Decide scope for Step 1 (which edit surfaces to instrument now vs. defer) and implement.
5. Fix `lib/agents/evidence-agent.ts` to write `AgentAuditEntry` rows.
6. Optional: build the DSAR PDF export for the AI journey (XAI.md item 4).
