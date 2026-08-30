# Standard 4 (Transparency) — bite-sized data notice

## What was built

`components/student/ChildTransparencyNotice.tsx` — a dismissible, one-time,
plain-language notice rendered in `AppShell` for STUDENT accounts only. It
is not a consent gate (it never blocks access, unlike `/accept-dpa` and
`/accept-terms`); it's purely informational, satisfying the DPIA's ask for
something "surfaced at the point data is used (e.g. first login, first
AI-generated homework)."

Design decision: rather than wiring two separate trigger points (a literal
"first login" check and a literal "first AI-generated homework" check —
the latter would need a new per-homework AI-provenance flag threaded through
every homework-creation path, which doesn't exist today and would be a much
larger, unrelated schema change), the notice is rendered once in `AppShell`,
which wraps every authenticated page. Whichever page a student lands on
first — the dashboard after login, or a homework link they were sent
directly — the notice appears there. This satisfies both named trigger
points with one component and one DB field, and is honest about what the
product can currently distinguish (AI is pervasively involved across
homework generation, marking and feedback — there's no single "this one is
AI-generated" flag to gate on yet).

## How it works

- `User.childNoticeAckAt DateTime?` (new field) — null until dismissed, then
  set once and never reset.
- `app/actions/child-notice.ts` — `getChildNoticeStatus()` (read) and
  `acknowledgeChildNotice()` (write + `writeAudit(CHILD_NOTICE_ACKNOWLEDGED)`),
  mirroring the existing `accept-dpa.ts` / `accept-terms.ts` pattern but
  without the middleware/JWT gating those use, since this is dismissible,
  not blocking.
- The "Got it" button closes the banner instantly (optimistic UI) and fires
  the acknowledgement server action in the background.
- Copy links to `/student/privacy` ("Full details →") for the Standard 15
  page, so Standards 4 and 15 reinforce each other.

## Verification — logged in as the student demo account

Ran a Playwright script against `localhost:3000` (dev server), logging in
as `a.hughes@students.omnisdemo.school` / `Demo1234!`:

1. **Fresh login** → notice appeared automatically, no page reload needed.
   Screenshot: `screenshots/standard-4-notice-shown.png` — shows the notice
   docked at the bottom of the student dashboard, over the homework list,
   with the exact copy:
   > "A quick word about your data — Your school uses Omnis to set
   > homework, track your progress, and support your learning. Your
   > teachers and relevant school staff can see your work and grades — not
   > other students. Some feedback and homework is created with AI help,
   > but a teacher always checks it. Full details →"
2. **Clicked "Got it"** → notice closed immediately.
   Screenshot: `screenshots/standard-4-after-dismiss.png`.
3. **Logged out, logged back in as the same student** → notice did **not**
   reappear (confirmed both visually and by asserting the dialog role is
   absent). This confirms the one-time behaviour — `childNoticeAckAt` was
   correctly persisted and read back on the next session.

Result: PASS — visible, dismissible, one-time, plain language, links to
full detail. Not just present in code; confirmed rendering and persisting
correctly against the live demo account.

## Status

- [x] Built
- [x] Verified via student demo login
