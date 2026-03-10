import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch {
    // cross-port redirect or timeout — check URL below
  }
}

// Note: platform admin credentials may not exist in all seed environments.
// These tests verify that non-platform-admin roles are blocked from /platform-admin routes.

test.describe('Platform admin flows', () => {
  test('teacher cannot access platform-admin routes', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await gotoCommit(page, '/platform-admin/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/platform-admin\//)
  })

  test('senco cannot access platform-admin routes', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await gotoCommit(page, '/platform-admin/schools')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/platform-admin\//)
  })

  test('student cannot access platform-admin routes', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/platform-admin/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/platform-admin\//)
  })

  test('school admin cannot access platform-admin routes', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await gotoCommit(page, '/platform-admin/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/platform-admin\//)
  })
})
