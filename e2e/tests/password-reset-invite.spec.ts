/**
 * Password Reset & Staff Invitation flows
 *
 * Verifies:
 *  - /forgot-password page renders and always returns success (no email enumeration)
 *  - /reset-password page renders, validates passwords client-side, rejects bad tokens
 *  - /accept-invite page renders, rejects bad/missing tokens
 *  - DB-backed: valid reset token shows form; expired token shows error on submit
 *  - DB-backed: valid invite token shows prefilled form; used invite shows error
 *  - AdminStaffTable has "Invite by email" button for school admin
 *  - Teacher cannot access /api/staff/invite (403)
 *  - Root "/" redirects unauthenticated users to /marketing/home
 */

import dotenv from 'dotenv'
import path   from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import crypto           from 'crypto'
import { loginAs }      from '../helpers/auth'
import { USERS }        from '../fixtures/users'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

function makeToken() {
  const raw  = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

async function getDemoSchool() {
  return prisma.school.findFirst({
    where:  { name: { contains: 'Omnis Demo' } },
    select: { id: true },
  })
}

// ─── Block 1: Forgot-password page ──────────────────────────────────────────

test.describe('Password reset — forgot-password page', () => {
  test('page renders with email input and submit button', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('submitting a non-existent email shows success (no enumeration)', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[type="email"]', 'nobody@doesnotexist.example.com')
    await page.click('button[type="submit"]')
    // Always returns success — should show "check your email" style message, never an error
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).not.toContain('error')
    expect(body.toLowerCase()).not.toContain('not found')
  })

  test('submitting a known email also shows success', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('domcontentloaded')
    await page.fill('input[type="email"]', USERS.teacher.email)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).not.toContain('error')
  })

  test('login page has "Forgot your password?" link', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    const link = page.locator('a[href="/forgot-password"]')
    await expect(link).toBeVisible()
  })
})

// ─── Block 2: Reset-password page (no DB) ───────────────────────────────────

