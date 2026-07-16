# Phase 7.1 — Staff MFA Implementation

**Date:** 10 July 2026
**Approach:** Email one-time code (not TOTP) — see reasoning in
`cyber-essentials-self-assessment.md`. Mandatory for all `STAFF_ROLES`
(everyone except STUDENT/PARENT). No enrollment step, no opt-out, no
schema changes.

## How it works

1. Login page (`app/login/page.tsx`) submits email+password to a new
   server action, `requestLoginMfaCode` (`app/actions/mfa.ts`), *before*
   calling next-auth's `signIn()`.
2. That action independently verifies the password (read-only — it never
   creates a session itself), and if the user's role is staff and MFA
   infrastructure (Upstash) is configured, generates a 6-digit code, stores
   it in Redis (`mfa:${userId}`, 5-minute TTL) via `lib/kv.ts`, and emails
   it via a new `sendMfaCodeEmail` template in `lib/email.ts`.
3. The login page then shows a second-step screen for the code.
4. Submitting the code calls the real `signIn('credentials', { email,
   password, otpCode })`. `lib/auth.ts`'s `authorize()` independently
   re-verifies the password *and* the code (`verifyAndConsumeMfaCode` —
   single use, deleted from Redis on success) before issuing a session.
   Step 1's action is a UX helper only; step 2 is the actual security
   boundary.
5. Non-staff roles (STUDENT, PARENT) and any environment without Upstash
   configured skip straight to normal sign-in, unchanged from before.

## Why no schema changes

Codes are ephemeral (5-minute TTL) and MFA is unconditionally mandatory
for staff rather than an opt-in/toggle — so there's no need for a
persistent "MFA enabled" flag on `User`, and no TOTP secret to store. This
was deliberately chosen to avoid touching `prisma/schema.prisma` while a
concurrent session was actively editing it.

## Rate limiting

Reuses the existing `@upstash/ratelimit` pattern already in `lib/kv.ts`:
max 3 code requests per user per 10 minutes (`checkMfaRequestRateLimit`),
separate from the existing 5-attempts/15-min IP-based login rate limit.
Prevents a malicious actor from email-bombing a staff inbox by repeatedly
triggering code sends.

**Ready-to-paste Claude Code prompts for everything below (plus the git
lock and dependency fixes) are in `claude-code-handoff-prompts.md`.**

## Known limitations / follow-ups

- **`STAFF_ROLES` is duplicated three times** (`app/actions/mfa.ts`,
  `lib/auth.ts` as `MFA_STAFF_ROLES`, and `auth.config.ts`'s existing DPA
  gate list). All three must be kept in sync manually. Flagged in code
  comments in all three locations. Worth extracting to a shared
  `lib/roles.ts` in a follow-up.
- **Not verified by `tsc`/`build`** in this session — see the note in
  `cyber-essentials-self-assessment.md`. Manually reviewed instead. Run
  the real check locally before committing.
- **Demo login buttons** on `/login` (the one-click demo account fill-ins)
  will now trigger the email-code step for every staff demo account once
  Upstash + Resend are both configured in that environment — expected
  behaviour, not a bug, but worth knowing if a demo/trial environment
  doesn't have a real inbox to check codes against. If that's a problem
  for a specific demo environment, the clean fix is to leave Upstash
  unconfigured there (MFA gracefully no-ops), not to special-case demo
  accounts in the auth code itself.
- **Accessibility of the code-entry UI** not tested against screen
  readers — `autoComplete="one-time-code"` is set (helps SMS/email code
  autofill on mobile), but no dedicated accessibility pass was done.
