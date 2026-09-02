# Inclusion Evidence Report — build log (2026-09-02)

Built per `docs/product/2026-09-02-ofsted-report-build-prompt.md`. A
filterable, exportable (PDF + CSV) report for SLT/SENCO/HOY/School Admin
pulling together SEND/ILP/EHCP data — the evidence a school already holds,
in one place, suitable to hand a governor or an inspector. Never claims
"Ofsted-compliant" anywhere — titled "Inclusion evidence summary" (cohort
mode) / "SEND provision evidence report — [name]" (case-study mode).

## Step 0 — Inventory (done before writing any new code)

- **`getSENDAnalytics`** — does not exist under that name anywhere in
  `app/actions/analytics.ts` or elsewhere. The closest existing thing is
  `getSltSendDashboard()` in `app/actions/slt-send.ts` (built for
  SEND-FRAMEWORK.md Step 7, live at `/slt/send`) — a real-time dashboard
  with SEND counts, ILP/EHCP stats, attainment gap, and early-warning
  flags, but with **no filtering at all** (fixed 90-day/6-month windows,
  no year-group/date/status/student filters) and no PDF/CSV export. Reused
  its field names and several query patterns (confirmed-correct, already
  proven in production) rather than re-deriving them, but wrote a new,
  separately-filterable action (`getInclusionEvidenceReport`) since the
  data shape this report needs (7 distinct sections, all filter-aware) is
  fundamentally different from a live dashboard's shape.
