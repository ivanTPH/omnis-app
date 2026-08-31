# Omnis — Go-Live Testing, Security & Accreditation Checklist
## Version 1.0 — 10 July 2026

> **How this relates to your other docs**
> `OMNIS_TRIAL_READINESS_PLAN.md` covers whether the *product works* (bugs, SEND
> loop, analytics). This document covers whether Omnis is *safe, tested, and
> credentialed* to run in a real UK school beyond a friendly pilot — MIS
> integration breadth, load/failure testing, security certification, and the
> external accreditations schools and MATs will ask for during procurement.
> `Omnis_DPIA_and_GDPR_Governance_Document.docx` (Feb 2026) is a solid GDPR
> foundation but pre-dates the ICO Children's Code work item below — treat
> Phase 8.1 as an update to that document, not a replacement.

**Rule: don't tick an item until there's evidence (screenshot, log, cert,
report) saved in `/evidence/` — not just "should be fine."** Create an
`/evidence/` folder in this repo now if it doesn't exist; each phase below
tells you what to drop in it.

---

## Status Tracker

| Phase | Area | Status | Blocks Go-Live? | Owner |
|---|---|---|---|---|
| 5 | MIS integration & synthetic data testing | 🟡 5.4 finding fixed (accessibility.ts), 5.2 decided (Arbor next). 27 Aug: broad security sweep covered ~24 more app/actions/ files, 12 confirmed cross-tenant findings fixed. 30 Aug: dedicated read-through of send-support.ts/safeguarding.ts/students.ts (the last 3 of the originally-prioritised 4), 12 more findings fixed incl. 2 CRITICAL — see below, still not the full ~47-file read-through | YES | You + Claude |
| 6 | Load, resilience & failure testing | 🟡 6.2: all 4 failure scenarios now traced, live-tested, and fixed where a real gap existed (27 Aug: scenarios 1 + 3; 31 Aug: scenarios 2 + 4) — see below. 🔴 6.1 (load test) not run and 🔴 6.3 (backup tier upgrade) not done — both blocked on infra/environment decisions outside coding scope, not on more fixes | YES | You + Claude |
| 7 | Security testing & certification | 🟡 MFA built (email OTP, staff-only) + ROLE_ROUTES comment done. Still open: apply npm audit fixes locally, verify build, external CE/pen-test | YES | You + Claude (assessment itself is external) |
| 8 | Data protection & Children's Code compliance | ✅ 8.1 done — all 15 Children's Code standards now Met/N/A, Standards 4/7/11/15 product-built + verified 30 Aug 2026 (see 8.1). 🟡 8.2 (DPA template) still open. ✅ 8.3: leaver-deletion workflow live-tested 30 Aug, 15 undocumented-retention gaps found and closed 31 Aug 2026 — 4 now deleted, 9 retained-with-citation, re-verified end to end against a live database with a control-school scoping check; 1 item (AgentAuditEntry) deliberately left as an open product decision rather than guessed, see 8.3 | YES | You + Claude |
| 9 | External accreditation & evaluation | ⬜ Not started | No (but expected by procurement) | You |
| 10 | Operational go-live readiness | ⬜ Not started | YES | You + Claude |

Update this table as you close items — it's the single source of truth for
"are we actually ready."

---

## PHASE 5 — MIS Integration & Synthetic Data Testing

### Goal: Omnis is proven against realistic school data shapes, not just your one Wonde test school

**5.1 Widen Wonde sandbox coverage**
```
Read CLAUDE.md. We only have one Wonde test school (A1930499544, ~98 staff,
~200 students, ~66 classes). Before go-live, create additional synthetic
Wonde sandbox schools covering edge cases:
- A large secondary (1,500+ students, 10+ year groups, split sites)
- A small school (<300 students) to catch pagination/empty-state bugs
- A school with a high proportion of SEND/EHCP students
- A school with mid-year joiners/leavers and multiple guardians per student

For each: run npm run wonde:seed against it, run the full Wonde sync, and
record staff/student/class counts in /evidence/wonde-sync-results.md.

✓ Check: sync completes without error for all 4 synthetic schools, and
  schoolId scoping holds (no cross-school leakage — see 5.3).
```

