/**
 * Sprint C — Academy Dashboard, SEND & Reports
 *
 * Verifies:
 *  - /academy/* routes are blocked for all demo-school roles
 *    (ACADEMY_ADMIN/PLATFORM_ADMIN are not in the demo seed but we can
 *     verify that non-privileged roles are correctly redirected)
 *  - /academy/schools, /academy/send, /academy/reports blocked for teacher/student/senco/schoolAdmin
 *  - Admin dashboard Sprint C changes: 'Open Concerns' stat renders, no crash
 *  - SLT analytics page is still accessible after Sprint C changes
 */

import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch { /* cross-origin redirect */ }
}

test.describe('Sprint C — /academy/* access control', () => {
  const ACADEMY_ROUTES = [
    '/academy/dashboard',
    '/academy/schools',
    '/academy/send',
    '/academy/reports',
  ]

  for (const route of ACADEMY_ROUTES) {
    test(`teacher blocked from ${route}`, async ({ page }) => {
      await loginAs(page, USERS.teacher)
      await gotoCommit(page, route)
      await page.waitForTimeout(2_000)
      expect(page.url()).not.toMatch(new RegExp(route.replace(/\//g, '\\/')))
    })

    test(`student blocked from ${route}`, async ({ page }) => {
      await loginAs(page, USERS.student)
      await gotoCommit(page, route)
      await page.waitForTimeout(2_000)
      expect(page.url()).not.toMatch(new RegExp(route.replace(/\//g, '\\/')))
    })

    test(`SENCO blocked from ${route}`, async ({ page }) => {
      await loginAs(page, USERS.senco)
      await gotoCommit(page, route)
      await page.waitForTimeout(2_000)
      expect(page.url()).not.toMatch(new RegExp(route.replace(/\//g, '\\/')))
    })

    test(`school admin blocked from ${route}`, async ({ page }) => {
      await loginAs(page, USERS.schoolAdmin)
      await gotoCommit(page, route)
      await page.waitForTimeout(2_000)
      expect(page.url()).not.toMatch(new RegExp(route.replace(/\//g, '\\/')))
    })
  }
})

test.describe('Sprint C — admin dashboard after audit', () => {
  test('admin dashboard loads without crash', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    expect(body.length).toBeGreaterThan(100)
  })

  test('admin dashboard shows Open Concerns stat (not Awaiting Marking)', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    // Sprint C removed 'Awaiting Marking' from admin dashboard; added 'Open Concerns'
    expect(body).toMatch(/concerns/i)
    expect(body).not.toMatch(/awaiting marking/i)
  })

  test('SLT analytics page still works after Sprint C', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/analytics')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
  })

  test('HOY analytics page still works after Sprint C', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/analytics')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })

    const body = await page.locator('body').innerText({ timeout: 10_000 })
    expect(body).not.toMatch(/something went wrong|unexpected error/i)
    expect(body.length).toBeGreaterThan(100)
  })
})
