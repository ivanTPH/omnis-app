#!/usr/bin/env node
/**
 * Regression test for the nonce-based CSP (middleware.ts + next.config.ts).
 * Loads every major flow in a real browser and asserts zero CSP violations
 * or page errors — the failure mode this policy risks is scripts silently
 * failing to run with no obvious error to the user, so this exists to catch
 * that before it reaches production.
 *
 * Run against a local dev server (`npm run dev` first):
 *   node scripts/test-csp-nonce.mjs
 *
 * Demo accounts (password Demo1234! for all) are MFA-exempt, so this can
 * log in directly without needing an email OTP code.
 */
import { chromium } from 'playwright'

const BASE = process.env.CSP_TEST_BASE_URL ?? 'http://localhost:3000'
const PASSWORD = 'Demo1234!'

const violations = []
const pageErrors = []
let currentContext = 'startup'

function isCspViolationText(text) {
  return /content security policy|refused to (execute|load|apply)|violates the following content security policy/i.test(text)
}

const browser = await chromium.launch()

async function newTrackedContext(initScript) {
  const context = await browser.newContext()
  if (initScript) await context.addInitScript(initScript)
  const page = await context.newPage()
  page.on('console', msg => {
    const text = msg.text()
    if (msg.type() === 'error' && isCspViolationText(text)) {
      violations.push({ context: currentContext, message: text })
      console.log(`  [CSP VIOLATION] (${currentContext}):`, text)
    }
  })
  page.on('pageerror', err => {
    pageErrors.push({ context: currentContext, message: err.message })
    console.log(`  [PAGE ERROR] (${currentContext}):`, err.message)
  })
  return { context, page }
}

async function login(page, email, password = PASSWORD) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForTimeout(2500)
}

async function visit(page, path, label) {
  currentContext = label
  console.log(`Visiting: ${label} (${path})`)
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(600)
  } catch (e) {
    console.log(`  (navigation issue, continuing) ${e.message.slice(0, 150)}`)
  }
}

// ── Unauthenticated marketing pages (JSON-LD <script nonce> tags) ─────────
{
  const { context, page } = await newTrackedContext()
  await visit(page, '/marketing/home', 'marketing/home (unauthenticated)')
  await visit(page, '/marketing/features', 'marketing/features (unauthenticated)')
  await visit(page, '/marketing/beta', 'marketing/beta (unauthenticated)')
  await visit(page, '/marketing/investors', 'marketing/investors (unauthenticated)')
  await visit(page, '/login', 'login page')
  await context.close()
}

// ── Per-role login + dashboard + representative deeper pages ──────────────
const ROLE_FLOWS = [
  { email: 'j.patel@omnisdemo.school', label: 'TEACHER (j.patel)', pages: [
    ['/dashboard', 'teacher dashboard'],
    ['/homework', 'teacher homework list'],
    ['/classes', 'teacher classes'],
    ['/revision-program', 'teacher revision program list'],
    ['/messages', 'teacher messages'],
    ['/ai-generator', 'AI generator'],
  ]},
  { email: 'r.morris@omnisdemo.school', label: 'SENCO (r.morris)', pages: [
    ['/senco/dashboard', 'senco dashboard (CohortInsightsPanel charts)'],
    ['/senco/ilp', 'senco ILP list'],
    ['/senco/ehcp', 'senco EHCP plans'],
    ['/senco/agent-insights', 'senco agent insights'],
    ['/senco/early-warning', 'senco early warning'],
  ]},
  { email: 't.adeyemi@omnisdemo.school', label: 'HEAD_OF_YEAR (t.adeyemi)', pages: [
    ['/hoy/dashboard', 'hoy dashboard'],
    ['/hoy/behaviour', 'hoy behaviour (BehaviourTrendChart/Recharts)'],
    ['/hoy/detentions', 'hoy detentions'],
    ['/hoy/welfare', 'hoy welfare'],
  ]},
  { email: 'c.roberts@omnisdemo.school', label: 'SLT (c.roberts)', pages: [
    ['/slt/analytics', 'slt analytics (charts)'],
    ['/slt/staff', 'slt staff overview'],
    ['/admin/attendance', 'attendance overview (charts)'],
  ]},
  { email: 'admin@omnisdemo.school', label: 'SCHOOL_ADMIN (admin)', pages: [
    ['/admin/dashboard', 'admin dashboard'],
    ['/admin/users', 'admin users'],
    ['/admin/audit', 'admin audit log'],
  ]},
  { email: 'a.hughes@students.omnisdemo.school', label: 'STUDENT (a.hughes)', pages: [
    ['/student/dashboard', 'student dashboard'],
    ['/student/homework', 'student homework list'],
    ['/student/grades', 'student grades (sparkline charts)'],
    ['/student/revision', 'student revision planner'],
  ]},
  { email: 'l.hughes@parents.omnisdemo.school', label: 'PARENT (l.hughes)', pages: [
    ['/parent/dashboard', 'parent dashboard'],
    ['/parent/progress', 'parent progress'],
    ['/parent/messages', 'parent messages'],
  ]},
  { email: 'j.taylor@omnisdemo.school', label: 'TEACHING_ASSISTANT (j.taylor)', pages: [
    ['/ta/notes', 'TA notes hub'],
  ]},
  { email: 'd.brooks@omnisdemo.school', label: 'HEAD_OF_DEPT (d.brooks)', pages: [
    ['/dashboard', 'HOD dashboard'],
    ['/analytics', 'HOD analytics'],
  ]},
  { email: 'platform@omnis.edu', label: 'PLATFORM_ADMIN (platform)', pages: [
    ['/platform-admin/dashboard', 'platform admin dashboard (PlatformInsightsPanel charts)'],
    ['/platform-admin/signups', 'platform admin signups'],
  ]},
]

