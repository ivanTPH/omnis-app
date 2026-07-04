# Omnis UAT — Diagnosis & Fix Log (dmox)

> Session: 2026-07-01. Multi-role browser UAT on omnis-app-ten.vercel.app.
> Format: observation → root cause → fix applied → files changed.

---

## 1. AI Goals Generation Failure (SENCo — Mia Adams)

**Observed:** Clicking "Auto-Generate ILP" → spinner → "AI returned unexpected format — try again" error banner.

**Root cause:** `generateIlpGoalsForStudent` in `app/actions/send-support.ts` (line 3918–3920):
```ts
const raw   = (msg.content[0] as ...).text.trim()
const match = raw.match(/\[[\s\S]*\]/)
if (!match) return { ok: false, error: 'AI returned unexpected format — try again' }
```
Claude (sonnet-4-6) sometimes prepends explanatory text before the JSON array, or returns a JSON object `{ "goals": [...] }` instead of a bare array. The regex finds no match → error surfaced to user.

**Fix:** Multi-strategy JSON extraction:
1. Strip markdown fences (` ```json ... ``` `)
2. Try `JSON.parse(stripped)` — handles bare array AND wrapped object `{goals:[...]}`
3. Fallback: regex extract first `[...]` from text
4. User-facing error changed to "Could not generate goals — please try again."

**Files:** `app/actions/send-support.ts` lines 3918–3927
**Commit:** 6643824

---

## 2. HOD "SEND Concerns" and "Early Warning" — Silent Redirect

**Observed:** HOD clicks "SEND Concerns" in sidebar → instantly redirected to `/hod/dashboard` with no message.

**Root cause:**
- `auth.config.ts` `ROLE_ROUTES`: `/senco` prefix only allows `['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR']`
- `HEAD_OF_DEPT` is NOT in this list
- `components/Sidebar.tsx` HOD nav had two links to `/senco/concerns` and `/senco/early-warning`
- Middleware matched the prefix and silently redirected

**Fix:** Removed the two dead links from the `HEAD_OF_DEPT` sidebar section. HOD already has access to SEND data through the analytics and class roster routes.

**Files:** `components/Sidebar.tsx`
**Commit:** 6643824

---

## 3. Resource Library Duplicates

**Observed:** Resource library (`/resources`) showed the same Oak lesson or uploaded file 3–5× — once per lesson it was attached to.

**Root cause:** `getFullResourceLibrary` in `app/actions/lessons.ts` queries `prisma.resource.findMany` with no deduplication. Each `Resource` record has a `lessonId` FK — adding the same URL to 5 lessons creates 5 records. The library returns all 5.

**Fix:** Post-query deduplication by `url ?? fileKey ?? label`, keeping the entry with the highest `sendScore`:
```ts
const seen = new Map<string, ResourceLibraryItem>()
for (const item of mapped) {
  const key = item.url ?? item.fileKey ?? item.label
  const existing = seen.get(key)
  if (!existing || (item.sendScore ?? -1) > (existing.sendScore ?? -1)) {
    seen.set(key, item)
  }
}
return Array.from(seen.values())
```

**Files:** `app/actions/lessons.ts`
**Commit:** 6643824

---

## 4. Student Draft Answers Not Persisted

**Observed:** Student starts writing a homework answer, closes the tab / navigates away, then returns — answer is gone.

**Root cause:** `HomeworkSubmissionView` only wrote to localStorage immediately before the network submit (as a backup in case submission fails). There was no auto-save while typing, and no restoration from localStorage on mount.

**Fix:**
- On mount: restore from `localStorage.getItem('hw-draft-${hw.id}')` if no submission yet
- On `onChange`: debounced 500ms save to localStorage
- On submit success: `localStorage.removeItem(draftKey)`

**Files:** `components/HomeworkSubmissionView.tsx`
**Commit:** b3826a7

---

## 5. AI Homework Generation Progress Bar Below Fold

**Observed:** Teacher clicks "Generate content" in homework creator step 3. The button shows "Generating…" but after the wizard content scrolls, the button is below the fold and the teacher thinks nothing is happening.

**Root cause:** The loading indicator was only in the button text. The modal (`max-h-[92vh] overflow-y-auto`) can scroll, pushing step 3's button below the viewport.

**Fix:** Added a sticky banner directly below the modal's sticky header (`top-[73px]`) that appears whenever `loading` is true:
```tsx
{loading && (
  <div className="sticky top-[73px] z-10 bg-blue-50 border-b border-blue-100 px-6 py-2 flex items-center gap-2">
    <Icon name="refresh" size="sm" className="animate-spin text-blue-600 shrink-0" />
    <span className="text-[13px] text-blue-700 font-medium">
      {genElapsed < 10 ? 'Generating homework…' : ...}
    </span>
  </div>
)}
```

