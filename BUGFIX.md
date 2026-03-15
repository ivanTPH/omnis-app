# Bug Fix Log

Date: 2026-03-15

---

## 1. Lessons not appearing in calendar after creation

**Symptom:** Teacher creates a lesson via the slide-over or calendar grid. The save appears successful and the LessonFolder opens — but the lesson never shows up in the calendar grid, even after the page refreshes.

**Root cause:** The Prisma query in `app/dashboard/page.tsx` fetched lessons using a strict class-teacher filter:
```js
where: {
  class: { teachers: { some: { userId } } },
}
```
In Prisma, filtering on a relation excludes records where the relation is `null`. This meant:
- Any lesson created without a class (`classId: null`) — e.g., intervention, club, cover — was silently excluded.
- Edge case: lessons created by a teacher for a class they're not formally assigned to were also excluded.

**Fix:** Changed both `weekLessons` and `futureLessons` queries to an `OR` condition:
```js
OR: [
  { class: { teachers: { some: { userId } } } },
  { createdBy: userId },
]
```
This shows lessons that either belong to a class the teacher is assigned to, OR were created by that teacher — covering all creation scenarios.

**Files changed:**
- `app/dashboard/page.tsx`

---

## 2. Calendar shows empty when navigating to previous/next weeks

**Symptom:** Teacher clicks the `<` or `>` week navigation arrows on the calendar. The week header updates correctly, but all lesson slots are empty even if lessons exist for that week.

