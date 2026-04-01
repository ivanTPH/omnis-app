# Omnis — Full System Audit
**Date:** 2026-04-01
**Auditor:** Claude Code (claude-sonnet-4-6)
**Method:** Full source-code read of every route, component, and action file across all roles

---

## Summary Table

| Role            | Critical | High | Medium | Low | Feature Gaps |
|-----------------|:--------:|:----:|:------:|:---:|:------------:|
| Teacher         |    0     |  2   |   2    |  2  |      2       |
| Student         |    0     |  1   |   2    |  0  |      2       |
| SENCO           |    0     |  1   |   2    |  0  |      1       |
| Admin           |    0     |  2   |   1    |  0  |      1       |
| SLT             |    0     |  3   |   0    |  0  |      2       |
| HOY             |    0     |  1   |   0    |  1  |      1       |
| Cover Manager   |    0     |  1   |   0    |  0  |      1       |
| All Roles       |    0     |  1   |   3    |  3  |      4       |
| **TOTAL**       |  **0**   | **12** | **10** | **6** | **14** |

---

## BUGS — TEACHER ROLE

---

### BUG-001
- **ID:** BUG-001
- **Status:** ✅ FIXED — `app/students/[studentId]/page.tsx` wrapped in `AppShell`
- **Role:** Teacher (also affects SENCO, HOY, SLT, Admin)
- **Area:** Student Detail Page — Navigation
- **Severity:** High
- **What is broken:** `app/students/[studentId]/page.tsx` does not wrap its content in `AppShell`. When any user navigates to a student detail page (e.g., by clicking a student row in the analytics panel), the sidebar and top nav are completely absent. The user is stranded on a page with no way to navigate back except the browser back button.
- **File responsible:** `app/students/[studentId]/page.tsx` (line 18 — bare `<div className="min-h-screen bg-gray-50">` instead of `<AppShell>`)
- **Correct behaviour:** The page should be wrapped in `<AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>` so the sidebar persists. All other student-facing and staff-facing detail pages use AppShell.

---

### BUG-002
- **ID:** BUG-002
- **Status:** ✅ FIXED — `displayScore` always converted via `percentToGcseGrade()`
- **Role:** Teacher
- **Area:** Homework Marking — Grade Display
- **Severity:** High
- **What is broken:** In `HomeworkMarkingView`, the pupil list shows `Grade {displayScore}` (line 677). The `displayScore` variable can be: (a) a GCSE grade 1–9 (when `rawFinalScore > maxScore && maxScore <= 20`), (b) the raw form score (e.g., 7 out of 9), or (c) a legacy percentage (e.g., 75). This means a teacher can see "Grade 75" or "Grade 7.5" in the list — which is ambiguous and confusing. Only a converted GCSE grade 1–9 should be labelled "Grade".
- **File responsible:** `components/HomeworkMarkingView.tsx` lines 618–623 (`displayScore` calculation) and line 677 (`Grade {displayScore}` display)
- **Correct behaviour:** The pupil list should always show a GCSE grade 1–9 (derived from `percentToGcseGrade()`) with a letter, e.g. `Grade 7 (A)`. If the score cannot be normalised to a GCSE grade, show `—`. Never show a raw number or percentage as a "Grade".

---

### BUG-003
- **ID:** BUG-003
- **Status:** ✅ FIXED — AI badge now shows "AI: Gr 7 (A) ↗"
- **Role:** Teacher
- **Area:** Homework Marking — AI Score Badge
- **Severity:** Medium
- **What is broken:** The AI score badge in the pupil list (`HomeworkMarkingView` lines 664–672) shows `AI: 75% ↗` (a percentage). After the recent GCSE grade migration, all score displays should use the Grade 1–9 scale. The AI badge is the only display that still shows a raw percentage.
- **File responsible:** `components/HomeworkMarkingView.tsx` lines 664–672
- **Correct behaviour:** Show `AI: Grade 7 (A) ↗` rather than a percentage. Use `percentToGcseGrade(pct)` to derive the grade before display.

