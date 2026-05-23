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

test.describe('Wonde MIS Sync — access control', () => {
  test('school admin login succeeds', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('SLT can access Wonde sync panel', async ({ page }) => {
    test.setTimeout(60_000)
    await loginAs(page, USERS.slt)
    await page.goto('/admin/wonde', { waitUntil: 'domcontentloaded' })
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByText('MIS Sync (Wonde)')).toBeVisible({ timeout: 15_000 })
  })

  test('teacher is redirected away from Wonde sync panel', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await gotoCommit(page, '/admin/wonde')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/wonde/)
  })

  test('student is redirected away from Wonde sync panel', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/admin/wonde')
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/admin\/wonde/)
  })
})

test.describe('Wonde MIS Sync — panel content', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USERS.slt)
  })

  test('panel shows Wonde School ID label', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/admin/wonde', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Wonde School ID')).toBeVisible({ timeout: 15_000 })
  })

  test('panel shows a sync button', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/admin/wonde', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /sync/i }).first()).toBeVisible({ timeout: 15_000 })
  })
})
