import { Page } from '@playwright/test'
import { UserFixture } from '../fixtures/users'

export async function loginAs(page: Page, user: UserFixture): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')
  // Wait for redirect away from login — 30s to handle Vercel cold starts
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 })
}

export async function logout(page: Page): Promise<void> {
  // Navigate away cleanly
  await page.goto('/login')
}
