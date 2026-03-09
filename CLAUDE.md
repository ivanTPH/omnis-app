# Omnis App — Claude Reference

> Last updated: 2026-03-09 (Phase 2E). This file is the authoritative reference for Claude sessions working on this codebase.

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

**Tailwind v4 note:** Uses `@import "tailwindcss"` in globals.css. Full class literals required (no dynamic construction) for the scanner to pick them up.

**Database connection:** `DATABASE_URL` in `.env.local` must use port **6543** (transaction mode pooler) with `?pgbouncer=true&connection_limit=5` to avoid `MaxClientsInSessionMode` errors. `DIRECT_URL` uses port 5432 for migrations.

---

## Environment

`.env.local` (required variables):
```
DATABASE_URL="...port 6543...?pgbouncer=true&connection_limit=5"
DIRECT_URL="...port 5432..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="..."
```

---

## Complete File Structure

### Pages (`app/`)

```
app/
├── layout.tsx                          Root layout (loads AppShell for auth'd routes)
├── page.tsx                            Root — redirects to /dashboard
├── globals.css                         Tailwind v4 import + base styles
├── not-found.tsx                       "Coming soon" fallback for unbuilt routes
│
├── login/page.tsx                      Login form (email + password)
│
├── dashboard/page.tsx                  Teacher weekly calendar (server component)
│
├── homework/
│   ├── page.tsx                        Teacher homework list
│   ├── loading.tsx                     Suspense skeleton
│   ├── error.tsx                       Error boundary
│   ├── [id]/page.tsx                   Homework detail — student submission list
│   └── [id]/mark/[submissionId]/
│       └── page.tsx                    Full-page single-submission marking
│
├── classes/
│   ├── page.tsx                        Class list with expandable student rosters
│   └── loading.tsx                     Suspense skeleton
│
├── settings/page.tsx                   User settings (5 tabs)
│
├── analytics/
│   ├── teacher/page.tsx                Teacher-scoped analytics
│   ├── department/page.tsx             Department analytics (HEAD_OF_DEPT)
│   └── students/
│       ├── page.tsx                    Student analytics — Classes tab + Students tab
│       └── [id]/page.tsx              Individual student detail dashboard
│
├── student/
│   ├── dashboard/page.tsx              Student home (upcoming homework, grades)
│   └── homework/[id]/page.tsx         Student homework submission view
│
├── parent/
│   ├── dashboard/page.tsx              Parent home (child summary)
│   ├── progress/page.tsx              Child progress view
│   └── messages/page.tsx              Parent–teacher messaging
│
├── send/
│   ├── dashboard/page.tsx              SEND overview dashboard
│   ├── review-due/page.tsx            Students with overdue SEND reviews
│   └── ilp/
│       ├── page.tsx                    ILP records list
│       └── [studentId]/page.tsx       Student ILP detail
│
├── hoy/analytics/page.tsx             Head of Year analytics
├── slt/analytics/page.tsx             SLT whole-school analytics
│
└── api/
    ├── auth/[...nextauth]/route.ts    NextAuth handler (GET + POST)
    └── settings/avatar/route.ts       Avatar upload (POST — JPG/PNG, max 5 MB, base64 → DB)
```

### Actions (`app/actions/`)

```
app/actions/
├── lessons.ts      createLesson, getLessonDetails, updateLessonOverview,
│                   getSchoolResourceLibrary, addUrlResource, addUploadedResource,
│                   addLibraryResource, reReviewResource, removeResource,
│                   deleteLesson, rescheduleLesson, updateResource
│
├── homework.ts     getHomeworkList, getHomeworkForMarking, getSubmissionForMarking,
│                   getTeacherLessons, getTeacherClasses,
│                   createHomework, markSubmission,
│                   generateHomeworkFromResources, generateHomeworkProposal
│
├── analytics.ts    getAnalyticsFilters, getStudentPerformance, getStudentDetail,
│                   getSubmissionDetail, getClassSummaries
│
├── settings.ts     getMySettings, saveProfile, requestEmailChange,
│                   saveProfessionalPrefs, savePrivacySettings,
│                   saveSharingSettings, changePassword
│
├── student.ts      getStudentHomework, submitHomework
│
├── parent.ts       sendParentMessage
│
├── oak.ts          getOakSubjects, searchOakLessons, getOakLesson, addOakLessonToLesson
│
├── send-scorer.ts  getOrCreateSendScore, forceRescoreLesson, getExistingScore, searchLessonsWithScores
│
├── gdpr.ts         getPurposes, createPurpose, togglePurposeActive, getConsentMatrix, exportConsentCsv,
│                   getDataSubjectRequests, updateDsrStatus, getMyChildrenConsents, recordConsent
│
└── platform-admin.ts  getPlatformStats, getSchoolList, createSchool, toggleSchoolActive,
                       getFeatureFlags, setFeatureFlag, getAuditLog, getPlatformUsageStats
```

