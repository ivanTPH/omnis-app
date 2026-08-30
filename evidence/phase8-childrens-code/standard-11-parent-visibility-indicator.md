# Standard 11 (Parental controls) — "visible to your parent" indicator

## What was built

`components/student/SharedWithParentBadge.tsx` — a small, purely
presentational pill ("Visible to your parent", with a family icon), and
`getMyParentShareStatus()` (`app/actions/student.ts`) — checks whether the
calling student has a linked parent account (`ParentStudentLink`, the model
that actually drives what `/parent/dashboard` and `/parent/progress` query
and display).

The badge is only rendered when `hasLinkedParent === true`, computed
server-side per page and passed down as a prop — never hard-coded, never
shown to a student with no linked parent account.

### Where it was placed, and where it deliberately wasn't

Placed on:
- `/student/grades` (`StudentGradesView`, next to the "My Grades" heading)
- `/student/homework/[id]` (next to the homework title, alongside the class
  and due-date chips)

**Deliberately not placed on Messages.** The task's example wording
mentioned "grades/homework/messages," but tracing what a parent account
actually sees (`app/parent/dashboard/page.tsx`, `app/parent/progress/page.tsx`)
confirmed parents only ever see **homework and grades** — parent↔teacher
communication runs through a completely separate channel
(`ParentConversation`/`ParentMessage`, reachable at `/parent/messages`), not
the student's own `Messages` (`MsgThread`) inbox with teachers/staff.
Putting the badge on the student's Messages page would have been a false
claim — a parent cannot see a student's Messages threads through Omnis.
Accuracy took priority over following the illustrative example literally.

## Verification — logged in as the student demo account

`a.hughes@students.omnisdemo.school` is linked to `l.hughes@parents.omnisdemo.school`
in the demo seed data, so `hasLinkedParent` resolves `true` for this account
— a real positive case, not a contrived one.

1. **`/student/grades`** — badge renders inline next to "My Grades".
   Screenshot: `screenshots/standard-11-grades-badge.png`.
2. **`/student/homework/[id]`** (opened the first homework in the list) —
   badge renders next to the class/due-date chips in the page header.
   Screenshot: `screenshots/standard-11-homework-detail-badge.png`.
3. Confirmed via the component's own logic (and by reading the parent
   dashboard/progress queries) that the badge's claim is true: the same
   homework and grade data the badge is attached to is exactly what
   `getParentDashboard`-equivalent queries in `app/parent/dashboard/page.tsx`
   / `app/parent/progress/page.tsx` pull for the linked parent to see.

Result: PASS — visible, accurate, and gated on real parent-link data rather
than always-on decoration.

## Status

- [x] Built
- [x] Verified via student demo login (real linked-parent case)
