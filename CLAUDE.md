# Omnis App — Claude Reference

> Last updated: 2026-03-04. This file is the authoritative reference for Claude sessions working on this codebase.

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
└── parent.ts       sendParentMessage
```

### Components (`components/`)

| Component | Controls |
|---|---|
| `Sidebar.tsx` | Role-based left nav (all authenticated views) |
| `AppShell.tsx` | Main authenticated layout wrapper (sidebar + content area) |
| `WeeklyCalendar.tsx` | Teacher calendar grid (click = slide-over, dbl-click = lesson folder) |
| `MiniCalendar.tsx` | Small month calendar (used inside WeeklyCalendar) |
| `LessonSlideOver.tsx` | Right-side panel — create new lesson |
| `LessonFolder.tsx` | Lesson detail modal — 5 tabs (Overview, Resources, Homework, SEND, Analytics) |
| `AddResourcePanel.tsx` | Inline panel for adding resources to a lesson |
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
└── migrations/
    ├── 20260301191436_add_lessons/
    └── 20260301195139_add_send_need_area_misconception_tags/
```

**Seed commands:**
```bash
npm run db:seed            # main seed (all demo data)
npm run db:seed-classes    # classes only
npm run db:seed-english    # English class students + submissions
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
| ILP records + detail | `app/send/ilp/` |
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
- `/admin/users` — user management (SCHOOL_ADMIN)
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
