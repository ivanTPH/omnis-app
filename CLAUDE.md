# Omnis App — Claude Reference

> Last updated: 2026-03-17. Authoritative reference for Claude sessions.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Auth | NextAuth v5 (`next-auth@5.0.0-beta.30`) — Credentials + JWT |
| ORM | Prisma v6.19.2 |
| Database | PostgreSQL via Supabase |
| AI | Anthropic Claude SDK (`@anthropic-ai/sdk`) |
| Language | TypeScript |

**Tailwind v4:** Uses `@import "tailwindcss"` in globals.css. Full class literals required (no dynamic construction).

**DB connection:** `DATABASE_URL` must use port **6543** with `?pgbouncer=true&connection_limit=5`. `DIRECT_URL` uses port 5432 for migrations.

---

## Environment (`.env.local`)

```
DATABASE_URL="...port 6543...?pgbouncer=true&connection_limit=5"
DIRECT_URL="...port 5432..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="..."
RESEND_API_KEY="..."        # for marketing contact forms
CRON_SECRET="..."           # for Oak sync + early-warning cron endpoints
```

---

## Auth & Session

```typescript
// JWT session shape (lib/auth.ts)
session.user = { id, schoolId, schoolName, role, firstName, lastName }
```

`middleware.ts` protects all routes except `/login`. Role-based redirects:
- STUDENT → `/student/dashboard` | PARENT → `/parent/dashboard` | SENCO → `/send/dashboard`
- SLT / SCHOOL_ADMIN → `/slt/analytics` | Others → `/dashboard`

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

## Routes (`app/`)

```
login/                          Login form
dashboard/                      Teacher weekly calendar
homework/                       Teacher homework list + [id] detail + [id]/mark/[submissionId]
classes/                        Class list with student rosters
analytics/                      Unified analytics (Classes + Students tabs + /adaptive)
revision/                       Student revision planner (STUDENT only)
settings/                       User settings (5 tabs) + /accessibility
student/dashboard, homework/[id]
parent/dashboard, progress, messages, consent
send/dashboard, review-due, ilp/[studentId]
senco/dashboard, concerns, ilp, early-warning, ehcp, ilp-evidence
hoy/analytics, slt/analytics
admin/gdpr, admin/cover, admin/wonde
platform-admin/dashboard, schools, oak-sync
messages/ + messages/[threadId]
notifications/                          Platform notifications (all roles)
plans/                                  SEND plans list
ai-generator/
send-scorer/
revision-program/ + /new + /[programId]
student/revision + /[taskId]
api/auth/[...nextauth], api/settings/avatar, api/export/*, api/cron/*
marketing/home, marketing/features, marketing/beta, marketing/investors  ← TODO
```

---

## Actions (`app/actions/`)

| File | Key exports |
|---|---|
| `lessons.ts` | createLesson, getLessonDetails, updateLessonOverview, addUrlResource, addUploadedResource, addLibraryResource, removeResource, deleteLesson, rescheduleLesson, updateLessonObjectives |
| `homework.ts` | getHomeworkList, getHomeworkForMarking, getSubmissionForMarking, createHomework, markSubmission, generateHomeworkFromResources, autoMarkSubmission, bulkAutoMarkAndQueue, generateHomeworkContent, extractLearningFromLabel |
| `analytics.ts` | getAnalyticsFilters, getStudentPerformance, getStudentDetail, getClassSummaries, getHomeworkAdaptiveAnalytics |
| `settings.ts` | getMySettings, saveProfile, saveProfessionalPrefs, savePrivacySettings, saveSharingSettings, changePassword |
| `oak.ts` | getOakSubjects, searchOakLessons, getOakLesson, addOakLessonToLesson |
| `send-scorer.ts` | getOrCreateSendScore, forceRescoreLesson, searchLessonsWithScores |
| `send-support.ts` | 25 SEND/concern/ILP/notification actions |
| `ehcp.ts` | createEhcpPlan, getStudentEhcp, linkHomeworkToIlpTarget, linkSubmissionToEhcpOutcome, generateIlpProgressReport, generateEhcpAnnualReview |
| `adaptive-learning.ts` | getStudentLearningProfile, updateLearningProfile, suggestSpacedRepetition, suggestNextHomework, getAdaptiveHomeworkSuggestions |
| `gdpr.ts` | getPurposes, createPurpose, getConsentMatrix, exportConsentCsv, getDataSubjectRequests, recordConsent |
| `revision.ts` | getMyExams, addExam, getMyRevisionSessions, generateRevisionPlan, saveRevisionPlan, markSessionComplete |
| `cover.ts` | getTodaysCoverSummary, logAbsence, getAvailableStaff, assignCover, getCoverHistory |
| `platform-admin.ts` | getPlatformStats, getSchoolList, createSchool, getFeatureFlags, setFeatureFlag, getAuditLog |
| `messaging.ts` | getMyThreads, getThread, createThread, sendMessage, getUnreadMessageCount, getContactList |
| `accessibility.ts` | getAccessibilitySettings, saveAccessibilitySettings |
| `student.ts` | getStudentHomework, submitHomework |
| `parent.ts` | sendParentMessage |
| `wonde.ts` | testWondeConnection, triggerWondeSync, getWondeConfig, getWondeSyncLogs, getWondeCounts |

