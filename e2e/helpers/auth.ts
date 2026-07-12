import { Page } from '@playwright/test'
import { UserFixture } from '../fixtures/users'
import { authStateFile } from '../global-setup'
import * as fs from 'fs'

/** Click through /accept-dpa or /accept-terms if the page lands there.
 *  This handles stale JWT cookies that have dpaAcceptedAt/termsAcceptedAt: null
 *  baked in from a previous test run before the compliance gates were live.
 *  The redesigned gate pages have multiple checkboxes — tick them all. */
async function clearComplianceGate(page: Page): Promise<void> {
  const url = page.url()
  if (!url.includes('/accept-dpa') && !url.includes('/accept-terms')) return
  // Tick all checkboxes (redesigned pages have 2–3 per role)
  const checkboxes = page.locator('input[type="checkbox"]')
  const count = await checkboxes.count()
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check()
  }
  await page.locator('button[type="button"]:not([disabled])').last().click()
  // Wait until we're past the gate (URL no longer contains accept-*)
  await page.waitForURL(url => !url.includes('/accept-dpa') && !url.includes('/accept-terms'), { timeout: 30_000 })
}

export async function loginAs(page: Page, user: UserFixture): Promise<void> {
  // When running against Vercel, inject pre-saved JWT cookies instead of
  // doing form login — avoids Lambda cold-start timeouts on the auth endpoint.
  if (process.env.PLAYWRIGHT_BASE_URL) {
    const stateFile = authStateFile(user.email)
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as {
        cookies: Array<Record<string, unknown>>
      }
      await page.context().addCookies(state.cookies)
      // Navigate to root so the middleware fires the role-home redirect.
      // Tests that do their own page.goto() afterwards will simply re-navigate.
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      // Handle compliance gates if stale JWT has null acceptance dates
      await clearComplianceGate(page)
      return
    }
  }
  // Local dev (or missing state file): fall back to form login
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')
  // 45s — fail fast so Playwright can retry; the Lambda warms up during the retry gap.
  // Warm Lambdas respond in 5-15s; cold ones will be warmer by the next attempt.
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 45_000 })
  await clearComplianceGate(page)
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/login')
}
