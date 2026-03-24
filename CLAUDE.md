# Omnis App — Claude Reference

> Last updated: 2026-03-23. Authoritative reference for Claude sessions.

---

## Active Development Framework

Three prompt-library files live in the project root. Reference these when starting any development task:

| File | Description |
|---|---|
| `DEVELOPMENT.md` | General bug/feature prompt library — 18 recipes covering fixes, new pages, schema changes, deploy checks, and more |
| `ADAPTIVE-LEARNING-LOOP.md` | 7-step teacher lesson → adaptive homework loop — from calendar fix through to per-student adaptive profiles |
| `SEND-FRAMEWORK.md` | 8-step ILP/EHCP/APDR/adaptive SEND system — from auto-ILP generation through to SLT SEND reporting dashboard |

---

## Project Description

Omnis is a multi-tenant UK secondary school management SaaS. It covers the full
teacher workflow: lesson planning, Oak National Academy resource integration,
homework (set / auto-mark / mark / return), class roster with SEND tracking,
analytics, adaptive learning, EHCP/ILP management, messaging, cover management,
GDPR consent, a student revision planner, a teacher revision program builder,
and a Wonde MIS sync integration. Deployed on Vercel, database on Supabase.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19.2.3, Tailwind CSS v4, Recharts, Lucide React |
| Auth | NextAuth v5 (`next-auth@5.0.0-beta.30`) — Credentials + JWT |
| ORM | Prisma v6.19.2 |
| Database | PostgreSQL via Supabase |
| AI | Anthropic Claude SDK (`@anthropic-ai/sdk ^0.78.0`) — `claude-sonnet-4-6` |
| PDF | Puppeteer v24 |
| Language | TypeScript 5 |
| Testing | Playwright 1.58 |