---

## Key Components (`components/`)

| Component | Purpose |
|---|---|
| `Sidebar.tsx` | Role-based left nav |
| `AppShell.tsx` | Authenticated layout wrapper |
| `WeeklyCalendar.tsx` | Teacher calendar (click=slide-over, dbl-click=folder) |
| `LessonFolder.tsx` | Lesson detail modal (6 tabs) |
| `LessonSlideOver.tsx` | Create new lesson panel |
| `AddResourcePanel.tsx` / `OakResourcePanel.tsx` | Add resources to lesson |
| `UnifiedResourceSearch.tsx` | Combined Oak + school library search with type filter chips |
| `ResourcePreviewModal.tsx` | Oak lesson preview — key learning points, vocab, quizzes, download links |
| `admin/WondeSyncPanel.tsx` | MIS sync dashboard — connection test, run sync, counts, log history |
| `HomeworkFilterView.tsx` | Homework list + filters |
| `SetHomeworkModal.tsx` | Homework creation modal |
| `HomeworkMarkingView.tsx` | Split-panel marking view |
| `SubmissionMarkingView.tsx` | Full-page per-submission marking |
| `HomeworkSubmissionView.tsx` | Student submission UI |
| `homework/HomeworkCreatorV2.tsx` | 6-step homework creation modal |
| `homework/AdaptiveSubmissionView.tsx` | Marking with AI suggestions + EHCP evidence |
| `homework/HomeworkTypeRenderer.tsx` | Input UI per homework variant (11 types) |
| `StudentAnalyticsView.tsx` | Analytics — Classes + Students tabs |
| `StudentDashboard.tsx` | Individual student detail |
| `StudentAvatar.tsx` | Avatar (photo or coloured initials, xs–lg) |
| `ClassListView.tsx` | Expandable class cards |
| `settings/SettingsShell.tsx` | Settings (5 tabs) |
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
| `revision/RevisionDashboard.tsx` + siblings | Revision planner |
| `accessibility/AccessibilityToolbar.tsx` + siblings | Accessibility panel |
| `homework/EhcpOutcomeTracker.tsx` | EHCP outcome progress |
| `analytics/AdaptiveAnalyticsDashboard.tsx` | Bloom's + adaptive charts |
| `ExportPdfButton.tsx` | PDF download button |

---

## Library (`lib/`)

| File | Purpose |
|---|---|
| `lib/auth.ts` | NextAuth config, JWT callbacks |
| `lib/prisma.ts` | Prisma singleton + `writeAudit()` helper |
| `lib/accessibility.ts` | `settingsToClasses()`, defaults |
| `lib/sendReview.ts` / `sendReviewCached.ts` | SEND accessibility scoring via Claude |
| `lib/send/early-warning.ts` | Pattern checks → EarlyWarningFlags + SENCO notifications |
| `lib/send/concern-analyser.ts` | Claude AI concern pattern analysis |
| `lib/pdf/` | Puppeteer PDF generation (lesson plan, homework, revision, summary) |
| `lib/wonde-client.ts` | Typed Wonde API client — paginated fetch helpers for all entity types |
| `lib/wonde-sync.ts` | Full sync engine — upserts employees, students, contacts, groups, classes, periods, timetable |

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
- **Revision:** `RevisionExam`, `RevisionSession`, `RevisionConfidence`
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
| SCHOOL_ADMIN | Dashboard, Users, Audit Log, Analytics, Cover, GDPR, Messages |
| SLT | Dashboard, Analytics, Audit Log, Cover, GDPR, Messages |
| COVER_MANAGER | Dashboard, Cover, Messages |
| STUDENT | Dashboard, Homework, Revision Planner, My Grades, Messages |
| PARENT | Dashboard, Progress, Consent, Messages |
| PLATFORM_ADMIN | Dashboard, Schools, Oak Sync |

Settings + avatar chip at sidebar bottom for all roles.

---

## Seed Commands

```bash
npm run db:seed            # main seed (demo users, classes, lessons)
npm run db:seed-classes    # classes only
npm run db:seed-english    # English students + submissions
npm run wonde:seed         # Oakfield Academy (30 staff, 120 students)
npm run platform:seed      # platform admin + 3 demo schools + feature flags
npm run send:seed          # SEND concerns, ILPs, flags, EHCP plans
npm run messages:seed      # 5 demo message threads
```

---

## Phase Completion

**Phases 0–6D + Messaging + Phase 7 (Revision Program) + Phase 1C Part B (Wonde Live API): All complete ✅**

Covers: Auth, Teacher Dashboard, Homework (set/mark/submit), Classes, Analytics, Settings, Oak content library, Wonde MIS schema, School Admin, Platform Admin, GDPR, SEND Scorer, AI Generator, Delta Oak Sync, Cover Management, PDF Export, Accessibility Modes, Student Revision Planner, Security Audit, Playwright E2E (82 tests), Proactive SEND Monitoring/ILP/Early Warning, Adaptive Homework/EHCP/ILP integration, Student Photos, Threaded Messaging, Revision Program (7A/7B/7C), Wonde Live API Integration.

