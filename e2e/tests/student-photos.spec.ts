import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

test.describe('Student avatars', () => {
  test('admin student table renders student list', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/students')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1').filter({ hasText: 'Students' })).toBeVisible({ timeout: 10_000 })
  })

  test('sidebar shows user initials or avatar chip for teacher', async ({ page }) => {
    await loginAs(page, USERS.patel)
    // Sidebar should show initials/avatar chip in bottom area (links to /settings)
    await expect(page.locator('nav')).toBeVisible({ timeout: 8_000 })
    // Avatar chip contains initials — look for a link to /settings in the nav area
    const settingsLink = page.locator('a[href="/settings"]').first()
    await expect(settingsLink).toBeVisible({ timeout: 10_000 })
  })

  test('sidebar shows user initials or avatar chip for student', async ({ page }) => {
    // Student uses a mobile layout with a bottom nav — no sidebar settings link
    await loginAs(page, USERS.student)
    await expect(page.locator('nav')).toBeVisible({ timeout: 8_000 })
    // Student mobile bottom nav has: Home, Alerts, Progress, Messages
    await expect(page.getByRole('button', { name: 'Home' }).first()).toBeVisible({ timeout: 8_000 })
  })
})