**Files:** `components/homework/HomeworkCreatorV2.tsx`
**Commit:** b3826a7

---

## 6. "Differentiate" Button Not Prominent in Marking View

**Observed:** Teachers with SEND students in class miss the "Differentiate" button — it blends into the filter bar.

**Root cause:** Button styled as ghost `bg-indigo-50 border border-indigo-200 text-indigo-700` — looks like an optional chip rather than a primary action.

**Fix:** Changed to solid primary: `bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`.

**Files:** `components/HomeworkMarkingView.tsx`
**Commit:** 13b15d1

---

## 7. Parent Dashboard: No Grade Trend/Trajectory

**Observed:** Parent sees "Grade 6" for English but has no sense of whether that's improving or declining.

**Root cause:** `subjectAverages` was computed as a flat mean of all graded submissions — no chronological analysis.

**Fix:** Compute `trend: 'up' | 'down' | 'stable'` alongside the average. Sort submissions by `submittedAt`, compare avg of last 2 vs avg of 2 before that (requires ≥4 graded). Render `trending_up` (green) or `trending_down` (rose) icon next to grade pill when trend is non-stable.

**Files:** `app/parent/dashboard/page.tsx`
**Commit:** 13b15d1

---

## 8. Teacher SEND Caseload: Broken Concern Links + No ILP Shortcut

**Observed:** Teacher on `/send-caseload` sees SEND student with no ILP. Clicks "Raise concern" → redirected to `/hod/dashboard` (or `/dashboard`). No way to notify SENCO inline.

**Root cause:** `components/teacher/SendCaseloadPanel.tsx` had three links to `/senco/concerns`. TEACHER role is not in the `/senco` prefix allowed list in `auth.config.ts` (only SENCO/SLT/SCHOOL_ADMIN/HEAD_OF_YEAR). All three links silently redirected.

The `raiseConcern()` server action DOES allow TEACHER role (line 278 of send-support.ts) — the page just lacked an accessible entry point.

**Fix:**
- Added `RaiseConcernModal` client component — category dropdown, description textarea, calls `raiseConcern()` server action, shows "SENCO notified" confirmation
- Per-student "Raise concern" action button opens the modal
- Students with no ILP get "Notify SENCO to create ILP →" with pre-filled description
- Removed broken panel-level `/senco/concerns` navigation link
- `RaiseConcernModal` props: `{ student, defaultDescription?, onClose }`

**Files:** `components/teacher/SendCaseloadPanel.tsx`
**Commit:** ae7ff86

---

## Not Fixed / Won't Fix

| Item | Reason |
|------|--------|
| "Q X of Y" progress indicator | Already exists in `HomeworkTypeRenderer` at lines 131 + 377. Tester was likely on EXTENDED_WRITING homework (plain textarea, no stepper). No action needed. |
| Calendar refresh after lesson save | `saveOverview` calls `router.refresh()` which propagates to WeeklyCalendar via `lessons` prop change. Works on current week. Non-current weeks re-fetch on nav. Low impact. |
| Adaptive ILP/EHCP evidence rates | haiku detection works but has false negatives at grade 4. Requires prompt tuning — not a UI bug. |

---

## 9. AI ILP Goals Generation Fails 100% of the Time

**Observed:** SENCO clicks 'AI Goals' for any student. Spinner shows for 5-8s then 'Could not generate goals — please try again.' on every attempt.

**Root cause:** max_tokens: 600 was too low for 3 full SMART ILP targets. claude-sonnet-4-6 outputs each target with a ~50-word description, ~30-word success criteria, and ~40-word teacher strategy. Three targets with JSON structure required ~700-900 tokens. The response was truncated mid-array, causing JSON.parse to throw silently and falling through to the error branch. No exception was raised — Claude returned HTTP 200 but with incomplete JSON.

**Fix:**
- max_tokens: 600 → 1200 in generateIlpGoalsForStudent (send-support.ts line ~3928)
- export const maxDuration = 60 added to app/senco/ilp/page.tsx so Vercel Lambda allows enough time for the Claude Sonnet call

**Files:** app/actions/send-support.ts, app/senco/ilp/page.tsx
**Commit:** 2ae51ed

---

## 10. Lesson Resource Search Showing Duplicate Entries

**Observed:** Searching 'An Inspector' in lesson Resources tab returns 3 identical copies of 'An Inspector Calls — Act 1 Slides.pptx'.

**Root cause:** getSchoolResourceLibrary returned all Resource records matching the subject filter — one record per lesson the file was attached to. getFullResourceLibrary (used on /resources page) already had dedup logic but getSchoolResourceLibrary (used in UnifiedResourceSearch) did not.

