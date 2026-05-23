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

test.describe('Revision Program — teacher access', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USERS.patel)
  })

  test('teacher can access revision program list', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/revision-program')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('revision program list shows New Program button', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/revision-program')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: /new program/i })).toBeVisible({ timeout: 10_000 })
  })

  test('teacher can navigate to create new revision program', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/revision-program/new')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('teacher can access year revision route', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/revision-program/year')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Revision Program — access control', () => {
  test('student cannot access revision program list', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/revision-program')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/revision-program/)
  })

  test('parent cannot access revision program list', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await gotoCommit(page, '/revision-program')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/revision-program/)
  })

  test('teacher cannot access student revision planner', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await gotoCommit(page, '/student/revision')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/student\/revision/)
  })
})

test.describe('Revision Program — student view', () => {
  test('student can access their revision tasks at /student/revision', async ({ page }) => {
    test.setTimeout(60_000)
    await loginAs(page, USERS.student)
    await page.goto('/student/revision', { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Revision Program — HOD access', () => {
  test('HOD can access revision program list', async ({ page }) => {
    test.setTimeout(60_000)
    await loginAs(page, USERS.hod)
    await page.goto('/revision-program')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })
})