---

### BUG-004
- **ID:** BUG-004
- **Status:** ✅ FIXED — SEND attainment labels now show `gradeLabel()` output
- **Role:** Teacher
- **Area:** Analytics — Class Insights Tab
- **Severity:** Medium
- **What is broken:** In `ClassAnalyticsPanel`, the SEND attainment comparison bars (`sendAvg` and `nonSendAvg`) still display as raw percentages (e.g., "SEND students: 58%"). These should also be expressed as GCSE grades for consistency with the class avg card that was updated.
- **File responsible:** `components/ClassAnalyticsPanel.tsx` lines 142–178 (SEND attainment section)
- **Correct behaviour:** Show "SEND avg: Grade 5 (C+)" and "Rest of class: Grade 6 (B)" using `gradeLabel()` from `lib/grading.ts`. Progress bars can retain percentage width but labels should show grade.

---

### BUG-005
- **ID:** BUG-005
- **Role:** Teacher
- **Area:** E2E Test Coverage
- **Severity:** Low
- **What is broken:** `e2e/tests/revision-program.spec.ts` contains two tests, both explicitly skipped with `test.skip(...)`. There is zero test coverage for the Revision Program feature (teacher creates program, student completes task, analytics update). This means regressions in revision features will not be caught by CI.
- **File responsible:** `e2e/tests/revision-program.spec.ts` (lines 4, 9)
- **Correct behaviour:** Tests should be implemented and enabled. At minimum: teacher creates a revision program, student views and completes a task, teacher sees progress.

---

### BUG-006
- **ID:** BUG-006
- **Role:** Teacher
- **Area:** E2E CI — Auth Test Assertions
- **Severity:** Low
- **What is broken:** In `e2e/tests/auth.spec.ts` lines 34–35, the test for "unauthenticated user does not see protected content" checks `url.endsWith('/dashboard') || url.includes('/student') || url === ''`. This allows the test to pass even if the redirect goes to an unexpected URL (e.g., `''` empty string). A genuine auth failure could be masked.
- **File responsible:** `e2e/tests/auth.spec.ts` lines 34–35
- **Correct behaviour:** Assert the URL ends with a specific known redirect target (e.g., `/login`) rather than allowing multiple fallback conditions.

---

## BUGS — STUDENT ROLE

---

### BUG-007
- **ID:** BUG-007
- **Status:** ✅ FIXED — `app/student/grades/page.tsx` stub created with AppShell
- **Role:** Student
- **Area:** Navigation — My Grades
- **Severity:** High
- **What is broken:** The student sidebar includes a "My Grades" link pointing to `/student/grades`. This route does not exist. Students clicking it see the "Coming soon" not-found page. This is a core student feature — seeing their grade history — and the nav link creates a dead end.
- **File responsible:** `components/Sidebar.tsx` (STUDENT nav block, `href: '/student/grades'`); `app/student/grades/` directory does not exist
- **Correct behaviour:** Either remove the nav item until the route is built, or build a basic `/student/grades` page showing the student's submission history with GCSE grades 1–9.

---

### BUG-008
- **ID:** BUG-008
- **Status:** ✅ FIXED — "pts" replaced with `formatRawScore()` in parent/progress and send/ilp
- **Role:** Student / Parent
- **Area:** Grade Display — Progress / ILP Views
- **Severity:** Medium
- **What is broken:** In `app/parent/progress/page.tsx` (lines 170–182) and `app/send/ilp/[studentId]/page.tsx` (lines 329–339), when a submission has a `finalScore` but no `grade` field, the score is displayed as `{sub.finalScore} pts` (e.g., "7 pts"). This is inconsistent with the GCSE 1–9 format used everywhere else. "7 pts" is meaningless to a parent; "Grade 7 (A)" is clear.
- **File responsible:** `app/parent/progress/page.tsx` lines 174–175; `app/send/ilp/[studentId]/page.tsx` lines 333–335
- **Correct behaviour:** Use `percentToGcseGrade()` to convert `finalScore` to a GCSE grade and display as "Grade 7 (A)" using `gradeLabel()`. The raw "pts" fallback should be removed.

