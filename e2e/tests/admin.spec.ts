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

test.describe('Admin/SLT flows', () => {
  test('SLT login succeeds', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('SLT can access slt analytics', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/analytics')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('SLT can access /admin routes', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/admin/users')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('SLT redirected away from /platform-admin routes', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await gotoCommit(page, '/platform-admin/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/platform-admin\//)
  })

  test('school admin can log in', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('school admin can access admin routes', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/users')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })
})
