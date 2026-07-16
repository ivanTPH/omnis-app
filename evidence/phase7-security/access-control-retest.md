# Phase 7.4 — Access Control / Role Enforcement Review

**Date:** 10 July 2026
**Method:** Static read-through of `middleware.ts` and `auth.config.ts` in the
live repo (not a live click-through re-test — that still needs doing per
Trial Readiness Plan §4.1's original manual check, e.g. logging in as a
student and confirming `/senco/ilp` redirects).

## How role enforcement actually works

Two layers, by design:

1. **`middleware.ts`** — NextAuth's `authorized()` callback runs on every
   matched request (matcher excludes `api`, static assets, `login`,
   `marketing`, `forgot-password`, `reset-password`, `accept-invite`,
   `accept-dpa`). It checks, in order: (a) unauthenticated → redirect to
   `/login` (or `/marketing/home` for `/`), (b) staff roles without
   `dpaAcceptedAt` → forced to `/accept-dpa`, (c) walks the `ROLE_ROUTES`
   array and, on the first prefix match, redirects away if the user's role
   isn't in the allowed list.
2. **Per-action `requireAuth(allowedRoles)` checks** in `app/actions/*.ts` —
   the actual data-fetching/mutating layer, independent of middleware.

## Finding: `ROLE_ROUTES` is an explicit allowlist, not a default-deny

Route prefixes *not* listed in `ROLE_ROUTES` fall through the loop and hit
`return true` at the end of `authorized()` — meaning **any authenticated
user of any role can reach any route not explicitly listed**, and the only
thing stopping a cross-role data read/write is whether that route's
page/server action independently calls `requireAuth()` with the right role
list. This is a legitimate, common Next.js pattern (middleware for the
big/sensitive prefixes, per-action checks for the rest) and not a bug — but
it means **the safety net is only as good as developer discipline on every
new route**, not a structural guarantee. Recorded here as a process risk to
carry into code review practice, not a fix-it-now item.

Cross-checked prefix ordering for the specific-before-generic pattern the
array depends on (since the loop `break`s on first match): `/send-caseload`
and `/send-scorer` correctly appear before the generic `/send` rule;
`/admin/subjects` before generic `/admin`; `/hoy/safeguarding` before
generic `/hoy`; `/academy` before nothing conflicting. Ordering is correct
as written. **Risk:** this ordering is easy to break silently if someone
adds a new specific-prefix rule in the wrong position in a future edit —
worth a code comment in the file itself warning that order matters.

## Finding: this ties directly to the Phase 7.3 dependency scan

Three of the Next.js CVEs found in the dependency scan are middleware/proxy
bypass vulnerabilities (GHSA-492v-c6pp-mqqv, GHSA-267c-6grr-h53f, and
GHSA-36qx-fr4f-26g5 — the last is Pages Router + i18n specific, and Omnis is
App Router only, so likely not applicable, but worth explicit confirmation
rather than assumption). Because Omnis's *entire* role-gating model for
listed prefixes lives in this one middleware file, a framework-level bypass
of Next.js middleware itself would undermine layer 1 regardless of how
correct `ROLE_ROUTES` is — the per-action `requireAuth()` checks become the
only real backstop for listed-prefix routes too. This raises the priority
of the Phase 7.3 Next.js version bump from "routine housekeeping" to
"closes a real gap in the primary access-control layer."

## Outstanding

- [ ] Live re-test: log in as each non-privileged role and confirm redirect
      behaviour for every `ROLE_ROUTES` prefix, not just spot-checks
      (original Trial Readiness Plan §4.1 scope)
- [ ] Apply the Next.js version bump from Phase 7.3 and re-confirm role
      enforcement still passes after upgrade
- [ ] Add a code comment above `ROLE_ROUTES` documenting that array order
      matters (specific prefixes must precede generic ones)
