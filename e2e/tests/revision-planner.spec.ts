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

test.describe('Revision planner', () => {
  test('student can access revision planner', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto('/revision')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('teacher cannot access revision planner', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await gotoCommit(page, '/revision')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/revision/)
  })

  test('parent cannot access revision planner', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await gotoCommit(page, '/revision')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/revision/)
  })

  test('senco cannot access revision planner', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await gotoCommit(page, '/revision')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/revision/)
  })
})
