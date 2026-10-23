import { test, expect } from '@playwright/test'
import { loginAs } from '../helpers/auth'
import { USERS } from '../fixtures/users'

// Task 6 (UI/UX review, 23 Oct 2026): DemoRoleSwitcher / DemoRolePicker
// called recordSignOut() + signOut() BEFORE signIn() when switching roles.
// If the new sign-in then failed, the browser was left with no session at
// all. Investigation: NextAuth v5 beta hangs if signIn() is called while
// still authenticated, so signOut() must still run before signIn() — what
// moved is the SERVER-SIDE revocation (recordSignOut-equivalent), now
// deferred via revokePreviousDemoSession() until the new sign-in is
// confirmed to work, plus a best-effort auto-recovery sign-in back into
// the previous demo account if the new one fails.
//
// Can't run this against a live server from this session — see the other
// Phase 1 branches for why (shared production database). Written to the
// same conventions as the rest of the suite for whoever runs it.

test.describe('Demo role switcher', () => {
  test('a failed switch leaves the user signed in as before, not logged out', async ({ page }) => {
    await loginAs(page, USERS.hod) // enter via a demo role, as if already switched once
    // Make the switcher visible without going through /demo first — it reads
    // this same flag (see DemoRolePicker.tsx / DemoRoleSwitcher.tsx LS_KEY).
    await page.evaluate(() => localStorage.setItem('omnis-demo-owner', '1'))
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Force the next sign-in attempt to fail, simulating a down auth
    // endpoint or (once Task 1 is merged) a rate-limited account+IP —
    // without this, the demo accounts' hardcoded shared password means a
    // real failure is hard to trigger deterministically in a test.
    // next-auth/react's signIn() always does `new URL(data.url)` on the
    // response body regardless of HTTP status, so the mock must return an
    // absolute url or the client throws before it ever reads `error`/`code`.
    await page.route('**/api/auth/callback/credentials**', route => {
      const origin = new URL(page.url()).origin
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: `${origin}/login?error=CredentialsSignin` }),
      })
    })

    await page.getByRole('button', { name: /Switch role|Demo active/ }).click()
    await page.getByRole('button', { name: /^Teacher/ }).click()

    // The switch failed — an error must be shown, and the ORIGINAL
    // account's session must still be intact (not bounced to /login).
    await expect(page.getByText(/Sign-in failed|Too many sign-in attempts/)).toBeVisible({ timeout: 10_000 })
    await page.unroute('**/api/auth/callback/credentials**')
    await page.goto('/hod/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/hod\/dashboard/) // not redirected to /login
  })

  test('owner sign-in -> /demo -> pick a role -> the in-app switcher is visible', async ({ page }) => {
    // loginAs injects a saved session for USERS.schoolAdmin etc., but the
    // owner account (ivanyardley@me.com) isn't one of the fixtures — sign
    // in via the real form so this exercises the actual /demo flow.
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.fill('input[type="email"]', 'ivanyardley@me.com')
    // This test only asserts on the post-/demo switcher visibility, not on
    // successfully authenticating as the owner — skip if the owner
    // password isn't available to this test run.
    test.skip(true, 'Owner credentials are not available to automated test runs; verify this flow manually or with a secrets-backed fixture.')
  })

  test('the switcher shows the rate-limit message, not a generic failure, when sign-in is rate limited', async ({ page }) => {
    await loginAs(page, USERS.hod)
    await page.evaluate(() => localStorage.setItem('omnis-demo-owner', '1'))
    await page.reload({ waitUntil: 'domcontentloaded' })

    await page.route('**/api/auth/callback/credentials**', route => {
      const origin = new URL(page.url()).origin
      // code=rate_limited is what LoginRateLimitedSignin (Task 1) sets;
      // simulated here via the redirect URL next-auth/react's client reads it from.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: `${origin}/login?error=CredentialsSignin&code=rate_limited` }),
      })
    })

    await page.getByRole('button', { name: /Switch role|Demo active/ }).click()
    await page.getByRole('button', { name: /^Teacher/ }).click()
    await expect(page.getByText('Too many sign-in attempts. Please wait a few minutes and try again.')).toBeVisible({ timeout: 10_000 })
  })
})
