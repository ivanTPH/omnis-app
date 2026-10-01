/**
 * Scheduled jobs, run inside the Omnis server by lib/scheduler/runner.ts.
 * Times are UTC. These used to be GitHub Actions schedules, which GitHub ran
 * up to six hours late (or not at all) at busy times; see
 * docs/audit/2026-10-01-in-app-scheduler.md. The GitHub workflows are kept for
 * manual runs only, except the weekly DSPy job, which needs Python.
 */
export type ScheduledJob = { path: string; cron: string; timeoutMs?: number }

export const SCHEDULED_JOBS: ScheduledJob[] = [
  // Nightly data
  { path: '/api/cron/wonde-sync',            cron: '15 1 * * *' },
  { path: '/api/cron/oak-sync',              cron: '0 2 * * 0' },
  // AI agents (only for schools with the ai_agents flag; coach/quality/engage Mon, Wed, Fri)
  { path: '/api/cron/agent-coach',           cron: '30 2 * * *', timeoutMs: 310_000 },
  { path: '/api/cron/agent-quality',         cron: '0 3 * * *',  timeoutMs: 310_000 },
  { path: '/api/cron/agent-plan-synthesis',  cron: '30 3 * * *', timeoutMs: 310_000 },
  { path: '/api/cron/agent-engage',          cron: '0 4 * * *',  timeoutMs: 310_000 },
  { path: '/api/cron/platform-insights',     cron: '0 5 * * 0' },
  { path: '/api/cron/early-warning',         cron: '0 6 * * 1-5', timeoutMs: 310_000 },
  // Weekly / daily emails and checks
  { path: '/api/cron/retention-review',      cron: '30 6 * * 1' },
  { path: '/api/cron/review-due',            cron: '0 7 * * 1-5' },
  { path: '/api/cron/parent-hw-digest',      cron: '0 7 * * 1' },
  { path: '/api/cron/overdue-alert',         cron: '0 7 * * 3' },
  { path: '/api/cron/slt-briefing',          cron: '0 7 * * 5' },
  { path: '/api/cron/teacher-digest',        cron: '30 7 * * 1' },
  { path: '/api/cron/weekly-parent-summary', cron: '30 7 * * 4' },
  { path: '/api/cron/parent-activation',     cron: '0 8 * * 1' },
  { path: '/api/cron/apdr-review',           cron: '30 8 * * 1' },
  { path: '/api/cron/low-attendance',        cron: '0 9 * * 1' },
  { path: '/api/cron/concern-stale',         cron: '0 9 * * 3' },
  { path: '/api/cron/trial-onboarding',      cron: '30 9 * * *' },
  // Monthly and yearly
  { path: '/api/cron/send-monthly',          cron: '0 8 1 * *' },
  { path: '/api/cron/engagement-digest',     cron: '30 8 1 * *' },
  { path: '/api/cron/year-rollover',         cron: '0 1 1 9 *' },
  // Demo school upkeep
  { path: '/api/cron/demo-advance',          cron: '0 0 * * 1', timeoutMs: 310_000 },
  { path: '/api/cron/demo-refresh',          cron: '30 0 * * 1' },
]
