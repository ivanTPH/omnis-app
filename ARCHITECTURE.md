# Omnis — Architecture Reference

> Last updated: 2026-06-29. Companion to CLAUDE.md (which covers conventions and patterns).

---

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16.1.6 (App Router) | Turbopack in dev, edge-compatible middleware |
| UI | React 19.2.3, Tailwind CSS v4 | All icons via `components/ui/Icon.tsx` (Google Material Icons) |
| Auth | NextAuth v5 (`beta.30`) | Credentials + JWT; no DB sessions |
| ORM | Prisma v6.19.2 | Singleton in `lib/prisma.ts`; `$extends` for AuditLog immutability guard |
| Database | PostgreSQL via Supabase | PgBouncer on port 6543 (transaction mode) for app; direct on 5432 for migrations |
| AI | Anthropic Claude SDK `^0.78.0` | Two tiers: `claude-sonnet-4-6` (complex generation), `claude-haiku-4-5` (classification, scoring) |
| PDF | Puppeteer v24 | Server-side HTML→PDF; routes under `/api/export/*` |
| Email | Resend | `lib/email.ts` — all sends wrapped in try/catch, no-op when `RESEND_API_KEY` absent |
| MIS sync | Wonde REST API | `lib/wonde-client.ts` + `lib/wonde-sync.ts`; POST `/api/wonde/sync` (300s maxDuration) |
| Testing | Playwright 1.58 | ~260 tests across 37 spec files; runs headless locally and against Vercel |

---

## 2. Data Architecture

### Multi-tenancy
Every Prisma query is scoped by `schoolId` extracted from the NextAuth JWT session. No cross-school data leakage is possible at the query layer because `requireAuth()` / `requireAllowed()` in `lib/session.ts` always returns the session's `schoolId`, and every server action includes it in the `where` clause.

### Key Model Groups

```
Tenant           School, TermDate
Users/Classes    User, SchoolClass, ClassTeacher, Enrolment, ParentChildLink, ParentContactEntry
Lessons/Resources Lesson, Resource, ResourceReview, OakContentCache
Homework         Homework, HomeworkQuestion, Submission, SubmissionAttempt, SubmissionAttemptAnswer
SEND             SendStatus, SendConcern, EarlyWarningFlag, SendNotification, SendScoreCache
ILP/EHCP         ILP, ILPTarget, IlpEvidenceEntry, EhcpPlan, EhcpOutcome, AssessPlanDoReview
Adaptive         StudentLearningProfile, LearningSequence, SubjectAdaptationProfile
Behaviour        BehaviourRecord, Detention, Exclusion
Safeguarding     SafeguardingRecord
Comms            MsgThread, MsgParticipant, MsgMessage, SchoolCommunication, CommunicationReceipt
Pastoral         PastoralNote
Revision         RevisionExam, RevisionSession, RevisionProgram, RevisionTask, RevisionProgress
System           Notification, AuditLog, UserSettings, ConsentRecord
Wonde MIS (12)   WondeEmployee, WondeStudent, WondeClass, WondePeriod, WondeTimetableEntry, …
```

### Critical Field Notes
- `ClassPerformanceAggregate.avgScore` is on **0–9 GCSE scale**, not 0–100.
- `ILPTarget.status` valid values: `"active"` | `"achieved"` | `"not_achieved"` | `"deferred"` (lowercase strings, NOT enum).
- `Homework` has no `teacherId` — teacher is found via `classId → SchoolClass → ClassTeacher`.
- `SendStatus` has no `schoolId` — scope via `student: { schoolId }`.

---

## 3. Auth Flow

```
User submits credentials
  ↓
NextAuth Credentials provider (lib/auth.ts)
  ↓ bcrypt verify
  ↓ prisma.user.findUnique (email + schoolId via school.slug)
  ↓ creates JWT: { id, schoolId, schoolName, role, firstName, lastName }
  ↓
middleware.ts (auth.config.ts — edge-safe, no Prisma/bcrypt)
  ↓ public paths excluded: /login, /marketing/*, /api/auth/*, /forgot-password, /reset-password, /accept-invite
  ↓ authenticated: getRoleHome() → redirect to role's home route
  ↓ unauthenticated → /marketing/home

Server pages/actions
  ↓ requireAuth() from lib/session.ts
  ↓ returns AuthUser { id, schoolId, schoolName, role, firstName, lastName }
  ↓ all Prisma queries scoped by schoolId
```