---

## Completed Phases (detail)

**Phase 7A — Revision Program Foundation ✅ (2026-03-16)**
- 4 Prisma models (RevisionProgram, RevisionTask, RevisionProgress, RevisionAnalyticsCache) pushed to DB.
- `lib/revision/analysis-engine.ts` — `analyseClassPerformance()`.
- `lib/revision/content-generator.ts` — `generateRevisionTask()` with SEND adaptations and ILP integration.
- `app/actions/revision-program.ts` — 8 server actions. Rate limit: 3 programs/class/week.

**Phase 7B — Revision Program Teacher UI ✅ (2026-03-16)**
- 4 components: RevisionProgramCreator (4-step wizard), RevisionProgramList, RevisionProgramDetail, RevisionAnalysisPanel.
- Routes: `/revision-program`, `/revision-program/new`, `/revision-program/[programId]`.

**Phase 7C — Revision Program Student View ✅ (2026-03-16)**
- StudentRevisionView, RevisionTaskView (localStorage auto-save, time tracking, 1–5 star confidence), RevisionProgressChart.
- Routes: `/student/revision`, `/student/revision/[taskId]`.
- LessonFolder Revision tab with RevisionAnalysisPanel + Create Program button.

**Phase 1C Part B — Wonde Live API Integration ✅ (2026-03-17)**
- `lib/wonde-client.ts` — typed API client, paginated fetch for all entity types.
- `lib/wonde-sync.ts` — full sync engine; 98 staff, 200 students, 66 classes synced from Wonde Testing School (A1930499544, SIMS MIS).
- `app/actions/wonde.ts` — 5 server actions (testWondeConnection, triggerWondeSync, getWondeConfig, getWondeSyncLogs, getWondeCounts).
- `components/admin/WondeSyncPanel.tsx` + `/admin/wonde` route.
- MIS Sync added to SCHOOL_ADMIN sidebar and admin dashboard quick links.

---

## Outstanding Tasks

**Marketing pages (TODO)**
- 4 public Next.js routes: `/marketing/home`, `/marketing/features`, `/marketing/beta`, `/marketing/investors`
- Contact forms → email `ivanyardley@me.com` via `resend` package
- API routes: `app/api/contact/beta/route.ts`, `app/api/contact/investors/route.ts`

**Wonde timetable sync (pending permissions)**
- Timetable sync (periods + lessons) skipped — needs `periods.read` and `lessons.read` permissions enabled in the Wonde dashboard. Email sent to Wonde support. When granted, re-run full sync from `/admin/wonde`.

**E2E tests needed**
- Phase 1C Part B (Wonde sync): `e2e/tests/wonde-sync.spec.ts`
- Phase 7 (Revision Program): `e2e/tests/revision-program.spec.ts` (currently stubbed/skipped)
- Lesson creation fixes (teacher subjects, time selects, Oak resources, homework auto-gen)

**Missing error boundaries**
- `app/hoy/error.tsx`, `app/messages/error.tsx`, `app/parent/error.tsx`, `app/settings/error.tsx`
- `app/platform-admin/error.tsx`, `app/slt/error.tsx`, `app/send-scorer/error.tsx`
- `app/ai-generator/error.tsx`, `app/revision/error.tsx`, `app/notifications/error.tsx`, `app/plans/error.tsx`

**Unbuilt routes (404)**
- `/lessons`, `/resources`, `/hoy/integrity`, `/admin/audit`, `/slt/audit`
- `/student/grades`, `/student/homework` (list — individual items exist)

---

## Key Patterns & Gotchas

- **Server actions:** All in `app/actions/`. Always `'use server'`. Session via `auth()` from `lib/auth.ts`.
- **Multi-tenancy:** Every query scoped with `schoolId` from session. Never query without it.
- **Prisma:** Singleton in `lib/prisma.ts`. Restart dev server after schema changes or queries fail silently.
- **`SchoolClass.department`** is required (not nullable).
- **Lesson `classId`** is optional (supports out-of-hours lessons).
- **`createHomework`** requires `setAt` and `dueAt` as ISO strings; defaults to `status: 'PUBLISHED'`.
- **AI generation:** Falls back to stub content if `ANTHROPIC_API_KEY` absent.
- **SEND scoring:** Auto-scored on resource upload via `lib/sendReviewCached.ts`. Score 0–100 in `ResourceReview.sendScore`.
- **Avatar:** Stored as base64 data URL in `UserSettings.profilePictureUrl`. Max 5 MB, JPG/PNG.
- **Audit logging:** Use `writeAudit()` from `lib/prisma.ts` for all auditable actions.
- **ConsentRecords:** INSERT-only (immutable audit trail).
- **Dev server:** `npm run dev > /tmp/omnis-dev.log 2>&1 &`