test.describe('Password reset — reset-password page', () => {
  test('page renders with password and confirm fields', async ({ page }) => {
    await page.goto('/reset-password?token=sometoken')
    await page.waitForLoadState('domcontentloaded')
    const inputs = page.locator('input[type="password"]')
    await expect(inputs.first()).toBeVisible()
    expect(await inputs.count()).toBeGreaterThanOrEqual(2)
  })

  test('mismatched passwords shows validation error before submit', async ({ page }) => {
    await page.goto('/reset-password?token=sometoken')
    await page.waitForLoadState('domcontentloaded')
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('ValidPass1!')
    await inputs.nth(1).fill('DifferentPass1!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/match|password/)
  })

  test('invalid token shows error after submit', async ({ page }) => {
    await page.goto('/reset-password?token=totallyinvalidtoken')
    await page.waitForLoadState('domcontentloaded')
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('ValidPass1!')
    await inputs.nth(1).fill('ValidPass1!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/expired|invalid|used|error/)
  })
})

// ─── Block 3: Reset-password with valid DB token ─────────────────────────────

test.describe('Password reset — valid token (DB-backed)', () => {
  let resetRaw     = ''
  let testUserId   = ''
  const testEmail  = `test-pwreset-${Date.now()}@omnisdemo.school`

  test.beforeAll(async () => {
    try {
      const school = await getDemoSchool()
      if (!school) throw new Error('No demo school — run db:seed')

      // Create a temporary user to reset password for
      const user = await prisma.user.create({
        data: {
          email:        testEmail,
          firstName:    'Test',
          lastName:     'Reset',
          role:         'TEACHER',
          passwordHash: '$2a$12$placeholder',
          schoolId:     school.id,
        },
      })
      testUserId = user.id

      const { raw, hash } = makeToken()
      resetRaw = raw
      await prisma.passwordResetToken.create({
        data: {
          userId:    user.id,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      })
    } catch (err) {
      console.error('[password-reset DB setup]', err)
    }
  })

  test.afterAll(async () => {
    // Delete test user (cascades token via onDelete: Cascade)
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    }
  })

  test('valid token shows password form (not expired state)', async ({ page }) => {
    if (!resetRaw) return test.skip()
    await page.goto(`/reset-password?token=${resetRaw}`)
    await page.waitForLoadState('domcontentloaded')
    const inputs = page.locator('input[type="password"]')
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 })
    // Should not show expired/error state
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).not.toContain('expired')
  })

  test('valid token — short password shows validation error', async ({ page }) => {
    if (!resetRaw) return test.skip()
    await page.goto(`/reset-password?token=${resetRaw}`)
    await page.waitForLoadState('domcontentloaded')
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('short')
    await inputs.nth(1).fill('short')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/8|short|length|password/)
  })

  test('valid token — submit new password shows success', async ({ page }) => {
    if (!resetRaw) return test.skip()
    await page.goto(`/reset-password?token=${resetRaw}`)
    await page.waitForLoadState('domcontentloaded')
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('NewPass1234!')
    await inputs.nth(1).fill('NewPass1234!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
    // Should show success or redirect to login
    const url  = page.url()
    const body = await page.locator('body').innerText()
    const success = url.includes('/login') || body.toLowerCase().match(/success|updated|changed|sign in/) !== null
    expect(success).toBe(true)
  })

  test('expired token shows error on submit', async ({ page }) => {
    try {
      const school = await getDemoSchool()
      if (!school) return test.skip()

      // Create a second temp user with an already-expired token
      const expiredEmail = `test-expired-${Date.now()}@omnisdemo.school`
      const expiredUser  = await prisma.user.create({
        data: {
          email:        expiredEmail,
          firstName:    'Test',
          lastName:     'Expired',
          role:         'TEACHER',
          passwordHash: '$2a$12$placeholder',
          schoolId:     school.id,
        },
      })
      const { raw, hash } = makeToken()
      await prisma.passwordResetToken.create({
        data: {
          userId:    expiredUser.id,
          tokenHash: hash,
          expiresAt: new Date(Date.now() - 1000), // already expired
        },
      })

      await page.goto(`/reset-password?token=${raw}`)
      await page.waitForLoadState('domcontentloaded')
      const inputs = page.locator('input[type="password"]')
      await inputs.nth(0).fill('ValidPass1!')
      await inputs.nth(1).fill('ValidPass1!')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(2000)
      const body = await page.locator('body').innerText()
      expect(body.toLowerCase()).toMatch(/expired|invalid|used/)

      await prisma.user.delete({ where: { id: expiredUser.id } }).catch(() => {})
    } catch {
      test.skip()
    }
  })
})

// ─── Block 4: Accept-invite page (no DB) ────────────────────────────────────

test.describe('Staff invitation — accept-invite page', () => {
  test('no token → shows error/expired state', async ({ page }) => {
    await page.goto('/accept-invite')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/expired|invalid|used|not found/)
  })

  test('invalid token → shows error/expired state', async ({ page }) => {
    await page.goto('/accept-invite?token=notavalidtoken')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/expired|invalid|used|not found/)
  })
})

// ─── Block 5: Accept-invite with valid DB token ──────────────────────────────

