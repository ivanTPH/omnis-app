import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "font-src 'self' https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these server-only packages.
  // @sparticuz/chromium includes a native Chromium binary; puppeteer/puppeteer-core
  // must also be external so they can resolve the binary path at runtime.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core', 'puppeteer'],

  // Ensure the Chromium binary assets (Brotli-compressed) are included in every
  // PDF export Lambda bundle. Next.js's file tracer only follows JS imports, so
  // the .br binary files would otherwise be omitted from the Vercel deployment.
  outputFileTracingIncludes: {
    '/api/export/**': ['./node_modules/@sparticuz/chromium/bin/**'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent:  true,       // suppress CLI output in CI
  disableLogger: true, // tree-shake Sentry logger from client bundle
  // Only upload source maps when SENTRY_AUTH_TOKEN is set
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: false,
})
