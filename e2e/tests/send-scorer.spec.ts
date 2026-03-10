import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

async function gotoCommit(page: Parameters<typeof loginAs>[0], path: string) {
  try {
    await page.goto(path, { waitUntil: 'commit', timeout: 10_000 })
  } catch {
    // cross-port redirect or timeout
  }
}

test.describe('SENCO / SEND flows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USERS.senco)
  })

  test('SENCO lands on send dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/send\/dashboard/, { timeout: 10_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('SENCO can access SEND dashboard', async ({ page }) => {
    await page.goto('/send/dashboard')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('SENCO can access ILP list', async ({ page }) => {
    await page.goto('/send/ilp')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('SENCO can access review-due page', async ({ page }) => {
    await page.goto('/send/review-due')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('SENCO redirected away from /platform-admin routes', async ({ page }) => {
    await gotoCommit(page, '/platform-admin/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/platform-admin\//)
  })

  test('SENCO redirected away from /revision routes', async ({ page }) => {
    await gotoCommit(page, '/revision')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/revision/)
  })

  test('SENCO can access settings', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })
})