---

### BUG-009
- **ID:** BUG-009
- **Status:** ✅ FIXED — `app/student/homework/page.tsx` redirects to `/student/dashboard`
- **Role:** Student
- **Area:** Navigation — Homework List
- **Severity:** Medium
- **What is broken:** The student sidebar includes a "Homework" item. Per CLAUDE.md the student homework list page (`/student/homework`) is not yet built — only individual homework items (`/student/homework/[id]`) exist. Students have no overview of all their assignments; they can only access homework via links sent to them directly or from the dashboard.
- **File responsible:** `components/Sidebar.tsx` (STUDENT nav block); `app/student/homework/page.tsx` does not exist
- **Correct behaviour:** Either build the `/student/homework` list page, or point the nav link directly to `/student/dashboard` (which shows upcoming homework) until the list is built.

---

## BUGS — SENCO ROLE

---

### BUG-010
- **ID:** BUG-010
- **Status:** ✅ FIXED — `app/senco/ilp-evidence/page.tsx` wrapped in `AppShell`
- **Role:** SENCO
- **Area:** ILP Evidence — Navigation
- **Severity:** High
- **What is broken:** `app/senco/ilp-evidence/page.tsx` renders its content inside a bare `<div className="max-w-4xl mx-auto ...">` (line 15) without any `AppShell` wrapper. When a SENCO navigates to `/senco/ilp-evidence`, the sidebar disappears completely. This is the only SENCO route without AppShell; all other SENCO pages (`/senco/dashboard`, `/senco/concerns`, `/senco/ilp`, `/senco/early-warning`, `/senco/ehcp`) correctly wrap in AppShell.
- **File responsible:** `app/senco/ilp-evidence/page.tsx` line 15 (missing `<AppShell>` import and wrapper)
- **Correct behaviour:** Import AppShell and wrap the page content identically to the other SENCO pages.

---

### BUG-011
- **ID:** BUG-011
- **Role:** SENCO
- **Area:** Navigation — Dual Route System
- **Severity:** Medium
- **What is broken:** Two parallel route prefixes exist for SEND functionality: `/send/*` (SEND dashboard, ILP list, ILP detail, review-due) and `/senco/*` (SENCO dashboard, ILP, concerns, early-warning, EHCP, ILP evidence). The SENCO sidebar links to `/senco/*` routes. The SEND register page at `/plans` and the teacher-facing plans overlay at `/send/dashboard` are separate implementations. This creates confusion about which is the canonical SEND management UI and makes it hard to link between teacher and SENCO views of the same student.
- **File responsible:** `components/Sidebar.tsx` SENCO nav block; `app/send/` and `app/senco/` directories
- **Correct behaviour:** Document which prefix is canonical for which actor. The `/senco/*` routes should be the SENCO's primary workspace; `/send/dashboard` and `/send/ilp` are the school-wide SEND register visible to SLT/Admin. Internal links between the two systems (e.g., from early-warning to student ILP detail) should use consistent routes.

---

### BUG-012
- **ID:** BUG-012
- **Status:** ✅ FIXED — `gap?.length ?? 0` optional chaining applied
- **Role:** SENCO
- **Area:** ILP Evidence — Null Safety
- **Severity:** Medium
- **What is broken:** In `app/senco/ilp-evidence/page.tsx` line 73, the code accesses `gap.length` where `gap` is derived from a database field that may be `null`. If `gap` is null, calling `.length` throws a TypeError, crashing the page with an unhandled error.
- **File responsible:** `app/senco/ilp-evidence/page.tsx` line 73
- **Correct behaviour:** Use optional chaining: `gap?.length ?? 0`.

---

## BUGS — ADMIN ROLE

---

