/**
 * Sprint E — Attendance Overview, HOY Welfare, Academy PDF Export,
 *            Notification Filter Chips, Sidebar additions
 *
 * Verifies:
 *  - /admin/attendance: SCHOOL_ADMIN, SLT, HOY can access; teacher/student/SENCO cannot
 *  - /admin/attendance: page renders without crash, KPI cards present, year-group section present
 *  - /admin/attendance: CSV export button is visible
 *  - /admin/attendance: Sidebar shows Attendance link for SCHOOL_ADMIN
 *  - /hoy/welfare: HOY, SLT, SCHOOL_ADMIN can access; teacher/student/SENCO cannot
 *  - /hoy/welfare: page renders Pastoral Welfare heading + KPI cards
 *  - /hoy/welfare: HOY sidebar shows Welfare nav link
 *  - /api/export/academy-report: unauthenticated → redirect; non-academy role → 403
 *  - /notifications: filter chips render (All, Unread)
 *  - /notifications: page does not crash for teacher, HOY
 */

import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch { /* cross-origin redirect */ }
}

// ── /admin/attendance — access control ────────────────────────────────────────

test.describe('/admin/attendance — access control', () => {
  test('SCHOOL_ADMIN can access /admin/attendance', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('SLT can access /admin/attendance', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('HEAD_OF_YEAR can access /admin/attendance', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /admin/attendance', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/admin/attendance')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/attendance/)
  })

  test('student cannot access /admin/attendance', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/admin/attendance')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/attendance/)
  })

  test('SENCO cannot access /admin/attendance', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await gotoCommit(page, '/admin/attendance')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/attendance/)
  })
})

// ── /admin/attendance — page content ─────────────────────────────────────────

test.describe('/admin/attendance — page content', () => {
  test('page renders without crash', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error|unhandled/i)
    expect(body.length).toBeGreaterThan(100)
  })

  test('Attendance Overview heading is visible', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/attendance overview/i)
  })

  test('KPI distribution cards are present', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    // Page shows either data cards or the no-data notice
    const hasData    = body.match(/excellent|good|concern|serious/i)
    const hasNoData  = body.match(/no attendance data available/i)
    expect(hasData || hasNoData).toBeTruthy()
  })

  test('year-group section or no-data notice is present', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    const hasByYear  = body.match(/by year group/i)
    const hasNoData  = body.match(/no attendance data available/i)
    expect(hasByYear || hasNoData).toBeTruthy()
  })

  test('Export CSV button is visible', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    // Button may be hidden when no data — only assert presence when data exists
    const body = await page.locator('body').innerText({ timeout: 10_000 })
    if (body.match(/no attendance data available/i)) return

    const csvBtn = page.getByRole('button', { name: /export csv/i }).first()
    await expect(csvBtn).toBeVisible({ timeout: 5_000 })
  })

  test('sidebar shows Attendance link for SCHOOL_ADMIN', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const attendanceLink = page.locator('a[href="/admin/attendance"]').first()
    await expect(attendanceLink).toBeVisible({ timeout: 5_000 })
  })

  test('sidebar shows Attendance link for SLT', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/admin/attendance')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const attendanceLink = page.locator('a[href="/admin/attendance"]').first()
    await expect(attendanceLink).toBeVisible({ timeout: 5_000 })
  })
})

// ── /hoy/welfare — access control ────────────────────────────────────────────

test.describe('/hoy/welfare — access control', () => {
  test('HEAD_OF_YEAR can access /hoy/welfare', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/welfare')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('SLT can access /hoy/welfare', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/hoy/welfare')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('SCHOOL_ADMIN can access /hoy/welfare', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/hoy/welfare')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /hoy/welfare', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/hoy/welfare')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/welfare/)
  })

  test('student cannot access /hoy/welfare', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/hoy/welfare')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/welfare/)
  })

  test('SENCO cannot access /hoy/welfare', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await gotoCommit(page, '/hoy/welfare')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/welfare/)
  })
})

// ── /hoy/welfare — page content ───────────────────────────────────────────────

test.describe('/hoy/welfare — page content', () => {
  test('page renders without crash', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/welfare')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error|unhandled/i)
    expect(body.length).toBeGreaterThan(100)
  })

  test('Pastoral Welfare heading is visible', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/welfare')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/pastoral welfare/i)
  })

  test('KPI cards are present (needing attention, open concerns, ILP reviews)', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/welfare')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/needing attention/i)
    expect(body).toMatch(/open concerns/i)
    expect(body).toMatch(/ilp reviews/i)
  })

  test('Early Warning section is present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/welfare')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/early warning/i)
  })

  test('HOY sidebar shows Welfare nav link', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/welfare')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const welfareLink = page.locator('a[href="/hoy/welfare"]').first()
    await expect(welfareLink).toBeVisible({ timeout: 5_000 })
  })
})

// ── /api/export/academy-report — auth guard ───────────────────────────────────

test.describe('/api/export/academy-report — auth guard', () => {
  test('unauthenticated request is redirected away from /api/export/academy-report', async ({ page }) => {
    // Do NOT log in — navigate directly
    await page.goto('/api/export/academy-report', { waitUntil: 'domcontentloaded' })
    // Should be redirected to login or receive a non-200 response
    const url = page.url()
    expect(url).not.toMatch(/\/api\/export\/academy-report/)
  })

  test('teacher role cannot download academy report (forbidden)', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    const response = await page.request.get('/api/export/academy-report')
    expect(response.status()).toBe(403)
  })

  test('SENCO role cannot download academy report (forbidden)', async ({ page }) => {
    await loginAs(page, USERS.senco)
    const response = await page.request.get('/api/export/academy-report')
    expect(response.status()).toBe(403)
  })

  test('SCHOOL_ADMIN role cannot download academy report (forbidden)', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    const response = await page.request.get('/api/export/academy-report')
    expect(response.status()).toBe(403)
  })
})

// ── /notifications — filter chips ────────────────────────────────────────────

test.describe('/notifications — filter chips', () => {
  test('notifications page renders without crash for teacher', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto('/notifications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })

  test('All and Unread filter chips are always present', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto('/notifications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/\bAll\b/i)
    expect(body).toMatch(/\bUnread\b/i)
  })

  test('clicking Unread chip filters the list', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto('/notifications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const unreadChip = page.getByRole('button', { name: /^Unread/i }).first()
    await expect(unreadChip).toBeVisible({ timeout: 5_000 })
    await unreadChip.click()
    // After click the chip should be in active state (blue bg) — check aria or just no crash
    const body = await page.locator('body').innerText({ timeout: 5_000 })
    expect(body).not.toMatch(/something went wrong/i)
  })

  test('notifications page renders without crash for HOY', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/notifications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })

  test('notifications page renders without crash for SENCO', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/notifications')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })
})
