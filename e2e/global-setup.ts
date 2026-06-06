import { chromium } from '@playwright/test'
import { USERS } from './fixtures/users'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Saves NextAuth JWT cookies for each test role to e2e/.auth/{slug}.json.
 * loginAs() injects these cookies directly, eliminating per-test form login
 * and Vercel Lambda cold-start pressure on the auth endpoint.
 *
 * Only runs when PLAYWRIGHT_BASE_URL is set (i.e. against Vercel, not localhost).
 */

const AUTH_DIR = path.join(__dirname, '.auth')

/** Derive the auth state file path from an email address. */
export function authStateFile(email: string): string {
  const slug = email.split('@')[0].replace(/\./g, '_')
  return path.join(AUTH_DIR, `${slug}.json`)
}

export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL
  if (!baseURL) return

  console.log('[global-setup] Saving auth state for Vercel deployment at', baseURL)
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  const browser = await chromium.launch()

  async function saveAuthState(
    email: string,
    password: string,
    label: string,
    timeoutMs = 60_000,
  ): Promise<boolean> {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
      await page.fill('input[type="email"]', email)
      await page.fill('input[type="password"]', password)
      await page.click('button[type="submit"]')
      await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: timeoutMs })
      await context.storageState({ path: authStateFile(email) })
      console.log(`[global-setup] saved auth: ${label}`)
      return true
    } catch (err) {
      console.warn(`[global-setup] auth failed for ${label}:`, (err as Error).message.slice(0, 80))
      return false
    } finally {
      await context.close()
    }
  }

  const roles: Array<[string, string, string]> = [
    [USERS.teacher.email,     USERS.teacher.password,     'teacher'],
    [USERS.senco.email,       USERS.senco.password,       'senco'],
    [USERS.slt.email,         USERS.slt.password,         'slt'],
    [USERS.schoolAdmin.email, USERS.schoolAdmin.password, 'schoolAdmin'],
    [USERS.student.email,     USERS.student.password,     'student'],
    [USERS.hoy.email,         USERS.hoy.password,         'hoy'],
    [USERS.ta.email,          USERS.ta.password,          'ta'],
    [USERS.hod.email,         USERS.hod.password,         'hod'],
    [USERS.parent.email,      USERS.parent.password,      'parent'],
  ]

  // First pass — sequential to avoid pgbouncer connection storms.
  // Teacher + SLT typically warm the auth Lambda so later roles succeed.
  const failed: Array<[string, string, string]> = []
  for (const [email, password, label] of roles) {
    const ok = await saveAuthState(email, password, label)
    if (!ok) failed.push([email, password, label])
  }

  // Retry pass — by now the auth Lambda is warm from the first pass successes
  if (failed.length > 0) {
    console.log(`[global-setup] retrying ${failed.length} failed roles...`)
    for (const [email, password, label] of failed) {
      await saveAuthState(email, password, `${label} (retry)`, 90_000)
    }
  }

  await browser.close()
  console.log('[global-setup] auth state saved')
}
