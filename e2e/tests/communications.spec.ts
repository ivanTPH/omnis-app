/**
 * School Communications — block 37
 *
 * Verifies:
 *  - /admin/communications: access control (HOY/SENCO/SLT/admin can access; teacher/student/parent cannot)
 *  - Page renders communication log without error
 *  - "New communication" modal opens and validates required fields
 *  - /parent/communications: parent can access their inbox
 *  - Parent cannot access /admin/communications
 */

import { test, expect } from '@playwright/test'
import { loginAs }      from '../helpers/auth'
import { USERS }        from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch { /* cross-origin redirect */ }
}

// ── /admin/communications access control ─────────────────────────────────────

test.describe('Admin Communications — access control', () => {
  test('school admin can access /admin/communications', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText(/communication/i, { timeout: 10_000 })
  })

  test('SLT can access /admin/communications', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('HEAD_OF_YEAR can access /admin/communications', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('SENCO can access /admin/communications', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /admin/communications', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/admin/communications')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/communications/)
  })

  test('student cannot access /admin/communications', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/admin/communications')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/communications/)
  })

  test('parent cannot access /admin/communications', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await gotoCommit(page, '/admin/communications')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/communications/)
  })
})

// ── /admin/communications page content ───────────────────────────────────────

test.describe('Admin Communications — page content', () => {
  test('page renders without error', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })

  test('"New communication" button opens compose modal', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await page.getByRole('button', { name: /new communication/i }).click()
    await expect(page.getByRole('heading', { name: /new communication/i })).toBeVisible({ timeout: 6_000 })
  })

  test('compose modal validates required subject field', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await page.getByRole('button', { name: /new communication/i }).click()
    await expect(page.getByRole('heading', { name: /new communication/i })).toBeVisible({ timeout: 6_000 })

    // Try to send without filling subject
    await page.getByRole('button', { name: /^send$/i }).click()
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/subject required|required/i)
  })

  test('compose modal has recipients dropdown', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await page.getByRole('button', { name: /new communication/i }).click()
    await expect(page.getByRole('heading', { name: /new communication/i })).toBeVisible({ timeout: 6_000 })

    // Recipients select should exist with "All parents" as an option
    const select = page.locator('select').first()
    await expect(select).toBeVisible()
    const options = await select.locator('option').allTextContents()
    expect(options.some(o => /all parents/i.test(o))).toBe(true)
  })

  test('compose modal can be cancelled', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await page.getByRole('button', { name: /new communication/i }).click()
    await expect(page.getByRole('heading', { name: /new communication/i })).toBeVisible({ timeout: 6_000 })
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('heading', { name: /new communication/i })).not.toBeVisible({ timeout: 4_000 })
  })
})

// ── /parent/communications access control ─────────────────────────────────────

test.describe('Parent Communications — access control', () => {
  test('parent can access /parent/communications', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await page.goto('/parent/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })

  test('teacher cannot access /parent/communications', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/parent/communications')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/parent\/communications/)
  })

  test('student cannot access /parent/communications', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/parent/communications')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/parent\/communications/)
  })
})

// ── /parent/communications page content ───────────────────────────────────────

test.describe('Parent Communications — inbox content', () => {
  test('parent inbox renders without error', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await page.goto('/parent/communications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    // Should show either messages or empty state
    expect(body).toMatch(/letters home|no communications|from school/i)
  })
})