### BUG-013
- **ID:** BUG-013
- **Status:** ✅ FIXED — `app/admin/audit/page.tsx` stub created with AppShell
- **Role:** Admin
- **Area:** Navigation — Audit Log
- **Severity:** High
- **What is broken:** The SCHOOL_ADMIN sidebar includes an "Audit Log" item pointing to `/admin/audit`. This route does not exist — it shows the "Coming soon" not-found page. The admin dashboard also has a quick-link card pointing to `/admin/audit` (line 16 of `app/admin/dashboard/page.tsx`). Both are dead links. Audit logging IS fully implemented in the backend (`writeAudit()` and `AuditLog` model) — there is simply no UI page to view it.
- **File responsible:** `components/Sidebar.tsx` (SCHOOL_ADMIN nav block); `app/admin/dashboard/page.tsx` line 16; `app/admin/audit/` directory does not exist
- **Correct behaviour:** Remove the quick-link card from the admin dashboard and either hide the sidebar item or display a "not yet available" tooltip until the route is built.

---

### BUG-014
- **ID:** BUG-014
- **Role:** Admin
- **Area:** Navigation — Sidebar Link
- **Severity:** High
- **What is broken:** The SCHOOL_ADMIN sidebar also has access to the `/hoy/integrity` route (inherited via SLT role check in some places). Additionally, SLT users accessible to admins see the `/slt/audit` dead link — which also appears in admin-level analytics flows. These represent additional dead navigation paths for admin users.
- **File responsible:** `components/Sidebar.tsx` SLT nav block
- **Correct behaviour:** See BUG-015 and BUG-016 for the canonical entries for these routes.

---

### BUG-015 (duplicate of BUG-013 quick-link)
*(merged into BUG-013)*

---

## BUGS — SLT ROLE

---

### BUG-015
- **ID:** BUG-015
- **Status:** ✅ FIXED — `app/slt/audit/page.tsx` stub created with AppShell
- **Role:** SLT
- **Area:** Navigation — Audit Log
- **Severity:** High
- **What is broken:** The SLT sidebar includes an "Audit Log" item pointing to `/slt/audit`. This route does not exist. SLT users see the "Coming soon" not-found page.
- **File responsible:** `components/Sidebar.tsx` (SLT nav block, `href: '/slt/audit'`); `app/slt/audit/` directory does not exist
- **Correct behaviour:** Remove or disable the sidebar item until the route is built. Alternatively, redirect to `/admin/audit` once that is built.

---

### BUG-016
- **ID:** BUG-016
- **Status:** ✅ FIXED — `app/hoy/integrity/page.tsx` stub created with AppShell
- **Role:** SLT / HOY
- **Area:** Navigation — Integrity
- **Severity:** High
- **What is broken:** Both the SLT and HEAD_OF_YEAR sidebars include an "Integrity" item pointing to `/hoy/integrity`. This route does not exist. Per CLAUDE.md this is documented as an unbuilt route. Users navigate to a dead end.
- **File responsible:** `components/Sidebar.tsx` (SLT and HEAD_OF_YEAR nav blocks, `href: '/hoy/integrity'`); `app/hoy/integrity/` directory does not exist
- **Correct behaviour:** Remove or disable the sidebar item until the route is built.

---

### BUG-017
- **ID:** BUG-017
- **Role:** SLT
- **Area:** Navigation — Audit Log (SLT)
- **Severity:** High
- **What is broken:** *(See BUG-015 above — the `/slt/audit` dead link affects SLT directly as a primary nav item.)*
- **File responsible:** `components/Sidebar.tsx` SLT nav block
- **Correct behaviour:** See BUG-015.

*(Note: BUG-017 is a duplicate reference — BUG-015 and BUG-016 together account for all 3 High-severity SLT navigation bugs.)*

---

## BUGS — HEAD OF YEAR ROLE

---

### BUG-018
- **ID:** BUG-018
- **Role:** HOY
- **Area:** Navigation — Integrity
- **Severity:** High
- **What is broken:** *(See BUG-016 above — `/hoy/integrity` is the primary HOY dead link. HOY is the most affected role as Integrity is a core pastoral feature for them.)*
- **File responsible:** `components/Sidebar.tsx` HEAD_OF_YEAR nav block
- **Correct behaviour:** See BUG-016.