### Components (`components/`)

| Component | Controls |
|---|---|
| `Sidebar.tsx` | Role-based left nav (all authenticated views) |
| `AppShell.tsx` | Main authenticated layout wrapper (sidebar + content area) |
| `WeeklyCalendar.tsx` | Teacher calendar grid (click = slide-over, dbl-click = lesson folder) |
| `MiniCalendar.tsx` | Small month calendar (used inside WeeklyCalendar) |
| `LessonSlideOver.tsx` | Right-side panel — create new lesson |
| `LessonFolder.tsx` | Lesson detail modal — 6 tabs (Overview, Resources, Oak Resources, Homework, SEND, Analytics) |
| `AddResourcePanel.tsx` | Inline panel for adding resources to a lesson |
| `OakResourcePanel.tsx` | Oak National Academy lesson search + add-to-lesson panel (in LessonFolder "Oak Resources" tab) |
| `SetHomeworkModal.tsx` | Homework creation modal (lesson picker → type → AI generate → publish) |
| `HomeworkFilterView.tsx` | Homework list page — filters, sort, "Set Homework" button triggers modal |
| `HomeworkMarkingView.tsx` | Split-panel marking view (student list left, submission right) |
| `SubmissionMarkingView.tsx` | Full-page per-submission marking (score, feedback, prev/next nav) |
| `HomeworkSubmissionView.tsx` | Student-facing homework submission UI |
| `StudentAnalyticsView.tsx` | Analytics page — Classes tab + Students tab with drill-down |
| `StudentDashboard.tsx` | Individual student detail dashboard |
| `ClassListView.tsx` | Classes page — expandable class cards with student rosters |
| `ParentMessagesView.tsx` | Parent–teacher conversation threads |
| `settings/SettingsShell.tsx` | Settings page — 5 tabs (Profile, Professional, Privacy, Sharing, Security) |
| `send/SendScoreBadge.tsx` | Compact SEND score badge (green ≥70, amber 40–69, red <40) |
| `send/SendScoreCard.tsx` | Full score card — 5 dimension bars, summary, recommendations, re-score |
| `send/SendScoreButton.tsx` | Inline score button — checks cache on mount, lazy-scores on click |
| `send/ScorerResultRow.tsx` | Result row for standalone scorer page with expandable score card |
| `send/ScorerView.tsx` | Standalone scorer client view — search, filter, "Score all visible" |
| `gdpr/ConsentPurposeForm.tsx` | Inline form — title, auto-slug, description, lawful basis select |
| `gdpr/ConsentPurposeList.tsx` | Purpose cards with active/inactive toggle |
| `gdpr/ConsentMatrix.tsx` | Student × purpose grid (✓/✗/—) with year/purpose/decision filters + CSV export |
| `gdpr/DataSubjectRequestList.tsx` | DSR table with inline status dropdown |
| `gdpr/ParentConsentPortal.tsx` | Parent toggle UI with optimistic updates, immutable consent inserts |
| `gdpr/GdprAdminShell.tsx` | Tabbed wrapper (Consent Purposes / Consent Matrix / Data Subject Requests) |
| `platform-admin/PlatformDashboardStats.tsx` | 7-card stat row (schools, students, staff, Oak, SEND, consent) |
| `platform-admin/PlatformUsageChart.tsx` | recharts LineChart — Oak/SEND/consent activity over 8 weeks |
| `platform-admin/PlatformAuditLogTable.tsx` | Read-only platform audit log table |
| `platform-admin/SchoolListTable.tsx` | Sortable school table with inline flag expansion + activate toggle |
| `platform-admin/SchoolForm.tsx` | Create school form (name, URN, phase, region, LA) |
| `platform-admin/FeatureFlagPanel.tsx` | Per-school feature flag toggles (5 known flags), lazy-loaded |
| `ai-generator/ResourceTypeIcon.tsx` | Maps resourceType → lucide icon; exports RESOURCE_TYPE_LABELS |
| `ai-generator/ResourceGeneratorForm.tsx` | Full generation form (subject, year, type, topic, SEND toggles, notes) |
| `ai-generator/ResourcePreview.tsx` | Rendered markdown preview with copy/delete/link-to-lesson actions |
| `ai-generator/ResourceCard.tsx` | Expandable card for library grid — type/SEND badges, inline preview |
| `ai-generator/ResourceLibrary.tsx` | My/School tabs, type filter, card grid — click to open in preview |
| `ai-generator/AiGeneratorShell.tsx` | Two-panel layout manager (left: form, right: preview ↔ library toggle) |
| `cover/AbsenceList.tsx` | List of today's absences — click to select/highlight, delete with confirm |
| `cover/LogAbsenceModal.tsx` | Modal: staff search select, date, reason, notes → calls logAbsence action |
| `cover/AssignCoverModal.tsx` | Modal: shows period/class/absent teacher, available staff list, assign + status update |
| `cover/CoverAssignmentGrid.tsx` | Grid of cover assignments grouped by period — click to open AssignCoverModal |
| `cover/CoverHistoryTable.tsx` | Last 30 days table: date, staff, reason, lessons, coverage rate % |
| `cover/CoverDashboard.tsx` | Today's cover view: 3-stat bar + AbsenceList + CoverAssignmentGrid |
| `cover/CoverPageTabs.tsx` | Tab switcher: Today (CoverDashboard) ↔ History (CoverHistoryTable) |
| `platform-admin/OakSyncStatus.tsx` | OakSyncLog table with row expansion, status badges, "Run Delta Sync Now" button |

