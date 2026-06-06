import { chromium } from '@playwright/test'
import { USERS } from './fixtures/users'

/**
 * Pre-warm the Vercel deployment before the test suite runs.
 * Logs in as all test roles so the auth + route handlers are hot.
 * Only runs when PLAYWRIGHT_BASE_URL is set (i.e. against Vercel, not localhost).
 *
 * Key constraint: total warmup must finish in < 3 minutes so that the
 * warmed Lambda instances are still hot when tests begin (Vercel evicts
 * idle lambdas after ~5 minutes). Per-user first-pass timeout is 25s —
 * fast enough for a cold start (typically 3–8s) without burning the
 * warmth window on repeated 120s timeouts. Failed roles get a 60s retry.
 */
export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) return

  console.log('[global-setup] Warming Vercel deployment at', baseURL)

  const browser = await chromium.launch()

  async function warmUser(email: string, password: string, label: string, timeoutMs = 25_000): Promise<boolean> {
    const page = await browser.newPage()
    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
      await page.fill('input[type="email"]', email)
      await page.fill('input[type="password"]', password)
      await page.click('button[type="submit"]')
      await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: timeoutMs })
      console.log(`[global-setup] warmed: ${label}`)
      return true
    } catch (err) {
      console.warn(`[global-setup] warm failed for ${label}:`, (err as Error).message.slice(0, 80))
      return false
    } finally {
      await page.close()
    }
  }

  const roles: Array<[string, string, string]> = [
    [USERS.teacher.email,     USERS.teacher.password,     'teacher'],
    [USERS.senco.email,       USERS.senco.password,       'senco'],
    [USERS.slt.email,         USERS.slt.password,         'slt'],
    [USERS.schoolAdmin.email, USERS.schoolAdmin.password, 'schoolAdmin'],
    [USERS.student.email,     USERS.student.password,     'student'],
    [USERS.hoy.email,         USERS.hoy.password,         'hoy'],
    [USERS.ta.email,          USERS.ta.password,          'ta'],
  ]

  // First pass — all roles with short timeout
  const failed: Array<[string, string, string]> = []
  for (const [email, password, label] of roles) {
    const ok = await warmUser(email, password, label)
    if (!ok) failed.push([email, password, label])
  }

  // Retry pass — give cold-start stragglers a second chance
  for (const [email, password, label] of failed) {
    await warmUser(email, password, `${label} (retry)`, 60_000)
  }

  await browser.close()
  console.log('[global-setup] warm-up complete')
}
