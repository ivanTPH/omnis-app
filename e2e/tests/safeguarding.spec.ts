/**
 * Safeguarding Log — block 37
 *
 * Verifies:
 *  - /hoy/safeguarding: access control (HOY/SENCO/SLT/admin can access; teacher/student/parent cannot)
 *  - Page renders KPI cards and section tabs without error
 *  - Log modal opens and validates required fields
 *  - /api/export/safeguarding-log: returns PDF (HOY/SENCO/SLT/admin only)
 */

import { test, expect } from '@playwright/test'
import { loginAs }      from '../helpers/auth'
import { USERS }        from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch { /* cross-origin redirect */ }
}

// ── Access control ────────────────────────────────────────────────────────────

test.describe('Safeguarding Log — access control', () => {
  test('HEAD_OF_YEAR can access /hoy/safeguarding', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText('Safeguarding', { timeout: 10_000 })
  })

  test('SENCO can access /hoy/safeguarding', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText('Safeguarding', { timeout: 10_000 })
  })

  test('SLT can access /hoy/safeguarding', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('school admin can access /hoy/safeguarding', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /hoy/safeguarding', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/hoy/safeguarding')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/safeguarding/)
  })

  test('student cannot access /hoy/safeguarding', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/hoy/safeguarding')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/safeguarding/)
  })

  test('parent cannot access /hoy/safeguarding', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await gotoCommit(page, '/hoy/safeguarding')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/safeguarding/)
  })
})

// ── Page content ──────────────────────────────────────────────────────────────

test.describe('Safeguarding Log — page content', () => {
  test('KPI stat cards render', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 12_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    // KPI cards
    expect(body).toMatch(/total|open|referred|critical/i)
  })

  test('section tab buttons are present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.getByRole('button', { name: /open/i }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /referred/i }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /monitoring/i }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /closed/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('"Log concern" button opens modal', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await page.getByRole('button', { name: /log concern/i }).click()
    await expect(page.getByRole('heading', { name: /log safeguarding concern/i })).toBeVisible({ timeout: 6_000 })
  })

  test('log modal validates required fields', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await page.getByRole('button', { name: /log concern/i }).click()
    await expect(page.getByRole('heading', { name: /log safeguarding concern/i })).toBeVisible({ timeout: 6_000 })

    // Submit without filling anything — should show validation error
    await page.getByRole('button', { name: /^log concern$/i }).last().click()
    const body = await page.locator('body').innerText()
    expect(body).toMatch(/student id required|description required|required/i)
  })

  test('modal can be closed with Cancel', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await page.getByRole('button', { name: /log concern/i }).click()
    await expect(page.getByRole('heading', { name: /log safeguarding concern/i })).toBeVisible({ timeout: 6_000 })
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('heading', { name: /log safeguarding concern/i })).not.toBeVisible({ timeout: 4_000 })
  })

  test('section tabs switch the displayed list', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.getByRole('button', { name: /referred/i }).first()).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /referred/i }).first().click()
    // page should not error after tab switch
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })

  test('export PDF link is present for HOY', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/safeguarding')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const exportLink = page.locator('a[href="/api/export/safeguarding-log"]')
    await expect(exportLink).toBeVisible({ timeout: 10_000 })
  })
})

// ── PDF export ────────────────────────────────────────────────────────────────

test.describe('Safeguarding Log — PDF export', () => {
  test('/api/export/safeguarding-log returns PDF for HOY', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    const resp = await page.request.get('/api/export/safeguarding-log')
    expect(resp.status()).toBe(200)
    expect(resp.headers()['content-type']).toContain('application/pdf')
  })

  test('/api/export/safeguarding-log returns PDF for SENCO', async ({ page }) => {
    await loginAs(page, USERS.senco)
    const resp = await page.request.get('/api/export/safeguarding-log')
    expect(resp.status()).toBe(200)
    expect(resp.headers()['content-type']).toContain('application/pdf')
  })

  test('/api/export/safeguarding-log is forbidden for teacher', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    const resp = await page.request.get('/api/export/safeguarding-log')
    expect(resp.status()).toBe(403)
  })

  test('/api/export/safeguarding-log is forbidden for student', async ({ page }) => {
    await loginAs(page, USERS.student)
    const resp = await page.request.get('/api/export/safeguarding-log')
    expect(resp.status()).toBe(403)
  })
})