### Library (`lib/`)

| File | Purpose |
|---|---|
| `lib/auth.ts` | NextAuth config (`trustHost: true`, JWT callbacks, session shape) |
| `lib/prisma.ts` | Prisma client singleton + helpers (e.g. `writeAudit()`) |
| `lib/sendReview.ts` | SEND accessibility scoring via Claude API |
| `lib/sendReviewCached.ts` | Cached wrapper around sendReview (DB cache via `SendScoreCache`) |
| `lib/sendInsights.ts` | SEND insights aggregation queries |
| `lib/curriculum.ts` | Curriculum utilities |

### Database (`prisma/`)

```
prisma/
├── schema.prisma               Full schema (see summary below)
├── seed.ts                     Main seed (all demo users, classes, lessons, SEND, analytics)
├── seed-classes.ts             Class seed data
├── seed-english-students.ts    Adds 20+22+22 students to 9E/En1, 10E/En2, 11E/En1
├── seed-wonde.ts               Oakfield Academy: 30 staff, 120 students, 32 classes (Wonde MIS)
└── migrations/
    ├── 20260301191436_add_lessons/
    ├── 20260301195139_add_send_need_area_misconception_tags/
    └── 20260309000000_add_wonde_schema/
```

**Seed commands:**
```bash
npm run db:seed            # main seed (all demo data)
npm run db:seed-classes    # classes only
npm run db:seed-english    # English class students + submissions
npm run wonde:seed         # Oakfield Academy Wonde MIS synthetic data
npm run platform:seed      # Platform admin user + 3 demo schools + feature flags
```

---

## UI Map — What Controls What

