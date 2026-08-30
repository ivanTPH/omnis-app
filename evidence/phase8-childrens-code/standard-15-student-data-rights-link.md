# Standard 15 (Online tools) — "how your data is used / who to ask" page

## What was built

- **`app/student/privacy/page.tsx`** — a new, simple, plain-language page:
  what Omnis stores, who can see it (cross-references Standard 11 — tells a
  student without a linked parent that nothing is shared with a parent
  account, and tells a linked student that it is), how AI is used, and a
  "Who to ask" section with the school's Data Protection Officer contact.
- **Sidebar link** (`components/Sidebar.tsx`) — "How your data is used",
  added to the same footer block as Help Centre / Settings / Accessibility,
  shown on **every page** for STUDENT accounts (role-gated, not tucked
  inside an unrelated page). This is what makes it "always-reachable" per
  the task wording, rather than a one-off link buried in a single view.
- **DPO contact, configurable per school** — `School.dpoName` /
  `School.dpoEmail` (new nullable fields), `getDpoContact()` /
  `getSchoolSettings()` / `saveSchoolSettings()` extended, and a new
  **`components/admin/DpoContactCard.tsx`** on `/admin/dashboard`
  (SCHOOL_ADMIN/SLT) so it's editable at any time — not locked behind the
  one-time `/admin/onboarding` wizard, which redirects away once a school
  has completed setup and would otherwise make this permanently
  unreachable for the demo school and any already-onboarded school.
- **Fallback when unset**: the page reads `School.dpoName`/`dpoEmail` and,
  when both are empty, shows a generic "ask your school office for the
  Data Protection Officer" prompt instead of blocking or showing nothing.

## Verification — logged in as SCHOOL_ADMIN, then the student demo account

1. **Before any DPO contact is set** — `/student/privacy` renders the
   generic fallback ("ask your school office…"), confirmed by asserting the
   page body mentions "Data Protection Officer" without a specific
   name/email present.
2. **Admin dashboard card, unset state** — confirmed the
   `DpoContactCard` renders on `/admin/dashboard` (`admin@omnisdemo.school`)
   with a "Set contact" button.
3. **Set a DPO contact as SCHOOL_ADMIN** — filled in "Priya Shah, DPO" /
   `dpo@omnisdemo.school`, saved.
   Screenshots: `screenshots/standard-15-admin-dpo-editing.png` (form
   filled in) and `screenshots/standard-15-admin-dpo-saved.png` (card shows
   the saved contact on the dashboard, confirming `saveSchoolSettings` /
   `getSchoolSettings` round-trip correctly and the audit entry
   `SCHOOL_SETTINGS_UPDATED` fires as it does for the other school-settings
   fields).
4. **Logged back in as the student** and reloaded `/student/privacy` —
   the page now shows the real configured contact, "Priya Shah, DPO" and
   `dpo@omnisdemo.school`, not the fallback text. Confirmed by asserting the
   page body contains both strings.
   Screenshot: `screenshots/standard-15-student-privacy-with-real-dpo.png`
   (full page — top sections visible; "Who to ask" section confirmed present
   via text assertion further down the same page).
5. **Sidebar link** — confirmed "How your data is used" is present and
   visible in the sidebar on the student dashboard, and clicking it lands on
   `/student/privacy` with heading "How your data is used".

Result: PASS — a genuinely reachable, always-visible link; a real page with
plain-language content; and a DPO contact that is truly configurable per
school (not hard-coded), with the demo school's own admin able to set it and
the change flowing through to the student page live, verified end-to-end
rather than assumed from reading the code.

## Status

- [x] Built
- [x] Verified via SCHOOL_ADMIN + student demo login (full configure →
      read round-trip, plus the unset-fallback case)