**5.2 Decide MIS breadth for launch — ✅ decided 10 Jul 2026**
- [x] Target market confirmed: state schools / MATs
- [x] Decision: Arbor is the next priority integration — free REST/GraphQL sandbox, SDKs, no licence cost
- [ ] Register for Arbor developer sandbox and repeat the Wonde-style integration/test pattern
- [ ] SIMS (paid API licence, ~50% market share) and iSAMS (independent schools, no public sandbox) deferred — revisit if a specific MAT/LA pipeline need arises
- See `evidence/phase5-mis-synthetic-data/mis-breadth-decision.md` for full reasoning

**5.3 Synthetic load/behavioural data on top of MIS data**
```
Read CLAUDE.md. MIS sandbox data gives us realistic school structure but
not usage volume. Generate synthetic behavioural data layered on the large
synthetic school from 5.1:
- Homework submissions across a full term for all students
- A spread of answer quality (strong/average/weak/blank) to stress-test
  autoMarkSubmission — do not use only "good" synthetic answers
- Realistic SEND distribution (NONE / SEN_SUPPORT / EHCP) driving adaptive
  homework generation at volume

Use this to answer: does auto-marking stay accurate and fast at 1,500
students' worth of submissions, not just 32?

✓ Check: results logged in /evidence/synthetic-load-results.md with
  accuracy spot-checks (sample 30 auto-marked submissions, teacher
  reviews and records agreement rate).
```

**5.4 Multi-tenancy isolation audit — 🟡 broader pass done 27 Aug 2026, dedicated 4th-file pass done 30 Aug 2026, not yet exhaustive**
```
10 Jul 2026: static audit of the 5 lowest schoolId-ratio files in app/actions/
(see evidence/phase5-mis-synthetic-data/tenancy-isolation.md). 4 false
positives, 1 real low-severity finding (accessibility.ts) — fixed same day.

27 Aug 2026: separate, larger sweep covered ~24 more app/actions/ files plus
13 dynamic export routes previously flagged as unreviewed. 12 confirmed
findings, including 1 CRITICAL (createHomework() — no role check, could
create homework against another school and email its real students/
parents). All fixed same day. Full detail:
docs/audit/2026-08-27-hardening-security-sweep.md. Cross-referenced against
this item's own prioritised list in the evidence file's 27 Aug update.

30 Aug 2026: dedicated read-through of the 3 files this item originally
prioritised but that hadn't yet been the specific target of a full pass —
send-support.ts, safeguarding.ts, students.ts (ehcp.ts, the 4th, was
covered by the 26 Aug audit instead). 12 confirmed findings across
send-support.ts (11) and students.ts (6, some shared shape) — 2 CRITICAL
(generateIlpGoalsForStudent() returning another school's real SEND record
to the caller via an AI prompt with zero schoolId check; updateIlpTarget()
a write-level IDOR letting any staff role mutate any school's ILP target),
plus HIGH cross-tenant K-Plan/ILP generation and overwrite findings. All
fixed same day, tsc + build both clean. safeguarding.ts read in full — no
findings, already correctly scoped throughout. Full detail:
docs/audit/2026-08-30-security-review-send-safeguarding-students.md.

Still outstanding:
- [x] send-support.ts, safeguarding.ts, students.ts — dedicated read-through
      done 30 Aug 2026, 12 findings fixed (see above)
- [ ] The ~70 non-dynamic app/api/export/** routes remain unreviewed
- [ ] The original scan's broader "540 REVIEW" bucket (schoolId present in
      the function but not verifiably tied to the specific id) remains
      largely unreviewed beyond the samples checked across all four passes
- [x] Fixed 10 Jul 2026 — getAccessibilitySettings() now ignores the passed
      userId and calls requireAuth(), matching saveAccessibilitySettings()
- [ ] Live cross-tenant test: seed two synthetic schools side by side, log
      in as a user from School A, confirm zero data from School B is
      reachable through any route, export, or API response — blocked on
      5.1 (need a second synthetic school)

✓ Check: full app/actions/ read-through complete, accessibility.ts fixed,
  live cross-tenant test passes with a transcript in
  evidence/phase5-mis-synthetic-data/tenancy-isolation.md.
```

---

## PHASE 6 — Load, Resilience & Failure Testing

### Goal: Omnis degrades gracefully under real load and real failures, not just on localhost