### Role → Home Route
| Role | Home |
|---|---|
| STUDENT | `/student/dashboard` |
| PARENT | `/parent/dashboard` |
| SENCO | `/send/dashboard` |
| SLT | `/slt/analytics` |
| SCHOOL_ADMIN | `/admin/dashboard` |
| PLATFORM_ADMIN | `/platform-admin/dashboard` |
| ACADEMY_ADMIN | `/academy/dashboard` |
| TEACHING_ASSISTANT | `/ta/notes` |
| HEAD_OF_YEAR | `/hoy/dashboard` |
| All others | `/dashboard` |

---

## 4. AI Call Patterns & Cost Model

### Model Usage by Feature

| Feature | Model | max_tokens | Trigger | Notes |
|---|---|---|---|---|
| Homework generation | `claude-sonnet-4-6` | 8,000 | Teacher clicks Generate | One call; retries once with follow-up if JSON malformed |
| Adaptive differentiation | `claude-sonnet-4-6` | 1,200 | Teacher clicks "Generate SEND adaptations" | One call **per SEND student**, batched 5 at a time |
| ILP goal generation | `claude-sonnet-4-6` | 2,500 | SENCO creates ILP | One call per ILP |
| ILP evidence classification | `claude-haiku-4-5` | 400 | After marking — fire-and-forget | One call per marked submission with active ILP |
| Auto-grading (MCQ/short answer) | `claude-sonnet-4-6` | 600 | After student submits | One call per submission |
| Concern pattern analysis | `claude-sonnet-4-6` | ~1,000 | SENCO early warning cron | One call per student batch |
| SEND accessibility scoring | `claude-haiku-4-5` | 500 | On resource upload | One call per resource; result cached in `SendScoreCache` |
| Adaptive learning profile | `claude-haiku-4-5` | 800 | After marking | Fire-and-forget profile update |
| Nightly agents (COACH/QUALITY/PLAN_SYNTHESIS) | `claude-haiku-4-5` | ~500 | Vercel cron 02:30–03:30 UTC | Batch across all students; results stored as `AgentRecommendation` records |
| Revision task generation | `claude-sonnet-4-6` | 3,000 | Teacher creates revision program | One call per task |
| Revision test evaluation | `claude-sonnet-4-6` | 800 | Student submits test answer | One call per answer |

### Token Logging
Differentiation calls log to Vercel function logs:
```
[Differentiation] {studentName} — input: {n}t, output: {m}t, model: claude-sonnet-4-6
```
Other calls do not yet log usage. Add `console.log(msg.usage)` at call sites when investigating cost.

### Cost Estimates (approximate, June 2026 pricing)

| Feature | Per-event cost | Class of 30 (5 SEND) | School of 1,000 students |
|---|---|---|---|
| Homework generation | ~$0.10 (8K tokens) | $0.10/homework | — |
| SEND differentiation | ~$0.03/student | $0.15/homework | — |
| Auto-grading | ~$0.005/submission | $0.15/homework | $150/term |
| Nightly agents | ~$0.01/student/night | — | ~$10/night |
| ILP generation | ~$0.05/ILP | — | — |

**Key**: Haiku is ~20× cheaper than Sonnet per token. Classification tasks (evidence match, scoring) use Haiku intentionally. Generation tasks (homework, ILP goals, adaptations) require Sonnet quality.

### Caching
- **SEND scores**: cached in `SendScoreCache` table (one row per resource, keyed on `resourceId`). No TTL — invalidated by re-upload.
- **Differentiation results**: not cached. Each "Generate adaptations" click re-calls the API. Future: cache in DB keyed on `homeworkId + studentId + ilpVersion`.
- **Dashboard queries**: wrapped in `unstable_cache` (60s TTL per `userId + weekStart`).
- **Oak lesson content**: cached in `OakContentCache` table.

---

## 5. MIS Integration (Wonde)

```
POST /api/wonde/sync
  ↓ lib/wonde-client.ts — paginated fetch for all entity types
  ↓ lib/wonde-sync.ts — upsert engine:
    1. Employees (staff)
    2. Groups (curriculum groupings)
    3. Classes (with subject)
    4. Students (with year group)
    5. Parent contacts (WondeContact)
    6. Periods (timetable slots)
    7. Timetable entries (which class, which room, which period)
  ↓ maxDuration: 300s (set in route file, not vercel.json)
```

**Key gotchas:**
- `WondePeriod.day` is a string (`"monday"`), `day_number` is int.
- `WondeTimetableEntry.period`, `.employee`, `.room` are flat strings (NOT nested objects).
- `WondeContact.relationship` IS a nested object: `{ relationship: string, parental_responsibility: boolean }`.
- `fetchWondeClasses` includes `'students,subject'` only — `employees` returns 400.
- Teacher timetable in dashboard falls back to lesson DB if no `WondeTimetableEntry` rows match by `employeeId`. Demo data intentionally nulls out `employeeId` so the fallback fires.

