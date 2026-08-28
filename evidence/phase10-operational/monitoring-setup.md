# 10.1 Monitoring & alerting — status

## What's wired in code (27 Aug 2026)

**Sentry (`@sentry/nextjs`) was already installed and initialised** in
`sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts` —
this predates this session. Each `Sentry.init()` is gated on
`enabled: !!process.env.SENTRY_DSN` (server/edge) or
`!!process.env.NEXT_PUBLIC_SENTRY_DSN` (client), so it safely no-ops if the
DSN isn't set rather than erroring.

**What Sentry actually saw before today: only client-side React render
errors.** 23 `error.tsx` error-boundary files call into Sentry — these catch
UI render crashes in the browser. Zero of the 93 server-side `app/api/**/route.ts`
files called Sentry directly. This matters because most of those routes —
including all 4 nightly agent crons — catch their own errors and convert them
into a normal JSON response (a 200, 502, or 500) rather than letting them
throw. Sentry's Next.js SDK auto-instruments *unhandled* exceptions; a caught
error that gets logged and turned into a response never throws, so it was
invisible to Sentry regardless of whether a DSN was configured.

**Fixed today:** added `lib/monitoring.ts` (`reportBatchItemFailure`,
`reportSystemicFailure`, `reportFatalError`) and wired it into all 4 agent
cron routes (`agent-coach`, `agent-quality`, `agent-plan-synthesis`,
`agent-engage`) at exactly the three points where they catch and swallow:
per-school failures, the systemic-failure branch (added in the 27 Aug
resilience audit, `docs/audit/2026-08-27-resilience-audit.md`), and the
top-level fatal catch (coach/engage only — quality/plan-synthesis don't wrap
their top-level DB call in try/catch, so an error there already throws
unhandled and Sentry's auto-instrumentation already covers it once a DSN
exists).

## What's still open

- **The other ~16 cron routes** (`oak-sync`, `wonde/sync`, `early-warning`,
  `low-attendance`, `review-due`, `overdue-alert`, digests, etc.) still catch
  and swallow errors into a response without calling Sentry. The 4 agent
  crons were prioritised because they're the most directly SEND-critical
  (a silently-broken Coach/Quality/Plan-Synthesis/Engage run means a
  student's plan silently stops being reviewed). Extending
  `lib/monitoring.ts` to the rest is a mechanical follow-up, not a design
  question — same three helper calls, same pattern.
- **No Sentry project/DSN exists yet.** `SENTRY_DSN` and
  `NEXT_PUBLIC_SENTRY_DSN` are unset in `.env.local` and (unconfirmed,
  needs checking) likely unset in Coolify's production env vars too. Until
  a DSN is set, every `Sentry.init()` call above stays disabled and none of
  this — old or new — actually reports anywhere. **This is the actual
  activation switch and needs a decision from Ivan**: either create a free
  Sentry account + Next.js project (sentry.io, free tier covers this scale)
  and set the DSN in both places, or pick a different error-tracking
  provider — the code doesn't have to be Sentry-specific if there's a
  preference.
- **No alert routing configured.** Even with a DSN set, Sentry won't notify
  anyone until an alert rule is created in the Sentry project pointing at a
  real email/Slack/phone. This is a few minutes of Sentry dashboard
  configuration once the project exists — not code.
- **No uptime monitoring exists.** Nothing currently checks that
  `omnis.education` itself is reachable, independent of whether the app
  throws errors once loaded (e.g. the whole Coolify container being down,
  as nearly happened during today's connection-pool incident). A free tier
  of UptimeRobot, Better Uptime, or Checkly pinging `/` or a dedicated
  `/api/health` endpoint every 1-5 minutes, alerting to the same
  email/Slack, covers this. No such endpoint exists yet either —
  worth adding a trivial `/api/health` route (200 OK + a DB ping) as the
  monitored target rather than pointing an uptime check at the marketing
  homepage.
- **No alert thresholds tied to the 6.1 performance targets** (roster <3s,
  analytics <5s, homework gen <30s, ILP gen <60s). Sentry's performance
  monitoring (`tracesSampleRate`, already set to 0.05 in prod) can alert on
  p95 latency per route once enough real traffic exists to set a sane
  baseline — premature to tune thresholds before the load testing in Phase
  6.1 has actually run once.

## Next steps (needs Ivan)

1. Create a Sentry project (or confirm a preference for an alternative),
   get the DSN, set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in both
   `.env.local` and Coolify's environment variables.
2. In the Sentry project: create an alert rule routing new issues to a real
   email/Slack channel.
3. Decide on an uptime monitor and point it at a new `/api/health` route
   (not yet built).
4. Once 6.1's load test has run once with real numbers, come back and set
   performance alert thresholds against the 4 targets above.
