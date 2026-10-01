import * as Sentry from '@sentry/nextjs'

// Registers the server/edge Sentry configs for their respective runtimes.
// Required (alongside the onRequestError export below) so Sentry captures
// errors thrown during Server Component rendering, in middleware, and in
// other request-lifecycle code that never reaches a route handler's own
// try/catch — none of that was covered by sentry.server.config.ts /
// sentry.edge.config.ts alone.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    // Nightly and weekly jobs run inside the server (lib/scheduler). GitHub
    // Actions ran them hours late; those workflows are now manual-only.
    const { startScheduler } = await import('./lib/scheduler/runner')
    startScheduler()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Next.js request-lifecycle error hook. Reports Server Component render
// errors, middleware errors, and other request errors that bypass route
// handlers entirely.
export const onRequestError = Sentry.captureRequestError
