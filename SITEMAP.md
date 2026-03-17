# Omnis — Application Sitemap

Last updated: 2026-03-17

---

## Public Routes

| Path | Description | Status |
|------|-------------|--------|
| `/login` | Credentials login form (email + password) | ✅ Built |

---

## Teacher / Head of Dept Routes

| Path | Description | Key Components | Status |
|------|-------------|----------------|--------|
| `/dashboard` | Weekly calendar — create/view/edit lessons | `WeeklyCalendar`, `LessonSlideOver`, `LessonFolder` | ✅ Built |
| `/homework` | Homework list with filter chips | `HomeworkFilterView`, `SetHomeworkModal` | ✅ Built |
| `/homework/[id]` | Homework detail — pupil submission list + marking panel | `HomeworkMarkingView` | ✅ Built |
| `/homework/[id]/mark/[submissionId]` | Full-page per-submission marking | `SubmissionMarkingView` | ✅ Built |
| `/classes` | Class roster — expandable cards with student lists | `ClassListView` | ✅ Built |
| `/analytics` | Unified analytics — Classes + Students tabs | `StudentAnalyticsView` | ✅ Built |
| `/analytics/adaptive` | Adaptive homework + Bloom's taxonomy charts | `AdaptiveAnalyticsDashboard` | ✅ Built |
| `/analytics/students/[id]` | Individual student detail view | `StudentDashboard` | ✅ Built |
| `/revision-program` | Revision program list with filter tabs | `RevisionProgramList` | ✅ Built |
| `/revision-program/new` | 4-step wizard to create revision program | `RevisionProgramCreator`, `RevisionAnalysisPanel` | ✅ Built |
| `/revision-program/[programId]` | Program detail — task list + student marking | `RevisionProgramDetail` | ✅ Built |
| `/ai-generator` | AI resource generator | `AiGeneratorShell` | ✅ Built |
| `/messages` | Threaded messaging inbox | `MessagingShell` | ✅ Built |
| `/messages/[threadId]` | Individual message thread | `ThreadView` | ✅ Built |
| `/notifications` | Platform notifications with read/mark-all | `NotificationsView` | ✅ Built |
| `/plans` | SEND plans list | `PlansView` | ✅ Built |
| `/settings` | User settings — 5 tabs (profile, prefs, privacy, sharing, security) | `SettingsShell` | ✅ Built |
| `/settings/accessibility` | Accessibility mode panel | `AccessibilityToolbar` | ✅ Built |

---

## Student Routes

| Path | Description | Key Components | Status |
|------|-------------|----------------|--------|
| `/student/dashboard` | Student dashboard — upcoming homework + grades | `StudentDashboard` | ✅ Built |
| `/student/homework/[id]` | Homework submission view | `HomeworkSubmissionView`, `HomeworkTypeRenderer` | ✅ Built |
| `/student/revision` | Revision planner — active tasks + study guide | `StudentRevisionView` | ✅ Built |
| `/student/revision/[taskId]` | Individual revision task — quiz/free-text with auto-save | `RevisionTaskView` | ✅ Built |
| `/student/grades` | My grades list | — | ❌ Not built |
| `/student/homework` | Homework list (individual items exist) | — | ❌ Not built |
| `/messages` | Student messaging inbox | `MessagingShell` | ✅ Built |
| `/notifications` | Student notifications | `NotificationsView` | ✅ Built |
| `/settings` | Profile + accessibility settings | `SettingsShell` | ✅ Built |
| `/revision` | Student revision planner (older, redirects) | `RevisionDashboard` | ✅ Built |

---

## Parent Routes

| Path | Description | Key Components | Status |
|------|-------------|----------------|--------|
| `/parent/dashboard` | Parent dashboard — child's progress overview | `ParentDashboard` | ✅ Built |
| `/parent/progress` | Detailed progress view for child | — | ✅ Built |
| `/parent/messages` | Parent messaging | `ParentMessagesView` | ✅ Built |
| `/parent/consent` | GDPR consent management | — | ✅ Built |

---

## SENCO Routes

