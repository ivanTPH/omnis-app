# Omnis — DSPy weekly-optimization + XAI integration (2026-08-27)

Wiring an already-built, standalone DSPy weekly-optimization pipeline (Python service, separate from this repo) into the Next.js app, plus the explainability (XAI) layer it enables. Full design rationale lives in the Claude Project doc `dspy-optimization-and-xai-design.md`; this file tracks integration status against the pipeline's own `INTEGRATION.md`, which specifies three required app-side changes.

## STATUS: Step 2 done (app side). DSPy service source delivered into this repo at `dspy-service/` (untracked, not yet committed). Steps 1 and 3 not started — Step 3 now has a concrete plan below, pending Ivan's decision.

### Prerequisite — schema reconciliation (done)

The DSPy tables (`AgentOptimizationRun`, `AgentSkillVersion`) and the three new `ResourceVersion` columns (`editSource`, `editDistance`, `diffSummary`) were originally applied directly to the production Supabase DB via raw SQL, outside Prisma's migration flow. `prisma/schema.prisma` has been updated to declare both new models and the new fields, and a matching migration file (`prisma/migrations/20260826150000_add_dspy_agent_skill_optimization/migration.sql`) has been added documenting exactly what was already applied — including the RLS-enable statements added during the 2026-08-26 security review (see below).

**Still needed before any future `prisma migrate`/`db push`:** run, in order, `npx prisma generate` then `npx prisma migrate resolve --applied 20260826150000_add_dspy_agent_skill_optimization` — otherwise Prisma will try to re-run a migration whose tables/columns already exist and fail. Not yet run.

### Security note — RLS on the new tables

Supabase flagged both new tables (`AgentOptimizationRun`, `AgentSkillVersion`) as missing Row Level Security during a routine advisory check. RLS has since been enabled on both (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, applied 2026-08-26). Since the app connects as the table owner via Prisma, this has no effect on the app itself — it only blocks Supabase's public REST API (anon/authenticated roles) from touching these tables, matching the pattern already used by every other table in the schema.

### Step 1 — Record teacher edits: NOT STARTED

Every time a teacher edits AI-generated content before saving, a `ResourceVersion` row should be written with `editSource: "teacher_edit"`, `editDistance` (string distance from the AI-generated original), and `diffSummary`. This is the signal the optimizer's fast metric partly trains against.

Investigation so far: the two surfaces with both original and edited content already available server-side are `updateIlpTargetText()` and `updateIlpDraft()` in `app/actions/send-support.ts`. `upsertKPlan()` in `app/actions/kplan.ts` would need an added read of the prior value first. Homework questions and AI-generated resources (`Resource` / `GeneratedResource`) have no edit-and-save surface at all yet — instrumenting those would mean building new edit UI first, which is likely out of scope for this pass and should be a separate decision.

### Step 2 — Consume the optimized prompt: DONE (2026-08-27)

Added `lib/agents/skill-prompt.ts`, the app's single consumer of `AgentSkillVersion`. It exposes:

- `resolveSkillFragment(agentType, skillId, fallbackFragment)` — looks up the active optimized version for a `(agentType, skillId)` pair and returns its instructions + worked examples as a prompt fragment, or the hardcoded fallback if nothing has been promoted yet.
- `resolveSkillVersion(agentType, skillId)` — resolves just the version number, for stamping `AgentAuditEntry.skillVersion` at call sites with no separate injectable prompt slot.

Wired into all four agents that call Claude directly:

- **`lib/agents/coach.ts`** — `RETRIEVAL_SPACING` fragment resolved before the Haiku call; `skillVersion` resolved per skill at audit-write time (`RETRIEVAL_SPACING`, `BLOOMS_ANALYSIS`).
- **`lib/agents/quality.ts`** — all five skill fragments (`BLOOMS_ANALYSIS`, `CURRICULUM_ALIGNMENT`, `SEND_DIFFERENTIATION`, `MARKING_CONSISTENCY`, `FEEDBACK_QUALITY`) resolved in parallel before the combined system prompt is built; `skillVersion` resolved per skill in the shared `push()` audit helper.
- **`lib/agents/plan-synthesis.ts`** — `APDR_CYCLE` and `SEND_DIFFERENTIATION` fragments resolved in parallel; `skillVersion` resolved per skill in the shared `push()` audit helper.
- **`lib/agents/engage.ts`** — `ENGAGEMENT_DESIGN` fragment resolved before the Haiku call; `skillVersion` resolved for both `ENGAGEMENT_DESIGN` and the standalone `RETRIEVAL_SPACING` audit entry.

