/**
 * lib/monitoring.ts
 *
 * Thin wrapper around Sentry for server-side code paths that deliberately
 * catch an error and turn it into a normal HTTP response (a JSON 502/500,
 * a per-item "skip and continue"). Sentry's Next.js SDK auto-instruments
 * *unhandled* exceptions in route handlers -- but a caught error that gets
 * logged and converted into a response never throws, so it never reaches
 * Sentry on its own. Call these explicitly at exactly those points.
 *
 * No-ops safely if SENTRY_DSN isn't configured (see sentry.server.config.ts
 * -- Sentry.init is `enabled: !!process.env.SENTRY_DSN`), so it's always
 * safe to call these without checking whether monitoring is wired up.
 */

import * as Sentry from '@sentry/nextjs'

/**
 * Report a single failed unit of work inside a batch (e.g. one school's
 * cron run) that was caught and the batch continued. Tagged so these are
 * easy to filter/group in Sentry by which job and which school.
 */
export function reportBatchItemFailure(
  job: string,
  itemId: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  console.error(`[${job}] item ${itemId} failed:`, error)
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    tags: { job, itemId },
    extra,
  })
}

/**
 * Report a systemic failure: every item in a batch failed the same way
 * (revoked API key, DB outage, etc.) rather than a few bad records. This is
 * the "silent total outage" case -- the route still returns a well-formed
 * response (so callers don't hang), but nothing else about it looks like a
 * crash, so it needs an explicit, high-visibility report.
 */
export function reportSystemicFailure(
  job: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  console.error(`[${job}] SYSTEMIC FAILURE: ${message}`, extra)
  Sentry.captureMessage(`[${job}] systemic failure: ${message}`, {
    level: 'error',
    tags: { job, kind: 'systemic-failure' },
    extra,
  })
}

/**
 * Report an unhandled/fatal error at the top of a route handler that was
 * caught only to return a clean JSON error response instead of crashing.
 */
export function reportFatalError(job: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[${job}] FATAL:`, error)
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    tags: { job, kind: 'fatal' },
    extra,
  })
}