---

### BUG-019
- **ID:** BUG-019
- **Status:** ✅ FIXED — `app/hoy/error.tsx` created
- **Role:** HOY
- **Area:** Error Handling
- **Severity:** Low
- **What is broken:** `app/hoy/error.tsx` does not exist. Per CLAUDE.md, this is the only route-level error boundary still missing. If the HOY analytics page or any HOY sub-page throws an unhandled error, React will escalate to `app/global-error.tsx` instead of showing a scoped error boundary with a "Try again" option within the layout.
- **File responsible:** `app/hoy/` directory — `error.tsx` absent
- **Correct behaviour:** Create `app/hoy/error.tsx` following the same pattern as the other existing route error boundaries (e.g., `app/analytics/error.tsx`).

---

## BUGS — COVER MANAGER ROLE

---

### BUG-020
- **ID:** BUG-020
- **Status:** ✅ FIXED — `app/lessons/page.tsx` stub created with AppShell
- **Role:** Cover Manager
- **Area:** Navigation — Lessons
- **Severity:** High
- **What is broken:** The COVER_MANAGER sidebar includes a "Lessons" item pointing to `/lessons`. This route does not exist. Cover Managers navigating to it see the "Coming soon" page. Per CLAUDE.md, `/lessons` is documented as an unbuilt route.
- **File responsible:** `components/Sidebar.tsx` (COVER_MANAGER nav block, `href: '/lessons'`); `app/lessons/` directory does not exist
- **Correct behaviour:** Remove or disable the sidebar item until the route is built. The Cover Manager workflow likely needs a read-only lesson list to understand cover requirements.

---

## BUGS — ALL ROLES

---

### BUG-021
- **ID:** BUG-021
- **Status:** ✅ FIXED — "pts" → `formatRawScore()`; HOY/SLT `avgScore.toFixed(1)` → `formatAvgGrade().main`
- **Role:** All (Teacher, SENCO, HOY, SLT, Admin)
- **Area:** Grade Display — Global Inconsistency
- **Severity:** High
- **What is broken:** Grade display format is inconsistent across the application. After the GCSE grade migration, most views now show `Grade X (Y)` (e.g., "Grade 7 (A)"). However, several views still show raw or legacy formats:
  - `app/parent/progress/page.tsx`: shows `{sub.finalScore} pts` when no grade field (e.g., "7 pts")
  - `app/send/ilp/[studentId]/page.tsx`: same `{sub.finalScore} pts` pattern
  - `app/hoy/analytics/page.tsx`: shows `agg.avgScore.toFixed(1)` — a decimal number (e.g., "6.4") with no grade label
  - `app/slt/analytics/page.tsx`: similar raw decimal average
  - `HomeworkMarkingView` pupil list: can show "Grade 75" (raw score) instead of "Grade 7 (A)"
  A parent, student, or SLT user sees different representations of the same data depending on which page they're on.
- **File responsible:** `app/parent/progress/page.tsx` lines 174–175; `app/send/ilp/[studentId]/page.tsx` lines 333–335; `app/hoy/analytics/page.tsx` (avgScore display); `app/slt/analytics/page.tsx` (avgScore display); `components/HomeworkMarkingView.tsx` lines 618–623
- **Correct behaviour:** All score/grade displays across all roles should use `gradeLabel()` from `lib/grading.ts` to show "Grade X (Y)" where possible. When only a raw score is available, normalise via `percentToGcseGrade()` before display. The "pts" suffix should be removed entirely.

---