Every lookup degrades gracefully: with zero `AgentSkillVersion` rows (true today — the optimizer has never run), every call resolves `version: 0` and falls back to the existing hardcoded prompt, so this change is a no-op on the request path until the first successful weekly run promotes something.

This resolution is already per-`(agentType, skillId)` pair, not per-skill — no app-side change was needed for the multi-agent fix below, since `skill-prompt.ts` was built against the schema's real `@@unique([agentType, skillId, version])` constraint from the start.

**Still open:** `lib/agents/evidence-agent.ts` writes no `AgentAuditEntry` at all (pre-existing gap, unrelated to this integration). This now matters more than it did on 2026-08-26: with the multi-agent fix below, `EVIDENCE`'s two skills (`SEND_DIFFERENTIATION`, `APDR_CYCLE`) are correctly targeted for their own independent optimization, but will sit at 0 training examples and never reach the weekly run's `--min-examples` threshold until `evidence-agent.ts` actually writes audit entries. Worth fixing before those two pairs can ever benefit.

### Multi-agent skill sharing — FIXED (2026-08-27, DSPy service side)

Ivan flagged that leaving only one agent able to benefit from a shared skill's optimization was a missed opportunity — the right instructions/demonstrations for, say, `SEND_DIFFERENTIATION` when drafting a homework question (COACH) are legitimately not the same as for `SEND_DIFFERENTIATION` when selecting evidence (EVIDENCE) or drafting an ILP target (PLAN_SYNTHESIS), even though it's the same skill/signature.

What was actually wrong: the DSPy service's `signatures.py` had `AGENT_SKILL_MAP` as `skillId -> one agentType` (a single string), so `data.py`/`optimize.py` only ever trained and served one agent's version of a shared skill — every other agent sharing that skill permanently fell back to the hardcoded prompt, with no path to ever earn its own optimization. It also had a real correctness bug on top of the design gap: `MARKING_CONSISTENCY` and `FEEDBACK_QUALITY` were mapped to `EVIDENCE`, but the app's real usage of both is entirely inside `QUALITY` (`lib/agents/skills/index.ts`'s `AGENT_SKILLS` table) — `EVIDENCE` never calls either skill, so those two pairs would never have accumulated training data at all under the old mapping.

Fixed in the DSPy service:

- `signatures.py` — `AGENT_SKILL_MAP` is now `skillId -> list[agentType]`, matching `lib/agents/skills/index.ts`'s `AGENT_SKILLS` exactly (including the `MARKING_CONSISTENCY`/`FEEDBACK_QUALITY` → `QUALITY` correction). Added `agent_skill_pairs()`, flattening the map into every `(skillId, agentType)` pair that needs its own optimization target.
- `data.py` — every function (`fetch_training_examples`, `count_new_reviewed_examples`, `get_active_version`, `write_skill_version`, `completion_and_progress_window`) now takes an explicit `agent_type` parameter instead of deriving it from a single-owner lookup, so each pair reads/writes only its own rows.
- `optimize.py` — `optimize_skill(skill_id, agent_type, ...)` now optimizes one specific agent's use of a skill per call, scored against only that agent's own baseline/active version.
- `weekly_run.py` — iterates `signatures.agent_skill_pairs()` instead of skill IDs alone; added an `--agents` filter alongside the existing `--skills` one; the run summary and the slow-metric regression check are now keyed per `agentType/skillId` pair.
- `metrics.py` — unchanged; it was already agent-agnostic (operates on the DSPy example/prediction, never looks at `AGENT_SKILL_MAP`).
- `README.md`, `DESIGN.md` (new "Multi-agent skill sharing" section), `INTEGRATION.md` (step 2 note) updated to describe the corrected per-pair behaviour and the `EVIDENCE` training-data caveat above.

