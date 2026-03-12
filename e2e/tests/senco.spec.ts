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

test.describe('SENCO workflow', () => {
  test('senco can access senco dashboard with SEND content', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/senco/dashboard')
    await expect(page).toHaveURL(/senco\/dashboard/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('senco can view concerns list', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/senco/concerns')
    await expect(page).toHaveURL(/senco\/concerns/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('senco can access ILP list', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/senco/ilp')
    await expect(page).toHaveURL(/senco\/ilp/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('senco can access early warning panel', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/senco/early-warning')
    await expect(page).toHaveURL(/senco\/early-warning/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('senco can access EHCP plans page', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/senco/ehcp')
    await expect(page).toHaveURL(/senco\/ehcp/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('senco can access ILP evidence dashboard', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto('/senco/ilp-evidence')
    await expect(page).toHaveURL(/senco\/ilp-evidence/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('teacher cannot access senco routes', async ({ page }) => {
    await loginAs(page, USERS.patel)
    await gotoCommit(page, '/senco/dashboard')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/senco\/dashboard/)
  })

  test('student cannot access senco routes', async ({ page }) => {
    await loginAs(page, USERS.student)
    await gotoCommit(page, '/senco/concerns')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toMatch(/\/senco\/concerns/)
  })
})