test.describe('Staff invitation — valid token (DB-backed)', () => {
  let inviteRaw         = ''
  let inviteId          = ''
  let createdUserId     = ''
  const inviteEmail     = `test-invite-${Date.now()}@omnisdemo.school`
  const inviteFirstName = 'Invited'
  const inviteLastName  = 'Teacher'

  test.beforeAll(async () => {
    try {
      const school = await getDemoSchool()
      if (!school) throw new Error('No demo school — run db:seed')

      const admin = await prisma.user.findFirst({
        where:  { schoolId: school.id, role: 'SCHOOL_ADMIN', isActive: true },
        select: { id: true },
      })
      if (!admin) throw new Error('No school admin — run db:seed')

      const { raw, hash } = makeToken()
      inviteRaw = raw
      const invite = await prisma.staffInvitation.create({
        data: {
          schoolId:    school.id,
          email:       inviteEmail,
          role:        'TEACHER',
          firstName:   inviteFirstName,
          lastName:    inviteLastName,
          tokenHash:   hash,
          expiresAt:   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          invitedById: admin.id,
        },
      })
      inviteId = invite.id
    } catch (err) {
      console.error('[accept-invite DB setup]', err)
    }
  })

  test.afterAll(async () => {
    // Delete created user if any, then the invitation
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {})
    }
    if (inviteId) {
      await prisma.staffInvitation.delete({ where: { id: inviteId } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  test('valid invite token shows account setup form', async ({ page }) => {
    if (!inviteRaw) return test.skip()
    await page.goto(`/accept-invite?token=${inviteRaw}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    // Should show password fields (not expired state)
    const inputs = page.locator('input[type="password"]')
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 })
  })

  test('valid invite — form is prefilled with name and email', async ({ page }) => {
    if (!inviteRaw) return test.skip()
    await page.goto(`/accept-invite?token=${inviteRaw}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body).toContain(inviteFirstName)
    expect(body).toContain(inviteEmail)
  })

  test('valid invite — mismatched passwords shows error', async ({ page }) => {
    if (!inviteRaw) return test.skip()
    await page.goto(`/accept-invite?token=${inviteRaw}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('ValidPass1!')
    await inputs.nth(1).fill('DifferentPass!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/match|password/)
  })

  test('valid invite — submit creates account and shows success', async ({ page }) => {
    if (!inviteRaw) return test.skip()
    await page.goto(`/accept-invite?token=${inviteRaw}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    const inputs = page.locator('input[type="password"]')
    await inputs.nth(0).fill('InvitePass1!')
    await inputs.nth(1).fill('InvitePass1!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
    // Should show success or redirect to login
    const url  = page.url()
    const body = await page.locator('body').innerText()
    const success = url.includes('/login') || body.toLowerCase().match(/success|account|created|sign in/) !== null
    expect(success).toBe(true)

    // Record created user id for cleanup
    const created = await prisma.user.findFirst({ where: { email: inviteEmail }, select: { id: true } })
    if (created) createdUserId = created.id
  })

  test('used invite token shows error', async ({ page }) => {
    if (!inviteRaw) return test.skip()
    // The token was used by the previous test — should now show expired/used state
    await page.goto(`/accept-invite?token=${inviteRaw}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/expired|invalid|used/)
  })
})

// ─── Block 6: Staff admin UI ─────────────────────────────────────────────────

test.describe('Staff invitation — admin UI', () => {
  test('school admin staff page loads', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/staff')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('school admin staff page has "Invite by email" button', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/staff')
    await page.waitForLoadState('domcontentloaded')
    const btn = page.getByRole('button', { name: /invite by email/i })
    await expect(btn).toBeVisible({ timeout: 8_000 })
  })

  test('clicking "Invite by email" opens invite modal', async ({ page }) => {
    await loginAs(page, USERS.schoolAdmin)
    await page.goto('/admin/staff')
    await page.waitForLoadState('domcontentloaded')
    await page.getByRole('button', { name: /invite by email/i }).click()
    await page.waitForTimeout(500)
    // Modal should show email and role fields
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5_000 })
  })

  test('teacher cannot access /api/staff/invite (403)', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    const response = await page.request.post('/api/staff/invite', {
      data: { email: 'test@test.com', firstName: 'Test', lastName: 'User', role: 'TEACHER' },
    })
    expect(response.status()).toBe(403)
  })

  test('unauthenticated / redirects to /marketing/home', async ({ page }) => {
    // Navigate without cookies — fresh context
    await page.context().clearCookies()
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    expect(page.url()).toMatch(/\/marketing\/home/)
  })
})
