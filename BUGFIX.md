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
