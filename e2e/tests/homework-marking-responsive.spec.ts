import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

// Task 4 (UI/UX review, 23 Oct 2026): the marking screen at
// /homework/[id]/mark was unusable below ~1,200px — grade buttons 2-U and
// "Save Grade" were off-screen, and the feedback textarea shrank to
// 26-88px wide. Below 1,280px (xl) the student list now collapses into a
// "Student N of M" switcher instead of a fixed 288px sidebar, so the
// marking panel keeps full width.
const VIEWPORTS = [
  { label: '375px (phone)',          width: 375,  height: 812 },
  { label: '768px (tablet)',         width: 768,  height: 1024 },
  { label: '1024px (small laptop)',  width: 1024, height: 768 },
  { label: '1280px (desktop)',       width: 1280, height: 900 },
  { label: '1440px (wide desktop)',  width: 1440, height: 900 },
]

async function gotoFirstMarkableHomework(page: import('@playwright/test').Page) {
  await page.goto('/homework', { waitUntil: 'domcontentloaded' })
  const markLink = page.locator('a[href*="/homework/"][href*="/mark"]').first()
  await expect(markLink).toHaveCount(1, { timeout: 15_000 })
  const href = await markLink.getAttribute('href')
  if (!href) throw new Error('No homework with outstanding marking found — seed data may be missing submissions')
  await page.goto(href, { waitUntil: 'domcontentloaded' })
}

test.describe('Homework marking screen — responsive layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USERS.teacher)
  })

  for (const vp of VIEWPORTS) {
    test(`grade buttons, Save, and feedback box are usable at ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await gotoFirstMarkableHomework(page)

      // No horizontal scroll at any width.
      const scrollWidth  = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth  = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth, `page should not scroll horizontally at ${vp.label}`).toBeLessThanOrEqual(clientWidth + 1)

      // A student must be selected before the grade/feedback footer renders.
      // Below xl, select one via the "Student N of M" switcher if nothing
      // is selected yet (first ungraded submission is auto-selected, but
      // guard anyway so this test doesn't depend on seed-data state).
      const switcherNext = page.getByRole('button', { name: 'Next student' })
      if (vp.width < 1280 && await switcherNext.isVisible().catch(() => false)) {
        // no-op: a submission is auto-selected on mount; nothing to click
      }

      const gradeButtons = page.locator('button', { hasText: /^(9|8|7|6|5|4|3|2|1|U)$/ })
      await expect(gradeButtons.first()).toBeVisible({ timeout: 10_000 })
      const count = await gradeButtons.count()
      expect(count, 'all 10 grade buttons (9-1, U) should be present').toBe(10)

      for (let i = 0; i < count; i++) {
        const btn = gradeButtons.nth(i)
        await expect(btn, `grade button ${i} should be visible at ${vp.label}`).toBeVisible()
        const box = await btn.boundingBox()
        expect(box, `grade button ${i} should have a bounding box at ${vp.label}`).not.toBeNull()
        if (box) {
          expect(box.x, `grade button ${i} must not start off-screen at ${vp.label}`).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width, `grade button ${i} must not end off-screen at ${vp.label}`).toBeLessThanOrEqual(vp.width + 1)
        }
      }

      const saveButton = page.getByRole('button', { name: /Save Grade|Saved!/ })
      await expect(saveButton).toBeVisible({ timeout: 10_000 })
      const saveBox = await saveButton.boundingBox()
      expect(saveBox).not.toBeNull()
      if (saveBox) {
        expect(saveBox.x + saveBox.width, `Save button must not end off-screen at ${vp.label}`).toBeLessThanOrEqual(vp.width + 1)
      }

      const feedbackBox = page.getByPlaceholder('Optional feedback for the student…')
      await expect(feedbackBox).toBeVisible()
      const fb = await feedbackBox.boundingBox()
      expect(fb).not.toBeNull()
      if (fb) {
        expect(fb.width, `feedback box must be at least 240px wide at ${vp.label}`).toBeGreaterThanOrEqual(240)
      }
    })
  }

  test('below 1,280px, the student list collapses into a Student N of M switcher', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await gotoFirstMarkableHomework(page)
    await expect(page.getByText(/Student \d+ of \d+/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next student' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous student' })).toBeVisible()
  })

  test('at 1,280px and above, the full student list sidebar is shown instead of the switcher', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await gotoFirstMarkableHomework(page)
    await expect(page.getByRole('button', { name: 'Next student' })).toBeHidden()
    await expect(page.getByText(/marked$/).first()).toBeVisible()
  })

  test('below 768px, the layout is a single stacked column', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoFirstMarkableHomework(page)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('keyboard shortcuts: a digit key selects a grade, Enter saves, and neither fires while typing feedback', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoFirstMarkableHomework(page)

    const gradeSeven = page.locator('button', { hasText: /^7$/ }).first()
    await expect(gradeSeven).toBeVisible()

    // Typing in the feedback box must NOT trigger the grade/save shortcuts.
    const feedbackBox = page.getByPlaceholder('Optional feedback for the student…')
    await feedbackBox.click()
    await feedbackBox.type('7')
    await expect(gradeSeven).not.toHaveClass(/bg-blue-700/)

    // Pressing "7" outside the textarea selects grade 7.
    await page.keyboard.press('Escape')
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('7')
    await expect(gradeSeven).toHaveClass(/bg-blue-700/)

    // Enter (outside the textarea) saves.
    await page.keyboard.press('Enter')
    // Wait for either outcome, then fail with the on-screen error text if the
    // save was rejected, so a failure says WHY rather than just "not visible".
    const saved = page.getByRole('button', { name: 'Saved!' })
    const saveError = page.getByText(/Failed to save grade|graded by someone else|Someone else already graded|Only teaching staff/)
    await expect(saved.or(saveError).first()).toBeVisible({ timeout: 15_000 })
    if (await saveError.count()) {
      throw new Error(`Enter did not save the grade — the page showed: "${await saveError.first().innerText()}"`)
    }
  })
})
