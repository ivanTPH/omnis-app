import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'
import { SidebarPage } from '../pages/SidebarPage'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch {
    // cross-port redirect or timeout
  }
}

test.describe('Student flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USERS.student)
  })

  test('student lands on student dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/student\/dashboard/, { timeout: 10_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('student bottom nav shows student nav items', async ({ page }) => {
    // Student uses a mobile layout with a bottom <nav> (Home, Alerts, Progress, Messages)
    await expect(page.locator('nav')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: 'Home' }).first()).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('button', { name: 'Messages' }).first()).toBeVisible({ timeout: 8_000 })
  })

  test('student cannot access SLT analytics', async ({ page }) => {
    // /slt is restricted to SLT/SCHOOL_ADMIN/PLATFORM_ADMIN — student should be redirected
    await gotoCommit(page, '/slt/analytics')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/slt\/analytics/)
  })

  test('student redirected away from /admin routes', async ({ page }) => {
    await gotoCommit(page, '/admin/users')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/admin\//)
  })

  test('student redirected away from /send routes', async ({ page }) => {
    await gotoCommit(page, '/send/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/send\/dashboard/)
  })

  test('student can access settings', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })
})
