import { chromium } from '@playwright/test'
import { USERS } from './fixtures/users'

/**
 * Pre-warm the Vercel deployment before the test suite runs.
 * Logs in as the three most-used roles so the auth + route handlers
 * are hot for all subsequent tests.
 * Only runs when PLAYWRIGHT_BASE_URL is set (i.e. against Vercel, not localhost).
 */
export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) return

  console.log('[global-setup] Warming Vercel deployment at', baseURL)

  const browser = await chromium.launch()

  async function warmUser(email: string, password: string, label: string) {
    const page = await browser.newPage()
    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await page.fill('input[type="email"]', email)
      await page.fill('input[type="password"]', password)
      await page.click('button[type="submit"]')
      await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 120_000 })
      console.log(`[global-setup] warmed: ${label}`)
    } catch (err) {
      console.warn(`[global-setup] warm failed for ${label}:`, (err as Error).message.slice(0, 80))
    } finally {
      await page.close()
    }
  }

  // Warm the most-used login paths sequentially so functions are hot
  await warmUser(USERS.teacher.email,     USERS.teacher.password,     'teacher')
  await warmUser(USERS.senco.email,       USERS.senco.password,       'senco')
  await warmUser(USERS.slt.email,         USERS.slt.password,         'slt')
  await warmUser(USERS.schoolAdmin.email, USERS.schoolAdmin.password, 'schoolAdmin')
  await warmUser(USERS.student.email,     USERS.student.password,     'student')

  await browser.close()
  console.log('[global-setup] warm-up complete')
}