- **`/api/export/send-register`** — exists, PDF-only, uses
  `getSendRegisterData()` (`app/actions/send-support.ts`) +
  `lib/pdf/generator.ts` + `lib/pdf/send-register-template.ts`. Confirmed
  and reused this exact pattern (`pdfShell`/`escHtml`/`.card` CSS from
  `lib/pdf/templates.ts`, `generatePdf(html)` → `NextResponse` with
  `Content-Disposition: attachment`) for the new PDF export — same
  generation library (Puppeteer via `lib/pdf/generator.ts`), same header
  style (school name + doc title + generated-on date, from `pdfShell`,
  which already does exactly what "school logo/name header, generated-on
  date" asked for — no separate logo-image mechanism exists anywhere in
  this codebase's PDF reports, so none was invented here either).
- **CSV pattern** — `/api/export/send-caseload/route.ts` has the cleanest
  reference: `escapeCsv()`, `fmtDate()`, header/row arrays joined with
  `\r\n`, `Content-Type: text/csv; charset=utf-8`. Reused verbatim.
- **`/api/export/student-progress/[studentId]`** — read first as
  instructed. Confirms the exact same PDF pipeline (`generatePdf` +
  a `*Pdf(data, schoolName)` template function) is what's live today on
  the parent Progress page's "Progress Report" button — this is the
  pattern every PDF export route in this repo already follows; the new
  routes match it exactly rather than introducing a second approach.
- **DSAR PDF export** (`claude/dspy-optimization-and-xai-design.md`) —
  file doesn't exist in this repo; nothing to check.
- **Schema field names** — confirmed directly against `prisma/schema.prisma`
  rather than assumed, given the explicit warning about near-duplicate
  model names:
  - **Two distinct ILP model families exist.** Legacy: `ILP` / `ILPTarget`
    (uppercase `ILPStatus` enum: DRAFT/ACTIVE/UNDER_REVIEW/ARCHIVED).
    Current, live-used: `IndividualLearningPlan` / `IlpTarget` (plain
    lowercase string status: "active"/"under_review"/"archived"/
    "achieved"/"not_achieved"/"deferred"). Confirmed which one is actually
    in use by checking `getSltSendDashboard()` and `getSendRegisterData()`
    — both exclusively use `prisma.individualLearningPlan` /
    `prisma.ilpTarget`. This report does the same; the legacy `ILP`/
    `ILPTarget` models are never queried.
  - `SendStatus`: `activeStatus` (enum `SendStatusValue`), `needArea`,
    `studentId` (unique).
  - `IndividualLearningPlan`: `status` (string), `reviewDate`,
    `approvedBySenco`, `approvedAt`, `createdAt`, relations
    `targets: IlpTarget[]`, `parentResponses: IlpParentResponse[]`.
  - `EhcpPlan`: `status` (active/under_review/ceased — **not** "closed",
    which one existing CSV export route (`send-caseload`) filters against
    despite it never occurring in the actual enum-like convention; didn't
    copy that apparent inconsistency into this new code, used the
    documented values instead).
  - `EhcpAnnualReview`: `reviewDate`, `newReviewDate`, `progressRating`.
    `EhcpPlan.reviewDate` is treated as the authoritative "next review
    due" date — the same convention `getSltSendDashboard()` and every
    existing SEND export already use (`EhcpAnnualReview.newReviewDate` is
    what updates it when a review completes).
  - `AssessPlanDoReview.status` is **uppercase** ("ACTIVE"/"COMPLETED") —
    a different casing convention from ILP/EHCP's lowercase. Not used
    directly in this report (Section 2/3/4 don't touch APDR cycles), but
    worth flagging since it's exactly the kind of inconsistency that
    causes silent bugs if assumed rather than checked.
  - `IlpEvidenceEntry.evidenceType` is uppercase ("PROGRESS"/"CONCERN"/
    "NEUTRAL").
  - `EarlyWarningFlag`: `severity`, `flagType`, `isActioned`, `expiresAt`,
    `createdAt`, plain `studentId`/`schoolId` string fields (no declared
    Prisma relation to `User` for `studentId`).
  - `IlpParentResponse`: `reviewedAt`, `meetingRequested`, `homeProgress`,
    unique on `[ilpId, parentId]`.
  - `AuditAction.SEND_STATUS_CHANGED` is **declared in the schema but
    never actually written by any code path** (confirmed by grep) — this
    directly shaped how Section 1's "trend vs prior term" was implemented;
    see below.

## Step 1 — Filters

`InclusionReportFilters` (`app/actions/analytics.ts`): `yearGroups?:
number[]`, `sendStatus?: 'NONE' | 'SEN_SUPPORT' | 'EHCP' | 'ALL'`
(`'ALL'` = SEN Support + EHCP, i.e. "the SEND register" — matching every
other SEND report in this app; does **not** silently include NONE-status
students, `'NONE'` must be picked explicitly), `dateFrom?`/`dateTo?` (ISO
strings, default to the current academic term via the existing
`lib/termUtils.ts` `currentTermLabel()`/`termLabelToDates()` helpers — no
new date logic invented), `studentId?` (single-student case-study mode —
**overrides** the status/year-group filters entirely rather than
composing with them, since picking a named student is a deliberate choice
that shouldn't silently produce an empty report if that student doesn't
happen to match the currently-selected cohort filter).

## Step 2 — The 7 sections, and how each was actually computed

1. **SEND register summary** — headcount/%-of-roll by status: direct
   `SendStatus` count against the (year-group-filtered) roll size.
   **"Trend vs prior term" is honestly scoped, not fabricated**: there is
   no historical snapshot of SEND headcounts anywhere in this schema
   (`SendStatus` tracks current state only, and the one `AuditAction`
   that could have reconstructed history is declared but never written —
   confirmed by grep before relying on it, not assumed). Rather than
   invent a headcount-over-time comparison the data can't support, this
   compares *new SEND identifications* (`IndividualLearningPlan.createdAt`
   — a real, reliable timestamp) in the current period vs the immediately
   preceding period of equal length, and labels it explicitly as an
   identification-activity proxy, in the report copy itself, not just in
   this doc.
2. **Identification & responsiveness** — for each cohort student with an
   *approved* ILP, finds their earliest `SendConcern`/`EarlyWarningFlag`
   and measures the gap to approval; averages across matched cases. A
   case where an ILP was approved *before* any recorded concern is
   excluded rather than counted as an artificially fast response.
3. **ILP coverage & currency** — % with `approvedBySenco: true` among
   active/under_review ILPs in the cohort; overdue = `reviewDate < now`;
   oldest overdue flagged by name.
4. **EHCP compliance** — total, % within the statutory 12-month window
   (== not overdue against `EhcpPlan.reviewDate`, the established
   convention), full overdue list **flagged by name**, sorted most-overdue
   first — surfaced prominently in both the PDF (a red compliance-risk
   callout box) and the on-screen preview, not buried in a table.
5. **Evidence-backed progress** — 3-way attainment split (NONE vs
   SEN_SUPPORT vs EHCP, last 90 days), extending `getSltSendDashboard()`'s
   existing 2-way NONE-vs-SEND pattern to three buckets; `IlpEvidenceEntry`
   counts by type for the filtered period.
6. **Parent & pupil voice** — `IlpParentResponse` count + meeting-requested
   count for the cohort in the filtered period. (Pupil-voice input doesn't
   exist as a distinct feature yet — noted honestly in the code, not
   invented.)
7. **Single-student narrative case study** — only populated when
   `studentId` is set: need (from the ILP's `areasOfNeed`), strengths
   (`currentStrengths`), plan (strategies + targets with status/dates),
   evidence timeline (last 20 `IlpEvidenceEntry` rows), parent voice. Real
   empty states ("No evidence entries recorded yet" etc.) rather than
   fabricated content when a section has nothing to show.

## Step 3/4 — Output & access

PDF (`lib/pdf/inclusion-evidence-template.ts`, via the existing
`generatePdf()`/`pdfShell()` pipeline) is primary; CSV
(`app/api/export/inclusion-evidence-report/csv/route.ts`, following the
`send-caseload` CSV pattern exactly) is the secondary row-level download.
Both routes and the page (`app/senco/inclusion-report/page.tsx`,
`components/senco/InclusionReportView.tsx`) gate on
`['SLT', 'SCHOOL_ADMIN', 'SENCO', 'HEAD_OF_YEAR']` — the same role list
`auth.config.ts`'s existing `/senco` prefix rule already enforces at the
middleware layer, so the page's URL choice (`/senco/inclusion-report`)
gets that access control for free with zero changes to `auth.config.ts`.
Nav links added to all 4 roles' sidebars (`components/Sidebar.tsx`).

## Step 5 — Language check

Grepped the final UI copy and PDF template text: "Ofsted-compliant" does
not appear anywhere. Page title: "Inclusion evidence summary". Case-study
PDF title: "SEND provision evidence report — [Student Name]".

## Bugs found and fixed during live testing (not just assumed working)

1. **`gradeLabel()` fed a raw unrounded average, producing "3.32... (?)"
   in the rendered output.** `lib/grading.ts`'s shared `gradeLabel()`
   expects an integer grade (it does `GCSE_LETTERS[grade]`, a lookup by
   exact key) — it does not round internally. `SltSendDashboard.tsx` has
   its *own local* duplicate `gradeLabel()` that does
   `Math.round(score)` first; the shared one doesn't. This was caught by
   actually generating the report against real demo data with a large
   enough cohort (35 SEN_SUPPORT + 8 EHCP students) rather than only
   testing a small filtered slice where every average happened to be
   `null`. Fixed at the two call sites (PDF template + React component) by
   rounding before calling `gradeLabel()`, and rounded the stored
   `avgScore` to 1dp in the action for reasonable display precision —
   did **not** touch the shared `lib/grading.ts` helper itself, since
   that's used elsewhere in the app and changing its behaviour is outside
   this task's scope.
2. Minor copy fix: the trend sentence originally read "New identifications
   this period: 0. -1 vs prior period (1)" — confusing. Reworded to
   "0 fewer than the prior period (1)" / "N more than the prior period".

## Live testing performed

Ran directly against the real dev DB (not mocked), using real demo
accounts:

- **Access control**: logged in as `j.patel@omnisdemo.school` (TEACHER) —
  `/senco/inclusion-report` redirected to `/dashboard`; both export routes
  returned `403`. Logged in as `a.hughes@students.omnisdemo.school`
  (STUDENT) — redirected to `/student/dashboard`. Both confirmed via the
  same middleware role gate already covering `/senco/*`, not a new check
  that could have its own bug.
- **Cohort report, real data**: logged in as `r.morris@omnisdemo.school`
  (SENCO), filtered to Year 10 (a year group confirmed via direct DB query
  to have a real mix of SEN_SUPPORT and EHCP students). Generated report
  showed 6 real named students, real need areas (ASD/Autism, ADHD,
  Dyslexia), a real named overdue-ILP case (Mia Adams, 84 days overdue)
  and a real named overdue-EHCP case (Mia Adams, 71 days overdue) —
  confirmed no `undefined`/`NaN`/`null` anywhere in the rendered body text.
- **Larger cohort**: re-ran with all year groups (43 students) to confirm
  Section 5's attainment averages populate correctly with real numbers
  when the sample is large enough — this is what surfaced the
  `gradeLabel()` bug above, fixed, then re-confirmed clean.
- **Case-study mode**: clicked "Case study →" on Mia Adams from the
  register table — confirmed the UI correctly switches to the 7-section
  narrative view (need/strengths/plan/targets/evidence/parent-voice, all
  real ILP content, not placeholder text) after properly waiting out the
  loading transition (an earlier capture mid-transition briefly showed
  stale cohort data still on screen, which is expected React behaviour
  during the async reload, not a bug — confirmed by re-testing with a
  longer wait).
- **PDF export, cohort mode**: downloaded via a real authenticated
  request, confirmed valid PDF (`%PDF` magic bytes, 200 status,
  `application/pdf` content type), visually read all pages — renders
  cleanly, matches the on-screen preview numbers exactly, compliance-risk
  section in red, no placeholder content.
- **PDF export, case-study mode**: downloaded Mia Adams' individual
  report, confirmed the filename includes her name
  (`inclusion-evidence-report-mia-adams-2026-09-02.pdf`), visually read
  all 4 pages — full narrative case study renders correctly with real
  target/strategy/evidence content, honest empty states where genuinely
  no data exists yet (evidence timeline, parent voice).
- **CSV export**: downloaded for the same Year 10 filter, confirmed the 6
  rows exactly match the register table shown on screen (same students,
  same order, same statuses/need areas/ILP status/review dates) — the PDF
  and CSV draw from the identical `getInclusionEvidenceReport()` call, so
  this wasn't a coincidence, it's structural.

## Verification

- `npx tsc --noEmit` — exit 0.
- `npm run build` — exit 0. New routes registered: `/senco/inclusion-report`,
  `/api/export/inclusion-evidence-report`,
  `/api/export/inclusion-evidence-report/csv` — all dynamic (`ƒ`), matching
  every other authenticated route in this app.