| Part of UI | File |
|---|---|
| Left sidebar nav | `components/Sidebar.tsx` |
| Authenticated layout shell | `components/AppShell.tsx` |
| Teacher calendar page | `app/dashboard/page.tsx` + `components/WeeklyCalendar.tsx` |
| Create lesson (slide-over) | `components/LessonSlideOver.tsx` |
| Lesson detail modal | `components/LessonFolder.tsx` |
| Add resource to lesson | `components/AddResourcePanel.tsx` |
| Homework list page | `app/homework/page.tsx` + `components/HomeworkFilterView.tsx` |
| Set Homework modal | `components/SetHomeworkModal.tsx` |
| Homework marking (split view) | `app/homework/[id]/page.tsx` + `components/HomeworkMarkingView.tsx` |
| Single submission marking | `app/homework/[id]/mark/[submissionId]/page.tsx` + `components/SubmissionMarkingView.tsx` |
| Student homework submission | `app/student/homework/[id]/page.tsx` + `components/HomeworkSubmissionView.tsx` |
| Classes page | `app/classes/page.tsx` + `components/ClassListView.tsx` |
| Analytics (Classes + Students tabs) | `app/analytics/students/page.tsx` + `components/StudentAnalyticsView.tsx` |
| Individual student dashboard | `app/analytics/students/[id]/page.tsx` + `components/StudentDashboard.tsx` |
| User settings (5 tabs) | `app/settings/page.tsx` + `components/settings/SettingsShell.tsx` |
| Avatar upload | `app/api/settings/avatar/route.ts` |
| SEND dashboard | `app/send/dashboard/page.tsx` |
| SEND Resource Quality Scorer | `app/send-scorer/page.tsx` + `components/send/ScorerView.tsx` |
| ILP records + detail | `app/send/ilp/` |
| Platform admin dashboard | `app/platform-admin/dashboard/page.tsx` + `components/platform-admin/` |
| Platform school management | `app/platform-admin/schools/page.tsx` + `components/platform-admin/SchoolListTable.tsx` |
| GDPR & Consent (admin) | `app/admin/gdpr/page.tsx` + `components/gdpr/GdprAdminShell.tsx` |
| Parent Consent Portal | `app/parent/consent/page.tsx` + `components/gdpr/ParentConsentPortal.tsx` |
| AI Resource Generator | `app/ai-generator/page.tsx` + `components/ai-generator/AiGeneratorShell.tsx` |
| Cover Management | `app/admin/cover/page.tsx` + `components/cover/CoverPageTabs.tsx` + `components/cover/CoverDashboard.tsx` |
| Oak Sync dashboard | `app/platform-admin/oak-sync/page.tsx` + `components/platform-admin/OakSyncStatus.tsx` |
| Parent portal | `app/parent/` + `components/ParentMessagesView.tsx` |
| Auth | `lib/auth.ts` + `app/api/auth/[...nextauth]/route.ts` |
| Route protection | `middleware.ts` (NextAuth middleware) |

---

## Database Schema Summary

### Enums

| Enum | Values |
|---|---|
| `Role` | SUPER_ADMIN, SCHOOL_ADMIN, SLT, HEAD_OF_DEPT, HEAD_OF_YEAR, COVER_MANAGER, TEACHER, SENCO, STUDENT, PARENT |
| `HomeworkType` | MCQ_QUIZ, SHORT_ANSWER, EXTENDED_WRITING, MIXED, UPLOAD |
| `HomeworkStatus` | DRAFT, PUBLISHED, CLOSED |
| `SubmissionStatus` | SUBMITTED, UNDER_REVIEW, RESUBMISSION_REQ, MARKED, RETURNED |
| `ResourceType` | PLAN, SLIDES, WORKSHEET, VIDEO, LINK, OTHER |
| `SendStatusValue` | NONE, SEN_SUPPORT, EHCP |
| `PlanStatus` | DRAFT, ACTIVE_INTERNAL, ACTIVE_PARENT_SHARED, ARCHIVED |
| `LessonSharingLevel` | SCHOOL, SELECTED, PRIVATE |
| `RiskLevel` | NONE, LOW, MEDIUM, HIGH |
| `ConversationStatus` | OPEN, CLOSED, ARCHIVED |
| `AuditAction` | 23 values covering all auditable events |

### Models

**Tenant root**
- `School` — tenant root; all other tables carry `schoolId`
- `TermDate` — term start/end dates per school

**Users & structure**
- `User` — all roles; fields: email, passwordHash, role, firstName, lastName, department?, yearGroup?
- `SchoolClass` — class with name, subject, yearGroup, department
- `ClassTeacher` — many-to-many: teacher ↔ class
- `Enrolment` — many-to-many: student ↔ class
- `ParentStudentLink` — legacy parent ↔ student link
- `ParentChildLink` — verified parent ↔ child link with relationshipType

**Lessons & resources**
- `Lesson` — title, topic, objectives[], scheduledAt, classId?, createdBy, lessonType
- `Resource` — type, label, url?, fileKey?, linked to lesson
- `ResourceVersion` — versioned resource history
- `ResourceReview` — SEND accessibility score (sendScore 0–100, suggestions[])
- `OakContentCache` — cached Oak National API responses

