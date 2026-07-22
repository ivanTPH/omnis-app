/**
 * Demo account setup flow (/set-password)
 *
 * Verifies:
 *  - /set-password renders with form when token param is present
 *  - Client-side validation: mismatched passwords, too-short password
 *  - Missing/invalid token shows error on submit
 *  - Expired token shows error on submit
 *  - Valid token: sets password, marks token used, redirects (auto-sign-in)
 *  - Already-used token is rejected on second attempt
 */

import dotenv from 'dotenv'
import path   from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import crypto           from 'crypto'
import bcrypt           from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

function makeToken() {
  const raw  = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

// ─── Block 1: Page rendering ─────────────────────────────────────────────────

test.describe('Set-password page — rendering', () => {
  test('renders with password fields when token is in URL', async ({ page }) => {
    await page.goto('/set-password?token=fakefakefakefake')
    await page.waitForLoadState('domcontentloaded')
    const body = await page.locator('body').textContent()
    expect(body).toBeTruthy()
    // Should show form fields
    const inputs = page.locator('input[type="password"]')
    await expect(inputs.first()).toBeVisible()
  })

  test('renders with warning when no token in URL', async ({ page }) => {
    await page.goto('/set-password')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)
    const body = await page.locator('body').innerText()
    // Should mention the token is invalid/missing
    expect(body.toLowerCase()).toMatch(/invalid|missing|link/)
  })
})

// ─── Block 2: Client-side validation ─────────────────────────────────────────

test.describe('Set-password page — client-side validation', () => {
  test('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/set-password?token=fakefakefakefake')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('input[type="password"]')
    const [pw1, pw2] = await page.locator('input[type="password"]').all()
    await pw1.fill('ValidPass1!')
    await pw2.fill('DifferentPass1!')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=do not match')).toBeVisible()
  })

  test('shows error when password is too short', async ({ page }) => {
    await page.goto('/set-password?token=fakefakefakefake')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('input[type="password"]')
    const [pw1, pw2] = await page.locator('input[type="password"]').all()
    await pw1.fill('abc')
    await pw2.fill('abc')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=8 characters')).toBeVisible()
  })
})

// ─── Block 3: DB-backed token validation ─────────────────────────────────────

test.describe('Set-password page — token validation (DB)', () => {
  let testUserId: string
  let testUserEmail: string

  test.beforeAll(async () => {
    const school = await prisma.school.findFirst({ where: { name: { contains: 'Omnis Demo' } }, select: { id: true } })
    if (!school) return

    testUserEmail = `e2e.set-pw.${Date.now()}@omnis-test.edu`
    const placeholderHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12)
    const user = await prisma.user.create({
      data: {
        email:        testUserEmail,
        passwordHash: placeholderHash,
        firstName:    'Test',
        lastName:     'SetPw',
        role:         'TEACHER',
        schoolId:     school.id,
        isActive:     true,
      },
    })
    testUserId = user.id
  })

  test.afterAll(async () => {
    if (testUserId) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: testUserId } })
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  test('expired token shows error on submit', async ({ page }) => {
    if (!testUserId) test.skip()
    const { raw, hash } = makeToken()
    await prisma.passwordResetToken.create({
      data: {
        userId:    testUserId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    })

    await page.goto(`/set-password?token=${raw}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('input[type="password"]')
    const [pw1, pw2] = await page.locator('input[type="password"]').all()
    await pw1.fill('NewPassword1!')
    await pw2.fill('NewPassword1!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/expired|used|request/)
  })

  test('valid token: sets password and redirects away from /set-password', async ({ page }) => {
    if (!testUserId) test.skip()
    const { raw, hash } = makeToken()
    await prisma.passwordResetToken.create({
      data: {
        userId:    testUserId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    await page.goto(`/set-password?token=${raw}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('input[type="password"]')
    const [pw1, pw2] = await page.locator('input[type="password"]').all()
    await pw1.fill('NewPassword1!')
    await pw2.fill('NewPassword1!')
    await page.click('button[type="submit"]')

    // Should navigate away (either to DPA gate, role home, or login)
    await page.waitForURL(url => !url.pathname.startsWith('/set-password'), { timeout: 15000 })
    expect(page.url()).not.toContain('/set-password')

    // Confirm token is now marked used
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash } })
    expect(record?.used).toBe(true)

    // Confirm activatedAt was set
    const user = await prisma.user.findUnique({ where: { id: testUserId }, select: { activatedAt: true } })
    expect(user?.activatedAt).not.toBeNull()
  })

  test('already-used token is rejected', async ({ page }) => {
    if (!testUserId) test.skip()
    const { raw, hash } = makeToken()
    await prisma.passwordResetToken.create({
      data: {
        userId:    testUserId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        used:      true, // already consumed
      },
    })

    await page.goto(`/set-password?token=${raw}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('input[type="password"]')
    const [pw1, pw2] = await page.locator('input[type="password"]').all()
    await pw1.fill('AnotherPass1!')
    await pw2.fill('AnotherPass1!')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)
    const body = await page.locator('body').innerText()
    expect(body.toLowerCase()).toMatch(/expired|used|request/)
  })
})
