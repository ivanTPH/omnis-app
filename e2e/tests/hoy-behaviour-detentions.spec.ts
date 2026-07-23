/**
 * HOY Behaviour, Detentions & Exclusions — blocks 29-31
 *
 * Verifies:
 *  - /hoy/behaviour: access control, KPI cards, trend chart area, year filter, CSV export links
 *  - /hoy/detentions: access control, page renders, log modal trigger
 *  - /hoy/exclusions: access control, page renders, KPI cards
 *  - /api/export/detention-register: returns CSV (HOY only)
 *  - /api/export/exclusion-log: returns CSV (HOY only)
 *  - /api/export/behaviour-summary: returns CSV (HOY only)
 */

import { test, expect } from '@playwright/test'
import { loginAs }      from '../helpers/auth'
import { USERS }        from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch { /* cross-origin redirect */ }
}

// ── /hoy/behaviour ────────────────────────────────────────────────────────────

test.describe('HOY Behaviour Overview — access control', () => {
  test('HEAD_OF_YEAR can access /hoy/behaviour', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/behaviour')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('h1')).toContainText('Behaviour Overview', { timeout: 10_000 })
  })

  test('SLT can access /hoy/behaviour', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/hoy/behaviour')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('school admin can access /hoy/behaviour', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/hoy/behaviour')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /hoy/behaviour', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/hoy/behaviour')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/behaviour/)
  })

  test('student cannot access /hoy/behaviour', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/hoy/behaviour')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/behaviour/)
  })
})

test.describe('HOY Behaviour Overview — page content', () => {
  test('KPI cards render without error', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/behaviour')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    expect(body).toMatch(/students/i)
    expect(body).toMatch(/with exclusion|negative records|positive records/i)
  })

  test('year filter buttons are present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/behaviour')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).toMatch(/all years/i)
    expect(body).toMatch(/year 9|year 10|year 11/i)
  })

  test('CSV export buttons are rendered', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/behaviour')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const behaviourLink = page.locator('a[href*="/api/export/behaviour-summary"]')
    await expect(behaviourLink).toBeVisible({ timeout: 8_000 })

    const detentionLink = page.locator('a[href*="/api/export/detention-register"]')
    await expect(detentionLink).toBeVisible({ timeout: 8_000 })
  })

  test('student table is rendered (or empty state)', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/behaviour')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    // Either a table with students or the empty state message
    const hasTable = body.match(/student|no behaviour data/i)
    expect(hasTable).toBeTruthy()
  })
})

// ── /hoy/detentions ───────────────────────────────────────────────────────────

test.describe('HOY Detentions — access control', () => {
  test('HEAD_OF_YEAR can access /hoy/detentions', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/detentions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.locator('body')).not.toContainText(/something went wrong|unexpected error/i, { timeout: 5_000 })
    await expect(page.locator('body')).toContainText(/detention/i, { timeout: 15_000 })
  })

  test('SLT can access /hoy/detentions', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/hoy/detentions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('school admin can access /hoy/detentions', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/hoy/detentions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /hoy/detentions', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/hoy/detentions')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/detentions/)
  })

  test('student cannot access /hoy/detentions', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/hoy/detentions')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/detentions/)
  })
})

test.describe('HOY Detentions — page content', () => {
  test('page renders detention sections', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/detentions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.locator('body')).not.toContainText(/something went wrong|unexpected error/i, { timeout: 5_000 })
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
  })

  test('log detention button is rendered', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/detentions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const logBtn = page.getByRole('button', { name: /log detention/i }).first()
    await expect(logBtn).toBeVisible({ timeout: 8_000 })
  })

  test('sidebar shows Detentions link', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/detentions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const sidebarLink = page.locator('a[href="/hoy/detentions"]').first()
    await expect(sidebarLink).toBeVisible({ timeout: 5_000 })
  })
})

// ── /hoy/exclusions ───────────────────────────────────────────────────────────

test.describe('HOY Exclusions — access control', () => {
  test('HEAD_OF_YEAR can access /hoy/exclusions', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/exclusions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.locator('body')).not.toContainText(/something went wrong|unexpected error/i, { timeout: 5_000 })
    await expect(page.locator('body')).toContainText(/exclusion/i, { timeout: 15_000 })
  })

  test('SLT can access /hoy/exclusions', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/hoy/exclusions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('school admin can access /hoy/exclusions', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/hoy/exclusions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
  })

  test('teacher cannot access /hoy/exclusions', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await gotoCommit(page, '/hoy/exclusions')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/exclusions/)
  })

  test('student cannot access /hoy/exclusions', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/hoy/exclusions')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/hoy\/exclusions/)
  })
})

test.describe('HOY Exclusions — page content', () => {
  test('page renders exclusion overview without error', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/exclusions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.locator('body')).not.toContainText(/something went wrong|unexpected error/i, { timeout: 5_000 })
    await expect(page.locator('h1')).toBeVisible({ timeout: 15_000 })
  })

  test('KPI cards are present', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/exclusions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    await expect(page.locator('body')).toContainText(/total|active|fixed.term|internal|permanent/i, { timeout: 15_000 })
  })

  test('log exclusion button is rendered', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/exclusions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const logBtn = page.getByRole('button', { name: /log exclusion/i }).first()
    await expect(logBtn).toBeVisible({ timeout: 8_000 })
  })

  test('sidebar shows Exclusions link', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/exclusions')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const sidebarLink = page.locator('a[href="/hoy/exclusions"]').first()
    await expect(sidebarLink).toBeVisible({ timeout: 5_000 })
  })
})

// ── CSV export routes ─────────────────────────────────────────────────────────

test.describe('Behaviour/Detention/Exclusion CSV exports', () => {
  test('/api/export/detention-register returns CSV for HOY', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    const resp = await page.request.get('/api/export/detention-register')
    expect(resp.status()).toBe(200)
    const ct = resp.headers()['content-type'] ?? ''
    expect(ct).toMatch(/text\/csv/i)
    const body = await resp.text()
    expect(body).toMatch(/Student|Year Group|Type|Reason/i)
  })

  test('/api/export/exclusion-log returns CSV for HOY', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    const resp = await page.request.get('/api/export/exclusion-log')
    expect(resp.status()).toBe(200)
    const ct = resp.headers()['content-type'] ?? ''
    expect(ct).toMatch(/text\/csv/i)
    const body = await resp.text()
    expect(body).toMatch(/Student|Year Group|Type|Reason/i)
  })

  test('/api/export/behaviour-summary returns CSV for HOY', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    const resp = await page.request.get('/api/export/behaviour-summary')
    expect(resp.status()).toBe(200)
    const ct = resp.headers()['content-type'] ?? ''
    expect(ct).toMatch(/text\/csv/i)
    const body = await resp.text()
    expect(body).toMatch(/Student|Year|Positive|Negative/i)
  })

  test('/api/export/detention-register returns 403 for teacher', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    const resp = await page.request.get('/api/export/detention-register')
    expect(resp.status()).toBe(403)
  })

  test('/api/export/exclusion-log returns 403 for student', async ({ page }) => {
    await loginAs(page, USERS.student)
    const resp = await page.request.get('/api/export/exclusion-log')
    expect(resp.status()).toBe(403)
  })
})
