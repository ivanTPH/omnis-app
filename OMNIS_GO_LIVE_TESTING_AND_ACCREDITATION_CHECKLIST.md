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
| 5 | MIS integration & synthetic data testing | 🟡 5.4 finding fixed (accessibility.ts), 5.2 decided (Arbor next) | YES | You + Claude |
| 6 | Load, resilience & failure testing | 🟡 Scripts/plan prepared, not yet run — 🔴 confirmed Free tier, upgrade deferred but required before go-live | YES | You + Claude |
| 7 | Security testing & certification | 🟡 MFA built (email OTP, staff-only) + ROLE_ROUTES comment done. Still open: apply npm audit fixes locally, verify build, external CE/pen-test | YES | You + Claude (assessment itself is external) |
| 8 | Data protection & Children's Code compliance | 🟡 Partial (Children's Code section added 10 Jul 2026 — 4 of 15 standards need product fixes: 4, 7, 11, 15, see 8.1) | YES | You + Claude |
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

**5.4 Multi-tenancy isolation audit — 🟡 first pass done 10 Jul 2026**
```
Static audit complete for the 5 lowest schoolId-ratio files in app/actions/
(see evidence/phase5-mis-synthetic-data/tenancy-isolation.md). Result: 4
false positives (correctly scoped by ownership/design, not literal
schoolId), 1 real but low-severity finding — getAccessibilitySettings()
in accessibility.ts has no internal auth check (not currently exploitable
via any UI path, but should be hardened to match the pattern already used
elsewhere in the codebase).

Still outstanding:
- [ ] Extend the same manual read-through to the remaining ~47 files in
      app/actions/, prioritising send-support.ts, safeguarding.ts, ehcp.ts,
      students.ts given data sensitivity
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

**6.2 Failure/chaos testing — 🟡 plan prepared 10 Jul 2026, not yet executed**
See `evidence/phase6-load-resilience/failure-test-plan.md` for the 4 scenarios
(Wonde downtime, AI timeout, DB connection loss, concurrent grade edits) and
exact simulation steps. Blocked on the same isolated-environment need as 6.1.

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

**8.1 Update the DPIA against the ICO Children's Code — ✅ done 10 Jul 2026**
```
Section 13 added to Omnis_DPIA_and_GDPR_Governance_Document.docx, assessing
Omnis against all 15 Children's Code standards. Result: 6 standards Met
outright, 4 Not Applicable (geolocation, connected toys), 5 Partial —
these are real product gaps, not paperwork, and are the actual remaining
work for this phase:

- [ ] Standard 4 (Transparency): age-appropriate "bite-sized" data notice
      surfaced at first login / first AI-generated homework — not yet built
- [ ] Standard 7 (Default settings): audit UserSettings,
      UserAccessibilitySettings and messaging defaults for "high privacy
      by default" — not yet audited
- [ ] Standard 11 (Parental controls): add a visible "shared with your
      parent/carer" indicator in student-facing UI — not yet built
- [ ] Standard 15 (Online tools): add a simple student-facing "how your
      data is used / who to ask" link routed to the school DPO — not yet built
- [x] Standard 3 (Age appropriate application): formally recorded —
      DPIA Section 13.1 now documents the age-assurance methodology
      (school-provisioned accounts, no self-service signup, age set via
      MIS year-group data) as the standing governance record. Closed
      10 Jul 2026.

Read CLAUDE.md and work through these four product items (Standards 4, 7,
11, 15) as normal feature tickets, then flip Phase 8 to ✅ in the Status
Tracker once all five checkboxes above are closed with evidence in
/evidence/childrens-code/.
```

**8.2 Confirm controller/processor position per contract**
- [ ] Existing DPIA states "school = Controller, Omnis = Processor" — confirm this is reflected in an actual signed Data Processing Agreement template ready for schools, not just asserted in the DPIA
- [ ] Confirm AI provider (Claude API) data handling terms explicitly exclude training on pupil data — document the confirmation

**8.3 Retention & deletion in practice, not just policy**
```
Read CLAUDE.md. The DPIA describes configurable retention and leaver
deletion workflows. Verify they actually run:
- Create a synthetic leaver in a test school, trigger the deletion
  workflow, confirm their data is actually gone (or correctly retained
  per safeguarding policy) across all tables, not just marked inactive.

✓ Check: leaver deletion test result recorded in /evidence/retention-test.md.
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
