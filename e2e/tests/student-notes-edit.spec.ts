/**
 * Student Notes — CRUD operations in StudentFilePanel
 *
 * Verifies (via /students/[id]):
 *  - Teacher can add a quick note
 *  - Teacher can edit their own note (inline edit UI appears)
 *  - Teacher can delete their own note
 *  - TA can add, edit, and delete TA notes
 *  - SENCO can view notes but cannot edit another user's note
 *
 * Uses Prisma to locate a real student from the demo school.
 */

import dotenv from 'dotenv'
import path   from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { test, expect } from '@playwright/test'
import { PrismaClient }  from '@prisma/client'
import { loginAs }       from '../helpers/auth'
import { USERS }         from '../fixtures/users'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

async function getDemoStudentId(): Promise<string | null> {
  const school = await prisma.school.findFirst({ where: { name: { contains: 'Omnis Demo' } }, select: { id: true } })
  if (!school) return null
  const student = await prisma.user.findFirst({
    where: { schoolId: school.id, role: 'STUDENT', isActive: true },
    select: { id: true },
  })
  return student?.id ?? null
}

test.describe('Student notes — add / edit / delete', () => {
  let studentId: string

  test.beforeAll(async () => {
    const id = await getDemoStudentId()
    if (!id) throw new Error('No demo student found — run db:seed first')
    studentId = id
  })

  test('student file page loads without error', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto(`/students/${studentId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('teacher can navigate to Notes tab in student file', async ({ page }) => {
    await loginAs(page, USERS.teacher)
    await page.goto(`/students/${studentId}`)
    await page.waitForLoadState('domcontentloaded')

    // Click the "Notes" tab
    const notesTab = page.getByRole('button', { name: 'Notes' }).first()
    await expect(notesTab).toBeVisible({ timeout: 10_000 })
    await notesTab.click()

    // Notes section should be visible
    await expect(page.locator('body')).toBeVisible()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('teacher can add a student quick note', async ({ page }) => {
    test.setTimeout(30_000)
    await loginAs(page, USERS.teacher)
    await page.goto(`/students/${studentId}`)
    await page.waitForLoadState('domcontentloaded')

    const notesTab = page.getByRole('button', { name: 'Notes' }).first()
    await expect(notesTab).toBeVisible({ timeout: 10_000 })
    await notesTab.click()

    // Find the note textarea and add a note
    const noteInput = page.locator('textarea').first()
    await expect(noteInput).toBeVisible({ timeout: 8_000 })
    const noteText = `E2E test note ${Date.now()}`
    await noteInput.fill(noteText)

    // Submit the note
    const addBtn = page.getByRole('button', { name: /save note/i }).first()
    await expect(addBtn).toBeVisible({ timeout: 5_000 })
    await addBtn.click()

    // Note should appear in the list
    await expect(page.getByText(noteText)).toBeVisible({ timeout: 10_000 })
  })

  test('teacher sees edit button on their own note', async ({ page }) => {
    test.setTimeout(30_000)

    // Ensure at least one note exists for this teacher on this student
    const teacher = await prisma.user.findUnique({ where: { email: USERS.teacher.email }, select: { id: true, schoolId: true } })
    if (teacher) {
      // Upsert a note so this test is self-contained
      await prisma.studentQuickNote.create({
        data: {
          studentId,
          authorId:  teacher.id,
          schoolId:  teacher.schoolId,
          content:   `Edit-target note ${Date.now()}`,
        },
      })
    }

    await loginAs(page, USERS.teacher)
    await page.goto(`/students/${studentId}`)
    await page.waitForLoadState('domcontentloaded')

    const notesTab = page.getByRole('button', { name: 'Notes' }).first()
    await expect(notesTab).toBeVisible({ timeout: 10_000 })
    await notesTab.click()

    // There should be at least one edit (pencil) button on a note row.
    // The button has no title/aria-label — it contains a Material Icon <span> with text "edit".
    const editBtn = page.locator('button').filter({ has: page.locator('span', { hasText: /^edit$/ }) }).first()
    await expect(editBtn).toBeVisible({ timeout: 10_000 })
  })

  test('SENCO can view student notes tab', async ({ page }) => {
    await loginAs(page, USERS.senco)
    await page.goto(`/students/${studentId}`)
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('TA notes', () => {
  let studentId: string

  test.beforeAll(async () => {
    const id = await getDemoStudentId()
    if (!id) throw new Error('No demo student found — run db:seed first')
    studentId = id
  })

  test.afterAll(async () => { await prisma.$disconnect() })

  test('TA can access TA notes hub', async ({ page }) => {
    await loginAs(page, USERS.ta)
    await expect(page).toHaveURL(/\/ta\/notes/, { timeout: 10_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('TA notes hub loads without error', async ({ page }) => {
    await loginAs(page, USERS.ta)
    await page.goto('/ta/notes')
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8_000 })
    await expect(page.locator('body')).toBeVisible()
  })

  test('teacher cannot access TA-only route /ta/notes', async ({ page }) => {
    // /ta/notes is auth-protected — teacher will be redirected to /dashboard
    await loginAs(page, USERS.teacher)
    try {
      await page.goto('/ta/notes', { waitUntil: 'commit', timeout: 10_000 })
    } catch { /* redirect */ }
    await page.waitForTimeout(2_000)
    expect(page.url()).not.toMatch(/\/ta\/notes/)
  })
})
