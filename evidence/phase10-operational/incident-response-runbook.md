# 10.2 Incident response runbook

**Status: first draft, 27 Aug 2026 — needs Ivan to fill in the on-call/escalation
details marked TODO below before this counts as complete.** The structure and
severity/response content is ready to use now.

## On-call

**TODO (Ivan):** who is on call, and how are they reached (phone/SMS, not just
email — Sentry/uptime alerts should page a phone for Sev 1). At current team
size this is likely just you; write that down explicitly rather than leaving
it implicit, since "who's on call" needs an unambiguous answer at 2am, not an
assumption. If/when a second person joins, add a rotation and a fallback if
the primary doesn't acknowledge within a fixed window (e.g. 15 minutes).

## Severity levels

**Sev 1 — Data safety or full outage.** Any of: the app is down/unreachable
for all users; any suspected unauthorised access to student data, especially
SEND/EHCP/safeguarding records; a cross-tenant data leak (one school seeing
another's data); data loss (the Oak mass-deletion failure mode fixed in the
27 Aug resilience audit would have been a Sev 1 had it fired). Page
immediately, any hour.

**Sev 2 — Degraded but not down.** A specific feature broken for all users
(e.g. homework generation failing platform-wide), or one school's tenant
significantly broken while others are fine, or a nightly agent cron
systemically failing (all 4 now surface this as a real alert, see
`monitoring-setup.md`) — a student's Coach/Quality/Plan-Synthesis/Engage run
silently not happening for days is a real SEND-service failure even though
nothing is "down." Respond same business day; overnight if it's actively
accumulating harm (e.g. a security-relevant cron failure).

**Sev 3 — Isolated/low-impact.** A single user's error, a non-critical
export failing, a UI bug. Normal bug-tracking flow, no incident process
needed.

## Response steps (Sev 1/2)

1. **Acknowledge** — stop the alert noise so you can think, but don't
   silence-and-forget; the clock is running.
2. **Triage** — is this actually Sev 1/2, or should it be downgraded? Check
   Sentry for the actual error, check Coolify for deploy/container health,
   check the Supabase dashboard for DB health (the 27 Aug incident would
   have shown up here first: connection-pool exhaustion on `prisma.classTeacher.findMany()`).
3. **Contain** — for a suspected data safety issue specifically: is data
   actively being exposed or exfiltrated right now, or is this a
   already-happened/historical finding? If active, the fastest containment
   is usually pausing the affected code path or, worst case, the app itself
   — better a short real outage than ongoing exposure.
4. **Fix or roll back** — Coolify keeps deployment history; a bad deploy can
   be rolled back to the last known-good commit from the Coolify UI without
   waiting on a full fix-forward if the fix isn't immediately obvious.
5. **Verify** — confirm the actual symptom is gone (not just that the alert
   stopped firing), including for any affected school specifically if it was
   tenant-scoped.
6. **Write it up** — even a few sentences: what happened, what was affected,
   how long, what fixed it. This session's `docs/audit/` folder is already
   the pattern for this (e.g. the connection-pool incident is documented in
   `docs/audit/2026-08-27-hardening-security-sweep.md`) — keep using it, one
   entry per real incident, not just audits.

## Safeguarding-specific escalation

Omnis holds SEND status, EHCP documents, and safeguarding concern records —
data with real child-protection sensitivity, not just generic PII. Any Sev 1
that is or might be a data safety issue involving this category of data needs
an extra step beyond the generic response above:

- **TODO (Ivan):** does your school-facing contract/DPA specify a notification
  deadline to affected schools (commonly 72 hours is the GDPR/ICO reportable-breach
  benchmark, but check what's actually in your agreements)? Confirm the real
  number rather than assuming.
- **TODO (Ivan):** who at each affected school needs to be told, and by whom —
  probably the school's SENCO or Data Protection Officer, not a generic admin
  contact. Is there a DPO/ICO contact path already documented anywhere in the
  compliance docs (`evidence/phase7-security/`)? Worth checking rather than
  inventing this from scratch here.
- Treat "which schools/students were actually affected" as its own triage
  question separate from "what broke" — multi-tenant `schoolId` scoping means
  most incidents should be provably contained to one school; confirm that
  scoping actually held before assuming impact was limited, don't just assert it.

## Communication template — data incident affecting a school

Subject: Important: data incident affecting your Omnis account — [date]

> We're writing to let you know about a data incident affecting your school's
> Omnis account, identified on [date/time].
>
> **What happened:** [plain description, no jargon — what broke and what
> category of data was potentially affected, e.g. "a configuration error
> briefly allowed [specific data type] to be visible to [who]"]
>
> **What we've done:** [contained/fixed as of date/time; specifically what
> was changed]
>
> **What this means for you:** [was any data actually accessed by someone who
> shouldn't have, or was this a potential-exposure window with no evidence of
> access — say which, don't blur the distinction]
>
> **What you should do:** [any action needed on the school's side, or
> explicitly "no action needed" if genuinely true]
>
> We take this seriously given the sensitivity of SEND and safeguarding data
> in particular. If you have questions, contact [TODO: real contact — Ivan to
> fill in], and we'll follow up with [any promised further detail/report].

**TODO (Ivan):** this needs a named human contact filled in before it's usable
for real, and ideally review from whoever handles your DPA obligations before
it's ever sent for real — I've drafted the structure and tone, not legal sign-off.