| Path | Description | Key Components | Status |
|------|-------------|----------------|--------|
| `/senco/dashboard` | SENCO overview — active concerns, flags, plans | `SencoDashboard` | ✅ Built |
| `/senco/concerns` | Concern register with filters | — | ✅ Built |
| `/senco/ilp` | ILP management list | — | ✅ Built |
| `/senco/early-warning` | Early warning flags dashboard | — | ✅ Built |
| `/senco/ehcp` | EHCP plans list | — | ✅ Built |
| `/senco/ilp-evidence` | ILP evidence linking | `EhcpOutcomeTracker` | ✅ Built |
| `/send/dashboard` | SEND monitoring dashboard | — | ✅ Built |
| `/send/review-due` | Plans due for review | — | ✅ Built |
| `/send/ilp` | ILP list | — | ✅ Built |
| `/send/ilp/[studentId]` | Individual student ILP detail | — | ✅ Built |
| `/student/[studentId]/send` | Student SEND profile | — | ✅ Built |
| `/send-scorer` | Standalone resource SEND scorer | `ScorerView` | ✅ Built |
| `/analytics` | Analytics (SENCO has access) | `StudentAnalyticsView` | ✅ Built |

---

## Head of Year Routes

| Path | Description | Key Components | Status |
|------|-------------|----------------|--------|
| `/hoy/analytics` | Head of Year analytics | — | ✅ Built |
| `/hoy/integrity` | Submission integrity monitoring | — | ❌ Not built |
| `/dashboard` | Calendar | `WeeklyCalendar` | ✅ Built |
| `/revision-program` | Revision programs | `RevisionProgramList` | ✅ Built |

---

## School Admin Routes

| Path | Description | Key Components | Status |
|------|-------------|----------------|--------|
| `/admin/dashboard` | Admin overview — stats + quick links | `AdminDashboardStats` | ✅ Built |
| `/admin/staff` | Staff list with role/class counts | `AdminStaffTable` | ✅ Built |
| `/admin/students` | Student browser by year group | `AdminStudentTable` | ✅ Built |
| `/admin/classes` | Class list with teacher assignments | `AdminClassTable` | ✅ Built |
| `/admin/timetable` | Weekly timetable grid | `AdminTimetableGrid` | ✅ Built |
| `/admin/calendar` | Term dates + holiday calendar | `AdminCalendar` | ✅ Built |
| `/admin/gdpr` | GDPR consent management | `GdprAdminShell` | ✅ Built |
| `/admin/cover` | Cover management | `CoverDashboard` | ✅ Built |
| `/admin/wonde` | Wonde MIS sync — test, run sync, logs | `WondeSyncPanel` | ✅ Built |
| `/admin/audit` | Immutable audit log | — | ❌ Not built |
| `/slt/analytics` | SLT analytics dashboard | — | ✅ Built |

---

## SLT Routes

| Path | Description | Key Components | Status |
|------|-------------|----------------|--------|
| `/slt/analytics` | School-wide performance analytics | — | ✅ Built |
| `/slt/audit` | SLT audit log | — | ❌ Not built |
| `/admin/cover` | Cover management (shared with admin) | `CoverDashboard` | ✅ Built |

---

## Platform Admin Routes

| Path | Description | Key Components | Status |
|------|-------------|----------------|--------|
| `/platform-admin/dashboard` | Platform stats — schools, users, flags | `PlatformDashboardStats` | ✅ Built |
| `/platform-admin/schools` | School list + create school | — | ✅ Built |
| `/platform-admin/oak-sync` | Oak curriculum sync control | — | ✅ Built |

---

## API Routes

| Path | Method | Purpose |
|------|--------|---------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth credentials + session |
| `/api/settings/avatar` | POST | Upload profile picture (base64, max 5 MB) |
| `/api/export/lesson-plan/[lessonId]` | GET | PDF export — lesson plan |
| `/api/export/homework/[homeworkId]` | GET | PDF export — homework sheet |
| `/api/export/homework-summary` | GET | PDF export — marking summary |
| `/api/export/revision-timetable` | GET | PDF export — revision timetable |
| `/api/cron/oak-sync` | GET | Delta Oak curriculum sync (cron, requires `CRON_SECRET`) |
| `/api/cron/early-warning` | GET | SEND early-warning pattern checks (cron, requires `CRON_SECRET`) |

---

## Pending / Unbuilt Routes

| Path | Notes |
|------|-------|
| `/lessons` | Resource-focused lesson library — not started |
| `/resources` | Standalone resource browser — not started |
| `/student/grades` | Student grades list — not started |
| `/student/homework` | Student homework list (individual submission pages exist) |
| `/hoy/integrity` | Submission integrity for Head of Year — not started |
| `/admin/audit` | Immutable audit log viewer — not started |
| `/slt/audit` | SLT audit log viewer — not started |
| `/marketing/home` | Marketing landing page — TODO |
| `/marketing/features` | Features page — TODO |
| `/marketing/beta` | Beta signup + contact form → `ivanyardley@me.com` — TODO |
| `/marketing/investors` | Investors page + contact form → `ivanyardley@me.com` — TODO |
