# Omnis — DSPy weekly-optimization + XAI integration (2026-08-27)

Wiring an already-built, standalone DSPy weekly-optimization pipeline (Python service, separate from this repo) into the Next.js app, plus the explainability (XAI) layer it enables. Full design rationale lives in the Claude Project doc `dspy-optimization-and-xai-design.md`; this file tracks integration status against the pipeline's own `INTEGRATION.md`, which specifies three required app-side changes.

## STATUS: All three INTEGRATION.md steps done. evidence-agent.ts audit gap fixed. XAI build scope complete (tab + DSAR PDF). inputRefs now populated across all 4 agents. Everything committed locally on `main`, 2 commits not yet pushed — needs `npx prisma generate` then `git push` from Ivan's own terminal.

### A mistake made and fixed this round, flagged plainly

Dropping `ResourceVersion.resourceId`'s foreign key (to make it usable for ILP edits, see below) required also removing `Resource.versions ResourceVersion[]` — the reverse side of that same relation. That second half was missed initially, got committed (`5f0f526`) and pushed to `main` before the mistake was caught (a Prisma schema validation error surfaced when Ivan ran `npx prisma generate` locally). **This briefly left `main` in a state where `prisma generate` would fail** — a real risk if a deploy pipeline runs it at build time. Fixed immediately in `f5e4ff4`, one commit later, same session. Worth knowing: this is the second schema-adjacent slip this session (the first was catching the FK issue itself before it shipped) — the underlying process gap is that `npx prisma generate`/`prisma validate` can't be run from this session's device-bridge shell (no network route to Prisma's engine-checksum CDN from that sandboxed VM, confirmed by a 403), so schema changes made through the bridge go un-validated until Ivan's own terminal catches them. Something to watch for in future schema-touching work — validate via Ivan's terminal (or ask him to run `npx prisma validate`) before or immediately after any schema.prisma edit, not only at the end of a batch.

### Prerequisite — schema reconciliation (4 migration files now)

- `20260826150000_add_dspy_agent_skill_optimization`
- `20260827130000_add_school_is_demo`
- `20260827140000_generalize_resourceversion_edit_tracking`

**Before any future `prisma migrate`/`db push`:** run `npx prisma generate`, then `npx prisma migrate resolve --applied <name>` for each of the three migration names above, in order.

### Step 1 — Record teacher edits: DONE (scoped to ILP, per Ivan's choice)

Fixed a real schema gap first: `ResourceVersion.resourceId` had a hard FK to `Resource` only; `INTEGRATION.md`'s own spec needs it for ILP/K-Plan edits too. Dropped the FK (table was empty — safe), documented as a loose reference in `schema.prisma`.

- `lib/text-diff.ts` — dependency-free `levenshtein()` + `summarizeEdit()` (before/after snapshot + char distance).
- `updateIlpTargetText()` and `updateIlpDraft()` in `app/actions/send-support.ts` now write `ResourceVersion` rows on real changes.

**Not instrumented (deferred):** K Plan, homework question editor, resource adaptation/regeneration.

### `lib/agents/evidence-agent.ts` — FIXED

Now writes an `AgentAuditEntry` under `(EVIDENCE, APDR_CYCLE)` for every evidence match it persists, with `inputRefs` (`targetId`, `submissionId`, `planType`) populated from the start — it's new code, so it didn't inherit the gap below.

### `AgentAuditEntry.inputRefs` — the gap found last round, now fixed for all 4 agents

**What was wrong:** none of `coach.ts`, `quality.ts`, `plan-synthesis.ts`, `engage.ts` had ever populated `inputRefs` — every existing audit entry has the schema default `{}`. Consequences: `dspy-service/data.py`'s `ResourceVersion` join had nothing to connect to, and `AiDecisionExplanation.tsx`'s "based on this student's..." sentence never rendered anything for any pre-existing entry.

**What was fixed:** every `writeAuditEntry`/`push` call site across all 4 files now takes an optional `inputRefs` param and passes through whatever identifying context is genuinely available there — submission ids (`coach.ts` RETRIEVAL_SPACING/BLOOMS_ANALYSIS, `quality.ts` MARKING_CONSISTENCY/FEEDBACK_QUALITY), topics (`coach.ts`, `engage.ts` ENGAGEMENT_DESIGN/RETRIEVAL_SPACING), and descriptive text arrays where no id exists yet (`plan-synthesis.ts` APDR_CYCLE/SEND_DIFFERENTIATION — `preChecks` only tracks ILP-target *descriptions*, not ids, at that point in the code).

**Deliberately NOT done — and worth understanding why before touching this again:** `dspy-service/signatures.py`'s actual `dspy.InputField` names per skill (e.g. `RetrievalSpacing` wants `weak_topic` + `prior_attempt_summary` as two *scalar* fields, not an array) don't match what got wired in here, and can't cleanly — several of these audit entries are one aggregated write per agent run (e.g. one `RETRIEVAL_SPACING` entry covering *all* weak topics at once), while the DSPy signature wants one example *per topic*. Properly aligning the two means restructuring several agents to write one audit entry per instance rather than one per run — a bigger, riskier change than populating `inputRefs` with best-available context, deliberately not attempted this round. What's shipped now is a real improvement (the XAI sentence renders, and `data.py`'s per-string-field extraction picks up whatever scalar fields exist) but not the final shape.

### XAI explainability — StudentAiJourney tab + DSAR PDF: DONE

Tab (`getStudentAiJourney()`, `lib/agents/labels.ts`, `AiDecisionExplanation.tsx`, `AiJourneyTab.tsx`) plus DSAR PDF export (`lib/pdf/ai-journey-template.ts`, `app/api/export/ai-journey-pdf/[dsrId]/route.ts`, wired into `DataSubjectRequestList.tsx` and folded into the existing JSON export in `app/actions/gdpr.ts`).

### Step 3 — Wire `weekly_run.py` into a scheduled job: DONE

`.github/workflows/crons-agents.yml` updated and pushed; `DATABASE_URL`/`ANTHROPIC_API_KEY` secrets set.

### Demo data excluded from DSPy training: DONE

`School.isDemo` + `dspy-service/data.py` filters.

## Commit / push state (2026-08-27, round 3)

`main` is 2 commits ahead of `origin/main`: `f5e4ff4` (schema fix) and `2d8ae24` (inputRefs). Needs `npx prisma generate` then `git push` from Ivan's terminal.

## Next steps

1. Push (see above).
2. Decide whether to take on the harder inputRefs-to-signature-field-name alignment (would change audit-write granularity in several agents).
3. Decide whether to extend Step 1 to K Plan / homework / resource-adaptation edit surfaces.
4. Continue the hardening phase: resilience audit (error handling / fallback behaviour across agents and crons), performance audit (query profiling), or a fresh security re-sweep — none started yet.