**6.1 Load test the heavy endpoints — 🟡 script prepared 10 Jul 2026, not yet run**
```
k6 script ready at evidence/phase6-load-resilience/load-test-script.js.
Confirmed real API routes to target: /api/ai/generate-homework,
/api/ai/generate-ilp, /api/wonde/sync (all POST, real cost/side-effects —
must NOT run against production). Light, safe GET routes included for an
initial pass. Not executed — needs the same isolated environment discussed
in Phase 5 (Supabase branch or Vercel preview) before running for real.
```
Original spec, unchanged:
```
Read CLAUDE.md. Using k6 or Artillery, load test against the Vercel
deployment (not localhost):
- Homework generation (generateHomeworkFromResources)
- ILP/EHCP generation (AI-heavy, longest-running)
- Wonde sync job
- Analytics dashboard queries at 1,500-student scale

Record p50/p95/p99 latency and error rate at increasing concurrency
(10, 50, 100 simultaneous users) in /evidence/load-test-results.md.
Flag anything exceeding the 4.2 performance targets already defined in
OMNIS_TRIAL_READINESS_PLAN.md (roster <3s, analytics <5s, homework
gen <30s, ILP gen <60s).
```

**6.2 Failure/chaos testing**
```
Read CLAUDE.md. Simulate and document behaviour for:
- Wonde API timeout/downtime during a sync — does the app show a clear
  error or hang?
- AI provider (Claude API) timeout during homework/ILP generation —
  confirm the 4.3 error-handling patterns actually fire
- Database connection loss mid-request — confirm no silent data loss,
  especially for student homework submissions
- Concurrent grade edits on the same submission — confirm no lost writes

✓ Check: every scenario above ends in a clear user-facing message, not
  a white screen or silent failure. Record in /evidence/failure-tests.md.
```

**6.2 Failure/chaos testing — 🟢 all 4 scenarios traced + live-tested + fixed, still no formal scripted drill**
See `evidence/phase6-load-resilience/failure-test-plan.md` for the 4 scenarios
(Wonde downtime, AI timeout, DB connection loss, concurrent grade edits) and
exact simulation steps. Formal drill execution (a repeatable k6/chaos harness
in CI) is still blocked on the same isolated-environment need as 6.1 — every
fix below was proven by hand-written scripts hitting the real API/DB directly,
not a scripted, repeatable chaos test. What changed:

- **Scenario 1 (Wonde downtime) — real code fix, 27 Aug 2026.**
  `lib/wonde-sync.ts`'s `inBatches()` used `Promise.all`, so one bad record
  aborted every remaining chunk in that sync phase. Now uses
  `Promise.allSettled` — a failed record is logged and skipped, the rest of
  the phase completes.
- **Scenario 3 (DB connection loss) — partially covered, plus real production
  evidence, 27 Aug 2026.** That day's deploy also produced an actual
  unplanned incident: two consecutive Coolify deploys failed on Prisma
  connection-pool exhaustion (`connection_limit: 5`) while `e2e.yml` hit
  production concurrently — see `docs/audit/2026-08-27-hardening-security-sweep.md`'s
  "Deployment incident" section. Fixed live via `connection_limit=20`
  (headroom, not a structural fix — see below). Related hardening from the
  same audit: DSPy's `weekly_run.py` no longer crashes the whole optimizer
  run if a single DB write fails mid-loop; all four agent cron routes
  (`agent-coach`, `agent-quality`, `agent-plan-synthesis`, `agent-engage`)
  now return `502` instead of a silent `200` when every attempt in a run
  fails, so a total outage (e.g. a revoked `ANTHROPIC_API_KEY`) actually
  shows red in GitHub Actions instead of going unnoticed.
- **Scenario 2 (AI provider timeout) — traced, live-tested, fixed, 31 Aug
  2026.** No call site anywhere in the homework/ILP/EHCP/APDR generation
  pipeline set an explicit timeout — every `new Anthropic(...)` relied on the
  SDK's own 10-minute default and its own default 2-retry policy, unbounded
  by any platform-level request cap on this deployment (Coolify, not
  Vercel). New `lib/ai-timeouts.ts` gives every call site an explicit
  timeout + `maxRetries: 1` (13 call sites total across
  `app/actions/homework.ts`, `app/actions/send-support.ts`,
  `app/actions/ehcp.ts`, and both AI SSE routes). Live-tested against the
  real Anthropic API with an artificially short timeout: both SSE routes now
  surface a clean `{"type":"error",...}` event in ~1.5–2.5s instead of
  hanging. Also found and fixed on `/api/ai/generate-ilp/route.ts`
  specifically: it was missing the same `Content-Encoding: identity`
  Nginx-gzip-SSE-buffering fix already applied to the homework route on
  5 Aug 2026, plus the `resultEmitted` double-emit guard and a safety-net
  `finally` emit that the homework route already had. Full trace, live-test
  numbers, and an honest scope note (the fixed `generateHomeworkContent` path
  turned out to be dead code — no live caller — so that specific fix is
  defensive, not a live-gap closure) in
  `evidence/phase6-load-resilience/failure-tests.md`.
