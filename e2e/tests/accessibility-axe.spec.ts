import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

// Task 7 (UI/UX review, 23 Oct 2026): /login and /marketing/beta had
// unlinked labels, missing autocomplete, un-hidden Material icon spans
// (screen readers read "check_circle" etc. aloud), and icon-only
// buttons/links with no accessible name. Fixed: LoginForm.tsx, BetaForm.tsx,
// ForgotPasswordPage, HomeworkCreatorV2's Set Homework step, and the two
// named icon-only nav elements (mobile menu/notifications). The shared
// Icon component (components/ui/Icon.tsx) was already rendering
// aria-hidden="true" — the violations came from code that bypassed it with
// a raw <span className="material-icons">, so this suite also guards
// against new ones creeping in.
//
// No icon-only-button audit here is exhaustive — there are far more
// expand/collapse icon buttons across the app (84+ expand_more/expand_less
// usages alone) than this phase fixed; this checks the screens named in
// the brief, not every screen in the app.
//
// Not run against a live server from this session — see the other Phase 1
// branches for why (shared production database, no safe dev DB here).

async function expectNoSeriousOrCriticalViolations(page: import('@playwright/test').Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  const seriousOrCritical = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(seriousOrCritical, `${label}: ${seriousOrCritical.map(v => `${v.id} (${v.impact}): ${v.description}`).join('; ')}`).toEqual([])
}

test.describe('Accessibility — no serious/critical axe violations', () => {
  test('public: /login', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expectNoSeriousOrCriticalViolations(page, '/login')
  })

  test('public: /marketing/beta', async ({ page }) => {
    await page.goto('/marketing/beta', { waitUntil: 'domcontentloaded' })
    await expectNoSeriousOrCriticalViolations(page, '/marketing/beta')
  })

  test('public: /marketing/home', async ({ page }) => {
    await page.goto('/marketing/home', { waitUntil: 'domcontentloaded' })
    await expectNoSeriousOrCriticalViolations(page, '/marketing/home')
  })

  const ROLE_HOMES: Array<{ user: keyof typeof USERS; path: string }> = [
    { user: 'teacher',     path: '/dashboard' },
    { user: 'senco',       path: '/senco/dashboard' },
    { user: 'slt',         path: '/slt/analytics' },
    { user: 'hod',         path: '/hod/dashboard' },
    { user: 'hoy',         path: '/hoy/dashboard' },
    { user: 'schoolAdmin', path: '/admin/dashboard' },
    { user: 'student',     path: '/student/dashboard' },
    { user: 'parent',      path: '/parent/dashboard' },
    { user: 'ta',          path: '/ta/notes' },
  ]

  for (const { user, path } of ROLE_HOMES) {
    test(`${user}: ${path}`, async ({ page }) => {
      await loginAs(page, USERS[user])
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expectNoSeriousOrCriticalViolations(page, `${user} ${path}`)
    })
  }

  test('MFA step shows a properly linked, autocompleted one-time-code field', async ({ page }) => {
    // Only meaningful when MFA infra (Upstash) is configured for this
    // staff account — asserts the markup is correct if the step appears,
    // skips otherwise rather than failing on an environment difference.
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', USERS.teacher.email)
    await page.fill('input[type="password"]', USERS.teacher.password)
    await page.click('button[type="submit"]')
    const otpInput = page.locator('#otp-input')
    const mfaAppeared = await otpInput.isVisible({ timeout: 5_000 }).catch(() => false)
    test.skip(!mfaAppeared, 'MFA infra not configured in this environment — nothing to check')
    await expect(otpInput).toHaveAttribute('autocomplete', 'one-time-code')
    await expectNoSeriousOrCriticalViolations(page, '/login (MFA step)')
  })
})