**Homework**
- `Homework` — title, instructions, modelAnswer?, type, status, dueAt, classId, lessonId?
- `HomeworkQuestion` — individual question with optionsJson, correctAnswerJson, rubricJson
- `Submission` — student answer, status, autoScore?, teacherScore?, finalScore?, feedback?
- `SubmissionAttempt` — individual attempt (supports resubmission flow)
- `SubmissionAttemptAnswer` — per-question answer for structured homework

**Integrity**
- `IntegritySignal` — legacy per-submission signal (pasteCount, pasteRatio, timeOnTask)
- `SubmissionIntegritySignal` — per-attempt signal (riskLevel, pasteEventsCount, focusLostCount)
- `IntegrityReviewLog` — reviewer decisions on flagged attempts
- `IntegrityPatternCase` — cross-submission integrity pattern tracking

**SEND**
- `SendStatus` — student's current SEND status (NONE/SEN_SUPPORT/EHCP) + needArea
- `SendStatusReview` — SENCo review records for SEND status changes
- `SendScoreCache` — content-hash cache for SEND accessibility scores
- `SendInsight` — aggregated SEND score insights by subject/yearGroup/resourceType
- `SendQualityScore` — AI-generated SEND accessibility score per OakLesson
- `SchoolFeatureFlag` — per-school feature flag (send_scorer/oak_resources/gdpr_portal/parent_portal/wonde_sync); unique per schoolId+flag; setBy=User.id
- `PlatformAuditLog` — platform-level audit trail (school.created/activated/deactivated/flag.toggled); actorId=User.id
- `ConsentPurpose` — school-scoped data processing purpose with lawful basis (consent/legitimate_interest/legal_obligation); unique per schoolId+slug
- `ConsentRecord` — immutable consent audit record (INSERT-only); studentId=WondeStudent.id, responderId=User.id, decision=granted/withdrawn
- `DataSubjectRequest` — DSR tracking (access/erasure/rectification/portability) with status workflow (unique per `oakLessonSlug`); 5 dimensions (readability, visualLoad, cognitive, language, structure) + summary + recommendations; cached in DB, scored via `claude-sonnet-4-20250514`

**Plans (richer ILP)**
- `Plan` — SEND support plan with status, reviewDate, parent sharing
- `PlanTarget` — measurable targets with baseline/target values
- `PlanStrategy` — strategies applying to HOMEWORK/CLASSROOM/BOTH
- `PlanReviewCycle` — review periods with associated adaptation recommendations

**Legacy ILP**
- `ILP` — legacy individual learning plan
- `ILPTarget` — targets within an ILP
- `ILPNote` — internal/external notes on an ILP

**Adaptations**
- `SubjectAdaptationProfile` — per-student per-subject active settings
- `AdaptationRecommendation` — AI-recommended adaptations from plan review cycles

**Messaging**
- `Message` / `MessageRecipient` — internal staff messaging
- `ParentConversation` / `ParentMessage` — parent–teacher contextual threads
- `TeacherAvailability` — teacher's messaging availability window

**Analytics**
- `ClassPerformanceAggregate` — per-class completion rate, avgScore, predictedDelta per term
- `SubjectMedianAggregate` — subject-level median benchmarks by year group + term

**System**
- `Notification` — in-app notifications with type, linkHref, read status
- `AuditLog` — immutable audit trail (actor, action, targetType, targetId, metadata)
- `UserSettings` — profile extras, privacy prefs, lesson sharing level, avatar URL
- `WondeSyncRun` / `ExternalChangeLog` — MIS sync history

**Wonde MIS (12 tables)**
- `WondeSchool` — 1-to-1 with School; stores Wonde school ID and sync metadata
- `WondeStudent` — MIS student record (wondeId, UPN, DOB, SEND flag, KS2 data)
- `WondeContact` — parent/guardian contacts linked to WondeStudent
- `WondeEmployee` — staff records with MIS role and subject
- `WondeGroup` — registration/form groups (e.g. 7A, 8B)
- `WondeClass` — subject class linked to WondeEmployee (teacher) and WondeGroup
- `WondeClassStudent` — many-to-many: WondeClass ↔ WondeStudent (composite PK)
- `WondePeriod` — timetable period definitions (name, startTime, endTime, dayOfWeek)
- `WondeTimetableEntry` — scheduled class occurrence per period
- `WondeAssessmentResult` — KS2 SAT scores and standardised scores per student
- `WondeDeletion` — soft-delete log for removed MIS records
- `WondeSyncLog` — per-run sync audit (recordCounts, errors, duration)