**Provisioning:** After sync, Wonde auto-provisioning creates `User` accounts for unmatched students/parents when `School.emailDomain` is set. Sends welcome email with 7-day activation link.

---

## 6. PDF Export

All exports follow the same pattern:

```
GET /api/export/{type}/[id]
  ↓ requireAuth() — role check
  ↓ prisma query → data
  ↓ lib/pdf/{type}-template.ts → HTML string
  ↓ lib/pdf/generator.ts → Puppeteer → Buffer
  ↓ Response with Content-Type: application/pdf
```

**Templates live in:** `lib/pdf/`
- `lesson-plan-template.ts` — lesson plan A4
- `homework-template.ts` — homework detail
- `revision-timetable-template.ts` — student revision schedule
- `apdr-template.ts` — APDR cycle PDF
- `academy-report-template.ts` — trust compliance report

**Puppeteer on Vercel**: `puppeteer-core` + `@sparticuz/chromium` (Vercel-compatible). maxDuration set to 60s on export routes.

---

## 7. Deployment

**Platform:** Vercel (Next.js first-party)
**Database:** Supabase PostgreSQL
**URL:** https://omnis-app-ten.vercel.app

### Connection Pooling
- App → PgBouncer (port 6543, transaction mode): `DATABASE_URL` with `?pgbouncer=true&connection_limit=5`
- Migrations → Direct (port 5432): `DIRECT_URL`
- Prisma singleton prevents multiple client instances in the same Lambda warm-start.

### Vercel Crons (vercel.json)
```json
{ "path": "/api/cron/oak-sync",      "schedule": "0 2 * * 0"   }   // Sunday 02:00 UTC
{ "path": "/api/cron/early-warning", "schedule": "0 6 * * 1-5" }   // Mon-Fri 06:00 UTC
```
Additional crons use `export const schedule` in the route file:
- `/api/cron/agent-coach` — 02:30 UTC nightly
- `/api/cron/agent-quality` — 03:00 UTC nightly
- `/api/cron/agent-plan-synthesis` — 03:30 UTC nightly
- `/api/cron/review-due` — 07:00 UTC Mon-Fri
- `/api/cron/year-rollover` — 01:00 UTC 1 Sep

### Environment Variables
```
DATABASE_URL        PostgreSQL via PgBouncer (port 6543)
DIRECT_URL          Direct PostgreSQL (port 5432, migrations only)
NEXTAUTH_SECRET     JWT signing key
NEXTAUTH_URL        Canonical URL (https://omnis-app-ten.vercel.app in prod)
ANTHROPIC_API_KEY   Claude API — all AI features no-op gracefully without this
RESEND_API_KEY      Transactional email — no-op gracefully without this
CRON_SECRET         Bearer token for cron endpoints
WONDE_API_TOKEN     Wonde MIS API token
WONDE_SCHOOL_ID     Wonde school ID (A1930499544 for test school)
```

### Key Build Rules
- `npx tsc --noEmit && npm run build` must exit 0 before every `git push`.
- **No `functions` block in vercel.json** — App Router routes use `export const maxDuration` in the route file.
- Tailwind v4: full class literals only (no dynamic string construction).

---

## 8. Key Architectural Decisions

### Server Actions Over API Routes
All data mutations use Next.js Server Actions (`app/actions/*.ts`) rather than API routes. This provides:
- Automatic CSRF protection
- Type-safe calling from client components
- Co-location with data models

Exception: long-running operations (`/api/wonde/sync`, PDF exports, AI streaming) use API routes with `export const maxDuration`.

### Audit Logging
`writeAudit()` in `lib/prisma.ts` creates immutable `AuditLog` records. The Prisma `$extends` hook blocks `update/delete/upsert` on `auditLog`. Used after every significant mutation.

### SEND Data Isolation
SEND/ILP/EHCP data is only accessible to staff roles (`TEACHER`, `HOD`, `HOY`, `SENCO`, `SLT`, `SCHOOL_ADMIN`). Student and parent roles cannot query SEND records — enforced in `requireAuth()` role checks within each action.

### Grade Scale
All scores displayed as GCSE grades 1–9. Internal storage:
- `Submission.finalScore` — 0–100 percentage
- `ClassPerformanceAggregate.avgScore` — 0–9 scale (direct GCSE grade)
- Conversion via `lib/grading.ts`: `percentToGcseGrade()`, `gradeLabel()`
