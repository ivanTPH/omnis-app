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

test.describe('Adaptive homework', () => {
  test('teacher sees homework list', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await page.goto('/homework')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('adaptive analytics page is accessible to teacher', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await page.goto('/analytics/adaptive')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.getByText('Adaptive Learning', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('student cannot access adaptive analytics', async ({ page }) => {
    await loginAs(page, USERS.student)
    // /analytics is restricted to staff roles — student should be redirected
    await gotoCommit(page, '/analytics/adaptive')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/analytics\/adaptive/)
  })

  test('student can access student dashboard', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto('/student/dashboard')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('senco can access analytics routes', async ({ page }) => {
    // SENCO is included in the /analytics allow-list in auth.config.ts
    await loginAs(page, USERS.senco)
    await page.goto('/analytics/adaptive')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })
})