**Root cause:** The `WeeklyCalendar` client component received the `lessons` prop from the server (always the current week's data from `dashboard/page.tsx`). Navigating to a different week changed the client-side `weekStart` state, causing the slot-mapping logic to calculate `dayIndex` values outside the `0–4` range — so no lessons rendered. There was no mechanism to fetch lessons for non-current weeks.

**Fix:**
1. Added `getWeekLessons(weekStartISO: string)` server action in `app/actions/lessons.ts` — fetches and returns `CalendarLessonData[]` for any given week, using the same `OR` query fix from Bug #1.
2. Updated `WeeklyCalendar.tsx` to:
   - Track `fetchedLessons` state (client-fetched, for non-current weeks) alongside the server `lessons` prop (current week).
   - On `weekStart` state change: if it's the current week, use the server prop (updated via `router.refresh()`); otherwise call `getWeekLessons()` to fetch that week's data.
   - `displayLessons` = `fetchedLessons ?? lessons` is used throughout the slot map and drag logic.

**Files changed:**
- `app/actions/lessons.ts` (added `getWeekLessons`, `CalendarLessonData` type)
- `components/WeeklyCalendar.tsx`

---

## 3. "New Homework" button in calendar links to a 404 route

**Symptom:** Clicking the "New Homework" button in the calendar toolbar navigates to `/homework/new`, which doesn't exist and shows the "Coming soon" page.

**Root cause:** `WeeklyCalendar.tsx` had `href="/homework/new"` hardcoded. The `/homework/new` route was never created; the homework creation flow lives at `/homework` via the `SetHomeworkModal` modal trigger.

**Fix:** Changed `href="/homework/new"` to `href="/homework"`.

**Files changed:**
- `components/WeeklyCalendar.tsx`

---

## 4. Homework list doesn't update after creating new homework

**Symptom:** Teacher creates homework via the "Set Homework" modal on `/homework`. The modal closes but the list still shows the old homework — the new item only appears after a manual page reload.

**Root cause:** `HomeworkFilterView` is a client component that receives homework data as a prop from the server. Its `onCreated` callback only called `setShowModal(false)`, without calling `router.refresh()` to trigger a server re-render with fresh data. The `revalidatePath('/homework')` in the `createHomework` action was invalidating the cache correctly, but the client component never re-fetched.

**Fix:** Added `router.refresh()` to the `onCreated` callback in `HomeworkFilterView`:
```js
onCreated={() => { setShowModal(false); router.refresh() }}
```
Also imported `useRouter` and initialised it in the component.

**Files changed:**
- `components/HomeworkFilterView.tsx`

---

## 5. Analytics page server crash (digest 645327168)

**Symptom:** Navigating to `/analytics/students` (and now `/analytics`) produced a production error — "Application error: a server-side exception has occurred".

**Root cause (A):** `getAnalyticsFilters()` in `app/actions/analytics.ts` called `Promise.all()` across three Prisma queries with no error handling. Any query failure (schema mismatch, connection error, etc.) propagated directly to the server component, crashing the entire page.

**Root cause (B):** `getHomeworkAdaptiveAnalytics()` at line 88 used `status: 'in_progress'` as a filter on `IlpTarget.status`. This is not a valid status value — the valid values are `"active"`, `"achieved"`, `"not_achieved"`, `"deferred"`. This invalid filter caused a silent runtime failure.

**Fix:**
1. Wrapped the `Promise.all()` block in `getAnalyticsFilters()` in a `try/catch` that returns empty defaults on error, preventing a full page crash.
2. Removed the invalid `status: 'in_progress'` filter on `IlpTarget.count` — the query now counts all targets in active ILPs regardless of target status.

**Files changed:**
- `app/actions/analytics.ts`

---

## 6. Analytics redesign — unified /analytics page

**Change:** Consolidated multiple analytics routes (`/analytics/teacher`, `/analytics/department`, `/analytics/students`) into a single `/analytics` page using the existing `StudentAnalyticsView` component (which already has both Classes and Students tabs). The role-specific teacher/dept aggregate pages now redirect to `/analytics`.

**Sidebar update:** All roles that had multiple analytics links (TEACHER, HEAD_OF_DEPT, HEAD_OF_YEAR, SENCO) now have a single "Analytics" link pointing to `/analytics`, keeping `Adaptive Learning → /analytics/adaptive` as a separate entry for applicable roles.

**Files changed:**
- `app/analytics/page.tsx` (new)
- `app/analytics/students/page.tsx` (now redirects to `/analytics`)
- `app/analytics/teacher/page.tsx` (now redirects to `/analytics`)
- `app/analytics/department/page.tsx` (now redirects to `/analytics`)
- `components/Sidebar.tsx`

---

## Broader audit — no bugs found

The following workflows were reviewed and found to be functioning correctly:

- **Homework submission (student):** `submitHomework` calls `revalidatePath` correctly; `HomeworkSubmissionView` calls `router.refresh()` after submit ✓
- **Homework marking (teacher):** `markSubmission` revalidates the marking routes; `SubmissionMarkingView` calls `router.refresh()` and auto-advances ✓
- **Oak Resources — add to lesson:** `addOakLessonToLesson` calls `revalidatePath('/dashboard')`; `LessonFolder` calls `refreshLesson()` via `onAdded` callback ✓
- **Lesson edit (overview/objectives):** `updateLessonOverview` calls `revalidatePath('/dashboard')`; `LessonFolder` calls `refreshLesson()` ✓
- **Lesson delete:** `deleteLesson` calls `revalidatePath('/dashboard')`; calendar closes folder ✓
- **Lesson reschedule (drag-drop):** `rescheduleLesson` calls `revalidatePath('/dashboard')`; optimistic UI clears after `router.refresh()` ✓
- **Student homework list (`/student/dashboard`):** Queries by enrolled classIds, filters `status: 'PUBLISHED'` ✓
- **Sidebar navigation:** All active routes are wired correctly; `/plans`, `/notifications`, `/hoy/integrity` deliberately show "Coming soon" per CLAUDE.md ✓

---

## 7. Oak resources not showing in lesson planner

**Symptom:** The Oak Resources tab in LessonFolder showed few or no results even though 11,403 lessons are synced in the database. Auto-search on open returned empty results for many subjects.

**Root cause (A — Subject slug mismatch):** `LessonFolder.tsx` derived the Oak subject slug from the school class's subject name using a simple `.toLowerCase().replace(/\s+/g, '-')` transform. This failed for common variations: "Mathematics" → "mathematics" (Oak uses "maths"), "English Literature" → "english-literature" (Oak uses "english"), "Religious Education" → "religious-education" vs "religious-studies", etc.

**Root cause (B — Limit too low):** The default `limit` in `searchOakLessons()` was 40, and the auto-search calls hardcoded `limit: 40`. With subject + year group filters this was sometimes fine, but for broad searches teachers saw a truncated list.

**Root cause (C — No year-group fallback):** When subject + year group combination returned 0 results (e.g. if the Oak database has lessons tagged to different year groups than the class), the panel showed "No lessons found" with no fallback.

**Fix:**
1. Added `toOakSubjectSlug(subject)` helper in `LessonFolder.tsx` with a complete mapping table covering mathematics/maths, english variants, physical education/pe, art & design, design and technology, religious education variants, etc.
2. Increased default `limit` in `searchOakLessons()` from 40 → 50.
3. Updated all search call sites in `OakResourcePanel.tsx` to use `limit: 50`.
4. Added year-group fallback in the auto-search `useEffect`: if subject+yearGroup returns 0 results, retry with subject only and show a note "(no results for Year X — showing all year groups)".

**Files changed:**
- `components/LessonFolder.tsx`
- `components/OakResourcePanel.tsx`
- `app/actions/oak.ts`

---

## 8. Homework generation not producing quiz questions or model answers

**Symptom:** Teachers generating MCQ or short-answer homework via AI found no quiz questions were included. Auto-marking failed. Model answers were sometimes empty.

**Root cause (A — ILP target status bug):** `getSubmissionForMarking()` queried `IlpTarget` with `status: 'in_progress'` — not a valid status value (valid: "active" | "achieved" | "not_achieved" | "deferred"). This silently returned 0 ILP targets for the marking panel, breaking the ILP evidence linking flow.

**Root cause (B — questionsJson not validated):** `generateHomeworkFromResources()` caught JSON parse errors and silently fell back to `noApiKeyFallback()`, discarding any partial AI output. There was no logging and no retry when `questionsJson` was missing from the parsed response.

**Root cause (C — autoMarkSubmission throws instead of graceful return):** `autoMarkSubmission()` threw `Error('Auto-marking only supported for quiz...')` when the homework type was unsupported, or when `structuredContent` was null — crashing the caller instead of returning a graceful message.

**Root cause (D — empty modelAnswer on proposal failure):** `generateHomeworkProposal()` catch block returned `modelAnswer: ''` — a blank field — when the API call or JSON parse failed.

**Fix:**
1. `getSubmissionForMarking()`: changed `status: 'in_progress'` → `status: 'active'` on `IlpTarget` filter.
2. `generateHomeworkFromResources()`: separated JSON.parse into its own try/catch with error logging; added `questionsJson` validation for MCQ_QUIZ/SHORT_ANSWER types — if < 3 questions found, retries once with a follow-up message in the conversation; improved error logging throughout.
3. `autoMarkSubmission()`: replaced `throw new Error(...)` with `return { score: 0, maxScore: 0, feedback: '...' }` for unsupported types and null structuredContent.
4. `generateHomeworkProposal()`: added markdown fence stripping; changed catch block to return a non-empty placeholder `modelAnswer` instead of `''`; changed catch to log the error.

**Files changed:**
- `app/actions/homework.ts`

---

## 9. Production crash digest 3065895699

**Symptom:** A second production server error appeared at digest 3065895699, distinct from the analytics crash (digest 645327168).

**Root cause (A — IlpTarget `status: 'in_progress'` in ehcp.ts and adaptive-learning.ts):** Three server actions continued to query `IlpTarget` with `status: 'in_progress'`, an invalid status value. Valid values are `"active"`, `"achieved"`, `"not_achieved"`, `"deferred"`.
- `getIlpTargetsDueForEvidencing()` in `app/actions/ehcp.ts` line 330
- `getAdaptiveHomeworkSuggestions()` in `app/actions/adaptive-learning.ts`
- `generateDifferentiatedVersions()` in `app/actions/adaptive-learning.ts`

These were missed in the previous bug #8 fix which only corrected `homework.ts` and `analytics.ts`.

**Root cause (B — SENCO blocked from `/analytics` route):** The sidebar was updated in a prior session to give SENCO an `Analytics → /analytics` link, but `auth.config.ts` did not include `SENCO` in the `/analytics` allowed roles. SENCO users clicking Analytics were silently redirected to `/send/dashboard` instead of seeing an error — but this also indicated an inconsistent access model.

**Root cause (C — Missing error boundaries):** `app/global-error.tsx` did not exist. Only `app/homework/error.tsx` had a route-level error boundary. Any unhandled server component exception in other routes (dashboard, analytics, SEND, classes) would escalate directly to the bare Next.js error page.

**Fix:**
1. Changed all three `status: 'in_progress'` → `status: 'active'` on `IlpTarget` filters in `ehcp.ts` and `adaptive-learning.ts`.
2. Added `'SENCO'` to the `/analytics` allowed roles in `auth.config.ts`.
3. Created `app/global-error.tsx` — branded fallback error page with digest display and "Try again" button.
4. Created `error.tsx` for: `app/dashboard/`, `app/analytics/`, `app/senco/`, `app/send/`, `app/classes/`.

**Files changed:**
- `app/actions/ehcp.ts`
- `app/actions/adaptive-learning.ts`
- `auth.config.ts`
- `app/global-error.tsx` (new)
- `app/dashboard/error.tsx` (new)
- `app/analytics/error.tsx` (new)
- `app/senco/error.tsx` (new)
- `app/send/error.tsx` (new)
- `app/classes/error.tsx` (new)

---

## 10. Homework marking — score display, AI approval, save freeze (first attempt — partial fix)

**Note:** The first fix attempt addressed the wrong root causes. See Bug #11 for the complete fix.

**Files changed (first attempt):**
- `lib/grading.ts` (new) — `percentToGcseGrade`, `formatScore`, `normalizeScoreForForm`
- `components/HomeworkMarkingView.tsx` — initial score normalisation, autoFeedback pre-fill, handleApprove stub
- `components/SubmissionMarkingView.tsx` — same
- `app/actions/homework.ts` — added `revalidatePath('/dashboard')` and `revalidatePath('/', 'layout')`

---

## 11. Homework marking — three bugs still present after Bug #10 fix

**Symptom A (Score still shows "X/9"):** Pupil list in `HomeworkMarkingView` showed scores as e.g. `8/9` even after the GCSE grade conversion — the `/9` denominator should not appear when the value is a GCSE grade. For old submissions with `finalScore = 87` (legacy percentage), the display showed `8/9` (converted GCSE grade over maxScore).

**Root cause A:** `StudentRow` in `HomeworkMarkingView.tsx` rendered `{displayScore}/{maxScore}` unconditionally. Even when `displayScore` had been converted from a percentage to a GCSE grade (e.g., 87 → 8), it still showed `8/9`.

**Fix A:** Changed the render to `Grade {displayScore}` when the original score was percentage-scale (`rawFinalScore > maxScore && maxScore ≤ 20`), and `{displayScore}/{maxScore}` only for raw scores.

---

**Symptom B (Grade field shows "—" on load):** The Grade input in the marking form always showed the placeholder "—" when opening an auto-marked submission. The teacher had to interact with the score field before the grade populated.

**Root cause B:** `formState` initialisation in `HomeworkMarkingView.tsx` set `grade: s.grade ?? ''`. For auto-marked submissions `s.grade` is null, so grade was always `''` on load. The grade auto-calculation only ran when the teacher typed into the score field (inside `setField`), not on initial render.

**Fix B:** In the `formState` init loop, pre-calculate `autoGrade` from `normScore` (using the same `suggestGrade` / `percentToGcseGrade` logic as `setField`), and use it as the default: `grade: s.grade ?? autoGrade`. Same fix applied to `SubmissionMarkingView.tsx` grade `useState` initialiser — now derives grade from `normalizeScoreForForm` output rather than raw `finalScore`.

---

**Symptom C ("Update & Return" button did nothing):** Clicking the button ran the server action (submission was updated in the DB), but the pupil list and submission status never reflected the change. Appeared to freeze / do nothing.

**Root cause C:** `HomeworkMarkingView.tsx` did not import `useRouter` and had no `router.refresh()` call after `markSubmission` succeeded. `revalidatePath` in the server action invalidates the cache, but without `router.refresh()` the client never re-fetched the updated server data, so the pupil list status remained stale.

**Fix C:** Added `useRouter` import and `router.refresh()` calls immediately after `markSubmission` in both `handleSave` and `handleApprove` in `HomeworkMarkingView.tsx`. (`SubmissionMarkingView.tsx` already had `router.refresh()`.)

---

**Bonus fix — `handleApprove` used wrong scale for `autoScore`:** `autoMarkSubmission` stores `autoScore` as a **raw score** (0–maxScore), not a percentage. Both `handleApprove` functions incorrectly computed `gradeNum = Math.round((autoScore / 100) * maxScore)` — treating a raw 7 as 7%, producing `gradeNum = 1` instead of 7. Fixed to use the same detection heuristic as `normalizeScoreForForm` (if `autoScore > maxScore && maxScore ≤ 20`, treat as legacy percentage; otherwise treat as raw). AI banner score display also fixed — was showing `7%` when autoScore is raw; now shows `7/9 (78% · Grade 7)`.

**Files changed:**
- `components/HomeworkMarkingView.tsx`
- `components/SubmissionMarkingView.tsx`

---

## 12. Homework marking — return date, status display, grade colour states

**Symptom A ("Returned 3 Mar" for "Submitted 4 Mar"):** The submission header showed a return date before the submission date — physically impossible. The "Returned" label appeared even on `MARKED` submissions that hadn't been confirmed by the teacher yet.

**Root cause A (display):** `HomeworkMarkingView.tsx` line 307 rendered `· Returned X Mar` whenever `markedAt` was set, regardless of `status`. `SubmissionMarkingView.tsx` did the same via `isAlreadyMarked = status === 'RETURNED' || status === 'MARKED'`.

**Root cause A (data):** `submitHomework` in `app/actions/student.ts` updated `submittedAt: new Date()` on resubmit but left the old `markedAt` from a previous seed run unchanged. If the submission was seeded with `markedAt = March 3` and the student resubmitted on March 4, `submittedAt (March 4) > markedAt (March 3)`.

**Root cause A (seed):** `upsertSub` set `markedAt: daysAgo(0)` for all RETURNED submissions regardless of `daysAgoSub`, and `update: {}` meant re-running the seed never corrected bad dates.

**Fix A:**
1. Both components now only show "Returned X Mar" when `status === 'RETURNED'` AND `markedAt >= submittedAt`.
2. `submitHomework` now clears `markedAt`, `finalScore`, `teacherScore`, `grade`, `feedback` on resubmit.
3. `upsertSub` in `seed.ts` now sets `markedAt = submittedAt + 1 day`; changed `update: {}` to also update `markedAt` for RETURNED records so re-running the seed fixes existing bad dates.

---

**Symptom B ("Returned" status before teacher confirms):** The status badge showed "Returned" for `MARKED` submissions (auto-marked, awaiting teacher review).

**Root cause B:** `statusLabel('MARKED')` returned "Marked" which could be confused, and there was no "Awaiting review" state. The "Returned" date line appeared for MARKED status.

**Fix B:** Both components now show `"Awaiting review"` (amber) for `MARKED` status. Status badge is green only for `RETURNED`.

---

**Symptom C (Grade field plain white, no visual state):** The Grade input box had no visual distinction between "AI auto-suggested" (needs confirmation), "teacher confirmed", and "final/returned".

**Fix C:** Added `gradeState` logic to both components. Grade box is amber (`bg-amber-50 border-amber-300 text-amber-700`) when auto-suggested, green (`bg-green-50 border-green-300 text-green-700`) when teacher confirmed, neutral when returned/empty. Label below changes to "Auto-suggested — confirm" (amber) / "Confirmed ✓" (green).

**Files changed:**
- `components/HomeworkMarkingView.tsx`
- `components/SubmissionMarkingView.tsx`
- `app/actions/student.ts`
- `prisma/seed.ts`

---

## 13. Profile picture not updating sidebar after upload

**Symptom:** Uploading a new profile picture in Settings (Profile tab) succeeded — the preview updated locally — but the avatar chip at the bottom-left of the sidebar still showed the old initials/photo until a full page reload.

**Root cause (3 parts):**
1. `app/api/settings/avatar/route.ts` — No `revalidatePath` calls after saving the image to DB. Next.js cached the page layout, so server components never refetched.
2. `components/settings/SettingsShell.tsx` — `handleAvatarChange` updated local `avatarUrl` state but never called `router.refresh()` to trigger a client-side re-render of server data.
3. `components/AppShell.tsx` — The `avatarUrl` prop was never passed to `Sidebar`. `AppShell` didn't fetch avatar data at all; `Sidebar` already accepted `avatarUrl?: string | null` but always received `undefined`.

**Fix:**
1. `avatar/route.ts` — Added `revalidatePath('/', 'layout')` and `revalidatePath('/settings')` after `writeAudit`.
2. `SettingsShell.tsx` — Added `router.refresh()` after the successful upload response.
3. `app/actions/settings.ts` — Added new `getMyAvatarUrl()` server action that queries `UserSettings.profilePictureUrl` for the current session user.
4. `AppShell.tsx` — Added `useEffect` on mount to call `getMyAvatarUrl()` and store result in `avatarUrl` state, then passes it to both Sidebar instances (desktop + mobile drawer).

**Files changed:**
- `app/api/settings/avatar/route.ts`
- `components/settings/SettingsShell.tsx`
- `app/actions/settings.ts`
- `components/AppShell.tsx`

---

## 14. Homework marking — filter chips, SEND indicators, resend/message actions

**Symptom A (Non-clickable counters):** The pupil list header showed "26/28 submitted · 2 missing" as plain text. There was no way to filter the list to show only submitted, returned, missing, or SEND pupils.

**Fix A:** Replaced the plain-text header with a row of clickable filter chips (All / Submitted / Returned / Missing / SEND), each showing a count badge. Clicking a chip filters the pupil list; clicking the active chip returns to "All". `pupilFilter` state drives two separate computed lists (`visibleSubmitted`, `visibleMissing`).

---

**Symptom B (Generic SEND badge):** All SEND pupils had an identical red "SEND" label. EHCP and SEN Support have different implications but were visually identical.

**Fix B:**
- Added `<SendBadge>` component inline — renders `EHCP` (purple) for `activeStatus === 'EHCP'` and `SEN` (blue) for `SEN_SUPPORT`.
- Missing SEND pupils now get an amber left-border highlight and amber `AlertCircle` icon instead of the grey treatment.
- The right-panel student header also shows the full `activeStatus` label with colour coding.

---

**Symptom C (No action buttons for missing pupils):** Missing students appeared in the list but teachers had no way to prompt them from within the marking view.

**Fix C:** Added two action buttons beneath each missing student row:
- **Remind** — calls new `resendHomeworkReminder(homeworkId, studentId)` server action that creates a `Notification` record for the student. Button shows spinner while pending and switches to "Sent ✓" (green) once confirmed per-session. Non-blocking (best-effort).
- **Message** — `<Link>` to `/messages?new=1&recipient=<id>&context=<hw title>`. For SEND pupils, shows a small purple "SEND" hint label to remind the teacher to use sensitive language.

---

**New server action:** `resendHomeworkReminder(homeworkId, studentId)` in `app/actions/homework.ts` — creates a `HOMEWORK_SET` notification for the student with due-date copy and link to the submission page.

**Files changed:**
- `components/HomeworkMarkingView.tsx`
- `app/actions/homework.ts`
