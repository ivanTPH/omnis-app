# Omnis — DSPy weekly-optimization + XAI integration (2026-08-27)

Wiring an already-built, standalone DSPy weekly-optimization pipeline (Python service, separate from this repo) into the Next.js app, plus the explainability (XAI) layer it enables. Full design rationale lives in the Claude Project doc `dspy-optimization-and-xai-design.md`; this file tracks integration status against the pipeline's own `INTEGRATION.md`, which specifies three required app-side changes.

## STATUS: All three INTEGRATION.md steps are now done (Step 1 scoped to ILP edits, per Ivan's choice). evidence-agent.ts audit gap fixed. XAI build scope complete (tab + DSAR PDF). Everything committed locally on `main`, not yet pushed — needs `npx prisma generate` (schema changed again) then `git push` from Ivan's own terminal, same as the previous round.

### Prerequisite — schema reconciliation (done, now spans 4 migration files)

The DSPy tables, the `ResourceVersion` edit-tracking columns, `School.isDemo`, and (this round) the `ResourceVersion.resourceId` FK relaxation were all applied directly to the production Supabase DB via the Supabase MCP tool, then reconciled into migration files:
- `20260826150000_add_dspy_agent_skill_optimization`
- `20260827130000_add_school_is_demo`
- `20260827140000_generalize_resourceversion_edit_tracking`

**Before any future `prisma migrate`/`db push`:** run `npx prisma generate`, then `npx prisma migrate resolve --applied <name>` for each of the three migration names above, in order.

### Step 1 — Record teacher edits: DONE (scoped to ILP, per Ivan's choice)

**A real schema gap was found and fixed first:** `ResourceVersion.resourceId` had a hard foreign key to `Resource`, but `INTEGRATION.md`'s own spec writes it for K Plan/ILP edits too (`resourceId: resource.id` in its example is really "whatever got edited", not literally always a `Resource` row). Writing an `IlpTarget.id` there would have violated the FK. Fixed: dropped the FK constraint (table was empty, zero rows, safe) — `resourceId` is now a loose reference, documented in `schema.prisma`.

