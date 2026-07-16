# Phase 5.4 — Multi-Tenancy Isolation Audit

**Date:** 10 July 2026
**Method:** Static audit of `app/actions/` (52 files) against the actual live repo
(`/Users/ivan-imac/omnis-app`, confirmed via `.git` and current `CLAUDE.md`).
Correction: an earlier attempt targeted `omnis-files/`, which turned out to be an
unrelated early install-script scaffold (16-model schema, no `.git`) and not the
live codebase — that path has since been moved out of the way and this audit
re-run against the real repo.

## Step 1 — Broad sweep

Ran the audit command from the Trial Readiness Plan (§4.1):
```
grep -r "prisma\." app/actions/ | grep -v "schoolId" | grep -v "//"
```
This produced 1,201 raw lines — too noisy to be useful on its own, because most
Prisma calls in this codebase are formatted across multiple lines (the `where`
clause with `schoolId` often sits several lines below the `prisma.model.method(`
call). A single-line grep flags nearly every multi-line query as a false
positive.

## Step 2 — Per-file ratio scan

Better signal: prisma call count vs. `schoolId` mention count per file, to find
files with structurally *zero* tenant scoping rather than just multi-line
formatting noise.

Lowest-ratio files identified: `send-scorer.ts` (8 calls / 0 schoolId),
`parent.ts` (3 / 0), `accessibility.ts` (2 / 0), `revision.ts` (17 / 2),
`oak.ts` (7 / 3).

## Step 3 — Manual read-through of each flagged file

| File | Verdict | Reasoning |
|---|---|---|
| `send-scorer.ts` | **False positive — correct as-is** | Scores `OakLesson` content (national curriculum, shared across all schools by design) and `SendQualityScore` keyed on `oakLessonSlug`, not student data. Rate-limited "across all schools" intentionally (line 176 comment). No school-specific data touched. |
| `parent.ts` | **False positive — correctly scoped, just not by schoolId** | `sendParentMessage` checks `role !== 'PARENT'` then loads the conversation with `where: { id: conversationId, parentId: userId }` — ownership-scoped to the calling parent, which is sufficient (a parent can never reach a conversation that isn't theirs regardless of school). |
| `revision.ts` | **False positive — correctly scoped, consistent pattern** | Every function explicitly ignores any client-supplied `_studentId` param (visible in the code as a leading underscore) with an inline comment "Security: always use session user ID, never trust client-provided studentId", then re-derives `studentId = user.id`. Cross-record actions (`markSessionComplete`, `skipSession`) additionally check `session.studentId !== user.id` before acting. This is a genuinely good, consistently-applied pattern worth reusing elsewhere. |
| `population.ts` | **False positive — my own quick-scan misread it** | Properly scoped: `const { schoolId, role } = await requireAuth()` then both Prisma calls use `where: { schoolId, ... }`. Flagged initially only because a narrow regex undercounted. Recorded here as a reminder that the ratio scan is a triage tool, not a verdict — every flagged file needs an actual read. |
| `oak.ts` | Not fully reviewed this pass | Same pattern expected as `send-scorer.ts` (global Oak content) but not manually confirmed — follow-up item. |
| `accessibility.ts` | **Real finding — see below** | |

## Finding: `getAccessibilitySettings()` has no internal auth check (Low severity)

`app/actions/accessibility.ts`, line 20:

```ts
export async function getAccessibilitySettings(userId: string): Promise<AccessibilitySettings> {
  ...
  return await unstable_cache(() => fetchAccessibilitySettings(userId), ...)()
}
```

Unlike `saveAccessibilitySettings` in the same file (which explicitly discards
its `_userId` parameter and re-derives the id from `requireAuth()` — the same
good pattern seen in `revision.ts`), `getAccessibilitySettings` takes `userId`
directly with no `requireAuth()` call and no check that it matches the calling
session. Both current call sites (`app/layout.tsx:39`, `app/settings/accessibility/page.tsx:11`)
pass their own session's `user.id`, so it is **not exploitable through any
current UI path**. But because this is an exported `'use server'` Server
Action, it is directly invocable with arbitrary arguments if the client-side
reference is called out of band — there is no defence if a new call site is
added carelessly in future.

**Data at risk:** accessibility preferences only (dyslexia font, contrast,
text size, motion, line spacing) — not grades, SEND status, or any special
category data. Severity: **Low**.

**Recommended fix:** mirror the pattern already used in `saveAccessibilitySettings`
— ignore the passed `userId`, call `requireAuth()`, and use the session's own id.

## Coverage note

This pass covered the 5 lowest-ratio files by static heuristic plus manual
verification of each. It did **not** exhaustively review all 52 files in
`app/actions/`. Recommended next step: extend this same read-through to the
remaining files, prioritising ones handling SEND/EHCP/safeguarding data
(`send-support.ts`, `safeguarding.ts`, `ehcp.ts`, `students.ts`) given their
sensitivity, even though their schoolId ratios looked healthy in the triage
scan.

## Live cross-tenant test

Not yet run — requires two seeded synthetic schools side by side (see item
5.1/5.3) and a logged-in session per school to confirm no data crosses at
runtime, not just in the query code. Outstanding.
