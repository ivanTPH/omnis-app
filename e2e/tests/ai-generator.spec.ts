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

test.describe('AI resource generator', () => {
  test('teacher can access AI generator', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await page.goto('/ai-generator')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
    // The generator form or shell should be present
    await expect(page.locator('h1, h2, [class*="generator"], form').first()).toBeVisible({ timeout: 10_000 })
  })

  test('senco can access AI generator', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/ai-generator')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('student cannot access AI generator', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/ai-generator')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/ai-generator/)
  })

  test('parent cannot access AI generator', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await gotoCommit(page, '/ai-generator')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/ai-generator/)
  })
})
