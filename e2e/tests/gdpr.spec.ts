import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch {
    // cross-port redirect or timeout — check URL below
  }
}

test.describe('GDPR consent management', () => {
  test('school admin can access GDPR consent page', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/gdpr')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
    // The GDPR admin shell should render some tab or heading
    await expect(page.locator('h1, h2, [role="tab"], button').first()).toBeVisible({ timeout: 10_000 })
  })

  test('slt can access GDPR consent page', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/admin/gdpr')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('teacher cannot access GDPR admin page', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await gotoCommit(page, '/admin/gdpr')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/admin\/gdpr/)
  })

  test('student cannot access GDPR admin page', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/admin/gdpr')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/admin\/gdpr/)
  })
})
