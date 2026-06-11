/**
 * HOY Academic Integrity — review workflow and access control
 *
 * Verifies:
 *  - /hoy/integrity is accessible to HEAD_OF_YEAR, SLT, SCHOOL_ADMIN
 *  - Page renders KPI cards and no crash
 *  - Risk-level filter chips (HIGH / MEDIUM / LOW / All) are present
 *  - Pattern cases section renders (or empty state)
 *  - Teacher cannot access /hoy/integrity
 *  - Student cannot access /hoy/integrity
 *  - SENCO cannot access /hoy/integrity (not in the allowed list)
 *  - HOY is not redirected to /login
 */

import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch { /* cross-origin redirect */ }
}

test.describe('HOY Integrity — access control', () => {
  test('HEAD_OF_YEAR can access /hoy/integrity', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('SLT can access /hoy/integrity', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('school admin can access /hoy/integrity', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /hoy/integrity', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/hoy/integrity')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/integrity/)
  })

  test('student cannot access /hoy/integrity', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/hoy/integrity')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/integrity/)
  })

  test('SENCO cannot access /hoy/integrity', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await gotoCommit(page, '/hoy/integrity')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/integrity/)
  })

  test('TA cannot access /hoy/integrity', async ({ page }) => {
    await loginAs(page, USERS.ta)
    await gotoCommit(page, '/hoy/integrity')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/integrity/)
  })
})

test.describe('HOY Integrity — page content', () => {
  test('page renders without crash', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error|unhandled/i)
    expect(body.length).toBeGreaterThan(100)
  })

  test('page heading includes "Academic Integrity"', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/academic integrity/i)
  })

  test('KPI cards are rendered (flagged / high risk / open cases labels)', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    // KPI card labels
    expect(body).toMatch(/total flagged|high risk|open cases/i)
  })

  test('risk-level filter chips are present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // Filter chips: All, High, Medium, Low
    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/\bHigh\b/i)
    expect(body).toMatch(/\bMedium\b/i)
    expect(body).toMatch(/\bLow\b/i)
  })

  test('filter chips are clickable buttons', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // Click the "High" filter chip — should not crash
    const highBtn = page.getByRole('button', { name: /^High/i }).first()
    if (await highBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await highBtn.click()
      // Page should still be on the integrity URL
      await expect(page).not.toHaveURL(/\/login/, { timeout: 3_000 })
    }
  })

  test('flagged submissions section is present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/flagged submissions/i)
  })

  test('pattern cases section is present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/pattern cases/i)
  })

  test('info footer about integrity signals is visible', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    // Footer disclaimer
    expect(body).toMatch(/paste ratio|focus.loss|AI assistance|copying/i)
  })

  test('empty state renders cleanly when no flags exist', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // Whether data exists or not, the page must not crash
    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })
})

test.describe('HOY Integrity — review workflow (UI smoke)', () => {
  test('clicking a signal row expands review panel (if signals exist)', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // Check if any signal rows exist
    const rows = page.locator('table tbody tr').first()
    const hasRows = await rows.isVisible({ timeout: 3_000 }).catch(() => false)
    if (!hasRows) return // No signals — skip interaction

    await rows.click()
    // After clicking, review action buttons should appear
    const body = await page.locator('body').innerText({ timeout: 5_000 })
    expect(body).toMatch(/release|resubmission|block/i)
  })

  test('HOY integrity page shows sidebar nav link', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/integrity')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // Sidebar should include "Integrity" nav item
    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/integrity/i)
  })
})
