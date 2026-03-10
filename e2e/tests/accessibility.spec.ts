import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

test.describe('Accessibility & settings', () => {
  test('settings page loads for teacher', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await page.goto('/settings')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
    // Settings page has tab-like buttons or headings
    const headingOrTab = page.locator('h1, h2, [role="tab"], button').first()
    await expect(headingOrTab).toBeVisible({ timeout: 8_000 })
  })

  test('settings page has editable fields', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await page.goto('/settings')
    // Wait for page to settle, then check for visible non-hidden form fields
    await page.waitForLoadState('networkidle')
    const visibleInput = page.locator('input:not([type="hidden"]):not([type="file"])').first()
    await expect(visibleInput).toBeVisible({ timeout: 10_000 })
  })

  test('login page is accessible without auth', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('authenticated layout renders content area', async ({ page }) => {
    await loginAs(page, USERS.patel)
    // App shell renders content in a div (no <main> — uses divs)
    await expect(page.locator('body')).toBeVisible()
    // At least a heading or meaningful content should be visible
    const content = page.locator('h1, h2, h3, [class*="calendar"], [class*="dashboard"]').first()
    await expect(content).toBeVisible({ timeout: 8_000 })
  })

  test('student settings accessible', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto('/settings')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })
})
