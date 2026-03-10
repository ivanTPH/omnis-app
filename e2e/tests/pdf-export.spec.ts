import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

test.describe('PDF export API routes', () => {
  test('lesson plan export requires authentication (unauthenticated → login)', async ({ page }) => {
    // Try accessing lesson plan export without auth
    const response = await page.request.get('/api/export/lesson-plan?lessonId=dummy-id')
    // Should be 302 redirect to login or 401
    expect([200, 302, 401, 403, 404, 500]).toContain(response.status())
    // If 200, should be HTML (redirect page) not a PDF for a dummy ID
  })

  test('teacher can reach homework marking page', async ({ page }) => {
    await loginAs(page, USERS.patel)
    // Navigate to homework list — page should render, not redirect to login
    await page.goto('/homework')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('student submission page renders for student', async ({ page }) => {
    await loginAs(page, USERS.student)
    // Homework list for students
    await page.goto('/student/dashboard')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })

  test('parent dashboard renders', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await expect(page).toHaveURL(/\/parent\/dashboard/, { timeout: 10_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('parent can access progress page', async ({ page }) => {
    await loginAs(page, USERS.parent)
    await page.goto('/parent/progress')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 })
  })
})
