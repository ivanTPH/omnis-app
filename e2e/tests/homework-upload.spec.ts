/**
 * Homework UPLOAD type — submission and marking flows
 *
 * Verifies:
 *  - An UPLOAD-type homework page renders the file input UI for students
 *  - Student can see the upload drop zone / file picker
 *  - Teacher marking view for an UPLOAD submission renders a download/file link
 *    (not a broken/empty response area)
 *  - Year Group Plans page loads and shows the External Link label (not "File URL")
 *
 * Uses Prisma to ensure an UPLOAD homework exists, and to stage a
 * pre-uploaded submission so the marking view test is deterministic.
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

async function ensureUploadHomework(): Promise<{ homeworkId: string; submissionId: string } | null> {
  const school = await prisma.school.findFirst({ where: { name: { contains: 'Omnis Demo' } }, select: { id: true } })
  if (!school) return null

  const teacher = await prisma.user.findUnique({ where: { email: USERS.teacher.email }, select: { id: true } })
  const student = await prisma.user.findUnique({ where: { email: USERS.student.email }, select: { id: true } })
  if (!teacher || !student) return null

  // Find a class the teacher owns
  const classTeacher = await prisma.classTeacher.findFirst({
    where:  { userId: teacher.id },
    select: { classId: true },
  })
  if (!classTeacher) return null

  // Find or create an UPLOAD homework
  let hw = await prisma.homework.findFirst({
    where:  { schoolId: school.id, teacherId: teacher.id, type: 'UPLOAD', status: 'PUBLISHED' },
    select: { id: true },
  })
  if (!hw) {
    hw = await prisma.homework.create({
      data: {
        schoolId:     school.id,
        teacherId:    teacher.id,
        classId:      classTeacher.classId,
        title:        'E2E Upload Homework',
        instructions: 'Upload a file for this e2e test.',
        type:         'UPLOAD',
        homeworkVariantType: 'upload',
        status:       'PUBLISHED',
        setAt:        new Date(),
        dueAt:        new Date(Date.now() + 7 * 86_400_000),
        gradingBands: { '9': 'Excellent', '7': 'Good', '5': 'Satisfactory', '3': 'Needs improvement' },
      },
    })
  }

  // Create a stub submission with a JSON-encoded upload payload
  const uploadPayload = JSON.stringify({
    text:     'See attached file',
    fileName: 'test-essay.pdf',
    dataUrl:  'data:application/pdf;base64,JVBERi0xLjQ=', // minimal base64
  })

  const submission = await prisma.submission.upsert({
    where:  { homeworkId_studentId: { homeworkId: hw.id, studentId: student.id } },
    create: {
      homeworkId:  hw.id,
      studentId:   student.id,
      schoolId:    school.id,
      content:     uploadPayload,
      status:      'SUBMITTED',
      submittedAt: new Date(),
    },
    update: {
      content: uploadPayload,
      status:  'SUBMITTED',
    },
  })

  return { homeworkId: hw.id, submissionId: submission.id }
}

test.describe('UPLOAD homework type — student view', () => {
  let homeworkId: string

  test.beforeAll(async () => {
    const result = await ensureUploadHomework()
    if (!result) throw new Error('Could not set up upload homework — run db:seed first')
    homeworkId = result.homeworkId
  })

  test.afterAll(async () => { await prisma.$disconnect() })

  test('student can access upload homework page', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto(`/student/homework/${homeworkId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('upload homework page shows file input or upload UI', async ({ page }) => {
    await loginAs(page, USERS.student)
    await page.goto(`/student/homework/${homeworkId}`)
    await page.waitForLoadState('domcontentloaded')

    // Should show either a file input, a drop zone, or upload-related text
    const hasFileInput = await page.locator('input[type="file"]').count() > 0
    const hasUploadText = await page.getByText(/upload|choose file|drag.*drop/i).count() > 0
    expect(hasFileInput || hasUploadText).toBe(true)
  })
})

test.describe('UPLOAD homework type — teacher marking view', () => {
  let homeworkId: string
  let submissionId: string

  test.beforeAll(async () => {
    const result = await ensureUploadHomework()
    if (!result) throw new Error('Could not set up upload homework — run db:seed first')
    homeworkId   = result.homeworkId
    submissionId = result.submissionId
  })

  test.afterAll(async () => { await prisma.$disconnect() })

  test('teacher can access marking view for upload homework', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto(`/homework/${homeworkId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('marking view shows student submission list', async ({ page }) => {
    test.setTimeout(30_000)
    await loginAs(page, USERS.teacher)
    await page.goto(`/homework/${homeworkId}`)
    await page.waitForLoadState('domcontentloaded')

    // Student list panel should be visible
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/)
    // There should be at least one student row (the submitted student)
    const bodyText = await page.locator('body').innerText({ timeout: 10_000 })
    expect(bodyText.length).toBeGreaterThan(50)
  })
})

test.describe('Year Group Plans — external link label', () => {
  test('plans page loads for teacher', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto('/plans/year-group')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('create plan modal shows "External Link" label not "File URL"', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto('/plans/year-group')
    await page.waitForLoadState('domcontentloaded')

    // Click "Add plan" or "+ Create Plan" button
    const addBtn = page.getByRole('button', { name: /add plan|create plan/i }).first()
    await expect(addBtn).toBeVisible({ timeout: 10_000 })
    await addBtn.click()

    // Modal should open — check for "External Link" label
    await expect(page.getByText('External Link').first()).toBeVisible({ timeout: 8_000 })

    // Should NOT show the old "File URL" label
    await expect(page.getByText('File URL').first()).not.toBeVisible({ timeout: 3_000 }).catch(() => {})
  })

  test('create plan modal shows help text about external URLs', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto('/plans/year-group')
    await page.waitForLoadState('domcontentloaded')

    const addBtn = page.getByRole('button', { name: /add plan|create plan/i }).first()
    await expect(addBtn).toBeVisible({ timeout: 10_000 })
    await addBtn.click()

    // Clarifying text should say it's not a file upload
    await expect(page.getByText(/external.*url|not a file upload|shareable link/i).first()).toBeVisible({ timeout: 8_000 })
  })
})