**Fix:** Added same dedup logic to getSchoolResourceLibrary: iterate rows, key by url ?? fileKey ?? label, keep the copy with the highest sendScore. Also increased take from 60 to 120 to compensate for pre-dedup volume.

**Files:** app/actions/lessons.ts
**Commit:** 2ae51ed

---

## 11. HOD Quick Access 'SEND Concerns' Link Causes Silent Redirect

**Observed:** HOD (d.brooks) clicks 'SEND Concerns' in the Dashboard Quick Access section and lands back on the HOD dashboard instead of the SEND concerns page.

**Root cause:** /senco/concerns requires SENCO/SLT/SCHOOL_ADMIN/HEAD_OF_YEAR per auth.config.ts ROLE_ROUTES. HEAD_OF_DEPT is not in that list. The middleware silently redirects to getRoleHome(role) = /hoy/dashboard... wait, actually to /hod/dashboard. This caused user confusion — looked like the sidebar 'Staff Overview' was broken (BUG-006).

**Fix:** Replaced 'SEND Concerns' → /senco/concerns with 'SEND Students' → /send-caseload in the HOD Dashboard Quick Access grid. /send-caseload IS accessible to HEAD_OF_DEPT.

**Files:** app/hod/dashboard/page.tsx
**Commit:** 2ae51ed

---

## 12. TA SEND Students Page: ILP Targets All Show as Empty

**Observed:** TA navigates to /ta/send-students. Page loads but shows 'No active ILP targets' for all SEND students.

**Root cause:** getTaSendStudents used lowercase status values ('active', 'under_review') when querying IndividualLearningPlan. ILPStatus is a Prisma enum defined with uppercase values (ACTIVE, UNDER_REVIEW). Prisma silently returns no results when an enum filter value does not match exactly. The same bug existed in getTaNotes (line 218).

**Fix:** Changed status filter to uppercase in both functions: ['active', 'under_review'] → ['ACTIVE', 'UNDER_REVIEW']. ILPTarget.status is a plain string using lowercase — those filters are correct and were not changed.

**Files:** app/actions/ta-notes.ts (lines 218 and 281)
**Commit:** 2ae51ed

---

## 13. AI Goals Error Modal Has No Retry Button

**Observed:** When AI ILP Goals generation fails, modal shows error message and only a 'Close' button. User must close, find the student in the list, and click 'AI Goals' again.

**Root cause:** Error state shape { phase: 'error', message } did not store which student was being generated for, so a retry button could not be rendered without that context.

**Fix:**
- Extended error state type: { phase: 'error', message, retryIlp?: IlpWithTargets }
- handleAiGenerate passes the ilp object into the error state on failure
- Error modal renders 'Try again' button (blue primary) when retryIlp is present, calling handleAiGenerate(aiModal.retryIlp) directly
- 'Close' button retained alongside

**Files:** components/send-support/IlpPageView.tsx
**Commit:** 2ae51ed

---

## 14. Student Draft Answers Not Persisted Between Page Navigations (GAP-001)

**Observed:** Student types a partial answer into a multi-question homework, navigates to the dashboard, returns to the same homework URL. Answer field is empty.

**Root cause:** Two-layer state management with a timing gap:

1. `HomeworkSubmissionView` holds `content` (a JSON string for structured types) and saves it to localStorage via a 500ms debounced `handleContentChange`.
2. On mount, a `useEffect` reads localStorage and calls `setContent(saved)` — this is async (fires after render).
3. `HomeworkTypeRenderer` receives `value={content}` and initialises its internal `answers` state via `useState(() => JSON.parse(value))` — this runs only once, on the first render where `content` is still `''`.
4. When the parent's `useEffect` later updates `content` to the localStorage value, React re-renders `HomeworkTypeRenderer` with the new `value` prop, but `useState` ignores subsequent prop changes — `answers` remains `{}`.

The localStorage save was working correctly; only the restore path was broken.

**Fix:** Added a `useEffect` in `HomeworkTypeRenderer` that fires whenever `value` changes. If the new value parses as a JSON object (i.e. answers map), `setAnswers` is called with the parsed result. Plain strings (EXTENDED_WRITING fallback) do not parse as objects and are silently ignored — no change to that render path.

```typescript
useEffect(() => {
  if (!value) return
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      setAnswers(parsed as Record<string, string>)
    }
  } catch { /* plain string — not JSON-structured */ }
}, [value])
```

This creates no render loop: when a user types, `updateAnswer` → `setAnswers` → `onChange` → parent `setContent` → new `value` prop → effect parses same answers object → `setAnswers` called with identical value → React bails (no state change detected).

**Files:** `components/homework/HomeworkTypeRenderer.tsx`
**Commit:** (current)
