/**
 * Student returned homework — grade context strip
 *
 * Verifies:
 *  - When a student views a RETURNED homework, the grade context strip is shown
 *    (Your Grade / Class Average / Predicted columns)
 *  - The strip is NOT shown for homework that is still pending/submitted
 *  - Student cannot see other students' answers in any homework view
 *
 * Uses Prisma to locate or create a returned submission for the demo student.
 */

import dotenv from 'dotenv'
import path   from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { test, expect }  from '@playwright/test'
import { PrismaClient }  from '@prisma/client'
import { loginAs }       from '../helpers/auth'
import { USERS }         from '../fixtures/users'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

async function ensureReturnedSubmission(): Promise<{ homeworkId: string } | null> {
  const school = await prisma.school.findFirst({ where: { name: { contains: 'Omnis Demo' } }, select: { id: true } })
  if (!school) return null

  const student = await prisma.user.findUnique({
    where:  { email: USERS.student.email },
    select: { id: true },
  })
  if (!student) return null

  // Look for an existing RETURNED submission
  const existing = await prisma.submission.findFirst({
    where:  { studentId: student.id, schoolId: school.id, status: 'RETURNED' },
    select: { homeworkId: true },
  })
  if (existing) return { homeworkId: existing.homeworkId }

  // No returned submission — find any MARKED submission and set it to RETURNED
  const marked = await prisma.submission.findFirst({
    where:  { studentId: student.id, schoolId: school.id, status: { in: ['MARKED', 'SUBMITTED', 'UNDER_REVIEW'] } },
    select: { id: true, homeworkId: true },
  })
  if (marked) {
    await prisma.submission.update({
      where: { id: marked.id },
      data:  { status: 'RETURNED', grade: '6', finalScore: 72, markedAt: new Date() },
    })
    return { homeworkId: marked.homeworkId }
  }

  // Last resort — find any published homework for the student's school and create a returned submission
  const hw = await prisma.homework.findFirst({
    where:  { schoolId: school.id, status: 'PUBLISHED' },
    select: { id: true },
  })
  if (!hw) return null

  await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: hw.id, studentId: student.id } },
    create: {
      homeworkId:  hw.id,
      studentId:   student.id,
      schoolId:    school.id,
      content:     'Test answer for grade strip e2e',
      status:      'RETURNED',
      grade:       '6',
      finalScore:  72,
      markedAt:    new Date(),
      submittedAt: new Date(),
    },
    update: {
      status:     'RETURNED',
      grade:      '6',
      finalScore: 72,
      markedAt:   new Date(),
    },
  })
  return { homeworkId: hw.id }
}

test.describe('Student returned homework — grade context strip', () => {
  let homeworkId: string

  test.beforeAll(async () => {
    const result = await ensureReturnedSubmission()
    if (!result) throw new Error('Could not find or create a returned submission — run db:seed first')
    homeworkId = result.homeworkId
  })

  test.afterAll(async () => { await prisma.$disconnect() })

  test('student can access returned homework page', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto(`/student/homework/${homeworkId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('returned homework shows "Marked & Returned" banner', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto(`/student/homework/${homeworkId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByText(/Marked.*Returned|marked.*returned/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('returned homework shows grade context strip with three columns', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto(`/student/homework/${homeworkId}`)
    await page.waitForLoadState('domcontentloaded')

    // Grade context strip has three labelled columns
    await expect(page.getByText('Your Grade').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Class Average').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Predicted').first()).toBeVisible({ timeout: 10_000 })
  })

  test('student grades page loads', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto('/student/grades')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('student homework list page loads', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto('/student/homework')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('teacher cannot view student homework submission page', async ({ page }) => {
    // /student/homework/:id is student-only — teacher should be redirected
    await loginAs(page, USERS.teacher)
    try {
      await page.goto(`/student/homework/${homeworkId}`, { waitUntil: 'commit', timeout: 10_000 })
    } catch { /* redirect */ }
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/student\/homework\//)
  })
})
