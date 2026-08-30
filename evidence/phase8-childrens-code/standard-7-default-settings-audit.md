# Standard 7 (Default settings) — audit of UserSettings, UserAccessibilitySettings, messaging

Audited first, before making any change, per the task instructions. Findings
below; the three fixes applied are listed at the end with before/after
values.

## UserSettings (`prisma/schema.prisma`) — audited field by field

| Field | Default before | Meaningful for a child account? | Verdict |
|---|---|---|---|
| `allowEmailNotifications` | `true` | Yes — homework/reminder emails. Not a *visibility-to-others* setting, and email is also the channel for password-reset/account-security mail, so an opt-out-by-default communications preference is standard practice, not a privacy-by-default violation. | **Kept `true`** — reviewed, no change. |
| `allowSmsNotifications` | `false` | Yes | **Already privacy-protective** — no change. |
| `allowAnalyticsInsights` | `true` | Yes — this is an opt-in-to-data-use flag, not a notification preference. Defaulting an analytics/insights opt-in to *on* for a child's account is the opposite of "high privacy by default." | **FIXED → `false`** |
| `profileVisibleToColleagues` | `true` | Yes — a visibility-to-others toggle. Defaulting to visible is not privacy-by-default. | **FIXED → `false`** |
| `profileVisibleToAdmins` | `true` | Yes — same reasoning. | **FIXED → `false`** |
| `lessonSharing` | `PRIVATE` | Teacher-only concept, but already the most restrictive value | Already privacy-protective — no change. |
| `allowAiImprovement` | `false` | Yes | Already privacy-protective — no change. |

### Important caveat found during the audit (not a "default" bug, but worth
### recording): these three toggles are currently inert

Grepped every call site of `profileVisibleToColleagues`, `profileVisibleToAdmins`,
and `allowAnalyticsInsights` across `app/`, `components/`, `lib/` — outside
`app/actions/settings.ts` (which reads/writes them) and
`components/settings/SettingsShell.tsx` (which renders the toggle UI),
**nothing in the codebase reads these fields to actually gate anything.**
They're stored and displayed as togglable settings, but no query anywhere
filters or restricts based on their value.

This means today's fix (flipping the *stored default*) is genuinely
zero-risk — it can't break any existing behaviour, because no behaviour
currently depends on these fields. But it also means the Standard 7 fix is
necessary-but-not-sufficient: the toggles don't yet do anything. Flagged as
a follow-up product item (not actioned in this pass, out of scope for "audit
defaults"): wire `profileVisibleToColleagues` / `profileVisibleToAdmins`
into whatever staff-directory/search feature would actually use them, or
remove the toggles if no such feature is planned — a setting a user can
change with no observable effect is itself a small transparency problem.

## UserAccessibilitySettings — no findings

`dyslexiaFont`, `highContrast`, `largeText`, `reducedMotion` all default
`false`; `lineSpacing` defaults `"normal"`. These are display/accessibility
preferences, not data-sharing or visibility settings — there's no
"privacy-by-default" dimension to audit here. No changes needed.

## Messaging defaults — no findings

Checked `MsgThread.isPrivate` (`@default(false)`) specifically, since a
`false` "is this private" default looked suspicious at first glance.
Traced its actual effect: message-thread **access control is enforced
entirely by `MsgParticipant` row membership**, not by `isPrivate` —
`getThread()` (`app/actions/messaging.ts:106`) requires an existing
`MsgParticipant` record for the caller before returning anything, and
`getMyThreads()` only ever returns threads the caller participates in.
`isPrivate` is read in exactly one place beyond storage/display
(`ThreadList.tsx`, `ThreadView.tsx`) — it renders a cosmetic lock icon,
nothing more. So its default value has no security or privacy consequence;
verified this is genuinely enforced by participant membership, not by
inspection alone. No change needed.

Also checked `SchoolCommunication` / `CommunicationReceipt` (admin→parent
broadcasts) and `ParentConversation` / `ParentMessage` (parent↔teacher) —
neither has a per-user default-visibility toggle; access is scoped by
explicit relations (`parentId`, `teacherId`, `studentId`) at query time in
every action reviewed. No findings.

## Fix applied

`prisma/schema.prisma`, `model UserSettings`:

```diff
- allowAnalyticsInsights     Boolean @default(true)
- profileVisibleToColleagues Boolean @default(true)
- profileVisibleToAdmins     Boolean @default(true)
+ allowAnalyticsInsights     Boolean @default(false)
+ profileVisibleToColleagues Boolean @default(false)
+ profileVisibleToAdmins     Boolean @default(false)
```

Applied via `npx prisma db push` (confirmed synced) and `npx prisma generate`.

## Verification — this is a schema default, not a UI element, so verified
## at the data layer rather than by screenshot

1. **Prisma runtime data model** — confirmed the generated client reports
   the new defaults (`allowAnalyticsInsights: false`, both visibility flags
   `false`).
2. **Actual Postgres column defaults** — queried
   `information_schema.columns` directly against the live Supabase DB:
   `allowAnalyticsInsights` / `profileVisibleToColleagues` /
   `profileVisibleToAdmins` all show `column_default: 'false'`.
3. **Real code-path proof, not just schema inspection** — found a genuine
   demo account with no `UserSettings` row yet
   (`l.hughes@parents.omnisdemo.school`), ran the *exact* upsert the app
   uses on first `/settings` visit
   (`prisma.userSettings.upsert({ where: { userId }, create: { userId }, update: {} })`,
   copied verbatim from `app/actions/settings.ts` / `app/settings/page.tsx`),
   and read back the created row:
   ```
   allowEmailNotifications: true
   allowSmsNotifications: false
   allowAnalyticsInsights: false        ← was true before the fix
   profileVisibleToColleagues: false    ← was true before the fix
   profileVisibleToAdmins: false        ← was true before the fix
   lessonSharing: 'PRIVATE'
   allowAiImprovement: false
   ```
   The test row was deleted immediately after, restoring the account to its
   pristine "never visited settings" state — no demo data was left mutated.

Result: PASS — the three non-privacy-protective defaults are fixed and
confirmed applying to brand-new accounts via the real application code
path, not just the schema file.

## Status

- [x] Audited (this document)
- [x] Fixed
- [x] Verified (data-layer proof above)
