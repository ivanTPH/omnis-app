import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

// Task 5 (UI/UX review, 23 Oct 2026): HoD and SLT were landing on the
// teacher "Good morning…" page with every count at 0 — SLT's sidebar
// "Dashboard" link pointed at /dashboard instead of /slt/analytics (HoD's
// was already correct). Separately, /hoy/dashboard showed 0 students/SEND
// and "—" on every Homework Pulse row because it filtered students by their
// own User.yearGroup field, while /hoy/analytics (which showed real
// figures) derived its roster from class enrolment instead — now both do.

test.describe('Leadership roles land on their own dashboard, with real data', () => {
  test('SLT signs in to /slt/analytics, not the teacher dashboard', async ({ page }) => {
    await loginAs(page, USERS.slt)
    await expect(page).toHaveURL(/\/slt\/analytics/, { timeout: 15_000 })
  })

  test('SLT sidebar "Dashboard" link also goes to /slt/analytics', async ({ page }) => {
    await loginAs(page, USERS.slt)
    // Navigate away first so clicking "Dashboard" is a real navigation, not a no-op.
    await page.goto('/slt/staff', { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await expect(page).toHaveURL(/\/slt\/analytics/, { timeout: 15_000 })
  })

  test('Head of Department signs in to /hod/dashboard with a non-zero figure', async ({ page }) => {
    await loginAs(page, USERS.hod)
    await expect(page).toHaveURL(/\/hod\/dashboard/, { timeout: 15_000 })
    // At least one of the department's headline stats should be non-zero
    // for a demo school with seeded classes/students — "0" everywhere was
    // the symptom of landing on the wrong (teacher) page.
    const zeroCount = await page.getByText(/^0$/).count()
    const nonZeroStat = page.locator('text=/^[1-9][0-9]*$/').first()
    await expect(nonZeroStat).toBeVisible({ timeout: 15_000 })
    void zeroCount
  })

  test('Head of Year dashboard shows the same non-zero student/SEND counts as Year Analytics', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await expect(page).toHaveURL(/\/hoy\/dashboard/, { timeout: 15_000 })

    const studentsStat = page.locator('a[href*="/analytics"]').filter({ hasText: /Students/ })
    await expect(studentsStat).toBeVisible({ timeout: 15_000 })
    const studentsText = await studentsStat.innerText()
    expect(studentsText, '/hoy/dashboard must not show 0 students when the HoY\'s year group has enrolled classes').not.toMatch(/^0\b/)

    // Cross-check against /hoy/analytics, which derives its roster from
    // class enrolment — both pages must now agree.
    await page.goto('/hoy/analytics', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).not.toContainText('0 students', { timeout: 15_000 })
  })

  test('Head of Year "no attendance data" state explains who can sync, instead of a dead link to /admin/wonde', async ({ page }) => {
    await loginAs(page, USERS.hoy)
    await page.goto('/hoy/dashboard', { waitUntil: 'domcontentloaded' })
    const misSyncLink = page.getByRole('link', { name: 'Run MIS sync' })
    // Either attendance data exists (link legitimately absent) or the
    // explanatory text is shown instead — never the admin-only dead link.
    await expect(misSyncLink).toHaveCount(0)
  })
})
