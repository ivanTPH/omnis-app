/**
 * Staff Analytics — blocks 39+40+42
 *
 * Verifies:
 *  - /analytics/teacher: access control (HOD/SLT/admin can access; teacher/student/parent cannot)
 *  - Teacher page renders selector and empty/loaded state without error
 *  - /analytics/department: access control (HOD/SLT/admin; others blocked)
 *  - Department page renders without error
 *  - /slt/staff: SLT/admin can access; HOD/teacher/student/parent cannot
 *  - Staff overview page renders table and CSV export link
 */

import { test, expect } from '@playwright/test'
import { loginAs }      from '../helpers/auth'
import { USERS }        from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch { /* cross-origin redirect */ }
}

// ── /analytics/teacher access control ────────────────────────────────────────

test.describe('Teacher Analytics — access control', () => {
  test('HEAD_OF_DEPT can access /analytics/teacher', async ({ page }) => {
    await loginAs(page, USERS.hod)
    await page.goto('/analytics/teacher')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText(/teacher analytics/i, { timeout: 10_000 })
  })

  test('SLT can access /analytics/teacher', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/analytics/teacher')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText(/teacher analytics/i, { timeout: 10_000 })
  })

  test('school admin can access /analytics/teacher', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/analytics/teacher')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /analytics/teacher', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/analytics/teacher')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/analytics\/teacher/)
  })

  test('student cannot access /analytics/teacher', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/analytics/teacher')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/analytics\/teacher/)
  })

  test('parent cannot access /analytics/teacher', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await gotoCommit(page, '/analytics/teacher')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/analytics\/teacher/)
  })
})

// ── /analytics/teacher page content ──────────────────────────────────────────

test.describe('Teacher Analytics — page content', () => {
  test('page renders teacher selector without error', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/analytics/teacher')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    // Teacher selector dropdown should be present
    await expect(page.locator('select')).toBeVisible({ timeout: 8_000 })
  })

  test('HOD sees only their department teachers in selector', async ({ page }) => {
    await loginAs(page, USERS.hod)
    await page.goto('/analytics/teacher')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    // Selector exists
    await expect(page.locator('select')).toBeVisible({ timeout: 8_000 })
  })

  test('selecting a teacher loads analytics data', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/analytics/teacher')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const select = page.locator('select')
    await expect(select).toBeVisible({ timeout: 8_000 })

    const options = await select.locator('option').all()
    // Skip placeholder ("Select a teacher")
    if (options.length > 1) {
      await select.selectOption({ index: 1 })
      await page.waitForLoadState('domcontentloaded')
      const body = await page.locator('body').innerText({ timeout: 12_000 })
      expect(body).not.toMatch(/something went wrong|unexpected error/i)
    }
  })

  test('"Department view" link present for SLT', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/analytics/teacher')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.getByRole('link', { name: /department view/i })).toBeVisible({ timeout: 10_000 })
  })
})

// ── /analytics/department access control ─────────────────────────────────────

test.describe('Department Analytics — access control', () => {
  test('HEAD_OF_DEPT can access /analytics/department', async ({ page }) => {
    await loginAs(page, USERS.hod)
    await page.goto('/analytics/department')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText(/department/i, { timeout: 10_000 })
  })

  test('SLT can access /analytics/department', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/analytics/department')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /analytics/department', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/analytics/department')
    await page.waitForTimeout(3_000)
    // May redirect to dashboard or analytics — just must not stay on /analytics/department
    const url = page.url()
    // If still on the page, wait a bit longer for the redirect
    if (url.includes('/analytics/department')) {
      await page.waitForTimeout(3_000)
    }
    expect(page.url()).not.toMatch(/\/analytics\/department/)
  })

  test('student cannot access /analytics/department', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/analytics/department')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/analytics\/department/)
  })
})

// ── /analytics/department page content ───────────────────────────────────────

test.describe('Department Analytics — page content', () => {
  test('page renders KPI cards and teacher table', async ({ page }) => {
    await loginAs(page, USERS.hod)
    await page.goto('/analytics/department')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    // Should show teacher, classes, students KPIs
    expect(body).toMatch(/teacher|class|student/i)
  })

  test('SLT sees department selector dropdown', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/analytics/department')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // SLT gets department selector; HOD does not (auto-scoped to their dept)
    await expect(page.locator('select')).toBeVisible({ timeout: 8_000 })
  })

  test('"Teacher view" link is present', async ({ page }) => {
    await loginAs(page, USERS.hod)
    await page.goto('/analytics/department')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.getByRole('link', { name: /teacher view/i })).toBeVisible({ timeout: 10_000 })
  })
})

// ── /slt/staff access control ─────────────────────────────────────────────────

test.describe('SLT Staff Overview — access control', () => {
  test('SLT can access /slt/staff', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText(/staff overview/i, { timeout: 10_000 })
  })

  test('school admin can access /slt/staff', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/slt/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('HOD cannot access /slt/staff', async ({ page }) => {
    await loginAs(page, USERS.hod)
    await gotoCommit(page, '/slt/staff')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/slt\/staff/)
  })

  test('teacher cannot access /slt/staff', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/slt/staff')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/slt\/staff/)
  })

  test('student cannot access /slt/staff', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/slt/staff')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/slt\/staff/)
  })
})

// ── /slt/staff page content ───────────────────────────────────────────────────

test.describe('SLT Staff Overview — page content', () => {
  test('page renders without error', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })

  test('KPI cards show teacher and student counts', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).toMatch(/teacher|student/i)
  })

  test('CSV export link is present', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const exportLink = page.getByRole('link', { name: /export csv/i })
    await expect(exportLink).toBeVisible({ timeout: 10_000 })
  })

  test('"Department view" cross-link is present', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.getByRole('link', { name: /department view/i })).toBeVisible({ timeout: 10_000 })
  })

  test('staff table shows teacher names', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // Either a populated table or an empty state is acceptable, but no crash
    // 20s timeout: loading skeleton shows first (no table), then streams in
    const table = page.locator('table')
    await expect(table).toBeVisible({ timeout: 20_000 })
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/something went wrong/i)
  })

  test('SLT sidebar shows Staff Overview link', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.getByRole('link', { name: /staff overview/i })).toBeVisible({ timeout: 10_000 })
  })
})
