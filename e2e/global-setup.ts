import { chromium } from '@playwright/test'
import { USERS } from './fixtures/users'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Best-effort auth-state saver for Vercel runs.
 *
 * For each role: attempts form login with a SHORT timeout (20s).
 * If the Lambda is warm the state is saved and loginAs() will inject
 * cookies directly (no per-test auth round-trip).
 * If the Lambda is cold we fail fast and move on — the test itself
 * handles the cold start via its own longer timeout + Playwright retries.
 *
 * Total warmup is bounded at 9 × 20s = 180s regardless of failures,
 * so Lambdas that did save state remain warm when tests begin.
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

  async function saveAuthState(email: string, password: string, label: string): Promise<void> {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await page.fill('input[type="email"]', email)
      await page.fill('input[type="password"]', password)
      await page.click('button[type="submit"]')
      await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20_000 })
      await context.storageState({ path: authStateFile(email) })
      console.log(`[global-setup] saved auth: ${label}`)
    } catch {
      // Cold Lambda — skip; the test will handle it via form-login fallback + Playwright retries
      console.log(`[global-setup] cold start for ${label} — skipped, tests will handle via retry`)
    } finally {
      await context.close()
    }
  }

  const roles: Array<[string, string, string]> = [
    [USERS.teacher.email,     USERS.teacher.password,     'teacher'],
    [USERS.slt.email,         USERS.slt.password,         'slt'],
    [USERS.senco.email,       USERS.senco.password,       'senco'],
    [USERS.schoolAdmin.email, USERS.schoolAdmin.password, 'schoolAdmin'],
    [USERS.student.email,     USERS.student.password,     'student'],
    [USERS.hoy.email,         USERS.hoy.password,         'hoy'],
    [USERS.ta.email,          USERS.ta.password,          'ta'],
    [USERS.hod.email,         USERS.hod.password,         'hod'],
    [USERS.parent.email,      USERS.parent.password,      'parent'],
  ]

  // Sequential — parallel hammers Supabase pgbouncer; 20s fail-fast keeps total ≤ 3 min
  for (const [email, password, label] of roles) {
    await saveAuthState(email, password, label)
  }

  await browser.close()
  console.log('[global-setup] auth state save complete')
}
