import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'
import { SidebarPage } from '../pages/SidebarPage'

test.describe('Teacher flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USERS.patel)
  })

  test('teacher sees dashboard/calendar', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
    // Calendar or weekly view should be present
    await expect(page.locator('body')).toBeVisible()
  })

  test('teacher sidebar has expected nav items', async ({ page }) => {
    const sidebar = new SidebarPage(page)
    await sidebar.expectNavItem('Calendar')
    await sidebar.expectNavItem('Homework')
    await sidebar.expectNavItem('Classes')
  })

  test('teacher can navigate to homework list', async ({ page }) => {
    await page.goto('/homework')
    await expect(page.locator('body')).toBeVisible()
    // Should show homework content or empty state — not redirected to login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('teacher can navigate to classes page', async ({ page }) => {
    await page.goto('/classes')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('teacher can navigate to analytics', async ({ page }) => {
    await page.goto('/analytics/students')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('teacher can navigate to settings', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('teacher sidebar does not show student routes', async ({ page }) => {
    const sidebar = new SidebarPage(page)
    await sidebar.expectNoNavItem('My Homework')
    await sidebar.expectNoNavItem('My Grades')
  })
})
