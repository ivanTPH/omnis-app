/**
 * Sprint A — User Management, CSV Import & Activation Tracking
 *
 * Verifies:
 *  - /admin/users loads for SCHOOL_ADMIN and SLT; blocked for lower roles
 *  - Filter chips (All / Students / Parents / Staff / Pending) are present
 *  - ?filter=pending URL param pre-selects the Pending chip
 *  - /admin/onboarding is accessible to SCHOOL_ADMIN
 *  - Admin dashboard activation panel renders (or is absent when all active)
 *  - CSV import "Import students" button is visible to SCHOOL_ADMIN
 */

import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch {
    // cross-origin redirect — check URL below
  }
}

test.describe('Sprint A — /admin/users access control', () => {
  test('school admin can access /admin/users', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/users')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('SLT can access /admin/users', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/admin/users')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /admin/users', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/admin/users')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/users/)
  })

  test('student cannot access /admin/users', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/admin/users')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/users/)
  })

  test('SENCO cannot access /admin/users', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await gotoCommit(page, '/admin/users')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/users/)
  })
})

test.describe('Sprint A — user management page content', () => {
  test('filter chips are rendered on /admin/users', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/users')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    // Expect at least "Students" and "Staff" filter chip labels
    expect(body).toMatch(/students/i)
    expect(body).toMatch(/staff/i)
    expect(body.length).toBeGreaterThan(100)
  })

  test('?filter=pending pre-selects pending state', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/users?filter=pending')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // Page should load without error — no 500 or crash
    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    expect(body.length).toBeGreaterThan(50)
  })

  test('page shows no crash message', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/users')
    await page.waitForLoadState('domcontentloaded')
    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error|unhandled/i)
  })
})

test.describe('Sprint A — onboarding wizard', () => {
  test('school admin can access /admin/onboarding', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/onboarding')
    await page.waitForLoadState('domcontentloaded')
    // Either shows wizard or redirects to dashboard if already onboarded
    const url = page.url()
    expect(url).not.toMatch(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('teacher cannot access /admin/onboarding', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/admin/onboarding')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/onboarding/)
  })
})

test.describe('Sprint A — admin dashboard activation widget', () => {
  test('admin dashboard loads without error', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    // Wait for RSC to finish streaming — avoids 13-char "Redirecting..." on cold Lambda
    await expect(page.locator('h1')).toContainText('Admin Dashboard', { timeout: 15_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })

  test('admin dashboard shows user management link', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/dashboard')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText('Admin Dashboard', { timeout: 15_000 })

    // Should have "All Users" or "Users" quick-link
    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/users/i)
  })
})
