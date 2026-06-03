import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

test.describe('SLT SEND reporting dashboard', () => {
  test('SLT can access SEND reporting dashboard', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/send')
    await expect(page).toHaveURL(/slt\/send/, { timeout: 12000 })
    await expect(page.locator('h1')).toContainText('SEND Reporting', { timeout: 10000 })
  })

  test('SEND dashboard shows register summary cards', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/send')
    await expect(page.locator('text=On SEND register')).toBeVisible({ timeout: 12000 })
    await expect(page.locator('text=SEN Support')).toBeVisible()
    await expect(page.locator('text=With EHCP')).toBeVisible()
    await expect(page.locator('text=Active ILPs')).toBeVisible()
  })

  test('SEND dashboard shows EHCP compliance and ILP coverage', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/send')
    await expect(page.getByRole('heading', { name: 'EHCP Compliance' })).toBeVisible({ timeout: 12000 })
    await expect(page.getByRole('heading', { name: 'ILP Coverage' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Early Warning Flags' })).toBeVisible()
  })

  test('SEND dashboard is not accessible to teacher role', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto('/slt/send')
    await expect(page).not.toHaveURL(/slt\/send/, { timeout: 8000 })
  })

  test('SEND Reporting link appears in SLT sidebar', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await page.goto('/slt/analytics')
    await expect(page.getByRole('link', { name: 'SEND Reporting', exact: true }).first()).toBeVisible({ timeout: 10000 })
  })
})
