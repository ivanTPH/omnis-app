import { Page } from '@playwright/test'
import { UserFixture } from '../fixtures/users'

export async function loginAs(page: Page, user: UserFixture): Promise<void> {
  await page.goto('/login')
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')
  // Wait for redirect away from login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 })
}

export async function logout(page: Page): Promise<void> {
  // Navigate away cleanly
  await page.goto('/login')
}