---

## Auth & Session

```typescript
// JWT session shape (lib/auth.ts)
session.user = {
  id:         string   // User.id
  schoolId:   string
  schoolName: string
  role:       Role
  firstName:  string
  lastName:   string
}
```

Middleware (`middleware.ts`) protects all routes except `/login`. Role-based redirect:
- STUDENT → `/student/dashboard`
- PARENT → `/parent/dashboard`
- SENCO → `/send/dashboard`
- SLT / SCHOOL_ADMIN → `/slt/analytics`
- Others → `/dashboard`

---

## Demo Credentials

All passwords: `Demo1234!`

| Email | Role |
|---|---|
| `j.patel@omnisdemo.school` | TEACHER (English, 3 classes: 9E/En1, 10E/En2, 11E/En1) |
| `r.morris@omnisdemo.school` | SENCO |
| `t.adeyemi@omnisdemo.school` | HEAD_OF_YEAR (Year 9) |
| `d.brooks@omnisdemo.school` | HEAD_OF_DEPT (English) |
| `c.roberts@omnisdemo.school` | SLT |
| `k.wright@omnisdemo.school` | TEACHER (Maths, 10M/Ma1) |
| `a.hughes@students.omnisdemo.school` | STUDENT (Year 9) |
| `l.hughes@parents.omnisdemo.school` | PARENT (Aiden's parent) |
| `admin@omnisdemo.school` | SCHOOL_ADMIN |
| `platform@omnis.edu` | PLATFORM_ADMIN (Omnis staff — sees all schools) |

---

## Sidebar Navigation by Role

| Role | Nav items |
|---|---|
| TEACHER | Calendar, Homework, Classes, Plans, Messages, Notifications, Analytics, Student Analytics |
| HEAD_OF_DEPT | Calendar, Homework, Classes, Analytics (dept), Student Analytics, Messages, Notifications |
| HEAD_OF_YEAR | Calendar, Analytics, Student Analytics, Messages, Notifications · *Pastoral:* Integrity, Plans |
| SENCO | SEND Dashboard, ILP Records, Review Due, Student Analytics, Messages, Notifications |
| SCHOOL_ADMIN | Dashboard, Users, Audit Log, Analytics, Messages, Notifications · *Pastoral:* Integrity, Plans |
| SLT | Dashboard, Analytics, Audit Log, Messages, Notifications · *Pastoral:* Integrity, Plans |
| COVER_MANAGER | Dashboard, Lessons, Messages, Notifications |
| STUDENT | Dashboard, Homework, My Grades, Messages |
| PARENT | Dashboard, Progress, Messages |

Settings link + avatar chip (→ `/settings`) appear at bottom of sidebar for all roles.

---

## Outstanding Tasks

### ✅ Completed (this session)
- **Sidebar:** Lessons and Resources removed from TEACHER and HEAD_OF_DEPT nav
- **Analytics:** Classes tab added to `StudentAnalyticsView` with clickable rows drilling into student view
- **Homework:** `SetHomeworkModal` built — lesson picker, homework type chips, AI generation from lesson resources, class assignment, publish flow
- **Classes page:** `ClassListView` built; `seed-english-students.ts` added 20+22+22 students to 9E/En1, 10E/En2, 11E/En1 with realistic submissions
- **Account settings:** `/settings` page built with 5 tabs (Profile, Professional, Privacy, Sharing, Security); avatar upload to DB; avatar chip in sidebar links to `/settings`
- **Phase 1A — Oak content library:** Oak sync script (`scripts/oak-sync.ts`) completed — 19 subjects, 2,017 units, 11,403 lessons synced. `app/actions/oak.ts` created (getOakSubjects, searchOakLessons, getOakLesson, addOakLessonToLesson). `components/OakResourcePanel.tsx` built with filter/search UI. Integrated as "Oak Resources" tab in `LessonFolder.tsx`.
- **Phase 1C Part A — Wonde schema + synthetic data:** 12 Wonde MIS models added to `prisma/schema.prisma` with migration applied. `prisma/seed-wonde.ts` creates Oakfield Academy: 30 staff, 120 students (Y7–Y10), 204 contacts, 32 classes, 480 enrolments, 40 periods, 96 timetable entries, 240 KS2 SAT results.
- **Phase 1B — School Admin Dashboard:** 7 routes under `/admin/`, `app/actions/admin.ts` (8 actions), 6 components under `components/admin/`. SchoolCalendar schema model added + migration. SCHOOL_ADMIN sidebar updated. SCHOOL_ADMIN login now redirects to `/admin/dashboard`.
- **Phase 2A — Platform Admin Dashboard:** `PLATFORM_ADMIN` role added to enum. School model extended: urn, phase, localAuthority, region, isActive, onboardedAt. `SchoolFeatureFlag` + `PlatformAuditLog` models + migration (20260309130000). `app/actions/platform-admin.ts` (7 actions). 6 components under `components/platform-admin/` (PlatformDashboardStats, PlatformUsageChart using recharts, PlatformAuditLogTable, SchoolListTable, SchoolForm, FeatureFlagPanel). Routes: `/platform-admin/dashboard`, `/platform-admin/schools`. `PLATFORM_ADMIN` nav in sidebar. `platform:seed` script seeds `platform@omnis.edu` + 3 demo schools + 5 feature flags.
- **Phase 1E — GDPR Consent Management:** 3 Prisma models (ConsentPurpose, ConsentRecord, DataSubjectRequest) + migration (20260309120000). `app/actions/gdpr.ts` (8 actions: admin + parent). 6 components under `components/gdpr/` (ConsentPurposeForm, ConsentPurposeList, ConsentMatrix, DataSubjectRequestList, ParentConsentPortal, GdprAdminShell). `/admin/gdpr` (3 tabs: Purposes / Matrix / DSRs) for SCHOOL_ADMIN + SLT. `/parent/consent` portal with toggle UI. ConsentRecords are immutable INSERT-only. "GDPR & Consent" in admin sidebar; "Consent Settings" in parent sidebar. Seed: 4 UK-GDPR-framed purposes, 58 sample records.
- **Phase 1D — SEND Resource Quality Scorer:** `SendQualityScore` Prisma model + migration (20260309110000). `app/actions/send-scorer.ts` (getOrCreateSendScore, forceRescoreLesson, getExistingScore, searchLessonsWithScores). 5 components under `components/send/` (SendScoreBadge, SendScoreCard, SendScoreButton, ScorerResultRow, ScorerView). Standalone page `/send-scorer` (SENCO + SLT + SCHOOL_ADMIN). SendScoreButton integrated into OakResourcePanel expanded detail. "Resource Scorer" added to SENCO sidebar nav. AI scoring via `claude-sonnet-4-20250514` across 5 dimensions (readability, visual load, cognitive, language, structure), scores cached in DB.
- **Phase 2B — AI Resource Generator:** `GeneratedResource` Prisma model + migration (20260309140000). `app/actions/ai-generator.ts` (generateResource, getMyResources, getSchoolResources, deleteGeneratedResource, linkResourceToLesson). `marked` installed for markdown rendering. 6 components under `components/ai-generator/` (ResourceTypeIcon, ResourceGeneratorForm, ResourcePreview, ResourceCard, ResourceLibrary, AiGeneratorShell). Route `/ai-generator` (TEACHER, HEAD_OF_DEPT, HEAD_OF_YEAR, SENCO, SLT, SCHOOL_ADMIN). Two-panel layout: left = form, right = preview or library. "AI Generator" added to TEACHER, HEAD_OF_DEPT, HEAD_OF_YEAR, SENCO, SLT, SCHOOL_ADMIN sidebars. Non-streaming Anthropic call with SEND adaptation prompts. Falls back to stub content if `ANTHROPIC_API_KEY` absent.
- **Phase 2E — Delta Oak Sync:** `lastSeenAt` + `deletedAt` fields added to OakSubject/OakUnit/OakLesson. `OakSyncLog` model created + migration (20260309160000). `lib/oak-delta-sync.ts` exports `runDeltaSync()` using shared prisma client — upserts subjects/units/lessons with change detection, soft-deletes unseen records, writes full counts to OakSyncLog. `scripts/oak-delta-sync.ts` standalone wrapper with direct-URL PrismaClient. `npm run oak:delta` script added. `app/api/cron/oak-sync/route.ts` — GET endpoint secured by `CRON_SECRET`, `maxDuration=300`. `vercel.json` cron: Sunday 2am (`0 2 * * 0`). `app/actions/oak.ts` updated to filter `deletedAt: null` in all queries. `getOakSyncLogs` + `triggerDeltaSync` actions added to `platform-admin.ts`. `components/platform-admin/OakSyncStatus.tsx` — log table with per-row expansion + "Run Delta Sync Now" button. `/platform-admin/oak-sync` page + "Oak Sync" (RefreshCw) in PLATFORM_ADMIN sidebar. `.env.local.example` created with `CRON_SECRET` documented.
- **Phase 2D — Cover Management:** `StaffAbsence` + `CoverAssignment` Prisma models + migration (20260309150000). `app/actions/cover.ts` (getTodaysCoverSummary, logAbsence, getAvailableStaff, assignCover, updateAssignmentStatus, deleteAbsence, getStaffList, getCoverHistory). 6 components under `components/cover/` (AbsenceList, AssignCoverModal, CoverAssignmentGrid, LogAbsenceModal, CoverHistoryTable, CoverDashboard, CoverPageTabs). Route `/admin/cover` (SCHOOL_ADMIN, SLT, COVER_MANAGER) with Today/History tabs. "Cover" (CalendarX2) added to SCHOOL_ADMIN, SLT, COVER_MANAGER sidebars. Auto-creates CoverAssignment per lesson when absence logged. `wonde:seed` extended with 2 today absences (WEMP-005 Helen Davies, WEMP-006 Robert Johnson) + mix of assignment statuses.

### 🔲 Still needed

**Analytics filter bar**
- `StudentAnalyticsView` has a filter bar but needs these specific dropdowns confirmed/added:
  - Subject, Year Group, Class, SEND status, Attainment band
- File: `components/StudentAnalyticsView.tsx` + `app/actions/analytics.ts` (`getAnalyticsFilters`)

**Marketing pages (4 pages as Next.js routes)**
- Add 4 public HTML pages as Next.js routes (do not require auth)
- Each page needs an email contact form that sends to `ivanyardley@me.com`
- Suggested routes: `/marketing/home`, `/marketing/features`, `/marketing/beta`, `/marketing/investors` (confirm exact routes with user)
- Install `resend` package for email sending

**Resend email API routes**
- Install: `npm install resend`
- Create `app/api/contact/beta/route.ts` — handles beta sign-up form submissions, sends email to `ivanyardley@me.com`
- Create `app/api/contact/investors/route.ts` — handles investor enquiry form submissions, sends email to `ivanyardley@me.com`
- Add `RESEND_API_KEY` to `.env.local`

**Unbuilt routes (currently show "Coming soon" via `not-found.tsx`)**
- `/lessons` — lesson library page
- `/resources` — resource library page
- `/classes` — partially built (list view exists, may need detail pages)
- `/plans` — SEND plans list/detail
- `/messages` — staff messaging inbox
- `/notifications` — notification centre
- `/hoy/integrity` — integrity case management
- `/admin/audit` — audit log (SCHOOL_ADMIN)
- `/slt/audit` — audit log (SLT)
- `/student/grades` — student grade history
- `/student/homework` — student homework list (individual items exist at `/student/homework/[id]`)
- `/cover/*` — cover manager pages

---

## Key Patterns & Gotchas

**Server actions:** All DB mutations live in `app/actions/`. Always `'use server'` at top. Session via `auth()` from `lib/auth.ts`.

**Multi-tenancy:** Every query must be scoped with `schoolId` from session. Never query without it.

**Prisma client:** Singleton in `lib/prisma.ts`. If server started before schema change, restart dev server or queries will fail silently.

**`SchoolClass.department`** is required (not nullable) in schema.

**Lesson `classId`** is optional — supports out-of-hours/club lessons.

**`createHomework` requires `setAt` and `dueAt`** as ISO strings, and sets `status: 'PUBLISHED'` by default.

**AI homework generation:** `generateHomeworkFromResources(lessonId, type)` in `app/actions/homework.ts` calls Claude with lesson title/objectives/resources as context. Falls back to template if API unavailable.

**SEND review:** Resources are automatically scored for SEND accessibility via `lib/sendReviewCached.ts` on upload. Score 0–100 stored in `ResourceReview.sendScore`.

**Avatar upload:** Stored as base64 data URL in `UserSettings.profilePictureUrl`. Max 5 MB, JPG/PNG only.

**Audit logging:** Use `writeAudit()` helper from `lib/prisma.ts` for all auditable actions.

**Dev server:** `npm run dev > /tmp/omnis-dev.log 2>&1 &` to run in background.
