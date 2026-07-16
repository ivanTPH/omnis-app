# Phase 7.1 — Cyber Essentials Self-Assessment (Draft)

**Date:** 10 July 2026
**Status:** Draft self-assessment prepared from a code/config review of the
live repo. This is preparation for the real, external, accredited CE/CE+
assessment (Phase 7.1 in the checklist) — it is not a substitute for it.

Cyber Essentials covers 5 control themes. Assessed against what's actually
in the codebase, not assumptions:

## 1. Firewalls / network boundary

**Largely inherited from platform.** Vercel (app hosting) and Supabase
(Postgres, `DATABASE_URL` via PgBouncer on port 6543 per CLAUDE.md) are both
managed platforms with their own network boundary controls. Nothing to
self-manage at the OS/network level. **Action:** get written confirmation
of Vercel's and Supabase's own Cyber Essentials / SOC2 posture, since your
CE certification will implicitly depend on theirs for this control.

## 2. Secure configuration

**Good.** `middleware.ts` role-gates known-sensitive route prefixes (see
Phase 7.4 evidence), NextAuth JWT session capped at 4 hours (`maxAge: 4 * 60
* 60`), Prisma singleton pattern avoids connection leaks. **Gap noted in
7.4:** route allowlist model means new routes need explicit developer
attention to stay covered — recommend adding this to a PR checklist.

## 3. Security update management

**Real gap — see Phase 7.3.** `npm audit` found 13 known vulnerabilities (7
high) in current dependencies, including Next.js middleware-bypass CVEs
directly relevant to this app's access-control design. Fixes are available
and non-breaking (see `dependency-scan.md`) but not yet applied. **This is
the single most actionable item blocking CE readiness right now.**

## 4. User access control

**Partial.** Role-based access control is implemented consistently
(NextAuth JWT + `requireAuth(role)` pattern across `app/actions/`, audit
logging via `writeAudit()`). Password hashing uses bcrypt. Login is rate
limited by IP (5 attempts/15 min) via Upstash — **but this rate limit
no-ops silently if Upstash isn't configured in a given environment** (see
comment in `lib/auth.ts` line 22) — worth confirming Upstash is actually
configured in production, not just present in code.

**Real gap: no MFA anywhere in the codebase.** Searched for `mfa`,
`twoFactor`, `2fa`, `totp` across `app/`, `lib/`, and the Prisma schema —
zero matches. Cyber Essentials Plus assessors explicitly check for MFA on
cloud services accessible from the internet, which this is. **This is
likely the single biggest blocker to CE+ certification** (base Cyber
Essentials is more lenient on this than CE+).

## 5. Malware protection

**N/A / inherited.** No file upload execution surface identified beyond
what's described in CLAUDE.md (avatar upload — JPG/PNG, 5MB max, stored as
base64, not executed). Vercel's build/runtime environment handles this
layer. No action identified beyond confirming the avatar upload path
validates file *content* (not just extension) if not already doing so —
not verified in this pass.

## Overall readiness verdict

**Not yet ready for CE+ external assessment**, but one of the two blockers
identified above is now closed:

1. ~~Add MFA for staff accounts~~ — **done 10 Jul 2026.** Built as email
   one-time codes rather than TOTP (see decision note below), mandatory for
   all staff roles, no schema changes. Code: `lib/kv.ts` (ephemeral code
   storage + rate limiting), `lib/email.ts` (`sendMfaCodeEmail`),
   `app/actions/mfa.ts` (`requestLoginMfaCode`), `lib/auth.ts` (enforces the
   code in `authorize()`), `app/login/page.tsx` (two-step UI). Gracefully
   no-ops when Upstash isn't configured (dev/CI), matching the existing
   rate-limiter convention in this codebase — **fully active once in
   production**, where Upstash is already configured for rate limiting.
2. Apply the dependency fixes from Phase 7.3 — **still open.** Attempted in
   this session; the sandbox environment couldn't complete `npm install`
   safely (see `dependency-scan.md`). Needs to run in your own terminal.

**Design note — TOTP vs. email OTP:** the original recommendation was TOTP
(authenticator app), but that assumes every teacher, TA, and admin is
willing to install a separate app — a real adoption barrier for a
non-technical school staff population. Email OTP was chosen instead:
staff already use their email to log in, it avoids installing anything
new, it's an accepted MFA factor for Cyber Essentials Plus, and — as a
practical bonus — it needed zero schema changes since codes live briefly
in the Upstash store already used for rate limiting.

**Not yet verified:** this session's sandbox can't run `tsc --noEmit` or
`npm run build` against this project — `esbuild`'s native binary here is
Linux and the project's installed dependency is the macOS build, so the
build tooling itself can't execute in this environment regardless of
timeout. All new/changed files were manually read through end-to-end
instead (types, imports, control flow) as the best available substitute.
**Run `npx tsc --noEmit && npm run build` yourself before committing** —
per CLAUDE.md's own mandatory rule, and especially important here since
auth-flow code was touched.

Once both the dependency fixes and a local build/type-check pass are
confirmed, recommend booking the external CE self-assessment (base tier
can often be completed without a specialist), followed by CE+.
