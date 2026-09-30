# Invitations, go-live checklist and MIS matching (30 September 2026)

## Why
- The Wonde sync emailed every pupil and parent automatically, the first time it ran and then every night, before the school had told families.
- Pupil emails were guessed as `firstname.lastname@students.<domain>`. Where two pupils shared a name, the activation link could reach the wrong child.
- Pupils were matched to MIS data (SEND, attendance, behaviour, exclusions, baselines, photos) **by name**, so pupils with the same name could have their data mixed up.
- Parent accounts were never linked to their children.

## What changed
- **No automatic emails.** `lib/wonde-sync.ts` creates pupil accounts silently (step 3a) and never emails. The old end-of-sync provisioning block is removed. CSV import (`importStudents`) no longer emails either.
- **Real addresses only.** Pupil emails come from Wonde `contact_details` (the school must grant it) or a CSV. Otherwise the account gets a placeholder on the reserved `pending.omnis.invalid` domain (`lib/accounts/placeholder.ts`), which is never emailed (bounce guard in `lib/email.ts`). CSV import fills in placeholders when exactly one pupil matches.
- **Matching by Wonde ID.** New `User.wondeId` (unique). `lib/accounts/student-matching.ts` links by ID. A legacy account is claimed by name only when the name is unique on both sides; ambiguous names are reported in the sync errors. All later sync steps use the ID map. Unit tests: `lib/accounts/student-matching.test.ts`.
- **Go-live checklist** (`lib/go-live.ts`, `/admin/go-live`). Essential items: school details and DPA, DPO contact, Wonde connected with a successful sync, pupils, classes, key staff, family contact email. Recommended items: subjects and exam boards, calendar, retention review, pupil emails. The admin presses "Go live" (`School.goLiveAt`). Staff see a pop-up (`GoLiveChecklistModal`, once per browser session) until the school is live.
- **Invitations** (`/admin/invitations`). By year group: pupil set-up emails (`invitedAt` recorded, optional resend), open or close parent registration, and email parents on the MIS an invitation to register. All actions are audited (`INVITATIONS_SENT`, `SCHOOL_WENT_LIVE`).
- **Parent self-registration** (`/parents` → `/marketing/parents`, `POST /api/parents/register`). The account is created only if the email belongs to a contact with parental responsibility at a live school with registration open. Links are made from MIS records only (`lib/accounts/parent-links.ts`). The response is always the same, and requests are rate-limited. The nightly sync links registered parents to any new children.
- **Before go-live**, pupils and parents cannot request sign-in links (`forgot-password`).
- **Emails rewritten** in plain English, with the school's contact email, help and privacy links (`sendWelcomeAccountEmail`, `sendParentRegistrationInviteEmail`). The set-up page shows "Welcome to Omnis" when `welcome=1`.
- **Help.** New public page `/support` → `/marketing/help` (getting started and common problems). The in-app Help page now has Parent and Pupil sections, and staff sections are hidden from them.

## Database (applied to production 30 Sep via Supabase migration `school_go_live_and_invitations`)
- `School`: `goLiveAt`, `goLiveBy`, `parentSignupOpen`, `familyContactEmail`. All existing schools (demo, test and seeded) were backfilled as live.
- `User`: `wondeId` (unique) and `invitedAt`.
- `AuditAction`: `INVITATIONS_SENT`, `SCHOOL_WENT_LIVE`, `PARENT_SELF_REGISTERED`.
- Seeds now mark their schools live.

## Still to check with the trial school
- Wonde classes are not yet turned into Omnis `SchoolClass` and `Enrolment` rows, and staff accounts are not created from Wonde employees. Before the trial, confirm with the Wonde test school how teachers will see their classes.

## Update (30 Sep, evening): classes, teachers and AI run days
- **Classes and teachers from the MIS** (`lib/accounts/class-provisioning.ts`, run at the end of each Wonde sync, but not for demo schools):
  - Teachers become `TEACHER` accounts, linked by `User.wondeId` or claimed by email. Only staff who teach or are flagged as teachers get accounts. No emails are sent.
  - Wonde classes become `SchoolClass` rows (`wondeClassId`, unique). A class's year group comes from its pupils when the MIS doesn't give one.
  - Teachers are linked with `ClassTeacher` and pupils with `Enrolment`. When the MIS changes, only MIS-managed links are removed; anything added by hand in Omnis stays.
- **Where teachers come from:** Wonde employee includes `contact_details` and `classes` (each combination is tried in turn), plus timetable entries and the class's own teacher.
- **Staff invitations:** a new Staff section on `/admin/invitations`. Staff can be invited before the school goes live.
- **Go live** turns on the `ai_agents` flag for that school.
- **AI run days:** coach, quality and engage run on Monday, Wednesday and Friday only (`AGENT_RUN_DAYS`, default `1,3,5`). SEND plan and evidence checks run nightly, and only for records that have changed.
- **Rehearsal school:** "Omnis Trial Rehearsal" (`school-trial-rehearsal`) now holds the Wonde test-school link and data, moved from Omnis Demo School. Its admin is ivan@omnis.education, who sets a password via Forgot password.
