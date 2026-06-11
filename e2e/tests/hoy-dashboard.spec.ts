/**
 * HOY Pastoral Dashboard — /hoy/dashboard
 *
 * Verifies:
 *  - HEAD_OF_YEAR is routed to /hoy/dashboard on login
 *  - SLT and SCHOOL_ADMIN can also access /hoy/dashboard
 *  - Teacher, student, SENCO cannot access /hoy/dashboard
 *  - Page renders KPI cards without crash
 *  - Page includes key section labels
 *  - Print button is visible
 */

import { test, expect } from '@playwright/test'
import { loginAs }      from '../helpers/auth'
import { USERS }        from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch { /* cross-origin redirect */ }
}

test.describe('HOY Dashboard — access control', () => {
  test('HEAD_OF_YEAR lands on /hoy/dashboard after login', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    expect(page.url()).toMatch(/\/hoy\/dashboard/)
  })

  test('HEAD_OF_YEAR can access /hoy/dashboard directly', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('SLT can access /hoy/dashboard', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('school admin can access /hoy/dashboard', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /hoy/dashboard', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/hoy/dashboard')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/dashboard/)
  })

  test('student cannot access /hoy/dashboard', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/hoy/dashboard')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/dashboard/)
  })

  test('SENCO cannot access /hoy/dashboard', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await gotoCommit(page, '/hoy/dashboard')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/dashboard/)
  })
})

test.describe('HOY Dashboard — page content', () => {
  test('page renders without crash', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error|unhandled/i)
    expect(body.length).toBeGreaterThan(100)
  })

  test('greeting and year group label are visible', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/good morning|good afternoon|good evening/i)
  })

  test('KPI cards are present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/students/i)
    expect(body).toMatch(/send register|open concerns|reviews due|low attendance/i)
  })

  test('quick action links are present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/year analytics/i)
    expect(body).toMatch(/integrity/i)
  })

  test('attendance panel is present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/low attendance/i)
  })

  test('SEND concerns panel is present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/open send concerns/i)
  })

  test('homework pulse section is present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/homework pulse/i)
  })

  test('print button is rendered', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const printBtn = page.getByRole('button', { name: /print/i }).first()
    await expect(printBtn).toBeVisible({ timeout: 5_000 })
  })

  test('sidebar shows Dashboard link pointing to /hoy/dashboard', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const dashLink = page.locator('a[href="/hoy/dashboard"]').first()
    await expect(dashLink).toBeVisible({ timeout: 5_000 })
  })
})