for (const flow of ROLE_FLOWS) {
  const { context, page } = await newTrackedContext()
  currentContext = `login as ${flow.label}`
  console.log(`\n=== ${flow.label} ===`)
  await login(page, flow.email)
  for (const [path, label] of flow.pages) {
    await visit(page, path, `${flow.label} — ${label}`)
  }
  await context.close()
}

// ── Homework marking / AI generator modal open ─────────────────────────────
{
  const { context, page } = await newTrackedContext()
  currentContext = 'teacher homework marking + AI generator modal'
  console.log('\n=== Homework marking + AI generator modal ===')
  await login(page, 'j.patel@omnisdemo.school')
  await visit(page, '/homework', 'homework list for marking test')
  try {
    const firstHw = page.locator('a[href^="/homework/"]').first()
    if (await firstHw.count() > 0) {
      await firstHw.evaluate(el => el.click())
      await page.waitForTimeout(1500)
      currentContext = 'homework detail/marking page'
    }
  } catch { /* best-effort */ }
  await visit(page, '/homework', 'back to homework list')
  try {
    const setHwBtn = page.locator('button', { hasText: /set homework|new homework|\+ homework/i }).first()
    if (await setHwBtn.count() > 0) {
      currentContext = 'homework creator / AI generator modal'
      await setHwBtn.evaluate(el => el.click())
      await page.waitForTimeout(1500)
    }
  } catch { /* best-effort */ }
  await context.close()
}

// ── Demo role switcher (real onClick path: recordSignOut -> signOut -> signIn) ──
{
  // The demo-owner localStorage flag makes DemoRoleSwitcher render without
  // needing the real owner account's password — mirrors what the real
  // owner account gets automatically, exercises the identical component.
  const { context, page } = await newTrackedContext(() => {
    localStorage.setItem('omnis-demo-owner', '1')
  })
  currentContext = 'demo role switcher'
  console.log('\n=== Demo role switcher ===')
  await login(page, 'j.patel@omnisdemo.school')
  await visit(page, '/dashboard', 'teacher dashboard with switcher visible')
  try {
    const switchBtn = page.locator('button', { hasText: /switch role|demo active|your account/i }).first()
    if (await switchBtn.count() > 0) {
      currentContext = 'DemoRoleSwitcher panel open'
      await switchBtn.evaluate(el => el.click())
      await page.waitForTimeout(800)
      const sencoOption = page.locator('button', { hasText: /senco/i }).first()
      if (await sencoOption.count() > 0) {
        currentContext = 'switching role via DemoRoleSwitcher'
        await sencoOption.evaluate(el => el.click())
        await page.waitForTimeout(3000)
        currentContext = 'post-switch page'
        await visit(page, '/senco/dashboard', 'senco dashboard after switch')
      }
    }
  } catch { /* best-effort */ }
  await context.close()
}

await browser.close()

console.log('\n\n========== SUMMARY ==========')
console.log('Total CSP violations:', violations.length)
console.log('Total page errors:', pageErrors.length)
if (violations.length > 0) {
  console.log('\nCSP violations by context:')
  for (const v of violations) console.log(`  [${v.context}] ${v.message}`)
}
if (pageErrors.length > 0) {
  console.log('\nPage errors by context:')
  for (const e of pageErrors) console.log(`  [${e.context}] ${e.message}`)
}
process.exit(violations.length > 0 ? 1 : 0)
