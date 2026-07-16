# Bug — /accept-dpa doesn't let staff into the app after acknowledging

**Reported:** 10 July 2026, live on Vercel. Screenshot: staff DPA
acknowledgement page — ticking the checkbox and clicking "Acknowledge and
Continue" just refreshes back to the same page instead of proceeding into
the app.

**Likely root cause (unconfirmed — needs diagnosis, not assumed):** per
CLAUDE.md, this gate works by `acceptDpa()` setting `User.dpaAcceptedAt` in
the DB, then calling `unstable_update()` client-side to patch the NextAuth
JWT so `middleware.ts`'s `authorized()` callback stops redirecting to
`/accept-dpa` on the next request — without a full re-login. If the client
navigates away before that session update actually lands (or the update
payload/merge is wrong), the middleware re-checks the *old* JWT, sees
`dpaAcceptedAt` still null, and bounces straight back to `/accept-dpa` —
exactly the symptom described. This is a known fragile pattern (the same
file, `auth.config.ts`, was also just extended with an equivalent
`termsAcceptedAt` gate for parents/students at `/accept-terms`, which
likely shares the identical risk since it's copy-paste of the same
mechanism — that page needs checking too, not just this one).

Ready-to-paste prompt below, written diagnosis-first per your own
DEVELOPMENT.md bug-fixing convention — don't let it guess at a fix before
confirming the actual cause.

---

### Prompt

```
Read CLAUDE.md for context. There is a bug: staff members who tick the
acknowledgement checkbox on /accept-dpa and click "Acknowledge and
Continue" get bounced right back to /accept-dpa instead of entering the
app — it loops instead of letting them in.

Diagnose first, don't guess:
1. Find the accept-dpa page component and its acceptDpa() server action.
   Confirm acceptDpa() actually sets User.dpaAcceptedAt in the DB —
   verify with a direct Prisma query against a test user after triggering it.
2. Check how the client signals the session to update after acceptDpa()
   succeeds — likely an unstable_update() call from next-auth. Confirm:
   (a) it's actually awaited before any redirect/navigation happens,
   (b) the payload it sends matches what auth.config.ts's jwt() callback
   trigger==='update' branch expects (check the exact field name —
   dpaAcceptedAt vs a mismatched key would silently no-op the merge),
   (c) there's no redirect firing before that update resolves.
3. Check auth.config.ts's authorized() callback — confirm the DPA gate
   condition (STAFF_ROLES.includes(role) && !token.dpaAcceptedAt &&
   pathname !== '/accept-dpa') is reading the field that actually gets
   patched, and that there isn't a stale-token issue from session
   maxAge/JWT caching.
4. Reproduce it: log in as a staff demo account with dpaAcceptedAt reset
   to null in the DB, go through the flow, and confirm whether it's a
   timing race, a field-name mismatch, or something else entirely.

Once the actual root cause is confirmed (not assumed), fix it.

Then check for the same bug class elsewhere: auth.config.ts was recently
extended with an equivalent termsAcceptedAt gate for PARENT/STUDENT roles
at /accept-terms, built the same way (same unstable_update() pattern).
Test that flow too with a parent/student demo account reset to
termsAcceptedAt = null — confirm it doesn't have the identical loop bug.
Also grep the whole codebase for other unstable_update() call sites
(`grep -rn "unstable_update" app/ lib/ components/`) and check each one
follows the same corrected pattern.

Verify with: npx tsc --noEmit && npm run build, then manually walk both
the /accept-dpa and /accept-terms flows end-to-end with fresh demo
accounts before considering this fixed. Report the actual root cause in
one paragraph, plus pass/fail for both flows.
```

**Check:** a staff demo account with `dpaAcceptedAt: null` can tick the
box, click through, and land on their normal dashboard — not loop back.
Same for a parent/student demo account and `/accept-terms`.