Implemented:
- `lib/text-diff.ts` — dependency-free `levenshtein()` (char-level, matching how `dspy-service/data.py` normalises `editDistance`) and `summarizeEdit()` (before/after snapshot + distance, not a full line-level diff — sufficient for DSPy's fast metric, which only ever reads `editDistance` itself).
- `updateIlpTargetText()` in `app/actions/send-support.ts` — writes a `ResourceVersion` (keyed by the `IlpTarget.id`) whenever the saved value actually changed.
- `updateIlpDraft()` — writes one `ResourceVersion` per changed field (`currentStrengths`, `areasOfNeed`, `successCriteria`, `strategies`), keyed `"<ilpId>:<field>"` so each field's edit history stays distinguishable.

**Not instrumented this round (deferred, per Ivan's scoping choice):** K Plan (`upsertKPlan()`), homework question editor, "Suggest adaptation" acceptance, resource regeneration — no existing edit-and-save surface for most of these yet.

**Important caveat found, not yet fixed:** none of the four agent files (`coach.ts`, `quality.ts`, `plan-synthesis.ts`, `engage.ts`) ever populate `AgentAuditEntry.inputRefs` — every entry has always been written with the schema default `{}`. This means `dspy-service/data.py`'s join (`ResourceVersion.resourceId = AgentAuditEntry.inputRefs->>'resourceId'`) has nothing to connect to yet, even now that `ResourceVersion` rows exist for ILP edits — and the `AiDecisionExplanation` component's "based on this student's..." sentence never renders (no `inputRefs` to describe) for any existing agent. `lib/agents/evidence-agent.ts`'s new audit entries (below) are the one exception — they do populate `inputRefs`, since they were written from scratch this round. **This is a new, separate follow-up item, not something in scope for Step 1 as originally written** — populating `inputRefs` meaningfully means deciding, per skill/call-site across 4 files, what identifier actually represents "what the agent was given," which is a bigger piece of work than instrumenting edits. Flagged for a future pass.

### Step 2 — Consume the optimized prompt: DONE (previous round)

No change this round.

### `lib/agents/evidence-agent.ts` — FIXED (was the flagged gap)

Previously wrote zero `AgentAuditEntry` rows. Now, for every evidence match it persists (submission ↔ EHCP outcome or ILP target), it writes an `AgentAuditEntry` under `(EVIDENCE, APDR_CYCLE)` — matching the file's own docstring citations (SEND CoP 2015 §6.72 evidence base, §9.2 EHCP outcome evidence trails) — with `skillVersion` resolved via `resolveSkillVersion()` and `inputRefs` populated (`targetId`, `submissionId`, `planType`).

**Deliberately not done:** injecting the resolved `APDR_CYCLE` skill fragment into the matching prompt. `APDR_CYCLE_SKILL`'s fragment is templated for `plan-synthesis.ts`'s whole-package coherence review (placeholders like `{sendStatus}`), not this file's submission-to-outcome matching task — and there's nothing to inject yet regardless (version 0 until the optimizer's first promoted run for this pair). Revisit once there's an actual optimized instruction set and a decision on how to reshape the matching prompt around it.

### XAI explainability — StudentAiJourney tab + DSAR PDF: DONE

Tab (previous round): `getStudentAiJourney()`, `lib/agents/labels.ts`, `AiDecisionExplanation.tsx`, `AiJourneyTab.tsx`, wired into the student file page.

This round — DSAR PDF export (`XAI.md` build-scope item 4):
- `lib/pdf/ai-journey-template.ts` — renders the same `AiJourneySummary` data as an HTML document, following this repo's existing `pdfShell`/`escHtml` PDF-template convention (the same one used by attendance letters, EHCP reviews, etc.).
- `app/api/export/ai-journey-pdf/[dsrId]/route.ts` — resolves the `DataSubjectRequest` → student → `getStudentAiJourney()` → renders via the existing `lib/pdf/generator.ts` puppeteer pipeline (already used by every other PDF export in the app — no new dependency needed).
- Wired into `components/gdpr/DataSubjectRequestList.tsx` as a second "AI Journey PDF" link next to the existing JSON export button, available independent of the DSR's completion status (it's a supplementary artifact, not the act that fulfils the request).
- `app/actions/gdpr.ts`'s `exportStudentData()` (the existing JSON export) now also folds in the full `getStudentAiJourney()` result under an `aiJourney` key, best-effort (a failure there doesn't block the rest of the export).

**Note:** the existing DSAR flow only ever produced JSON before this round — there was no PDF export of any kind for GDPR requests specifically (other PDF exports in the app are for unrelated purposes — attendance letters, EHCP reviews). This is a genuinely new capability, not a reuse of an existing PDF flow, though it does reuse the app's existing PDF *infrastructure*.

### Step 3 — Wire `weekly_run.py` into a scheduled job: DONE (previous round)

`.github/workflows/crons-agents.yml` updated and pushed; `DATABASE_URL`/`ANTHROPIC_API_KEY` secrets set on the repo.

### Demo data excluded from DSPy training: DONE (previous round)

No change this round.

## Commit / push state (2026-08-27, round 2)

One new commit on `main`, local only: `322f5d6` — ILP edit tracking, evidence-agent audit fix, DSAR PDF export. Schema changed again (`ResourceVersion` FK dropped), so **`npx prisma generate` needs to run again** before the pre-push hook's `tsc` check will pass, same as the previous round.

## Next steps

1. From Ivan's own terminal: `npx prisma generate`, then `git push`.
2. Decide whether to tackle the newly-found `inputRefs` gap (all 4 agent files write `{}` — breaks the `ResourceVersion` join and the XAI "based on..." sentence for everything except the new `evidence-agent.ts` entries).
3. Decide whether to extend Step 1 to K Plan / homework / resource-adaptation edit surfaces.
4. Optional: reshape `evidence-agent.ts`'s matching prompt to actually consume an optimized `APDR_CYCLE` instruction set, once one exists.
