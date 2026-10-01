import * as Sentry from '@sentry/nextjs'
import { cronMatches } from './cron'
import { SCHEDULED_JOBS } from './jobs'

/**
 * In-app scheduler. Started once per server process from instrumentation.ts.
 * Every minute it calls the cron routes that are due, on this same server,
 * with the CRON_SECRET bearer token, exactly as the GitHub workflows did.
 *
 * Switch off with IN_APP_CRON=off (for example if Omnis ever runs on more
 * than one container, so jobs aren't run twice).
 */
const KEY = '__omnisSchedulerStarted'

export function startScheduler(): void {
  const g = globalThis as unknown as Record<string, unknown>
  if (g[KEY]) return
  const secret = process.env.CRON_SECRET
  if (!secret || process.env.IN_APP_CRON === 'off' || process.env.NODE_ENV !== 'production') return
  g[KEY] = true

  const base = `http://127.0.0.1:${process.env.PORT ?? '3000'}`
  const lastRun = new Map<string, string>()   // path -> minute key, so a job never runs twice in one minute

  const tick = () => {
    const now = new Date()
    const minuteKey = now.toISOString().slice(0, 16)
    for (const job of SCHEDULED_JOBS) {
      if (!cronMatches(job.cron, now) || lastRun.get(job.path) === minuteKey) continue
      lastRun.set(job.path, minuteKey)
      void runJob(base, job.path, secret, job.timeoutMs ?? 120_000)
    }
  }

  // Align to the start of each minute (+2s), then every 60s.
  const delay = 60_000 - (Date.now() % 60_000) + 2_000
  setTimeout(() => { tick(); setInterval(tick, 60_000) }, delay)
  console.log(`[scheduler] started with ${SCHEDULED_JOBS.length} jobs`)
}

async function runJob(base: string, path: string, secret: string, timeoutMs: number): Promise<void> {
  const started = Date.now()
  try {
    const res = await fetch(base + path, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    console.log(`[scheduler] ${path} -> ${res.status} in ${Math.round((Date.now() - started) / 1000)}s`)
    if (!res.ok) {
      Sentry.captureMessage(`Scheduled job ${path} returned ${res.status}`, { level: 'error', tags: { job: 'scheduler', path } })
    }
  } catch (err) {
    console.error(`[scheduler] ${path} failed`, err)
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), { tags: { job: 'scheduler', path } })
  }
}