**Consequence for coverage:** a shared skill now needs `--min-examples` reviewed examples *per agent*, not once total, before that agent's pair gets its first optimization pass — an agent using a skill lightly will take longer to accumulate enough signal than one using it heavily, even for the same skillId. That's expected, not a regression.

**Delivery (2026-08-27, updated):** the corrected source has now been placed directly in this repo at `dspy-service/` — `signatures.py`, `data.py`, `optimize.py`, `weekly_run.py`, `metrics.py`, `README.md`, `DESIGN.md`, `INTEGRATION.md`, `XAI.md`, `requirements.txt`, `db/001_dspy_tables.sql`. Delivered as individual files committed straight into the connected repo folder (not a zip). `git status` shows the folder as untracked (`??`) — not yet `git add`/committed, left for Ivan or a future session to commit deliberately. It is still not deployed anywhere (no cron runs it yet) — see Step 3 below for the concrete plan.

### Step 3 — Wire `weekly_run.py` into a scheduled job: plan decided, not yet implemented

This deployment runs on GitHub Actions cron workflows that `curl` deployed `/api/cron/*` routes with `CRON_SECRET` — there is no separate always-on worker or Coolify-side cron. Three existing workflow files split jobs by cadence:

- `.github/workflows/crons-agents.yml` — includes `oak-sync`, gated on `github.event.schedule == '0 2 * * 0'` (Sunday 02:00 UTC). This is the natural anchor: `INTEGRATION.md` calls for `weekly_run.py` to run *after* Oak sync, so `CURRICULUM_ALIGNMENT` judging happens against freshly-synced content.
- `.github/workflows/crons-weekly.yml` — other Mon–Fri and weekly app-cron routes (`review-due`, `teacher-digest`, `apdr-review`, etc.) — not the right home, none of it relates to the optimizer.
- `.github/workflows/crons-monthly.yml` — despite the filename, this is also where `demo-advance` lives (`cron: '0 0 * * 1'`, Monday 00:00 UTC) alongside genuinely monthly jobs. Confirmed by direct read — not the right home either.

**Recommendation:** add a new step to the `cron` job in `crons-agents.yml`, gated on the same `'0 2 * * 0'` schedule as `oak-sync` (or its own new weekly schedule slot a little later, e.g. `0 3 * * 0`, so it doesn't race the Oak sync's `--max-time 310`), that checks out the repo and runs the Python service directly — the first job in this workflow to need `actions/checkout`, since every existing step is a pure `curl` against the deployed app:

```yaml
      - name: dspy-weekly-optimize
        if: github.event.schedule == '0 3 * * 0' || github.event_name == 'workflow_dispatch'
        run: |
          pip install -r dspy-service/requirements.txt
          python dspy-service/weekly_run.py
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

plus `actions/checkout@v4` and `actions/setup-python@v5` steps added near the top of the job (currently absent — nothing else in this workflow needs the repo checked out). Requires two new GitHub Actions secrets Ivan will need to add himself (`DATABASE_URL` pointing at the same Supabase Postgres instance Prisma uses, and `ANTHROPIC_API_KEY` for DSPy's judge LM) — I can't add repo secrets from here. This matches `INTEGRATION.md`'s own "simplest option" and needs no new infrastructure (no separate host/worker to run and pay for).

**Not yet done:** the actual workflow-file edit, and the two secrets. Waiting on Ivan to confirm this is the right home before editing `crons-agents.yml`.

### Demo data and DSPy training — investigated, open question

Confirmed: the demo/synthetic environment is **not** a separate database — it's the same production Supabase project, same `AgentAuditEntry` table, filtered only by `schoolId`. `app/api/cron/demo-advance/route.ts` runs weekly (Monday 00:00 UTC, via `crons-monthly.yml`'s `demo-advance` step) and, among other synthetic activity, auto-confirms 4 and auto-dismisses 1 of the oldest 6 unreviewed `AgentAuditEntry` rows for the demo school (`prisma.school.findFirst({ where: { OR: [{ name: 'Omnis Demo School' }, { emailDomain: 'omnisdemo.school' }] } })`) — i.e. it writes scripted, non-human `reviewOutcome` values into exactly the table `data.py`'s `fetch_training_examples` reads from.

There is no `isDemo` flag on `School`, so nothing in the DSPy service currently distinguishes real reviewed-by-a-human examples from these scripted demo ones. **So: yes, demo/synthetic activity does exercise this part of the app today, but as a data-quality risk rather than a deliberate test path** — scripted auto-confirm/dismiss isn't a genuine training signal and would currently get mixed into real optimization runs undetected.

**Options, not yet decided:**
1. Add an explicit exclusion to `data.py`'s queries — join to `School` and filter `WHERE s."name" != 'Omnis Demo School' AND s."emailDomain" != 'omnisdemo.school'` (or, cleaner, add a real `isDemo boolean` column to `School` and filter on that instead, which would also help other parts of the app that may have the same problem).
2. Leave it as-is deliberately, on the reasoning that scripted confirm/dismiss is still a plausible (if crude) training signal and demo volume is small relative to real schools.

Leaning toward option 1 (with the `isDemo` column, since a name/domain string match is brittle) — flagged here for Ivan to confirm before touching `data.py`.

### XAI surface — investigated, not yet built

Per `XAI.md`'s own design and confirmed against the live route structure: the explainability feature is **not** an admin-dashboard feature. `app/students/[studentId]/page.tsx` (gated `requireAuth(['TEACHER','HEAD_OF_DEPT','HEAD_OF_YEAR','SENCO','SLT','SCHOOL_ADMIN'])`) is a thin server wrapper that loads `getStudentFile(studentId)` and renders `components/students/StudentFilePanel.tsx`, the actual client component with the student's tabs/sections (K Plan, ILP, evidence, etc.). The new `StudentAiJourney` tab belongs there, visible to the same staff roles already permitted on that page — any teacher, HOD, HOY, SENCO, SLT or school admin looking at a student's file, not just admins.

Separately, `app/admin/gdpr` (plus `app/api/export/gdpr-audit`, `app/api/export/gdpr-data`) is the existing DSAR/GDPR bulk-export area — `XAI.md` proposes reusing that flow for a bulk "explain everything about this student's AI-assisted decisions" export, which is a genuinely admin-facing, separate concern from the per-student in-context explanation tab. Both are unbuilt so far — `XAI.md` is a design spec only; no `getStudentAiJourney` action, no `StudentAiJourney` tab, and no `AiDecisionExplanation` renderer exist in the repo yet.

## Next steps

1. Ivan confirms: (a) the `crons-agents.yml` Step 3 plan above, (b) the demo-data exclusion approach for `data.py` (isDemo column vs. name/domain filter vs. leave as-is), (c) whether to build the `StudentAiJourney` tab now or treat XAI as a fully separate follow-up piece of work.
2. Run the three deferred local commands (`prisma generate`, `prisma migrate resolve --applied ...`, then the usual pre-deploy checklist) and commit/deploy the Step 2 app-side changes, plus `git add dspy-service/` once Ivan is ready to track it.
3. Decide scope for Step 1 (which edit surfaces to instrument now vs. defer) and implement.
4. Fix `lib/agents/evidence-agent.ts` to write `AgentAuditEntry` rows, so `EVIDENCE`'s two skills can ever accumulate training data.
5. Once (1a) is confirmed, edit `crons-agents.yml` and add the two GitHub Actions secrets.
6. Once (1b) is confirmed, implement the demo-data exclusion in `data.py`.
7. Once (1c) is confirmed, build `getStudentAiJourney`, the `StudentAiJourney` tab in `StudentFilePanel.tsx`, and the `AiDecisionExplanation` renderer.
