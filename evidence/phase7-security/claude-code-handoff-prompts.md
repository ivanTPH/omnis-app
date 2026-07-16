# Claude Code Handoff — Prompts to Run Locally

**Date:** 10 July 2026
**Why this file exists:** everything below needs a real terminal (git write
access, a working build toolchain, a real inbox to test emails against) —
none of it could run in the sandboxed Cowork session that produced the
MFA implementation and dependency scan. Paste these into Claude Code, in
order, one at a time. Each one updates the checklist/evidence itself, so
you don't need to track progress separately.

---

### 1. Clear the stale git lock

**What:** Removes a leftover `.git/index.lock` from an interrupted sandbox
process (confirmed stale — not from any real git process) and shows you
the current working tree state before anything gets staged.

**Prompt:**
```
There's a stale .git/index.lock file from an interrupted process in a
previous Cowork session (not from any real git process). Run:
  rm .git/index.lock
  git status
Report the full output of git status. Do not run git add or git commit
yet — just confirm the lock is cleared and show me what's changed.
```

**Check:** `git add`/`git commit` work again without the "Unable to create
index.lock" error.

---

### 2. Apply the dependency fixes + verify

**What:** Applies the `npm audit` fixes a sandboxed session found but
couldn't apply (filesystem permission issues on package renames), then
runs the real pre-push verification that session couldn't run either.

**Prompt:**
```
Read CLAUDE.md. Apply the dependency fixes identified in
evidence/phase7-security/dependency-scan.md:
  npm audit fix
  npm audit fix --force
This bumps next 16.1.6 → 16.2.10 (same major version, just outside the
exact-pinned range in package.json) and resolves 13 known vulnerabilities,
including 3 Next.js middleware-bypass CVEs relevant to our role-enforcement
design (see evidence/phase7-security/access-control-retest.md). After
applying, run the mandatory pre-push check:
  npx tsc --noEmit && npm run build
Report any errors. If clean, run npm run test:e2e and report the pass/fail
count. Update evidence/phase7-security/dependency-scan.md with the result
and tick item 7.3 in OMNIS_GO_LIVE_TESTING_AND_ACCREDITATION_CHECKLIST.md.
```

**Check:** `npx tsc --noEmit` and `npm run build` both exit 0; `npm audit`
shows 0 high/critical vulnerabilities remaining.

---

### 3. Verify the MFA implementation actually compiles and works end-to-end

**What:** A sandboxed session built staff email-OTP MFA (`lib/kv.ts`,
`lib/email.ts`, `app/actions/mfa.ts`, `lib/auth.ts`, `app/login/page.tsx`)
but could only manually read the code — never compiled or ran it, since
this sandbox's Linux environment can't execute the project's macOS-only
native build binaries. This is the first real test.

**Prompt:**
```
Read CLAUDE.md and evidence/phase7-security/mfa-implementation.md. A prior
sandboxed session added staff email-OTP MFA and could only manually review
the code — it was never compiled or run. First:

  npx tsc --noEmit && npm run build

Fix any type errors found. Then manually test the login flow for a staff
demo account (e.g. j.patel@omnisdemo.school) with UPSTASH_REDIS_REST_URL/
UPSTASH_REDIS_REST_TOKEN and RESEND_API_KEY set in .env.local. Confirm:
password step → code emailed → code-entry screen appears → correct code
signs in → wrong code shows "Invalid or expired code" → Resend button
works → rate limit kicks in after 3 code requests in 10 minutes. Also
confirm a STUDENT or PARENT demo account skips straight to sign-in with
no MFA step at all, and that if UPSTASH env vars are unset, staff login
also skips MFA gracefully (no lockout).

Report pass/fail for each check. Update
evidence/phase7-security/mfa-implementation.md with the result.
```

**Check:** all listed behaviours pass; no staff account can be locked out
by a build/env misconfiguration.

---

### 4. Fix the known limitation: STAFF_ROLES duplicated three times

**What:** The same role list is currently copy-pasted in
`app/actions/mfa.ts`, `lib/auth.ts` (as `MFA_STAFF_ROLES`), and
`auth.config.ts` (used by the DPA and terms gates). One source of truth
removes the risk of the three drifting apart.

**Prompt:**
```
Read CLAUDE.md. STAFF_ROLES is currently duplicated identically in three
places: app/actions/mfa.ts, lib/auth.ts (as MFA_STAFF_ROLES), and
auth.config.ts (used for the DPA and terms gates). Create lib/roles.ts
exporting a single STAFF_ROLES constant and import it in all three
locations, deleting the three local copies. This file must be Edge-runtime
safe — auth.config.ts can't import Prisma or bcrypt — so lib/roles.ts
should export only the plain array, nothing else. Verify with
npx tsc --noEmit && npm run build.
```

**Check:** `grep -rn "STAFF_ROLES = \[" app/ lib/ auth.config.ts` returns
exactly one definition.

---

### 5. Accessibility pass on the new MFA code-entry screen

**What:** The two-step login screen was built without a dedicated
accessibility review — worth doing given Omnis already has an
accessibility settings system elsewhere in the app.

**Prompt:**
```
Read CLAUDE.md. The MFA code-entry screen in app/login/page.tsx (added
this session) hasn't had an accessibility pass. Check and fix: the code
input has a properly associated <label> (it does), autoComplete=
"one-time-code" is present (it is), there's an aria-live announcement when
the code-sent screen appears so a screen reader user hears "code sent to
your email" without needing to tab around, the "Resend code" and "Back"
buttons are clearly reachable and labelled via keyboard/screen reader, and
error messages are announced (add aria-live="polite" to the error div if
missing). Match whatever aria-live pattern is already used elsewhere in
the app if one exists (check lib/accessibility.ts and any
AccessibilityToolbar component).
```

**Check:** tab through the whole two-step flow with a screen reader (or
axe-core / Lighthouse accessibility audit) and confirm no new violations
versus the rest of the app.

---

## After all 5 are done

Update the Status Tracker in `OMNIS_GO_LIVE_TESTING_AND_ACCREDITATION_CHECKLIST.md`
— Phase 7 should move from 🟡 to close to ✅ once dependency fixes are
verified and MFA is confirmed working end-to-end. The remaining Phase 7
item after that is genuinely external: booking the Cyber Essentials Plus
audit and a third-party penetration test.
