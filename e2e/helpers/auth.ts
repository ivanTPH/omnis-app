import { Page } from '@playwright/test'
import { UserFixture } from '../fixtures/users'
import { authStateFile } from '../global-setup'
import * as fs from 'fs'

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
      return
    }
  }
  // Local dev (or missing state file): fall back to form login
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')
  // 120s — Vercel cold-start with Prisma schema generation can take 60-90s
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 120_000 })
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/login')
}
