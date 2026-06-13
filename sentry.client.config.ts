import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Only report real errors — filter noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    /^Network Error/,
    /^AbortError/,
    /Loading chunk/,
  ],
})