**Tailwind v4:** Uses `@import "tailwindcss"` in `app/globals.css`. Full class
literals required — no dynamic string construction (scanner can't see it).

**DB connection:** `DATABASE_URL` must use port **6543** with
`?pgbouncer=true&connection_limit=5`. `DIRECT_URL` uses port 5432 for
migrations (`prisma db push`).

---

## Environment (`.env.local`)

```
DATABASE_URL="...port 6543...?pgbouncer=true&connection_limit=5"
DIRECT_URL="...port 5432..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="..."
RESEND_API_KEY="..."      # for marketing contact forms (not yet built)
CRON_SECRET="..."         # bearer token for Oak sync + early-warning cron endpoints
WONDE_API_TOKEN="..."     # Wonde MIS API token
WONDE_SCHOOL_ID="..."     # Wonde school ID (A1930499544 for test school)
```

---

## Auth & Session

```typescript
// JWT session shape (lib/auth.ts + auth.config.ts)
session.user = { id, schoolId, schoolName, role, firstName, lastName }
```

`middleware.ts` (NextAuth v5 auth export) protects all routes except
`/login`, `/api`, `/_next/*`, `favicon.ico`. Role-based redirects are in
`auth.config.ts` via `ROLE_ROUTES` array and `getRoleHome()`:

| Role | Home |
|---|---|
| STUDENT | `/student/dashboard` |
| PARENT | `/parent/dashboard` |
| SENCO | `/send/dashboard` |
| SLT | `/slt/analytics` |
| SCHOOL_ADMIN | `/admin/dashboard` |
| PLATFORM_ADMIN | `/platform-admin/dashboard` |
| All others | `/dashboard` |

---

## Demo Credentials (all password: `Demo1234!`)

| Email | Role |
|---|---|
| `j.patel@omnisdemo.school` | TEACHER (English, 3 classes) |
| `r.morris@omnisdemo.school` | SENCO |
| `t.adeyemi@omnisdemo.school` | HEAD_OF_YEAR (Year 9) |
| `d.brooks@omnisdemo.school` | HEAD_OF_DEPT (English) |
| `c.roberts@omnisdemo.school` | SLT |
| `k.wright@omnisdemo.school` | TEACHER (Maths) |
| `a.hughes@students.omnisdemo.school` | STUDENT (Year 9) |
| `l.hughes@parents.omnisdemo.school` | PARENT |
| `admin@omnisdemo.school` | SCHOOL_ADMIN |
| `platform@omnis.edu` | PLATFORM_ADMIN |

---

## Commands

```bash
# Dev
npm run dev                                       # Turbopack dev server
npm run build                                     # Production build (must pass clean)
npm run lint                                      # ESLint

# DB
npx prisma db push                                # Apply schema changes (uses DIRECT_URL)
npx prisma studio                                 # DB browser
npx tsc --noEmit                                  # TypeScript check without building

# Seeds (all use .env.local)
npm run db:seed            # Main seed — demo users, school, classes, lessons, homework
npm run db:seed-classes    # Classes only
npm run db:seed-english    # English students + submissions
npm run revision:seed      # Revision exams + sessions for demo student
npm run topup:seed         # Top-up seed (additional demo data)
npm run wonde:seed         # Wonde tables — Oakfield Academy (30 staff, 120 students)
npm run platform:seed      # Platform admin + 3 demo schools + feature flags
npm run send:seed          # SEND concerns, ILPs, flags, EHCP plans
npm run messages:seed      # 5 demo message threads

# Oak content sync
npm run oak:sync           # Full Oak lesson sync (11,000+ lessons) — slow
npm run oak:delta          # Delta sync — only changed lessons since last run

# E2E tests (Playwright)
npm run test:e2e           # Headless
npm run test:e2e:ui        # Playwright UI
npm run test:e2e:headed    # Headed browser

# Background dev server
npm run dev > /tmp/omnis-dev.log 2>&1 &
tail -f /tmp/omnis-dev.log
```

---

## Routes (`app/`)

```
/                           → redirects to role home
/login                      Login form (public)
/dashboard                  Teacher weekly calendar (TEACHER, HOD, HOY)
/homework                   Homework list + filters
/homework/[id]              Homework detail — pupil list, marking panel
/homework/[id]/mark/[subId] Full-page per-submission marking
/classes                    Class list with student rosters
/analytics                  Unified analytics — Classes + Students tabs (all staff)
/analytics/adaptive         Adaptive learning analytics
/settings                   User settings (5 tabs: Profile, Professional, Privacy, Sharing, Password)
/settings/accessibility     Accessibility preferences
/messages                   Messaging — thread list
/messages/[threadId]        Individual thread
/notifications              Platform-wide notifications
/plans                      SEND plans list
/ai-generator               AI resource generator
/send-scorer                Standalone SEND resource scorer
/revision-program           Teacher revision programs list
/revision-program/new       Create revision program (4-step wizard)
/revision-program/[id]      Revision program detail
/student/dashboard          Student homework dashboard
/student/homework/[id]      Student homework submission
/student/revision           Student revision planner
/student/revision/[taskId]  Student revision task
/student/[studentId]/send   Student SEND overlay
/parent/dashboard           Parent overview
/parent/progress            Parent progress view
/parent/messages            Parent messaging
/parent/consent             Parent GDPR consent
/send/dashboard             SENCO dashboard
/send/review-due            Reviews due
/send/ilp                   ILP list
/send/ilp/[studentId]       Student ILP detail
/senco/dashboard            SENCO hub
/senco/concerns             SEND concerns
/senco/ilp                  ILP management
/senco/early-warning        Early warning flags
/senco/ehcp                 EHCP plans
/senco/ilp-evidence         ILP evidence linking
/hoy/analytics              Head of Year analytics
/slt/analytics              SLT analytics
/admin/dashboard            School admin dashboard
/admin/wonde                Wonde MIS sync panel
/admin/gdpr                 GDPR consent management
/admin/cover                Cover management (redirect)
/admin/calendar             Admin timetable view
/admin/classes              Admin class management
/admin/staff                Admin staff management
/admin/students             Admin student management
/admin/timetable            Admin timetable grid
/platform-admin/dashboard   Platform admin stats
/platform-admin/schools     School list
/platform-admin/oak-sync    Oak sync status
/revision                   Student revision (redirect to /student/revision)

/api/auth/[...nextauth]     NextAuth endpoints
/api/settings/avatar        Avatar upload (POST — JPG/PNG, max 5MB, base64 in DB)
/api/export/lesson-plan/[id]  PDF export
/api/export/homework/[id]     PDF export
/api/export/homework-summary  PDF export
/api/export/revision-timetable PDF export
/api/cron/oak-sync          Oak delta sync cron (Sun 02:00 UTC)
/api/cron/early-warning     SEND early warning cron (Mon–Fri 06:00 UTC)
/api/wonde/sync             Wonde full sync — POST, 300s maxDuration, SCHOOL_ADMIN/SLT only

marketing/home, /features, /beta, /investors     ← TODO (not yet built)
/lessons, /resources, /hoy/integrity             ← not yet built (show not-found)
/student/grades, /student/homework (list)         ← not yet built
/admin/audit, /slt/audit                          ← not yet built
```

---

## Actions (`app/actions/`)

| File | Key exports |
|---|---|
| `lessons.ts` | getWeekLessons, createLesson, getLessonDetails, updateLessonOverview, addUrlResource, addUploadedResource, addLibraryResource, removeResource, deleteLesson, rescheduleLesson, updateLessonObjectives, getClassRoster, getStudentClassDetail, getSchoolResourceLibrary |
| `homework.ts` | getHomeworkList, getHomeworkForMarking, getSubmissionForMarking, createHomework, markSubmission, generateHomeworkFromResources, autoMarkSubmission, bulkAutoMarkAndQueue, generateHomeworkContent, extractLearningFromLabel, resendHomeworkReminder |
| `analytics.ts` | getAnalyticsFilters, getStudentPerformance, getStudentDetail, getClassSummaries, getHomeworkAdaptiveAnalytics |
| `settings.ts` | getMySettings, getMyAvatarUrl, saveProfile, saveProfessionalPrefs, savePrivacySettings, saveSharingSettings, changePassword |
| `oak.ts` | getOakSubjects, searchOakLessons, getOakLesson, addOakLessonToLesson |
| `send-scorer.ts` | getOrCreateSendScore, forceRescoreLesson, searchLessonsWithScores |
| `send-support.ts` | 25 SEND/concern/ILP/notification actions |
| `ehcp.ts` | createEhcpPlan, getStudentEhcp, linkHomeworkToIlpTarget, linkSubmissionToEhcpOutcome, generateIlpProgressReport, generateEhcpAnnualReview |
| `adaptive-learning.ts` | getStudentLearningProfile, updateLearningProfile, suggestSpacedRepetition, suggestNextHomework, getAdaptiveHomeworkSuggestions |
| `gdpr.ts` | getPurposes, createPurpose, getConsentMatrix, exportConsentCsv, getDataSubjectRequests, recordConsent |
| `revision.ts` | getMyExams, addExam, getMyRevisionSessions, generateRevisionPlan, saveRevisionPlan, markSessionComplete |
| `revision-program.ts` | 8 actions — createRevisionProgram, getRevisionPrograms, getRevisionProgramDetail, generateRevisionTasks, getStudentRevisionTasks, completeRevisionTask, updateTaskConfidence, getRevisionAnalytics. Rate limit: 3 programs/class/week |
| `cover.ts` | getTodaysCoverSummary, logAbsence, getAvailableStaff, assignCover, getCoverHistory |
| `platform-admin.ts` | getPlatformStats, getSchoolList, createSchool, getFeatureFlags, setFeatureFlag, getAuditLog |
| `messaging.ts` | getMyThreads, getThread, createThread, sendMessage, getUnreadMessageCount, getContactList |
| `accessibility.ts` | getAccessibilitySettings, saveAccessibilitySettings |
| `student.ts` | getStudentHomework, submitHomework |
| `parent.ts` | sendParentMessage |
| `wonde.ts` | testWondeConnection, triggerWondeSync (legacy — now prefer /api/wonde/sync), getWondeConfig, getWondeSyncLogs, getWondeCounts |
| `admin.ts` | School admin actions |
| `ai-generator.ts` | AI resource generation |

---

## Key Components (`components/`)

| Component | Purpose |
|---|---|
| `Sidebar.tsx` | Role-based left nav; avatar chip at bottom |
| `AppShell.tsx` | Authenticated layout wrapper; loads avatar via getMyAvatarUrl() on mount |
| `WeeklyCalendar.tsx` | Teacher calendar — click=slide-over, dbl-click=folder. Fetches non-current weeks via getWeekLessons() |
| `LessonFolder.tsx` | Lesson detail — 6 tabs: Overview, Resources, Homework, Class, Class Insights, Revision. Class tab shows all students with inline SEND badges + expandable detail per SEND student (ILP goals, EHCP provisions, K Plan). wizardStep 4=Resources, 5=Homework |
| `LessonSlideOver.tsx` | Create new lesson panel — saves only at final step |
| `UnifiedResourceSearch.tsx` | Combined Oak + school library search. Props: lessonId, subjectSlug, yearGroup, lessonTitle, onAdded, onGenerateHomework. Guards: skips load if subjectSlug absent. Shows "Generate homework?" banner after adding resource |
| `ResourcePreviewModal.tsx` | Oak lesson preview — key learning points, vocab, quizzes, iframe download preview. Takes `slug` prop, fetches detail internally |
| `ClassRosterTab.tsx` | Student roster with SEND badges, expand for recent homework scores |
| `ClassInsightsTab.tsx` | Class performance insights |
| `admin/WondeSyncPanel.tsx` | MIS sync — uses fetch('/api/wonde/sync') not server action (avoids Vercel 10s timeout) |
| `HomeworkFilterView.tsx` | Homework list + filter chips + router.refresh() after create |
| `HomeworkMarkingView.tsx` | Split-panel marking — filter chips (All/Submitted/Returned/Missing/SEND), SEND badges (EHCP purple, SEN blue), AI score badge, gradeState colours |
| `SubmissionMarkingView.tsx` | Full-page per-submission marking |
| `HomeworkSubmissionView.tsx` | Student submission UI |
| `homework/HomeworkCreatorV2.tsx` | 6-step homework creation modal |
| `homework/AdaptiveSubmissionView.tsx` | Marking with AI suggestions + EHCP evidence |
| `homework/HomeworkTypeRenderer.tsx` | Input UI per homework variant |
| `StudentAnalyticsView.tsx` | Analytics — Classes + Students tabs |
| `StudentDashboard.tsx` | Individual student detail |
| `StudentAvatar.tsx` | Avatar (photo or coloured initials, xs–lg) |
| `ClassListView.tsx` | Expandable class cards |
| `settings/SettingsShell.tsx` | Settings (5 tabs) — calls router.refresh() after avatar upload |
| `messaging/MessagingShell.tsx` | Two-panel messaging layout |
| `messaging/ThreadView.tsx` | Thread with 30s poll |
| `messaging/UnreadBadge.tsx` | Blue badge, 60s poll |
| `send/SendScoreCard.tsx` / `SendScoreBadge.tsx` | SEND score display |
| `send/ScorerView.tsx` | Standalone SEND scorer |
| `send-support/SencoDashboard.tsx` + siblings | SEND monitoring UI |
| `gdpr/GdprAdminShell.tsx` + siblings | GDPR consent management |
| `platform-admin/PlatformDashboardStats.tsx` + siblings | Platform admin UI |
| `ai-generator/AiGeneratorShell.tsx` + siblings | AI resource generator |
| `cover/CoverDashboard.tsx` + siblings | Cover management |
| `revision/RevisionDashboard.tsx` + siblings | Student revision planner |
| `revision-program/RevisionProgramCreator.tsx` | 4-step wizard |
| `revision-program/RevisionProgramList.tsx` / `RevisionProgramDetail.tsx` | Program management |
| `revision-program/RevisionTaskView.tsx` / `StudentRevisionView.tsx` | Student task UI (localStorage auto-save, 1–5 star confidence) |
| `revision-program/RevisionProgressChart.tsx` | Student progress visualisation |
| `accessibility/AccessibilityToolbar.tsx` + siblings | Accessibility panel |
| `homework/EhcpOutcomeTracker.tsx` | EHCP outcome progress |
| `analytics/AdaptiveAnalyticsDashboard.tsx` | Bloom's + adaptive charts |
| `ExportPdfButton.tsx` | PDF download button |

---

## Library (`lib/`)

| File | Purpose |
|---|---|
| `lib/auth.ts` | NextAuth full config — Credentials provider, bcrypt, Prisma adapter, JWT callbacks |
| `auth.config.ts` | Edge-safe auth config — middleware role routing only, no Prisma/bcrypt |
| `lib/prisma.ts` | Prisma singleton + `writeAudit()` helper |
| `lib/grading.ts` | `percentToGcseGrade()`, `suggestGrade()`, `normalizeScoreForForm()`, `formatScore()` |
| `lib/accessibility.ts` | `settingsToClasses()`, defaults |
| `lib/sendReview.ts` / `sendReviewCached.ts` | SEND accessibility scoring via Claude — score 0–100 |
| `lib/sendInsights.ts` | SEND insight aggregation |
| `lib/send/early-warning.ts` | Pattern checks → EarlyWarningFlags + SENCO notifications |
| `lib/send/concern-analyser.ts` | Claude AI concern pattern analysis |
| `lib/curriculum.ts` | Curriculum helpers |
| `lib/pdf/generator.ts` | Puppeteer PDF generation |
| `lib/pdf/lesson-plan-template.ts` / `homework-template.ts` / `revision-timetable-template.ts` / `homework-summary-template.ts` | PDF HTML templates |
| `lib/wonde-client.ts` | Typed Wonde API client — paginated fetch for all entity types. Interfaces: WondePeriod (day/day_number fields), WondeTimetableEntry (period/employee as flat strings), WondeContact (relationship as nested object) |
| `lib/wonde-sync.ts` | Full sync engine — upserts employees, students, contacts, groups, classes, periods, timetable. Inner try/catch per student contact so one bad record doesn't abort all |
| `lib/oak-delta-sync.ts` | Oak delta sync logic |
| `lib/revision/analysis-engine.ts` | `analyseClassPerformance()` |
| `lib/revision/content-generator.ts` | `generateRevisionTask()` with SEND adaptations + ILP integration |

---

## Database Schema Summary

### Key Enums

| Enum | Values |
|---|---|
| `Role` | SUPER_ADMIN, SCHOOL_ADMIN, SLT, HEAD_OF_DEPT, HEAD_OF_YEAR, COVER_MANAGER, TEACHER, SENCO, STUDENT, PARENT, PLATFORM_ADMIN |
| `HomeworkType` | MCQ_QUIZ, SHORT_ANSWER, EXTENDED_WRITING, MIXED, UPLOAD |
| `HomeworkStatus` | DRAFT, PUBLISHED, CLOSED |
| `SubmissionStatus` | SUBMITTED, UNDER_REVIEW, RESUBMISSION_REQ, MARKED, RETURNED |
| `SendStatusValue` | NONE, SEN_SUPPORT, EHCP |
| `ILPStatus` | DRAFT, ACTIVE, UNDER_REVIEW, ARCHIVED |
| `LessonType` | NORMAL, COVER, INTERVENTION, CLUB |
| `AuditAction` | HOMEWORK_CREATED, SUBMISSION_GRADED, GRADE_OVERRIDDEN, ILP_CREATED, SEND_STATUS_CHANGED, LESSON_PUBLISHED, WONDE_SYNC_COMPLETED, RESOURCE_UPLOADED, USER_SETTINGS_CHANGED, … |

### ILPTarget.status valid values
`"active"` | `"achieved"` | `"not_achieved"` | `"deferred"` — **NOT** `"in_progress"` (this caused multiple production crashes)

### Model Groups

- **Tenant:** `School`, `TermDate`
- **Users/Classes:** `User`, `SchoolClass`, `ClassTeacher`, `Enrolment`, `ParentChildLink`
- **Lessons/Resources:** `Lesson`, `Resource`, `ResourceReview`, `OakContentCache`
- **Homework:** `Homework`, `HomeworkQuestion`, `Submission`, `SubmissionAttempt`, `SubmissionAttemptAnswer`
- **Integrity:** `SubmissionIntegritySignal`, `IntegrityReviewLog`, `IntegrityPatternCase`
- **SEND:** `SendStatus`, `SendScoreCache`, `SendQualityScore`, `SendConcern`, `EarlyWarningFlag`, `SendNotification`
- **ILP/EHCP:** `ILP`, `ILPTarget`, `Plan`, `PlanTarget`, `EhcpPlan`, `EhcpOutcome`, `IlpHomeworkLink`, `HomeworkEhcpEvidence`
- **Adaptive:** `StudentLearningProfile`, `LearningSequence`, `SubjectAdaptationProfile`
- **Messaging:** `MsgThread`, `MsgParticipant`, `MsgMessage`
- **Analytics:** `ClassPerformanceAggregate`, `SubjectMedianAggregate`
- **System:** `Notification`, `AuditLog`, `UserSettings`, `UserAccessibilitySettings`
- **Revision (student):** `RevisionExam`, `RevisionSession`, `RevisionConfidence`
- **Revision Program (teacher-created):** `RevisionProgram`, `RevisionTask`, `RevisionProgress`, `RevisionAnalyticsCache`
- **Cover:** `StaffAbsence`, `CoverAssignment`
- **GDPR:** `ConsentPurpose`, `ConsentRecord`, `DataSubjectRequest`
- **Platform:** `SchoolFeatureFlag`, `PlatformAuditLog`, `GeneratedResource`
- **Wonde MIS (12 tables):** `WondeSchool`, `WondeStudent`, `WondeEmployee`, `WondeClass`, `WondeGroup`, `WondePeriod`, `WondeTimetableEntry`, `WondeAssessmentResult`, `WondeContact`, `WondeClassStudent`, `WondeDeletion`, `WondeSyncLog`
- **Oak sync:** `OakSubject`, `OakUnit`, `OakLesson`, `OakSyncLog`

---

## Sidebar Nav by Role

| Role | Nav items |
|---|---|
| TEACHER | Calendar, Homework, Classes, Analytics, Adaptive Learning, AI Generator, Messages |
| HEAD_OF_DEPT | Calendar, Homework, Classes, Analytics, Adaptive Learning, AI Generator, Messages |
| HEAD_OF_YEAR | Calendar, Analytics, Student Analytics, SEND Concerns, Messages |
| SENCO | SEND Dashboard, Concerns, ILP, Early Warning, EHCP Plans, ILP Evidence, Analytics, Resource Scorer, AI Generator, Messages |
| SCHOOL_ADMIN | Dashboard, MIS Sync, Users, Audit Log, Analytics, Cover, GDPR, Messages |
| SLT | Dashboard, Analytics, Audit Log, Cover, GDPR, Messages |
| COVER_MANAGER | Dashboard, Cover, Messages |
| STUDENT | Dashboard, Homework, Revision Planner, My Grades, Messages |
| PARENT | Dashboard, Progress, Consent, Messages |
| PLATFORM_ADMIN | Dashboard, Schools, Oak Sync |

Settings + avatar chip at sidebar bottom for all roles.

---

## Error Boundaries

`app/global-error.tsx` — catches anything not caught by route-level boundaries.

Route-level `error.tsx` files exist for: `dashboard`, `analytics`, `homework`,
`classes`, `messages`, `notifications`, `parent`, `plans`, `platform-admin`,
`revision`, `revision-program`, `send`, `send-scorer`, `senco`, `settings`,
`slt`, `ai-generator`, `student/revision`, `student/revision/[taskId]`,
`revision-program/[programId]`, `admin/dashboard`.

**Still missing:** `app/hoy/error.tsx`

---

## Vercel Config (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/oak-sync",      "schedule": "0 2 * * 0"   },
    { "path": "/api/cron/early-warning", "schedule": "0 6 * * 1-5" }
  ]
}
```

**IMPORTANT:** Do NOT add a `"functions"` block referencing App Router route
files (e.g. `app/api/wonde/sync/route.ts`). The `functions` key in
`vercel.json` is for Pages Router only. App Router Route Handlers use
`export const maxDuration = 300` inside the route file itself. Adding
`"functions"` for App Router paths breaks Vercel deployment.

---

## Key Patterns & Gotchas

### General
- **Server actions:** All in `app/actions/`. Always `'use server'` at top. Session via `auth()` from `lib/auth.ts`.
- **Multi-tenancy:** Every Prisma query scoped with `schoolId` from session. Never query without it.
- **Prisma:** Singleton in `lib/prisma.ts`. Restart dev server after schema changes or queries fail silently.
- **`SchoolClass.department`** is required (not nullable).
- **Lesson `classId`** is optional (supports out-of-hours/intervention lessons).
- **`createHomework`** requires `setAt` and `dueAt` as ISO strings; defaults to `status: 'PUBLISHED'`.
- **AI generation:** Falls back to stub content if `ANTHROPIC_API_KEY` absent. Always check Vercel function logs for `[generateHomeworkFromResources]` prefixed lines to diagnose AI failures.
- **SEND scoring:** Auto-scored on resource upload via `lib/sendReviewCached.ts`. Score 0–100 in `ResourceReview.sendScore`.
- **Avatar:** Stored as base64 data URL in `UserSettings.profilePictureUrl`. Max 5 MB, JPG/PNG. After upload, `revalidatePath('/', 'layout')` + `router.refresh()` needed for sidebar to update.
- **Audit logging:** Use `writeAudit()` from `lib/prisma.ts` for all auditable actions.
- **ConsentRecords:** INSERT-only (immutable audit trail).

### Calendar / Lessons
- `getWeekLessons(weekStartISO)` server action fetches any week's lessons using an OR: lessons where class has this teacher OR lessons created by this teacher (covers classless lessons).
- `rescheduleLesson` calls `revalidatePath('/dashboard')`. LessonFolder calls `router.refresh()` + `refreshLesson()` after saving — both needed.
- LessonFolder `getLessonDetails` is wrapped in try/catch returning null on error. The useEffect uses an async function with try/catch/finally and a `cancelled` flag to prevent spinner getting stuck.

### Oak Resources
- `searchOakLessons` uses **per-term OR matching** — `"Norman Conquest"` splits into `["Norman", "Conquest"]` and matches each independently across title, pupilLessonOutcome, unitSlug. Do not revert to exact-phrase matching.
- When `query` is present, `yearGroup` filter is **skipped** so keyword searches span all year groups.
- `UnifiedResourceSearch` does a two-pass search: first with exact yearGroup, then broadened to subject-only if < 3 results.
- `UnifiedResourceSearch` skips initial load if `subjectSlug` is absent.
- Oak subject slug mapping is done by `toOakSubjectSlug()` in `LessonFolder.tsx` — covers "Mathematics"→"maths", "English Literature"→"english", "PE"→"physical-education", etc.

### Homework
- `SAQuestion` type has optional `markScheme?: string` and `marks?: number` fields.
- `generateHomeworkFromResources` logs to console: `RAW AI RESPONSE`, `PARSED KEYS`, `questionsJson?.questions length`, `USING STUB FALLBACK`. Check Vercel function logs after clicking Generate.
- If `questionsJson` is missing from AI response, it retries once with a follow-up message, then checks `parsed.questions` at root level, then falls back to stubs.
- Homework grading: `maxScore` is derived from `gradingBands` JSON keys via `maxFromBandsServer()` — Homework model has no `maxScore` field, it uses `gradingBands: Record<string, string>`.
- `autoMarkSubmission` returns gracefully for unsupported types (no throw).
- Score display in marking: `autoScore` is stored as raw score (0–maxScore), not percentage.

### Wonde Sync
- Full sync via `POST /api/wonde/sync` (300s maxDuration, fetch from client).
- `WondeSyncPanel` uses `fetch('/api/wonde/sync')` not a server action (avoids Vercel 10s serverless timeout).
- `WondePeriod.day` is a string ("monday"), `day_number` is int. Map via `DAY_MAP` in `wonde-sync.ts`.
- `WondeTimetableEntry.period` and `.employee` are flat strings (not nested objects). `room` is also flat string.
- `WondeContact.relationship` is a **nested object** with `.relationship` and `.parental_responsibility` fields. Extract with type guard.
- `fetchWondeClasses` only includes `'students,subject'` — `employees` include returns 400.
- `fetchWondeTimetableEntries` only includes `'class'` — `period/employee/room` are flat values.
- Timetable sync needs `periods.read` and `lessons.read` Wonde permissions (pending from Wonde support as of 2026-03-17).

### Router / Revalidation
- Always call `router.refresh()` after server actions that modify data visible to the current component. `revalidatePath` in server actions alone is not enough for client components.
- `HomeworkFilterView`: calls `router.refresh()` in `onCreated` callback.
- `HomeworkMarkingView`: calls `router.refresh()` after `markSubmission` in both `handleSave` and `handleApprove`.

---

## Outstanding Tasks

### Marketing pages (not started)
- 4 public Next.js routes: `/marketing/home`, `/marketing/features`, `/marketing/beta`, `/marketing/investors`
- Contact forms → `ivanyardley@me.com` via `resend` package
- API routes: `app/api/contact/beta/route.ts`, `app/api/contact/investors/route.ts`

### Wonde timetable sync (pending Wonde permissions)
- Needs `periods.read` and `lessons.read` enabled in Wonde dashboard.
- Email sent to Wonde support (2026-03-17). When granted, re-run full sync from `/admin/wonde`.

### E2E tests needed
- Wonde sync: `e2e/tests/wonde-sync.spec.ts`
- Revision Program: `e2e/tests/revision-program.spec.ts` (currently stubbed/skipped)

### Missing error boundary
- `app/hoy/error.tsx`

### Unbuilt routes (show not-found)
- `/lessons`, `/resources`, `/hoy/integrity`, `/admin/audit`, `/slt/audit`
- `/student/grades`, `/student/homework` (list — individual homework items exist)

---

## Completed Phases

**Phases 0–6D + Messaging + Phase 7 (Revision Program) + Phase 1C Part B (Wonde Live API): All complete ✅**

**Phase 7A — Revision Program Foundation ✅ (2026-03-16)**
- 4 Prisma models: RevisionProgram, RevisionTask, RevisionProgress, RevisionAnalyticsCache.
- `lib/revision/analysis-engine.ts`, `lib/revision/content-generator.ts`.
- `app/actions/revision-program.ts` — 8 server actions. Rate limit: 3 programs/class/week.

**Phase 7B — Revision Program Teacher UI ✅ (2026-03-16)**
- RevisionProgramCreator (4-step wizard), RevisionProgramList, RevisionProgramDetail, RevisionAnalysisPanel.
- Routes: `/revision-program`, `/revision-program/new`, `/revision-program/[programId]`.

**Phase 7C — Revision Program Student View ✅ (2026-03-16)**
- StudentRevisionView, RevisionTaskView (localStorage auto-save, time tracking, 1–5 star confidence), RevisionProgressChart.
- Routes: `/student/revision`, `/student/revision/[taskId]`.
- LessonFolder Revision tab with RevisionAnalysisPanel + Create Program button.

**Phase 1C Part B — Wonde Live API Integration ✅ (2026-03-17)**
- `lib/wonde-client.ts` — typed API client, paginated fetch for all entity types.
- `lib/wonde-sync.ts` — full sync engine; 98 staff, 200 students, 66 classes synced from Wonde Testing School.
- `app/actions/wonde.ts` + `app/api/wonde/sync/route.ts` (300s, POST).
- `components/admin/WondeSyncPanel.tsx` + `/admin/wonde` route.
- MIS Sync added to SCHOOL_ADMIN sidebar and admin dashboard quick links.

**Post-launch fixes (2026-03-17 to 2026-03-22)**
- Wonde sync API shape mismatches fixed (period/employee/room flat strings, contact relationship nested object).
- Lesson panel spinner infinite loop fixed (async/await + try/catch/finally + cancelled flag).
- Oak resource search: per-term splitting, two-pass search (broaden if < 3 results), initial search from lesson title keywords, skip yearGroup when query present.
- UnifiedResourceSearch: subjectSlug guard, "Generate homework?" banner after adding resource.
- LessonFolder: `onGenerateHomework` callback switches to Homework tab + wizard step 5.
- SA homework: `markScheme` + `marks` fields per question in type, prompt, editor.
- Homework generation: verbose logging to diagnose AI response failures.
- WeeklyCalendar: removed "New Homework" button.
- vercel.json: removed invalid `functions` block that was breaking all Vercel deployments.
- All previously listed error boundaries now built (except `app/hoy/error.tsx`).
