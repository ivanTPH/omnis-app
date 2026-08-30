import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.NEXT_PUBLIC_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
  // Filter browser noise — only surface real application errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    /^Network Error/,
    /^AbortError/,
    /Loading chunk/,
    /^Non-Error promise rejection/,
    /^Script error/,
  ],
})

// Reports errors that occur during client-side route/page transitions
// (e.g. a lazy-loaded route chunk or nested layout throwing mid-navigation),
// which the plain Sentry.init() above does not instrument on its own.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