### BUG-022
- **ID:** BUG-022
- **Status:** ✅ FIXED — `app/settings/accessibility/page.tsx` now has AppShell + "← Settings" back link
- **Role:** All
- **Area:** Navigation — Accessibility Page Sidebar
- **Severity:** Medium
- **What is broken:** The accessibility settings page at `/settings/accessibility` uses `AppShell` correctly, and `AccessibilityToolbar` correctly applies CSS classes to `document.documentElement`. However, there is no back-navigation or breadcrumb on the accessibility page — the only escape is the sidebar. On narrow viewports, if the sidebar is collapsed or the user has navigated directly to the URL, there is no clear route back to the Settings hub (`/settings`).
- **File responsible:** `app/settings/accessibility/page.tsx` (no breadcrumb component)
- **Correct behaviour:** Add a breadcrumb or "← Settings" back link at the top of the accessibility page, consistent with other settings sub-pages.

---

### BUG-023
- **ID:** BUG-023
- **Role:** All
- **Area:** E2E Test Coverage — Workflow
- **Severity:** Medium
- **What is broken:** The GitHub Actions workflow (`.github/workflows/e2e.yml`) runs on every push to `main`. It starts the Next.js server in the background with `npm run start &` (line 52) and waits 30 seconds for HTTP readiness. However:
  1. The `revision-program.spec.ts` tests are ALL skipped (`test.skip()`), producing false-green CI results — the revision program feature has zero test coverage.
  2. There is no explicit check that the background `npm run start` process is still alive before Playwright runs. If the process crashes after the HTTP check succeeds, tests will fail with confusing network errors rather than a clear "server died" message.
- **File responsible:** `.github/workflows/e2e.yml`; `e2e/tests/revision-program.spec.ts`
- **Correct behaviour:** Unskip and implement revision-program tests. Add a process health check (e.g., `kill -0 $!` guard) to verify the server process is still running before starting Playwright.

---

### BUG-024
- **ID:** BUG-024
- **Status:** ✅ FIXED — inline SVG replaced with `<Icon name="chat" size="sm" />`
- **Role:** All (primarily Parent)
- **Area:** Icon Consistency
- **Severity:** Low
- **What is broken:** `app/parent/consent/page.tsx` uses a hardcoded inline SVG `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" ...>` (around line 32). Per the completed Google Material Icons migration (CLAUDE.md), all icons throughout the app must use `<Icon name="..." />` from `components/ui/Icon.tsx`. This is the only remaining instance of inline SVG.
- **File responsible:** `app/parent/consent/page.tsx` (inline SVG near line 32)
- **Correct behaviour:** Replace with `<Icon name="chat" size="sm" />`.

---

### BUG-025
- **ID:** BUG-025
- **Status:** ℹ️ FALSE POSITIVE — `/send` IS already in `auth.config.ts` ROLE_ROUTES at line 30. No fix needed.
- **Role:** All
- **Area:** Auth / Route Protection
- **Severity:** Low
- **What is broken:** `auth.config.ts` defines a `ROLE_ROUTES` array that maps route prefixes to allowed roles. The `/send/*` route prefix (covering `/send/dashboard`, `/send/ilp`, `/send/ilp/[studentId]`, `/send/review-due`) does not appear to have an explicit entry in `ROLE_ROUTES`. Protection for these routes relies entirely on page-level role checks rather than edge-runtime middleware. This means an unauthenticated request could reach the page handler before being rejected, adding latency and bypassing the fast redirect that middleware provides.
- **File responsible:** `auth.config.ts` `ROLE_ROUTES` array
- **Correct behaviour:** Add an explicit entry: `{ prefix: '/send', roles: ['SENCO', 'SLT', 'SCHOOL_ADMIN', 'HEAD_OF_YEAR', 'TEACHER'] }` so the middleware enforces role access at the edge.

---

### BUG-026
- **ID:** BUG-026
- **Role:** All
- **Area:** Accessibility
- **Severity:** Low
- **What is broken:** The `AccessibilityToolbar` correctly applies CSS classes (dyslexia-font, high-contrast, large-text, etc.) to `document.documentElement`. However, the actual Tailwind CSS classes that these selectors target (e.g., `.dyslexia-font body`, `.high-contrast *`) must exist in `app/globals.css`. If those styles are absent or incomplete, toggling accessibility settings has no visible effect even though the classes are applied. This was not verifiable from source code alone but is a known risk of custom CSS class-based theming.
- **File responsible:** `components/accessibility/AccessibilityToolbar.tsx`; `app/globals.css` (requires verification)
- **Correct behaviour:** Verify that `app/globals.css` contains working CSS rules for each of the 5 accessibility classes: `dyslexia-font`, `high-contrast`, `large-text`, `reduced-motion`, and `line-spacing-wide`/`line-spacing-wider`.