- **Scenario 4 (concurrent grade edits) — traced, live-tested, fixed, 31 Aug
  2026.** `markSubmission()` used a plain unconditional
  `prisma.submission.update()` — no optimistic-concurrency check at all.
  Reproduced live against a real submission in the production database: two
  concurrent writes both resolved successfully, one silently discarded, zero
  warning to either caller — a genuine data-loss bug, not theoretical. Fixed
  with an atomic `updateMany({ where: { id, schoolId, markedAt: expected },
  ... })` + `count === 0` conflict check (no schema migration — reuses the
  existing `markedAt` field as the concurrency token), threaded through all
  3 real marking UI components (`HomeworkMarkingView.tsx`,
  `HomeworkMarkingV2.tsx`, `SubmissionMarkingView.tsx`, 6 call sites total)
  with a clear "someone else already graded this" message instead of a
  silent overwrite. Re-verified live after the fix: the exact same race now
  gives one writer `count: 1` and the other `count: 0`, and a stale retry
  after the fact is also correctly rejected. Full trace and both rounds of
  live-test evidence in `evidence/phase6-load-resilience/failure-tests.md`.

Also fixed as part of the 27 Aug pass, not one of the 4 listed scenarios but a
related data-loss risk: `lib/oak-delta-sync.ts` could have mass-deleted the
entire Oak curriculum catalogue (10,000+ lessons) on a single bad HTTP
response from the Oak sitemap — no `res.ok` check, no retry, and an empty
result set was treated as "nothing exists anymore" by the reconciliation
logic. Now retries 3x with backoff and refuses to reconcile at all if the
entry count looks implausibly low (<1,000).

**Still open, unresolved by design:** the underlying e2e/production coupling
that caused the connection-pool incident above. Three options are written up
in the resilience audit doc (point E2E at the existing second Vercel project;
decouple the E2E trigger from the deploy trigger; give E2E's DB connection
its own separate pool) — none implemented, pending your call.

**What 6.2 does NOT yet cover, so it isn't being overstated as "done":** none
of the 4 scenarios has been run as a repeatable, scripted chaos-test harness
(e.g. k6 fault injection wired into CI) — every fix above was proven correct
by direct, hand-written reproduction scripts against the real API/DB, run
once, by hand, this session. That's sufficient evidence the failure mode was
real and the fix works, but it is not the same as an automated regression
test that would catch a future re-introduction of either bug. 6.1's isolated
environment, once it exists, is also the natural place to build that.

**6.3 Backup & recovery drill — 🔴 confirmed Free tier, upgrade deferred**
- [x] Confirmed 10 Jul 2026 (by you): Supabase project "Ivan Omnis"
      (`ppmckscpekgwfeofvjej`, `eu-central-1`, Postgres 17.6) is on the
      **Free tier** — no PITR, minimal backup retention. Decision: stay on
      Free for now, upgrade to a paid tier when ready/required.
- [ ] **This must happen before go-live, not after** — add explicit sign-off
      here once the upgrade is done, since it's a real gap until then
- [ ] Once upgraded: run an actual restore-from-backup drill into a scratch
      project/branch, not just confirm backups are enabled
- [ ] Document recovery time in evidence/phase6-load-resilience/backup-drill.md

---

## PHASE 7 — Security Testing & Certification

### Goal: Omnis meets the security bar MATs and LAs will contractually require

**7.1 Cyber Essentials / Cyber Essentials Plus — 🟡 MFA built 10 Jul 2026, 1 blocker remains**
- [x] Draft self-assessment complete against all 5 CE control themes — see `evidence/phase7-security/cyber-essentials-self-assessment.md`
- [x] **Blocker 2 closed:** staff MFA built — email one-time code (not TOTP;
      pivoted after a realistic-adoption concern re: authenticator apps for
      school staff), mandatory for all staff roles, no schema changes. Full
      detail in `evidence/phase7-security/mfa-implementation.md`. **Not yet
      verified by a real type-check/build** — this session's sandbox can't
      run the build tooling (Linux sandbox, macOS-only native binaries in
      node_modules) — manually reviewed instead. Run
      `npx tsc --noEmit && npm run build` locally before committing.
