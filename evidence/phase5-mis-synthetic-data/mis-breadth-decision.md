# Phase 5.1 / 5.2 / 5.3 — Feasibility Assessment & MIS Breadth Notes

**Date:** 10 July 2026

## Environment finding (important)

`.env.local` in the live repo (`/Users/ivan-imac/omnis-app`) has `DATABASE_URL`,
`DIRECT_URL`, `WONDE_API_TOKEN` and `WONDE_SCHOOL_ID` pointing at what all the
existing seed scripts (`wonde:seed`, `db:seed`, `send:seed`, `platform:seed`,
etc.) treat as *the* database — the same one CLAUDE.md repeatedly refers to as
"production DB" and that the live Vercel deployment reads from. There is no
separate local/dev database configured.

This matters for 5.1 and 5.3: both call for generating synthetic schools and
bulk synthetic homework/submission data. Running any seed script as-is would
write that synthetic data into the same database serving the real trial
data (Mia Adams, Rehan Ali, and the rest of the seeded demo cohort
referenced throughout CLAUDE.md). **I have not run any seed or sync script
against this database** — that's a decision for you, not something to do
by default given the stakes.

## Recommended safe path: Supabase branching

A Supabase MCP connector is available in this session with a `create_branch`
tool. Supabase branches give an isolated copy of the schema (and optionally
data) with its own connection string — synthetic schools, load-test data,
and cross-tenant isolation testing (5.4's outstanding live test) could all
run there with zero risk to the real database. Branch compute has a cost
(the connector also exposes `get_cost` / `confirm_cost`), so this needs your
go-ahead before I create one.

**Suggested next step, pending your confirmation:** create a Supabase branch,
point a temporary `.env.branch` at it, and run `wonde:seed` + the additional
synthetic schools (5.1) and synthetic submission generation (5.3) there.

## 5.1 — Wonde sandbox breadth

Separately from the database question: creating *additional* Wonde sandbox
schools (large/small/high-SEND/mid-year-joiners) isn't something scriptable
from here — Wonde issues sandbox test schools through their own dashboard/
support process, not a self-service API call. Action needed on your side:
contact Wonde (same channel used for the pending `periods.read`/`lessons.read`
permission request noted in CLAUDE.md) to request additional sandbox schools
with those specific shapes, or confirm whether the existing sandbox already
supports generating varied synthetic schools that we haven't discovered yet.

## 5.2 — MIS breadth decision

Recorded for your decision, not decided here:

| Option | Effort | Notes |
|---|---|---|
| Wonde only (current) | None — already integrated | ~35 MIS platforms reachable through one API, but each school still needs to already use a Wonde-connected MIS |
| + Arbor | Low | Free REST/GraphQL sandbox, full SDKs, no cost to integrate |
| + SIMS | Medium–High | Paid API licence required; ~50% UK market share, so highest reach per £ if budget allows |
| + iSAMS | Medium | No public sandbox — needs a direct conversation with their partner API team; relevant only if targeting independent schools |

**Decision — 10 July 2026:** Target market confirmed as state schools/MATs.
Arbor is the next priority MIS integration after Wonde: free sandbox, full
REST/GraphQL SDKs, no licence cost, and complements Wonde's existing reach
into state-school MIS platforms. SIMS (highest single-platform reach at ~50%
share, but paid API licence) and iSAMS (independent schools, no public
sandbox) are deferred until there's a specific MAT/LA pipeline reason to
prioritise them.

**Next action:** register for Arbor's developer sandbox
(developer portal — free, self-service) and repeat the same sandbox
integration + testing pattern already proven with Wonde (Phase 5.1) once
that phase resumes.

**Correction after checking the live repo:** this is further along than
assumed. `app/api/arbor/sync/route.ts` already exists — auth-gated,
documents the exact Arbor→Omnis data mapping (students, staff, academic
years, registration groups, timetable, behaviour, attendance, assessment
grades), and explicitly says "Status: INTEGRATION READY — client library +
sync engine needed. Follow the pattern in `lib/wonde-client.ts` +
`lib/wonde-sync.ts`." It currently returns HTTP 501 (not implemented) —
it's a well-specified scaffold, not a working integration. Remaining work
is exactly `lib/arbor-client.ts` + `lib/arbor-sync.ts` plus an admin UI
panel, mirroring the existing Wonde pattern. This lowers the effort
estimate for "Arbor next" considerably — the integration contract is
already designed.

**Bonus finding:** `app/api/classcharts/sync/route.ts` is a third
scaffolded-but-unimplemented integration (behaviour/homework platform, not
a core MIS) with the same "INTEGRATION READY" status. Not part of this
decision, but worth knowing it exists next time integration priorities are
reviewed.

## 5.3 — Synthetic behavioural/load data

Approach is sound (generate a realistic spread of submissions/grades/SEND
distribution on a large synthetic school, spot-check autoMarkSubmission
accuracy) but execution is blocked on the same database question as 5.1.
Once a safe target (branch or otherwise) is confirmed, this is straightforward
to build as a script using the existing seed patterns in `prisma/seed*.ts`.