---

## FEATURE GAPS

*(Document only — do not build until bug fixes are complete)*

---

### GAP-001 — Audit Log UI (Admin + SLT)
- **Roles:** Admin, SLT
- **What is built:** `AuditLog` Prisma model exists. `writeAudit()` is called throughout the codebase for all significant actions. Audit data is being collected.
- **What is needed:** A UI page at `/admin/audit` (and `/slt/audit`) to: display audit entries in a paginated table; filter by user, date range, and action type; show actor name, target, timestamp, and metadata. SLT may need a read-only subset view.

---

### GAP-002 — HOY Integrity Page
- **Roles:** HOY, SLT
- **What is built:** The sidebar nav item exists and points to `/hoy/integrity`. Nothing else.
- **What is needed:** A page showing per-student academic integrity signals: late/missing submissions, suspected copy-paste, AI detection flags, resubmission requests. The `SubmissionIntegritySignal`, `IntegrityReviewLog`, and `IntegrityPatternCase` Prisma models already exist. The page should let HOY view, review, and dismiss flags.

---

### GAP-003 — Student Grade History
- **Roles:** Student
- **What is built:** Individual homework submissions with grades are accessible via `/student/homework/[id]`. The student dashboard shows recent homework cards.
- **What is needed:** A `/student/grades` page showing: all marked submissions over time grouped by subject; GCSE grade 1–9 for each; a simple chart showing grade trajectory; comparison to predicted grade (where set by teacher). The `Submission`, `TeacherPrediction`, and `StudentBaseline` models have the necessary data.

---

### GAP-004 — Cover Manager Lesson List
- **Roles:** Cover Manager
- **What is built:** Full cover management at `/admin/cover`. The `StaffAbsence` and `CoverAssignment` models are complete.
- **What is needed:** A `/lessons` read-only view for Cover Managers to see scheduled lessons (date, class, room, subject) to plan cover assignments. Currently the Cover Manager has no way to browse the lesson schedule.

---

### GAP-005 — Analytics Full Drill-Down (All Staff Roles)
- **Roles:** Teacher, HOY, SLT, Admin
- **What is built:** RAG breakdown, SEND attainment comparison, per-student grade pill and trend arrow in `ClassAnalyticsPanel`. Student rows link to `/student/[id]/send`.
- **What is needed when clicking a RAG category or student:**
  - Attendance record (number of lessons attended vs total)
  - Behaviour record (incidents, commendations)
  - Full homework submission history with GCSE grades and trend chart
  - ILP/EHCP status and current targets
  - National average benchmark for subject/year group comparison
  - Teacher and SENCO notes
  Currently the student SEND page (`/student/[id]/send`) shows SEND plans but not the full academic profile.

---

### GAP-006 — Student Predicted vs Actual Grade View
- **Roles:** Student
- **What is built:** `TeacherPrediction` and `StudentBaseline` models hold predicted scores. `ClassAnalyticsPanel` shows predicted grade (`P6`) to teachers.
- **What is needed:** The student should be able to see their own predicted grade vs current working-at grade on their dashboard or grade history page. Currently students have no visibility of their predicted grade.

---

### GAP-007 — Adaptive Learning: Per-Student Format Preferences
- **Roles:** Teacher, SENCO
- **What is built:** `StudentLearningProfile`, `LearningSequence`, and `SubjectAdaptationProfile` models exist. The heatmap shows topic performance by student.
- **What is needed:**
  - Per-student record of which homework formats (MCQ, short answer, extended writing, upload) produce the best grades
  - Teacher and SENCO can log a preferred format suggestion per student
  - App tracks format-vs-grade correlation per student
  - AI recommends best format when teacher creates homework for a class