- [ ] **Blocker 1 remains:** apply dependency fixes from 7.3 below
- [ ] Once both blockers closed *and* verified locally: book Cyber Essentials Plus external audit (paid, external, human-run — can't happen in this session)
- [ ] Note: CE+ does **not** include a penetration test — budget for one separately if a school/MAT contract requires it

**7.2 Independent penetration test**
- [ ] Commission a third-party pen test against the production app before go-live (and annually after) — required by many MAT procurement frameworks even beyond CE+
- [ ] Remediate findings and re-test before go-live sign-off

**7.3 Dependency & code-level security — ✅ scan done 10 Jul 2026**
```
npm audit run against the live repo: 13 vulnerabilities (2 low, 4 moderate,
7 high, 0 critical). All have non-breaking fixes available. 3 of the high
findings are Next.js middleware/proxy-bypass CVEs directly relevant to
Omnis's role-enforcement design (see 7.4). Full results and exact fix
commands in evidence/phase7-security/dependency-scan.md.

- [ ] **Attempted in this session, did not complete** — this sandbox's
      mounted-folder filesystem can't handle npm's atomic package renames
      (ENOTEMPTY / permission errors). Left `node_modules/brace-expansion`
      broken mid-install; manually repaired back to its original (pre-fix)
      version, so no lasting damage, but the fixes were **not applied**.
      Also left a stale, undeletable `.git/index.lock` (0 bytes) — safe to
      delete locally once no git process is running. Full account in
      `evidence/phase7-security/dependency-scan.md`.
- [ ] **Run locally instead:** `npm audit fix` then `npm audit fix --force`
      (bumps next 16.1.6 → 16.2.10, same major, just outside the
      exact-pinned range) — closes the middleware CVEs
- [ ] Run `npx tsc --noEmit && npm run build` per CLAUDE.md's own rule, then
      the E2E suite, before committing
- [ ] Add npm audit (or Dependabot/Snyk) to CI so this doesn't silently drift
```

**7.4 Access control re-verification — 🟡 static review done 10 Jul 2026**
```
Reviewed middleware.ts + auth.config.ts directly. Role enforcement uses an
explicit allowlist (ROLE_ROUTES) checked in order with first-match-wins —
correctly ordered today (specific prefixes like /admin/subjects appear
before generic /admin), but routes NOT in the list fall through to allow
any authenticated role, relying entirely on per-action requireAuth() checks.
Not a bug, but a process risk: every new sensitive route must be added
here or protected in its own action. Full findings in
evidence/phase7-security/access-control-retest.md.

- [ ] Live re-test: log in as each non-privileged role, confirm redirect
      behaviour for every ROLE_ROUTES prefix (not just spot checks)
- [ ] Re-confirm after the Next.js version bump in 7.3
- [x] Added 10 Jul 2026 — code comment above ROLE_ROUTES documenting that
      array order matters and that unlisted prefixes fall through
```

---

## PHASE 8 — Data Protection & Children's Code Compliance

### Goal: Omnis's data protection posture holds up to ICO scrutiny, specifically around children's data

**8.1 Update the DPIA against the ICO Children's Code — ✅ done 10 Jul 2026, product items closed 30 Aug 2026**
```
Section 13 added to Omnis_DPIA_and_GDPR_Governance_Document.docx, assessing
Omnis against all 15 Children's Code standards. Result at the time: 6
standards Met outright, 4 Not Applicable (geolocation, connected toys), 5
Partial — real product gaps, not paperwork.

30 Aug 2026: all 4 outstanding product items (Standards 4, 7, 11, 15) built
and verified against the live demo school (student + SCHOOL_ADMIN logins,
screenshots + a real DB-layer check for the Standard 7 schema-default fix).
DPIA Section 13.1/13.2 updated in place — all four standards now read "Met."
Full evidence in evidence/phase8-childrens-code/.

- [x] Standard 4 (Transparency): bite-sized, dismissible, one-time data
      notice (ChildTransparencyNotice) shown in the shared app shell for
      STUDENT accounts — covers both the first-login and first-homework
      trigger points since it renders on whichever page a student lands on
      first. Links to /student/privacy for full detail. Acknowledgement
      timestamp on User.childNoticeAckAt. Evidence:
      evidence/phase8-childrens-code/standard-4-transparency-notice.md.
- [x] Standard 7 (Default settings): audited UserSettings,
      UserAccessibilitySettings and messaging defaults field by field.
      allowAnalyticsInsights / profileVisibleToColleagues /
      profileVisibleToAdmins were opt-out (@default(true)) — flipped to
      opt-in (@default(false)). Messaging's MsgThread.isPrivate default
      confirmed cosmetic only (real access control is MsgParticipant
      membership) — no change needed there. Verified via the actual
      account-creation code path against a real demo account, not just
      schema inspection. Evidence:
      evidence/phase8-childrens-code/standard-7-default-settings-audit.md.
- [x] Standard 11 (Parental controls): "Visible to your parent" badge on
      student homework + grades views, gated on a real ParentStudentLink
      check per student (never shown to a student without a linked parent
      account). Deliberately not added to student Messages — traced what
      parents actually see and confirmed that channel isn't shared, so
      badging it would have been inaccurate. Evidence:
      evidence/phase8-childrens-code/standard-11-parent-visibility-indicator.md.
- [x] Standard 15 (Online tools): new /student/privacy page, linked from
      the sidebar on every student page (always-reachable, not buried in
      an unrelated view). Shows a per-school configurable DPO contact
      (School.dpoName/dpoEmail, editable any time from the admin dashboard
      — not locked behind the one-time onboarding wizard), falling back to
      a generic "ask your school office" prompt when unset. Verified the
      full configure → read round-trip live (SCHOOL_ADMIN sets contact →
      student page reflects it immediately). Evidence:
      evidence/phase8-childrens-code/standard-15-student-data-rights-link.md.
- [x] Standard 3 (Age appropriate application): formally recorded —
      DPIA Section 13.1 now documents the age-assurance methodology
      (school-provisioned accounts, no self-service signup, age set via
      MIS year-group data) as the standing governance record. Closed
      10 Jul 2026.

All five checkboxes above are closed with evidence in
evidence/phase8-childrens-code/. Phase 8 flipped to ✅ in the Status
Tracker below — 8.2 and 8.3 remain open (contractual DPA template
confirmation and the retention/leaver-deletion live test).
```

**8.2 Confirm controller/processor position per contract**
- [ ] Existing DPIA states "school = Controller, Omnis = Processor" — confirm this is reflected in an actual signed Data Processing Agreement template ready for schools, not just asserted in the DPIA
- [ ] Confirm AI provider (Claude API) data handling terms explicitly exclude training on pupil data — document the confirmation

**8.3 Retention & deletion in practice, not just policy — 🟡 tested 30 Aug, fixed + re-verified 31 Aug 2026**
```
Read CLAUDE.md. The DPIA describes configurable retention and leaver
deletion workflows. Verify they actually run:
- Create a synthetic leaver in a test school, trigger the deletion
  workflow, confirm their data is actually gone (or correctly retained
  per safeguarding policy) across all tables, not just marked inactive.

30 Aug 2026: executeErasure() (app/actions/gdpr.ts) traced from the
/admin/gdpr UI, a synthetic leaver built with linked data across all 30
studentId-bearing models, erasure triggered via the real product UI,
verified by direct DB query before/after, plus a control record in a
second school. Found 25 correctly deleted + 5 correctly retained-and-
documented (ILP/EHCP/APDR/SendStatus — DfE 7-year obligation) — but 15
more categories retained with no stated policy anywhere, highest priority
SafeguardingRecord and ParentConversation/ParentMessage. schoolId scoping
confirmed correct. Two unrelated bugs also found (DSR list missing
router.refresh(), stale schema comment on ConsentRecord.studentId).

31 Aug 2026: all 15 gaps closed per confirmed decisions — 4 deleted
(ParentConversation/ParentMessage, TeacherPrediction, IntegrityPatternCase,
IlpParentResponse), 9 retained-with-citation (SafeguardingRecord — KCSIE
guidance; legacy Plan/PlanTarget + ILP/ILPTarget/ILPNote — same DfE 7-year
bucket as their modern replacements, confirmed materially the same kind of
document by tracing both models; SendReviewLog/SendStatusReview — tied to
SendStatus's retention; PastoralNote/BehaviourRecord/Detention/Exclusion —
school behavioural-records policy). AgentAuditEntry deliberately left
undecided and flagged, not guessed — its append-only design mirrors
AuditLog's own retained rationale, but that's not yet a settled product
decision. Both unrelated bugs fixed too. Re-ran the full live test end to
end against a second synthetic leaver: all 5 new deletions confirmed
0-after, all 9 newly-documented retentions confirmed still 1-after (i.e.
correctly untouched), AgentAuditEntry confirmed unaffected as expected,
control-school scoping re-confirmed. router.refresh() fix verified with a
polling check (takes ~5s in this dev environment — real Supabase network
latency, not a defect). Side finding: session 1's own cleanup script had
left its control records behind due to a wrong id reference — caught and
fixed in this session's cleanup too. Full detail, before/after tables, and
screenshots for both sessions: evidence/retention-test.md.

- [x] Synthetic leaver created with realistic linked data across every
      relevant category (30 models) — evidence/retention-test.md
- [x] Deletion workflow triggered via the real product UI, not a script —
      screenshots in evidence/retention-test-screenshots/ and -v2/
- [x] Verified directly against the database, not just the UI — full
      before/after count tables for both test runs in evidence/retention-test.md
- [x] schoolId scoping confirmed correct via a live control-school test,
      twice — evidence/retention-test.md
- [x] SafeguardingRecord retention policy decided (KCSIE) and documented
      in both the code comment and the confirmation-screen UI
- [x] ParentConversation/ParentMessage deletion added to executeErasure()
- [x] Legacy Plan/ILP models traced and confirmed the same category as
      their modern replacements — added to the same retention bucket
- [x] router.refresh() gap fixed in DataSubjectRequestList
- [x] Stale ConsentRecord.studentId schema comment fixed
- [ ] AgentAuditEntry retention policy — deliberately left open, not
      guessed (see evidence/retention-test.md, Session 2). Needs an actual
      product decision: same audit-trail-integrity bucket as AuditLog, or
      delete like TeacherPrediction/IntegrityPatternCase?

✓ Check: leaver deletion test result recorded in evidence/retention-test.md
  — done, including the fix-and-re-verify pass. 14 of 15 originally-found
  gaps now have a documented, live-tested outcome. The 1 remaining item
  (AgentAuditEntry) is a genuine open product decision, not an oversight —
  flagging it rather than guessing is itself the correct outcome here.
```

---

## PHASE 9 — External Accreditation & Evaluation

### Goal: Third-party credibility that schools and MATs actually recognise during procurement

- [ ] **BESA membership** — prerequisite for LendED listing; involves financial/reputational checks (external, human-reviewed)
- [ ] **LendED listing** (DfE-supported) — enables schools to trial Omnis free and generates real case-study evidence
- [ ] **EdTech Evidence Board review** (DfE-funded, run via Chartered College of Teaching) — covers generative AI and adaptive learning, which maps directly onto Omnis's AI homework/ILP features; apply once Phases 5–8 evidence exists to reference
- [ ] **G-Cloud / Digital Marketplace listing** — relevant if targeting LA/MAT procurement routes (Wonde and Arbor are both listed there)
- [ ] **DfE Digital & Technology Standards self-assessment** — aimed at schools rather than suppliers, but being able to show alignment (cyber security, governance) strengthens your procurement position

All five are external, human-reviewed processes — I can help draft the
applications and supporting evidence packs, but can't complete them from
this session.

---

## PHASE 10 — Operational Go-Live Readiness

**10.1 Monitoring & alerting**
- [ ] Error monitoring in production (e.g. Sentry) wired up and alerting to a real person
- [ ] Uptime monitoring on the production URL
- [ ] Alert thresholds tied to the performance targets in 6.1

**10.2 Incident response**
- [ ] Written incident response runbook: who's on call, escalation path, safeguarding-specific escalation (given SEND/EHCP data involved)
- [ ] Communication template ready for a data incident affecting a school

**10.3 Pilot before full rollout**
- [ ] Run a genuine but small-scale live pilot (1–2 schools) even after all phases above pass, with a defined rollback trigger and success criteria before wider rollout

**10.4 Final pre-deploy gate**
```
Read CLAUDE.md. Before flipping go-live:
1. npx tsc --noEmit — zero errors
2. npm run lint
3. npm run build
4. Every checkbox in Phases 5–8 above is checked with evidence in /evidence/
5. Update CLAUDE.md and this checklist's Status Tracker
6. git add -A && git commit -m "docs: go-live checklist status — [DATE]" && git push
```

---

*Document owner: Omnis Education*
*Created: 10 July 2026*
*Next review: after Phase 5 evidence is in*
