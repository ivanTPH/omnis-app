import { request as playwrightRequest } from '@playwright/test'
import { USERS } from './fixtures/users'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Auth-state saver for remote CI runs.
 *
 * Uses Playwright's request API (HTTP client, no browser) to obtain session
 * cookies by directly calling the NextAuth credentials endpoint. This avoids
 * Chromium browser startup + full page load overhead that consistently timed
 * out at 90s on the GitHub Actions → Coolify network path, while curl-based
 * auth succeeded in < 1s on the same route.
 *
 * Flow: GET /api/auth/csrf → POST /api/auth/callback/credentials →
 * request context follows the 302 + stores session cookie → storageState().
 *
 * Only runs when PLAYWRIGHT_BASE_URL is set (i.e. against remote server).
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

  console.log('[global-setup] Saving auth state (request API) at', baseURL)
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  /** One attempt to get a session cookie. Returns true on success. */
  async function tryAuth(email: string, password: string): Promise<boolean> {
    const ctx = await playwrightRequest.newContext({ baseURL, timeout: 30_000 })
    try {
      const csrfRes = await ctx.get('/api/auth/csrf')
      if (!csrfRes.ok()) return false
      const { csrfToken } = await csrfRes.json() as { csrfToken: string }

      // NextAuth credentials endpoint — request context follows the 302 and
      // stores the session cookie automatically in its cookie jar.
      await ctx.post('/api/auth/callback/credentials', {
        form: { csrfToken, email, password },
      })

      await ctx.storageState({ path: authStateFile(email) })
      return true
    } catch {
      return false
    } finally {
      await ctx.dispose()
    }
  }

  async function saveAuthState(email: string, password: string, label: string): Promise<void> {
    // Retry once on transient 5xx (e.g. 502 when server is briefly overloaded
    // by rapid sequential requests during CI warmup).
    for (let attempt = 1; attempt <= 2; attempt++) {
      const ok = await tryAuth(email, password)
      if (ok) {
        console.log(`[global-setup] saved auth: ${label}`)
        return
      }
      if (attempt === 1) {
        console.log(`[global-setup] auth attempt 1 failed for ${label} — retrying in 3s …`)
        await sleep(3_000)
      } else {
        console.log(`[global-setup] auth failed for ${label}: both attempts failed`)
      }
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

  // Sequential with 1.5 s gap to avoid overwhelming pgbouncer / Next.js
  // cold-start queue. Parallel hammers Supabase connection pool.
  for (const [email, password, label] of roles) {
    await saveAuthState(email, password, label)
    await sleep(1_500)
  }

  console.log('[global-setup] auth state save complete')
}