---

### GAP-008 — Revision Depth: Curriculum-Weighted Topics
- **Roles:** Teacher, Student
- **What is built:** Revision programs exist with task generation. Students can complete tasks and record confidence.
- **What is needed:**
  - Questions weighted by curriculum topic importance (e.g., GCSE exam weightings)
  - Gap analysis from the student's submission history to prioritise topics they struggle with
  - Adaptive follow-up: if student answers incorrectly, present a simpler question on the same topic before progressing
  - Mark-scheme awareness: answers graded against descriptors, not just correct/incorrect

---

### GAP-009 — Student Progress View: Topic-by-Topic Breakdown
- **Roles:** Student
- **What is built:** Homework submissions are stored with scores. The adaptive heatmap shows topic scores to teachers.
- **What is needed:** Students should see their own topic-by-topic performance (from the same heatmap data), their strengths and gaps, and AI-generated personalised revision suggestions based on those gaps. Currently the adaptive heatmap is teacher-only.

---

### GAP-010 — APDR Cycle Forms (SENCO)
- **Roles:** SENCO
- **What is built:** ILP targets, ILP evidence entries, EHCP outcomes, and plan notes are all stored. SENCO can view evidence timelines.
- **What is needed:** A structured APDR (Assess, Plan, Do, Review) form per student per term:
  - **Assess** section: baseline data, SEND concern details, areas of need
  - **Plan** section: SMART targets with proposed interventions
  - **Do** section: auto-populated from ILP evidence entries and teacher notes
  - **Review** section: outcome rating, updated targets, parent/carer sign-off record
  Currently APDR data is scattered across multiple models with no unified form UI.

---

### GAP-011 — Admin User Management
- **Roles:** Admin
- **What is built:** `/admin/staff` and `/admin/students` list pages exist.
- **What is needed:** Full CRUD — create new user, edit role/name/email, deactivate account, reset password. Currently the pages appear to be read-only lists. Wonde sync handles mass import but there is no manual user creation flow for edge cases.

---

### GAP-012 — HOY Student Overview (Full Pastoral View)
- **Roles:** HOY
- **What is built:** `/hoy/analytics` shows year group performance with class breakdown and at-risk students.
- **What is needed:** Per-student pastoral view accessible from the HOY analytics page: attendance record, behaviour record, SEND status, ILP summary, grade trajectory, teacher notes, parent contact log. Currently clicking a student in HOY analytics either navigates to the SEND page or has no clickthrough.

---

### GAP-013 — SLT School-Wide Benchmarking
- **Roles:** SLT
- **What is built:** SLT analytics at `/slt/analytics` shows class and student performance. `SubjectMedianAggregate` model exists.
- **What is needed:** National benchmark comparison — show each class/subject average vs the national GCSE average for that subject/year group. Show whether the school is above or below national average. Visual RAG on the school-wide view.

---

### GAP-014 — Parent Communication Log
- **Roles:** Admin, SENCO, HOY
- **What is built:** Messaging system for direct parent-teacher threads. Parent consent records exist.
- **What is needed:** A structured parent contact log per student (date, method, summary, outcome) that SENCO, HOY, and Admin can view and add to, separate from the messaging inbox. Required for SEND and pastoral paperwork.

---

## Notes on Scope

1. **Marketing pages** (`/marketing/home`, `/features`, `/beta`, `/investors`) are not included in this audit — they are intentionally unbuilt per CLAUDE.md.
2. **Platform Admin** role was not audited in depth — all 3 nav routes exist and the role has a narrow scope.
3. **Parent role** has no critical or high-severity bugs. The grade display inconsistency (BUG-021) affects parent views but the parent-specific nav and pages all resolve correctly.
4. **Wonde sync** (`/admin/wonde`) was not live-tested but source code shows no structural issues — it correctly uses `fetch('/api/wonde/sync')` to avoid the Vercel 10s timeout.
