# Data protection changes (29 Sep 2026)

These changes implement the recommendations from the DPIA readiness review for the first school trial.
The review and the Trust documents are kept privately in `Documents and Forms/`, which is gitignored.

## 1. AI gateway: pupil names never reach the AI provider

- New `lib/ai/`:
  - `pseudonymise.ts`: swaps known person names for codes (`[N1]`, `[N2]` …) and removes email addresses and UK phone numbers.
    It covers full names, title + surname ("Mr Patel") and first names on their own.
    Everyday-word names ("Mark", "Grace", "May") are only replaced as part of a full name. Unicode-aware (Zoë, O'Brien).
  - `name-directory.ts` / `name-directory-core.ts`: the names to protect (User, WondeStudent, WondeContact,
    WondeEmployee), cached for 10 minutes.
  - `safe-anthropic.ts`: `SafeAnthropic`, a drop-in subclass of the SDK client.
    - `messages.create()` and `messages.stream()` redact every text part of the request and restore names in the response.
    - Streamed text is restored with a hold-back, so a code split across chunks still comes back correctly.
    - **Fails closed**: if the name list cannot be loaded, nothing is sent.
- All 52 `new Anthropic(` call sites across 29 files now use `new SafeAnthropic(`.
- Tests (`npm run test:unit`, which now also picks up `lib/**/*.test.ts`):
  - `lib/ai/pseudonymise.test.ts`: 8 tests.
  - `lib/ai/safe-anthropic.test.ts`: 3 tests. Uses a fake API that echoes what it received: names never leave, the
    response is restored, and a failed name-list load means the request is refused.
  - `lib/ai/gateway.test.ts`: fails the build if anyone constructs `new Anthropic(` outside `lib/ai`, or calls
    `create({ stream: true })` directly.
- The DSPy service (`dspy-service/data.py`) applies the same redaction to training examples before optimisation.
- Development-only switch: `AI_PSEUDONYMISE=off` (ignored in production).
- Residual: pupils' learning and SEND information is still sent where features need it. Coded data is still personal
  data. Anthropic deletes API data within 30 days; zero data retention is to be requested.

## 2. Retention follows the school's schedule

- The "DfE 7-year obligation" wording was not based on any guidance and has been removed everywhere
  (GDPR tools, sign-up and consent pages, privacy policy).
- New `School` columns (**applied to production 29 Sep via migration `school_retention_schedule`**):
  - `retentionSendYears` (default 31), `retentionPupilRecordYears` (25) and `retentionSafeguardingYears` (25).
    These are the IRMS Academies Toolkit defaults, counted from the pupil's date of birth.
  - `leaverRecordHandling`: `EXPORT_THEN_DELETE` (default) or `RETAIN_IN_OMNIS`.
  - New `AuditAction` values: `LEAVER_FILE_EXPORTED`, `RETENTION_SCHEDULE_UPDATED`.
- `lib/retention.ts`: policy helpers and `buildLeaverFile()`. The leaver file is the pupil's statutory file: SEND plans,
  safeguarding, behaviour, and the AI decision-support log. Everything is scoped by `schoolId`.
- New export route `GET /api/export/leaver-file/[studentId]`. Admin/SLT only; every download is audit-logged.
- `executeErasure()` changes:
  - Under `EXPORT_THEN_DELETE`, it refuses until the leaver file has been downloaded, then deletes the statutory file
    too, children first (EHCP outcomes/evidence, ILP targets, APDR audit, legacy plans and so on).
  - Under `RETAIN_IN_OMNIS`, it keeps the file as before.
  - `AgentAuditEntry` now follows the SEND file (the product decision that was open in `evidence/retention-test.md`).
- There is a new "Retention" tab in `/admin/gdpr` (`components/gdpr/RetentionSettings.tsx`). Only SCHOOL_ADMIN can edit it.
- New weekly cron `GET /api/cron/retention-review` (Monday 06:30 UTC):
  - It tells a school's admins when former pupils' records are past the schedule.
  - It **never deletes**: that is the controller's decision.

## 3. Privacy policy and in-app notices

- `app/marketing/privacy` rewritten:
  - Roles: the school is the controller; Omnis is the processor, and a controller only for its own business data.
  - Correct supplier list: Vercel removed; DigitalOcean, Sentry, Upstash and Wonde added.
  - A plain AI section, the IRMS retention table, and accurate security wording (no unearned claims).
  - A 24-hour breach notice to schools, a one-month response time, and "registration details to follow".
- The renderer now handles a heading line followed by a list, and line breaks.
- "Omnis Education Ltd" was changed to "Omnis Education" throughout, because the company is not yet registered.
- The pupil privacy page explains in plain words that names are coded before AI sees them.

## 4. Dependencies and incident plan

- `puppeteer` (local-development PDF fallback only) moved to devDependencies and upgraded to 25.x. This removes the
  `extract-zip` high-severity chain from production.
- `npm audit fix` was applied to the lockfile. The lockfile is now in sync (`npm ci` works again).
- Remaining: `deepmerge-ts` via the Prisma CLI, which is build-time tooling only. The only offered fix downgrades
  Prisma, so it has been left.
- Incident runbook TODOs filled in:
  - Tell schools within 24 hours.
  - Contact the school's DPO and headteacher, plus the DSL if safeguarding is involved.
  - Customer contact: privacy@omnis.education. Check that this mailbox receives mail.

## Verification

- `tsc --noEmit` is clean, checked against a Prisma client generated from the new schema. `eslint` on changed files: 0 errors.
- Unit tests for `lib/ai` pass: 11 of 11.
- The DSPy redaction was checked against a local Postgres.
- Production database columns and enum values confirmed after the migration.
- Not run here: `next build` (Prisma engine downloads are blocked in this environment). Coolify's build is the check.

## After pulling

Run `npx prisma generate` (or `npm install`) locally so the Prisma client knows the new School fields.
