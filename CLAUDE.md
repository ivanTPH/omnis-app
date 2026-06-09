# Omnis App — Claude Reference

> Last updated: 2026-06-09. Authoritative reference for Claude sessions.
>
> **TRIAL STATUS: TRIAL-READY + POST-LAUNCH IMPROVEMENTS AS OF 2026-06-09.**
> All phases of OMNIS_TRIAL_READINESS_PLAN.md complete (Phases 0–4). 16/16 smoke test checks pass.
> Live teacher feedback incorporated (May 2026 sprint): Year Group Plans, TA Notes, homework depth,
> lesson visibility fixes, design consistency, No Plan filter, Generate ILP button.
> May 2026 Part 2: design system (OmnisLogo, EmptyState, PageHeader, SendBadge, skeleton loaders),
> homework marking two-panel layout, SENCO read-only submission view, ILP evidence automation.
> May 2026 Part 3 (issues 13-18): RAG badges in Performance tab, Support Profile card in student
> deep-dive, student slide-over from ConcernList, year revision mode, adaptive test mode wired,
> student photo proxy SVG initials fallback.
> May 2026 Part 4: Teaching Assistant role — /ta/notes hub, year+class dropdown filters, seed fix.
> May 2026 Part 5: Code quality sprint — ClassRosterTab hook refactor, dashboard unstable_cache,
> debug log removal, bare <a>→<Link> conversions, N+1 fix in addTaNote, error boundaries.
> May 2026 Part 6: Security audit — getTaClasses() role enforcement, Wonde route auth tightening,
> TA_NOTE_ADDED/DELETED audit trail, remaining bare <a> links converted. 110/110 e2e on Vercel.
> June 2026: Homework UX fixes — AI stream final-buffer flush, maxDuration 120s, student answer
> exposure guard, re-generation flow, resizable two-panel drag handles (grip dots + label),
> duplicate model answer suppression in HomeworkDetailPanel. 110/110 e2e on Vercel (18b4e38).
> June 2026 Part 2: Agent recommendation review UI (/senco/agent-insights with confirm/override/
> dismiss), student homework list (/student/homework), resource library (/resources), cover lessons
> weekly view (/lessons). DB perf: indexes on Submission.homeworkId + SendConcern.raisedBy. 13
> debug console.logs removed. Wonde timetable permissions enabled — periods + timetable live.
> June 2026 Part 3: E2E test suite expanded to 155 tests (23 spec files). Fixed Prisma disconnect
> bugs, beforeAll try-catch patterns, icon-only button selectors, loginAs 45s timeout (cold-start
> fail-fast), Homework model schema mismatches (no teacherId; createdBy required). 151/155 passing.
> June 2026 Part 4: Feature gap sprint (BUGS.md GAP-007/008/009/013/014) — parent contact log
> (ParentContactEntry model + addParentContactEntry/deleteParentContactEntry actions, interactive
> ContactsTab in StudentFilePanel), topic heatmap + format breakdown in StudentGradesView, national
> GCSE benchmark comparison in SLT analytics, GCSE exam weighting hints in revision AI prompt.
> 150/155 e2e passing on Vercel (1 network flake, 4 intentional skips).
>
> **Deployment:** https://omnis-app-ten.vercel.app
> June 2026 Part 5: Marketing pages — /marketing/home, /marketing/features, /marketing/beta,
> /marketing/investors. Shared sticky-nav layout, contact forms → ivanyardley@me.com via Resend
> (/api/contact/beta + /api/contact/investors). Middleware updated to exclude /marketing/* from auth.
> June 2026 Part 6: Password reset flow (/forgot-password + /reset-password), staff invitation
> system (/accept-invite + /api/staff/invite + /api/staff/accept-invite), root redirect (/ →
> /marketing/home for unauthenticated users). PasswordResetToken + StaffInvitation Prisma models
> pushed to production. AdminStaffTable "Invite by email" modal. lib/email.ts extended with
> sendPasswordResetEmail + sendStaffInvitationEmail. login page "Forgot your password?" link.
> June 2026 Part 7: Year rollover cron (0 1 1 9 *, Y7→Y12 increment + Y13 deactivation) + manual
> trigger with dry-run preview (YearRolloverPanel). Wonde auto-provisioning of student/parent User
> accounts (gated on School.emailDomain). /admin/users unified management page (UserManagementTable,
> filter chips, deactivate/reactivate/resend). 5 new email triggers: new homework → students, grade
> below target → parents, ILP/EHCP review-due cron (0 7 * * 1-5). Schema: User.activatedAt,
> School.emailDomain, AuditAction YEAR_ROLLOVER/USER_PROVISIONED/WELCOME_EMAIL_SENT.
>
> **Latest commit:** dadc70d (feat: year rollover, Wonde provisioning, user management, email notifications). E2E: 174 passed, 4 skipped, 0 failures. Exit 0.

> **MANDATORY:** Run `npx tsc --noEmit && npm run build` before every `git push`. Both must exit with code 0. Never push if either fails.

---

## Active Development Framework

Prompt-library and planning files live in the project root. Reference these when starting any development task:

| File | Description |
|---|---|
| `DEVELOPMENT.md` | General bug/feature prompt library — 18 recipes covering fixes, new pages, schema changes, deploy checks, and more |
| `ADAPTIVE-LEARNING-LOOP.md` | 7-step teacher lesson → adaptive homework loop — from calendar fix through to per-student adaptive profiles |
| `SEND-FRAMEWORK.md` | 8-step ILP/EHCP/APDR/adaptive SEND system — from auto-ILP generation through to SLT SEND reporting dashboard |
| `TRIAL_READINESS_PLAN.md` | Trial readiness checklist — what must be complete before school trial. Read this before starting any new work. |

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
| UI | React 19.2.3, Tailwind CSS v4, Recharts, Google Material Icons |
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
RESEND_API_KEY="..."      # transactional emails via lib/email.ts (homework reminders, etc.) + future marketing contact forms
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
| `j.taylor@omnisdemo.school` | TEACHING_ASSISTANT |

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
/classes                    My Classes — class filter + full roster (TEACHER primary nav; replaces separate Plans + Analytics links)
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
/student/homework           Student homework list — filter chips, search, status badges
/student/homework/[id]      Student homework submission
/student/grades             Student grade history + sparklines + weak topic detection
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
/senco/agent-insights       Agent recommendation review — confirm/override/dismiss COACH/QUALITY/PLAN_SYNTHESIS outputs
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
/admin/audit                Filterable audit log (SCHOOL_ADMIN)
/slt/audit                  Filterable audit log (SLT — defaults to SEND category)
/lessons                    Weekly timetable view (COVER_MANAGER/SCHOOL_ADMIN/SLT) — 5-day grid, absence flags
/resources                  School resource library — type filter, SEND scores, search
/ta/notes                   Teaching Assistant notes hub — year/class cascade, student list, urgent flags
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
/api/cron/agent-coach       COACH agent nightly batch (02:30 UTC) — weak topics, retention risk
/api/cron/agent-quality     QUALITY agent nightly batch (03:00 UTC) — Bloom's, SEND adaptation, feedback
/api/cron/agent-plan-synthesis  PLAN_SYNTHESIS agent nightly (03:30 UTC) — ILP/EHCP/K Plan coherence
/api/wonde/sync             Wonde full sync — POST, 300s maxDuration, SCHOOL_ADMIN/SLT only

/marketing/home                                   ← fully built (hero, feature grid, role cards, CTAs)
/marketing/features                               ← fully built (6 sections, 35 features)
/marketing/beta                                   ← fully built (school application form, Resend)
/marketing/investors                              ← fully built (market pitch, investor contact form)
/hoy/integrity                                    ← fully built (integrity signals + pattern cases)
/student/grades                                   ← fully built (grade history + sparklines)
/admin/audit, /slt/audit                          ← fully built (filterable audit log)
/lessons                                          ← fully built (weekly timetable for Cover Manager)
/resources                                        ← fully built (school resource library)
/student/homework                                 ← fully built (homework list with filters)
/senco/agent-insights                             ← fully built (agent recommendation review UI)
```

---

## Actions (`app/actions/`)

| File | Key exports |
|---|---|
| `lessons.ts` | getWeekLessons, createLesson, getLessonDetails, updateLessonOverview, addUrlResource, addUploadedResource, addLibraryResource, removeResource, deleteLesson, rescheduleLesson, updateLessonObjectives, getClassRoster, getStudentClassDetail, getSchoolResourceLibrary |
| `homework.ts` | getHomeworkList, getHomeworkForMarking, getSubmissionForMarking, createHomework, markSubmission, generateHomeworkFromResources, autoMarkSubmission, bulkAutoMarkAndQueue, generateHomeworkContent, extractLearningFromLabel, resendHomeworkReminder, saveHomeworkTeacherNote, recordHomeworkAsIlpEvidence, classifyIlpEvidence, saveIlpEvidenceEntries, getIlpEvidenceForStudent, getIlpConcernsThisTerm, getSubmissionReadOnly |
| `ilp-evidence.ts` | requestILPEvidence (SENCO notifies all subject teachers to link homework evidence), checkILPEvidenceMatch (fire-and-forget — uses claude-haiku to detect if a graded submission evidences an ILP target; creates ILP_EVIDENCE_SUGGESTED notification for the teacher) |
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
| `students.ts` | getStudentFile, addParentContactEntry, deleteParentContactEntry |
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
| `HomeworkMarkingView.tsx` | Two-panel marking — student list left (filter chips, SEND badges, grade pills), submission right (Q&A cards, model answer, rubric, per-question scores, SEND sidebar with ILP goals, teacher notes). `canGrade` prop: teachers get full marking; SENCO/SLT/SCHOOL_ADMIN get read-only view. |
| `ui/Icon.tsx` | Shared Google Material Icons wrapper — props: `name` (icon string), `size` ('sm'=16px/'md'=20px/'lg'=24px), `color`, `className`. Use for all icons throughout the app. Do NOT use lucide-react. |
| `ui/EmptyState.tsx` | Consistent empty state — props: `icon`, `title`, `description`, `size` ('sm'/'md'/'lg'). Used across all list/table views. |
| `ui/PageHeader.tsx` | Consistent page header — props: `title`, `subtitle`, `backHref`, `backLabel`, `action` (ReactNode). Used on all main pages. |
| `ui/SendBadge.tsx` | Standardised SEND badge — props: `status` ('SEN_SUPPORT'/'EHCP'), `size`. Replaces ad-hoc badge markup. |
| `OmnisLogo.tsx` | Inline SVG logo component — replaces PNG `<img>` in Sidebar. Renders at configurable size, no network request. |
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
| `students/StudentFilePanel.tsx` | Student file panel — Homework tab: SENCO/SLT/SCHOOL_ADMIN get clickable `<button>` rows opening a read-only slide-over (student answer, grade, feedback, model answer, ILP targets); teachers keep `<a href>` links to the marking view. Slide-over caches fetched data in `detailCache` per session. |

---

## Library (`lib/`)

| File | Purpose |
|---|---|
| `lib/auth.ts` | NextAuth full config — Credentials provider, bcrypt, Prisma adapter, JWT callbacks |
| `auth.config.ts` | Edge-safe auth config — middleware role routing only, no Prisma/bcrypt |
| `lib/session.ts` | `requireAuth(allowedRoles?, fallback?)` — typed session helper for server pages/actions. Replaces `session.user as any` pattern. Returns `AuthUser` (`id, schoolId, schoolName, role, firstName, lastName`). |
| `lib/email.ts` | Resend transactional email — `sendHomeworkReminderEmail`, `sendHomeworkReturnedEmail`, `sendConcernRaisedEmail`. No-ops when `RESEND_API_KEY` absent. Never throws (catches internally). |
| `lib/prisma.ts` | Prisma singleton + `writeAudit()` helper. Extended with AuditLog immutability guard (`$extends`). All models fully typed — **never use `(prisma as any)`**. |
| `lib/grading.ts` | `percentToGcseGrade()`, `suggestGrade()`, `normalizeScoreForForm()`, `formatScore()`, `gradeLabel()`, `gradePillClass()`, `GCSE_LETTERS` |
| `lib/gradeUtils.ts` | Display helpers built on grading.ts: `formatGrade()`, `formatRawScore()`, `scoreToGcseGrade()`, `formatAvgGrade()` (returns `{ main, sub }` for analytics avg display) |
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
| `lib/design-tokens.ts` | Design system constants — `colors`, `badges`, `buttons` objects. Source of truth for Tailwind class strings. Use when building new components. |

---

## Database Schema Summary

### Key Enums

| Enum | Values |
|---|---|
| `Role` | SUPER_ADMIN, SCHOOL_ADMIN, SLT, HEAD_OF_DEPT, HEAD_OF_YEAR, COVER_MANAGER, TEACHER, SENCO, STUDENT, PARENT, PLATFORM_ADMIN, **TEACHING_ASSISTANT** |
| `HomeworkType` | MCQ_QUIZ, SHORT_ANSWER, EXTENDED_WRITING, MIXED, UPLOAD |
| `HomeworkStatus` | DRAFT, PUBLISHED, CLOSED |
| `SubmissionStatus` | SUBMITTED, UNDER_REVIEW, RESUBMISSION_REQ, MARKED, RETURNED |
| `SendStatusValue` | NONE, SEN_SUPPORT, EHCP |
| `ILPStatus` | DRAFT, ACTIVE, UNDER_REVIEW, ARCHIVED |
| `LessonType` | NORMAL, COVER, INTERVENTION, CLUB |
| `AuditAction` | HOMEWORK_CREATED, SUBMISSION_GRADED, GRADE_OVERRIDDEN, ILP_CREATED, SEND_STATUS_CHANGED, LESSON_PUBLISHED, WONDE_SYNC_COMPLETED, RESOURCE_UPLOADED, USER_SETTINGS_CHANGED, TA_NOTE_ADDED, TA_NOTE_DELETED, PARENT_CONTACT_LOGGED, … |
| `ContactMethod` | PHONE, EMAIL, MEETING, LETTER, OTHER |

### ILPTarget.status valid values
`"active"` | `"achieved"` | `"not_achieved"` | `"deferred"` — **NOT** `"in_progress"` (this caused multiple production crashes)

### Model Groups

- **Tenant:** `School`, `TermDate`
- **Users/Classes:** `User`, `SchoolClass`, `ClassTeacher`, `Enrolment`, `ParentChildLink`, `ParentContactEntry`
- **Lessons/Resources:** `Lesson`, `Resource`, `ResourceReview`, `OakContentCache`
- **Homework:** `Homework`, `HomeworkQuestion`, `Submission`, `SubmissionAttempt`, `SubmissionAttemptAnswer`
- **Integrity:** `SubmissionIntegritySignal`, `IntegrityReviewLog`, `IntegrityPatternCase`
- **SEND:** `SendStatus`, `SendScoreCache`, `SendQualityScore`, `SendConcern`, `EarlyWarningFlag`, `SendNotification`
- **ILP/EHCP:** `ILP`, `ILPTarget`, `Plan`, `PlanTarget`, `EhcpPlan`, `EhcpOutcome`, `IlpHomeworkLink`, `HomeworkEhcpEvidence`, `IlpEvidenceEntry`
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
| TEACHER | Calendar, Homework, My Classes (/classes — roster + plans), Revision, Adaptive Learning, AI Generator, Messages |
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
`revision-program/[programId]`, `admin/dashboard`, `hoy`.

**All route error boundaries are now present.**

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
- **Prisma enum case sensitivity:** Enum values must match the exact casing defined in `schema.prisma`. `ILPStatus` values are `ACTIVE`, `UNDER_REVIEW` (uppercase). Using lowercase strings like `'active'` in a `where` clause causes Prisma to silently return null/empty with no error. Always check `schema.prisma` for the exact enum value casing before writing queries.
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

### Icons
- **All icons use Google Material Icons** via `components/ui/Icon.tsx`. Never add lucide-react. Material Icons font is loaded in `app/layout.tsx`.
- Icon name reference: https://fonts.google.com/icons — use snake_case names (e.g. `check_circle`, `expand_more`, `auto_fix_high`).
- Animated spinners: `<Icon name="refresh" size="sm" className="animate-spin" />`

### ILP Evidence Capture
- After `markSubmission`, the action returns `{ ilpData: { studentId, ilpId, targets[] } | null }`.
- `HomeworkMarkingView` shows a blue prompt banner for 10s when a marked student has an active ILP.
- Clicking "Yes" opens a modal that calls `classifyIlpEvidence` (Claude API, max_tokens 300) to classify each ILP goal as PROGRESS/CONCERN/NEUTRAL.
- Teacher confirms/adjusts, then `saveIlpEvidenceEntries` bulk-creates `IlpEvidenceEntry` records.
- Evidence timeline appears on `/send/ilp/[studentId]` page.
- SENCO early warning dashboard (`/senco/early-warning`) shows a rose alert banner when students have 3+ CONCERN entries in the current term (via `getIlpConcernsThisTerm` which uses `groupBy` with `having`).
- `IlpEvidenceEntry` model has `@@unique([submissionId, ilpTargetId])` — safe to call `saveIlpEvidenceEntries` multiple times without duplicates.
- **Proactive detection:** `markSubmission` also fire-and-forgets `checkILPEvidenceMatch` — claude-haiku checks if the submission evidences any ILP target and creates an `ILP_EVIDENCE_SUGGESTED` notification for the teacher. Only triggered for passing grades (4+). Deduplicates by `linkHref`.
- **SENCO notify teachers:** `IlpEvidenceView` amber banner (when targets have no linked evidence) has a "Notify teachers" button calling `requestILPEvidence` — sends `ILP_EVIDENCE_REQUEST` notifications to all subject teachers for that student. Deduplicates within the same day.

### SENCO / SLT Read-Only Views
- **Homework grading is teacher-only.** SENCO, SLT, SCHOOL_ADMIN roles cannot modify marks.
- `canGrade` boolean: computed server-side in the page, passed as prop to `HomeworkMarkingView`.
- `HomeworkMarkingView` hides grade inputs and save buttons when `canGrade=false`.
- Server actions (`markSubmission`, `saveHomeworkTeacherNote`) re-check role and reject non-teacher callers.
- **StudentFilePanel** Homework tab: SENCO gets clickable `<button>` rows that open a read-only slide-over via `getSubmissionReadOnly` action. Teachers keep `<a href>` links to the full marking view.
- `getSubmissionReadOnly` is scoped to staff roles only (`TEACHER`, `SENCO`, `SLT`, `SCHOOL_ADMIN`, `HEAD_OF_DEPT`, `HEAD_OF_YEAR`) and returns only safe display fields.

### Grade Display
- **All scores must be shown as GCSE grades 1–9**, never as raw numbers or "pts".
- `percentToGcseGrade(pct)` converts 0–100 → grade 1–9.
- `gradeLabel(grade)` → "7 (A)" — compact label for pill display.
- `formatRawScore(score)` from `lib/gradeUtils.ts` — smart conversion for scores that could be 0–9 or 0–100 (e.g., from parent/ILP views where `gradingBands` not available).
- `formatAvgGrade(avgScore)` from `lib/gradeUtils.ts` — for analytics where `ClassPerformanceAggregate.avgScore` is on **0–9 scale**. Returns `{ main: "Gr 7 (A)", sub: "avg 6.8" }`.
- **`ClassPerformanceAggregate.avgScore` is on 0–9 scale** — use `formatAvgGrade()`, never `.toFixed(1)`.

### Homework Marking View (right panel)
- `QuestionCard` sub-component: shows question prompt, MCQ options (correct highlighted green), student answer (blue bg), collapsible model answer (green), collapsible rubric (amber), per-question score input.
- `rubricJson` and `modelAnswer` are typed as `unknown` (Prisma.JsonValue). Use `!= null` checks (not bare truthiness) in JSX to avoid TypeScript error "unknown not assignable to ReactNode".
- Per-question scores auto-sum to total score field.
- SEND sidebar (w-72) shows when selected student has an active ILP: ILP summary, up to 3 targets, "Record as ILP evidence" per target.
- Teacher notes section: yellow sticky-note display with textarea + "Add note" button calling `saveHomeworkTeacherNote`. Notes are date-stamped and audit-logged.

### Homework
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

### Trial readiness (see `TRIAL_READINESS_PLAN.md`)
- Read `TRIAL_READINESS_PLAN.md` in the project root before starting any session — it is the authoritative list of what must be done before the school trial.

### Marketing pages ✅ COMPLETE (2026-06-08, commit 0bc1197)
- `/marketing/home`, `/marketing/features`, `/marketing/beta`, `/marketing/investors` — all built
- Shared layout: `app/marketing/layout.tsx` — sticky nav + footer, `OmnisLogo`, role-based links
- Contact forms post to `/api/contact/beta` and `/api/contact/investors` — email to `ivanyardley@me.com` via Resend
- Middleware excludes `/marketing/*` from auth (added `marketing` to matcher negation)

### Wonde timetable sync (pending Wonde permissions)
- Needs `periods.read` and `lessons.read` enabled in Wonde dashboard.
- Email sent to Wonde support (2026-03-17). When granted, re-run full sync from `/admin/wonde`.

### E2E tests
**174/178 tests passing** against Vercel (last run: 2026-06-09). 0 hard failures. 4 gracefully skip
(ehcp-evidence block 3 — require returned homework in DB; run `npm run db:seed` to populate).
24 spec files (178 tests): auth, accessibility, teacher, student, SENCO, SEND smoke (13 steps),
adaptive homework, revision program, Wonde sync, PDF export, GDPR, admin, AI generator,
cover management, platform admin, student photos, revision planner, send scorer,
EHCP evidence (P2002 regression), homework UPLOAD type, student returned HW grade strip,
student notes CRUD, subjects & boards HOY edit-rights regression,
password reset + staff invitation (23 tests — DB-backed token flows, admin UI, anti-enumeration).
- `USERS.hod` (d.brooks), `USERS.hoy` (t.adeyemi), `USERS.ta` (j.taylor) fixtures in users.ts
- loginAs timeout: 45s fail-fast (cold Lambdas fail quickly; warm Lambdas respond in 5-15s)
- 0 flakes when global-setup saves auth state; retries handle remaining cold starts
- Run locally: `npm run test:e2e`
- Run against Vercel: `PLAYWRIGHT_BASE_URL=https://omnis-app-ten.vercel.app npx playwright test`

### Unbuilt routes
All routes are now functional. No unbuilt routes remain.

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

**Homework Marking Enhancement + ILP Evidence ✅ (2026-03-28)**
- `HomeworkMarkingView` right panel: `QuestionCard` sub-component with Q&A display, model answers, rubric, per-question scores.
- SEND sidebar with ILP goals + quick "Record as ILP evidence" per target.
- Teacher notes: yellow sticky display, date-stamped, audit-logged via `saveHomeworkTeacherNote`.
- `markSubmission` now returns `{ ilpData }` — triggers 10s countdown banner + ILP evidence modal.
- `classifyIlpEvidence` calls Claude API (max_tokens 300) to classify each goal as PROGRESS/CONCERN/NEUTRAL.
- `saveIlpEvidenceEntries` bulk-creates `IlpEvidenceEntry` records.
- Evidence timeline added to `/send/ilp/[studentId]` page.
- SENCO early warning page shows rose banner when students have 3+ CONCERN entries this term.
- New Prisma model: `IlpEvidenceEntry` (applied with `prisma db push`).

**Google Material Icons migration ✅ (2026-03-28)**
- Added Material Icons font link to `app/layout.tsx`.
- Created `components/ui/Icon.tsx` — shared wrapper with `name`/`size`/`color`/`className` props.
- Replaced all lucide-react usages across 131 files with `<Icon name="..." />`.
- `lucide-react` is no longer used anywhere in the codebase.

**Student Photo Proxy — Definitive Fix ✅ (2026-04-01)**
- `app/api/student-photo/[userId]/route.ts` rewritten: reads `User.avatarUrl` directly from DB (not WondeStudent name-matching); fetches with `Basic` auth for Wonde URLs (`Bearer` was wrong), no auth for public CDNs; returns 404 if `avatarUrl` null; curl confirmed `200 image/png`.
- `lib/wonde-sync.ts` photo bridge fixed: sync now writes **raw Wonde URL** to `User.avatarUrl` (read by proxy) and proxy URL to `UserSettings.profilePictureUrl` (for sidebar self-avatar). Previous design wrote proxy URL to `User.avatarUrl` — causing circular reference (proxy reads URL → gets proxy URL → loops).
- `components/StudentAvatar.tsx`: added `userId?: string | null` prop. When set, img src = `/api/student-photo/${userId}` (authenticated proxy); when not set, falls back to `avatarUrl` directly (backward compat).
- All 21 StudentAvatar call sites updated with `userId` prop across 17 files: `HomeworkMarkingView`, `ClassListView`, `AdminStudentTable`, `StudentAnalyticsView`, `RevisionProgramDetail`, `StudentFilePanel`, `PlansView`, `ConcernList`, `SubmissionMarkingView`, `StudentContactPanel`, `NewThreadModal`, `ThreadList`, `MessageBubble`, `ClassAnalyticsPanel`, `RagView`, `AdaptiveHeatmapView`, `AdaptiveStudentView`, `ClassRosterTab`, `student/[studentId]/send`.

**GCSE Grading System + Full System Audit + Bug Fixes ✅ (2026-04-01)**
- `lib/grading.ts` updated: `GCSE_LETTERS` map (9=A**, 8=A*, 7=A, 6=B, 5=C+, 4=C, 3=D, 2=E, 1=F), `percentToGcseGrade()`, `gradeLabel()`, `gradePillClass()`.
- `lib/gradeUtils.ts` created: `formatGrade()`, `formatRawScore()`, `scoreToGcseGrade()`, `formatAvgGrade()`.
- `app/actions/rag.ts`: grade-based RAG (green=at/above predicted, amber=1 below, red=2+ below); `RagStudent` now includes `workingAtGrade`, `predictedGrade`, `recentGrades`.
- `ClassAnalyticsPanel`: class avg card coloured by GCSE grade tier; SEND attainment labels use `gradeLabel()`; student rows show trend arrow + grade pill + predicted grade.
- `AdaptiveHeatmapView`: cells and headers show GCSE grade 1–9; colour thresholds grade-based.
- `HomeworkMarkingView`: grade picker 1–9 buttons; `displayScore` always routed through `percentToGcseGrade()`; AI badge shows "Gr X (Y)" not percentage.
- Full system BUGS.md audit produced (26 bugs + 14 feature gaps).
- BUG-001/010: AppShell added to `app/students/[studentId]` and `app/senco/ilp-evidence`.
- BUG-002/003/004/021: Grade display consistency — no more "pts", "Grade 75", or raw decimals.
- BUG-007/009/013/015/016/018/020: 6 dead sidebar links resolved with stub pages; student/homework redirects to dashboard.
- BUG-012: `gap?.length` null safety.
- BUG-019: `app/hoy/error.tsx` error boundary created.
- BUG-022: `app/settings/accessibility` — AppShell added + "← Settings" back link.
- BUG-024: Inline SVG in parent/consent replaced with `<Icon name="chat" />`.

**May 2026 Design + SENCO Sprint ✅ (2026-05-04)**
- Design system: `OmnisLogo` (inline SVG, replaces PNG), `EmptyState`, `PageHeader`, `SendBadge` components. Typography scale, card/surface system, SEND badge standardisation, skeleton loaders across all list/card views.
- `HomeworkMarkingView` rebuilt as two-panel layout: student list (left, with SEND badges + grade pills) + submission view (right, with Q&A cards, auto-score, teacher notes).
- Teacher dashboard polish: stat cards, today's lessons strip, homework-to-mark list, open concerns widget.
- LessonFolder tab restyle to pills; Revision tab removed (content moved to lesson plan section).
- Learning passport selection: per-student checkboxes on ILP list, "No Passport" filter chip, context-aware Generate button.
- **ILP evidence automation:** `app/actions/ilp-evidence.ts` — `requestILPEvidence` (SENCO notify teachers button), `checkILPEvidenceMatch` (fire-and-forget proactive AI detection via claude-haiku after marking).
- **SENCO read-only submission view:** `StudentFilePanel` Homework tab now shows clickable rows for SENCO/SLT/SCHOOL_ADMIN that open a read-only slide-over. `getSubmissionReadOnly` server action added. Teachers keep existing `<a href>` links.
- **Homework grading role enforcement:** `markSubmission` and related actions reject non-teacher callers; `canGrade` prop threads from server page to `HomeworkMarkingView`.
- **ILP row chevron fix:** `IlpPageView` — `shrink-0` on action strip, single rotating `expand_more` icon, `stopPropagation` on action buttons, "Collapse" link at bottom of expanded content. Same fix applied to `ClassListView`.
- **AppShell restored** on `/student/[studentId]/send`, `/admin/cover`, `/student/revision` (sidebar was missing).
- **Bare `<a href>` → `<Link>`** in `KPlanModal`, `EhcpPageClient`, `StudentFilePanel`.

**May 2026 Part 3 — Issues 13-18 ✅ (2026-05-06)**
- **Issue 13 (RAG in Performance tab):** `StudentAnalyticsView` Performance tab now loads RAG data via `getClassRagData` when a class is selected. Each student row shows a colour-coded RAG pill (green=on track, amber=borderline, red=needs support). Class stats bar shows counts. Grid layout updated to `grid-cols-[1fr_130px_110px_110px_60px_80px]`.
- **Issue 14 (Support Profile card):** `StudentDeepDive` in `StudentAnalyticsView` now shows an amber "Support Profile" card grouping SEND badge + needArea, ILP areasOfNeed (2-line clamp), active SMART goals (max 3 + overflow count), and most recent teacher note (from `file.notes`).
- **Issue 15 (Student slide-over from ConcernList):** `ConcernList` now imports `StudentContactPanel` and adds a "Profile" button to each concern card's `rightContent`. Clicking opens the student contact slide-over with contact details, SEND status, and messaging options.
- **Issue 16 (Year revision mode):** Already fully implemented. `getYearTopics`, `createYearRevisionProgram` server actions in `revision-program.ts`. `YearRevisionCreator.tsx` 3-step wizard (configure → topic checklist → generating). `YearRevisionView` renders Section A (generic guide) + Section B (personalised focus areas). Route: `/revision-program/year`.
- **Issue 17 (Adaptive test mode):** Already fully implemented. `RevisionTaskView` phase state machine includes `'test'` phase that renders `RevisionTestMode`. "Start Test" button wired for both standard and year revision tasks. `test-engine.ts` handles difficulty cycling, question generation, evaluation, results.
- **Issue 18 (Photo proxy SVG fallback):** `app/api/student-photo/[userId]/route.ts` now queries `firstName` and `lastName` alongside `avatarUrl`. Returns deterministic-colour SVG initials avatar instead of 404/error when avatarUrl is null or upstream fetch fails.

**May 2026 Part 4–6 — TA Role + Code Quality + Security Audit ✅ (2026-05-31)**
- **Teaching Assistant role:** `/ta/notes` hub (`TaNotesHub`) with year group + class cascade dropdowns,
  student list with SEND badges, inline note add/view/mark-read, urgent flag, TA notifications to class teachers.
  Route: `/ta/notes`. Sidebar: Student Notes, Messages, Notifications only.
  Auth: routes to `/ta/notes` on login. Demo user: `j.taylor@omnisdemo.school / Demo1234!`.
  Seed: TA user now in main `npm run db:seed` (upsert resets password on every seed run).
- **Code quality:** `ClassRosterTab.tsx` split from 1430→~700 lines via `hooks/useClassRosterData.ts`.
  `getDashboardData` wrapped in `unstable_cache` (60s TTL per user/day). N+1 in `addTaNote`
  notifications replaced with `findMany` + `createMany`. Debug console.logs removed (lessons, dashboard).
  `app/ta/error.tsx` error boundary added. Class Notes / TA Notes labelling distinguished.
  6 bare `<a href>` internal links converted to `<Link>` (SencoDashboard, StudentFilePanel, StudentAnalyticsView).
- **Security audit (2026-05-31):** `getTaClasses()` missing role check fixed (now uses `requireAllowed()`).
  Wonde sync route auth guard tightened (explicit null-checks on schoolId + role). `TA_NOTE_ADDED` and
  `TA_NOTE_DELETED` added to `AuditAction` enum; `addTaNote()` and `deleteTaNote()` now call `writeAudit()`.
  `console.error` removed from `TaNotesHub` client. 4 remaining bare `<a href>` links converted
  (AdaptiveHeatmapView, AdaptiveStudentView, IlpEvidenceView, SencoDashboard).
- **E2E:** 110/110 tests passing on both localhost and live Vercel deployment.

**Phase 4 — Trial Readiness ✅ (2026-04-08)**
- Phase 4.1 (Data safety): schoolId scoping confirmed on all queries; SEND data not accessible to student/parent roles; ILP audit trail via writeAudit().
- Phase 4.2 (Performance): Loading skeletons on ClassRosterTab, StudentAnalyticsView, IlpPageView; progress bars on ILP gen (60s) and homework gen (30s); DB indexes added (`@@index([userId])` on Enrolment); analytics filter queries wrapped in 60s unstable_cache; classSize parallelised into Promise.all; ILP batch reduced 10→5 with 1s inter-batch delay.
- Phase 4.3 (Error handling): `app/admin/error.tsx` + `app/student/error.tsx` added (all routes now have error boundaries); `HomeworkSubmissionView` saves draft to localStorage before submit, try/catch with retry button on failure; AI error messages in `generateIlpGoalsForStudent` + `generateILPForStudent` changed from raw `String(err)` to user-friendly strings.
- Phase 4.4 (Smoke test): Full 16-step end-to-end code audit — all PASS. Adaptive SEND homework (scaffolding_hint/ehcp_adaptation/vocab_support) confirmed generated and rendered. Concern flagging → SENCO notification confirmed. SEND attainment gap in SLT analytics confirmed.

**June 2026 — Homework UX Polish ✅ (2026-06-02)**
- AI stream: fixed final-buffer flush on stream close so last chunk is never dropped; `maxDuration` increased to 120s on `/api/homework/generate`.
- Student answer exposure: submission answers are no longer shown to other students in the marking view.
- Re-generation flow: teachers can regenerate homework content without losing existing submissions.
- Sign-in redirect: switched to `window.location.href` after NextAuth sign-in so server-side role redirect fires correctly for all roles (including TEACHING_ASSISTANT → `/ta/notes`).
- Resizable two-panel layout in `HomeworkMarkingView`: left/right panel resized via a 12px grip-dot handle (`cursor-col-resize`, 160–360px range); marking panel height resized via a 20px bar with `drag_handle` icon + "drag to resize" label (`cursor-ns-resize`, 180–700px range).
- Duplicate model answer fix in `HomeworkDetailPanel`: combined `hw.modelAnswer` block now suppressed when per-question answers are already rendered via `scQuestions`, `qJson`, or `hqRows`.
- 110/110 e2e passing on Vercel (commit 18b4e38). 3 network flakes on cold start — all pass on retry #1.

**June 2026 Part 3 — E2E Test Suite Expansion ✅ (2026-06-06)**
- **5 new spec files added** (155 tests total, 23 spec files): `ehcp-evidence.spec.ts` (EHCP plans
  access + P2002 regression guard), `homework-upload.spec.ts` (UPLOAD type student/teacher views +
  Year Group Plans "External Link" label), `student-notes-edit.spec.ts` (teacher add/edit/delete
  notes, TA notes hub, access control), `student-returned-hw.spec.ts` (grade context strip, homework
  list), `subjects-boards-hoy.spec.ts` (HOD/HOY edit rights regression).
- **Playwright fixes:** `loginAs` timeout reduced 120s→45s (cold Lambdas fail fast; suite runs in
  ~18 min instead of 1h+). `beforeAll` DB setup wrapped in try-catch — unhandled throws caused 0ms
  test failures instead of graceful skips. Removed duplicate `prisma.$disconnect()` calls across
  describe blocks in same file (block N's afterAll was disconnecting shared client before block N+1's
  beforeAll). Auth cookie injection: added `page.goto('/')` after `addCookies()` to trigger
  middleware role redirect.
- **Selector fixes:** `"add note"` → `"save note"` button text; icon-only edit button found via
  `locator('button').filter({ has: locator('span', { hasText: /^edit$/ }) })`.
- **Homework schema fix:** `ensureUploadHomework` was using non-existent `teacherId` field and
  missing required `createdBy`. Fixed to filter by `classId` and include `createdBy: teacher.id`.
- **Result:** 151/155 passing on Vercel (exit code 0). 4 gracefully skip (ehcp-evidence block 3
  requires returned homework in DB — run `npm run db:seed`).

**June 2026 Part 2 — Feature Completion + Wonde Timetable ✅ (2026-06-05)**
- **Agent recommendation UI:** `/senco/agent-insights` — `AgentRecommendationsView` with filter chips (Awaiting/Reviewed/All), confirmation modal, confirm/override/dismiss actions via `reviewAgentRecommendation`, audit-logged. `getPendingAgentRecommendations` server action with pagination.
- **Student homework list:** `/student/homework` — `StudentHomeworkListView` with STATUS_CHIPS (Overdue/Due soon/Upcoming/Submitted/Graded), search, `daysUntil()` helper, grade pills. Server component deduplicates adapted variants.
- **Resource library:** `/resources` — `ResourceLibraryView` with type filter chips (PLAN/SLIDES/WORKSHEET/VIDEO/LINK), URL search state sync, SEND score badges (green ≥70 / amber ≥40 / red <40). `getFullResourceLibrary(typeFilter?, query?)` server action added to `lessons.ts`.
- **Cover lessons view:** `/lessons` — `LessonsWeekView` weekly 5-day grid, search + subject + day filters, week nav, absence-affected cards highlighted amber. Uses `scheduledAt`/`endsAt` (not lessonDate/endTime). `SchoolLesson` type added to `lessons.ts`.
- **DB indexes:** `@@index([homeworkId])` on Submission, `@@index([schoolId, raisedBy])` on SendConcern — pushed to production DB.
- **13 debug console.logs removed** from homework.ts, revision-program.ts, ai-generator.ts, content-generator.ts.
- **SENCO sidebar:** "AI Insights" nav item added pointing to `/senco/agent-insights`. "Resource Library" added to TEACHER nav.
- **Wonde timetable:** `periods.read` + `lessons.read` permissions now enabled in Wonde dashboard. Existing sync code (steps 6–7) will populate `WondePeriod` + `WondeTimetableEntry` tables on next full sync from `/admin/wonde`.

**June 2026 Part 7 — Year Rollover, Wonde Provisioning, User Management, Email Notifications ✅ (2026-06-09)**
- **Year rollover cron:** `/api/cron/year-rollover` (schedule `0 1 1 9 *`) — `$executeRaw` increments yearGroup for Y7–Y12, sets `isActive=false` for Y13 leavers, writes `YEAR_ROLLOVER` audit entry.
- **Manual trigger:** `POST /api/admin/trigger-year-rollover` with `{ dryRun: true }` preview (returns counts without applying). `YearRolloverPanel` component on `/admin/dashboard` — idle → preview → confirm → done state machine.
- **Wonde auto-provisioning:** After each sync, creates `User` accounts for unprovisioned students/parents (gated on `School.emailDomain`). Student email: `firstname.lastname@students.{emailDomain}`. Parent email from `WondeContact.email`. Sends welcome email with 7-day activation link. Writes `USER_PROVISIONED` + `WELCOME_EMAIL_SENT` audit entries per-record. Best-effort with per-record try/catch.
- **`/admin/users`:** Unified user management page. `getSchoolAllUsers`, `deactivateUser`, `reactivateUser`, `resendWelcomeEmail` server actions in `app/actions/admin.ts`. `UserManagementTable` — filter chips (All/Students/Parents/Staff/Pending), search, status badges (Active/Pending/Inactive), activated date, per-row actions. "All Users" in SCHOOL_ADMIN sidebar + admin dashboard quick links.
- **5 new email functions** in `lib/email.ts`: `sendWelcomeAccountEmail`, `sendIlpReviewDueEmail`, `sendEhcpReviewDueEmail`, `sendNewHomeworkEmail`, `sendGradeBelowTargetEmail`.
- **Email triggers:** New homework published → enrolled students notified (`createHomework`). Grade 2+ below predicted → parent notified (`markSubmission`). ILP ≤7 days + EHCP ≤30 days → SENCO emailed by `/api/cron/review-due` (schedule `0 7 * * 1-5`).
- **Schema:** `User.activatedAt DateTime?` (set fire-and-forget in `lib/auth.ts` on first login). `School.emailDomain String?`. `AuditAction`: `YEAR_ROLLOVER`, `USER_PROVISIONED`, `WELCOME_EMAIL_SENT`. All pushed to production DB.
- **E2E:** 174 passed, 4 skipped, 0 failures. Exit 0.

**June 2026 Part 6 — Password Reset + Staff Invitation + Root Redirect ✅ (2026-06-08)**
- **Password reset flow:** `app/forgot-password/page.tsx` (email entry, always-200 response to prevent enumeration) + `app/reset-password/page.tsx` (new password form, Suspense + useSearchParams). API routes: `app/api/auth/forgot-password/route.ts` (1h token) + `app/api/auth/reset-password/route.ts` (bcrypt + $transaction). "Forgot your password?" link added to login page.
- **Staff invitation system:** `app/api/staff/invite/route.ts` (SCHOOL_ADMIN/SLT only — creates 7-day token, sends email, invalidates prior pending invites) + `app/api/staff/accept-invite/route.ts` (GET: validate token; POST: create User + mark invite used). `app/accept-invite/page.tsx` (account setup form). "Invite by email" modal added to `AdminStaffTable` with firstName/lastName/email/role fields.
- **Root redirect:** Unauthenticated requests to `/` now redirect to `/marketing/home` (via `auth.config.ts` authorized callback).
- **Prisma schema:** `PasswordResetToken` + `StaffInvitation` models added, pushed to production DB.
- **lib/email.ts:** `sendPasswordResetEmail` + `sendStaffInvitationEmail` added.
- **Middleware:** `forgot-password|reset-password|accept-invite` added to public matcher exclusions.
- **E2E:** 148 passed, 4 skipped, 3 network flakes (all retry-pass), 0 hard failures. Exit 0.

**June 2026 Part 5 — Marketing Pages ✅ (2026-06-08)**
- **4 public routes:** `/marketing/home` (hero, feature grid, role cards), `/marketing/features` (6 sections, 35 features), `/marketing/beta` (school application form), `/marketing/investors` (market pitch + contact form).
- **Shared layout:** `app/marketing/layout.tsx` — sticky nav with `OmnisLogo`, links to all 4 pages, "Sign in" CTA, and footer.
- **Contact API routes:** `app/api/contact/beta/route.ts` + `app/api/contact/investors/route.ts` — POST JSON, send formatted HTML email to `ivanyardley@me.com` via Resend. No-op gracefully without `RESEND_API_KEY`.
- **Middleware:** `marketing` added to matcher negation — all `/marketing/*` routes are public (no auth required).

**June 2026 Part 4 — Feature Gap Sprint ✅ (2026-06-08)**
- **GAP-007 (Parent contact log):** New `ParentContactEntry` Prisma model (`ContactMethod` enum: PHONE/EMAIL/MEETING/LETTER/OTHER; `PARENT_CONTACT_LOGGED` AuditAction). `addParentContactEntry` + `deleteParentContactEntry` server actions in `app/actions/students.ts`. Interactive `ContactsTab` in `StudentFilePanel` — add-entry form (date, method, summary, outcome), optimistic UI, delete per entry, chronological log with method icons.
- **GAP-009 (Topic heatmap + format breakdown):** `TopicHeatmap` component in `StudentGradesView` — colour-coded topic chips (green 7–9, blue 5–6, amber 4, red 1–3) with legend. `FormatBreakdownPanel` — bar chart of avg grade per homework format with "best format" insight. Both added to `SubjectCard` expanded view.
- **GAP-013 (National GCSE benchmark):** `NATIONAL_AVG` record in `app/slt/analytics/page.tsx` (2024 JCQ national averages per subject, 0–9 scale). "vs National Average" sidebar card in SLT analytics showing trending arrows + delta per subject.
- **GAP-008 (GCSE exam weighting hints):** `GCSE_WEIGHT_HINTS` record in `lib/revision/content-generator.ts`. Exam component weighting injected into `generateRevisionTask` AI prompt to bias content towards high-value paper components.
- **GAP-014 (Schema):** `prisma db push` applied — `ParentContactEntry` table live in production DB.
- **E2E:** 150/155 passing on Vercel (1 network flake on `/senco/ehcp`, 4 intentional skips).
