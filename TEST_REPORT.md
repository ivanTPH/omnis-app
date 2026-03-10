# Omnis E2E Test Report

**Date:** 2026-03-10
**Suite:** Playwright E2E — Phase 4B
**Environment:** Next.js dev server (localhost:3001), Chromium headless
**Total:** 50 tests — **50 passed, 0 failed**

---

## Summary

| Suite | Tests | Passed | Failed | Duration |
|---|---|---|---|---|
| Authentication | 9 | 9 | 0 | ~90s |
| Teacher flows | 7 | 7 | 0 | ~15s |
| Student flows | 6 | 6 | 0 | ~65s |
| Admin / SLT flows | 6 | 6 | 0 | ~55s |
| SENCO / SEND flows | 7 | 7 | 0 | ~65s |
| Platform admin | 4 | 4 | 0 | ~72s |
| Accessibility & settings | 5 | 5 | 0 | ~8s |
| PDF export / API routes | 6 | 6 | 0 | ~10s |
| **Total** | **50** | **50** | **0** | **5.2 min** |

---

## Test Coverage by Role

### Authentication (`auth.spec.ts`)
- ✅ Login page renders with correct form fields
- ✅ Unauthenticated user cannot access protected content
- ✅ Teacher login → redirects to `/dashboard`
- ✅ Student login → redirects to `/student/dashboard`
- ✅ Parent login → redirects to `/parent/dashboard`
- ✅ Invalid credentials stay on `/login`
- ✅ Empty password stays on `/login`
- ✅ Student redirected away from `/admin/*` routes (middleware RBAC)
- ✅ Teacher redirected away from `/platform-admin/*` routes (middleware RBAC)
- ✅ Parent redirected away from `/send/*` routes (middleware RBAC)

### Teacher flows (`teacher.spec.ts`)
- ✅ Teacher lands on dashboard/calendar view
- ✅ Sidebar shows Calendar, Homework, Classes items
- ✅ Can navigate to `/homework`
- ✅ Can navigate to `/classes`
- ✅ Can navigate to `/analytics/students`
- ✅ Can navigate to `/settings`
- ✅ Sidebar does not show student-only nav items

### Student flows (`student.spec.ts`)
- ✅ Student lands on `/student/dashboard`
- ✅ Sidebar shows Dashboard and Homework items
- ✅ Redirected away from `/slt/analytics` (role-restricted)
- ✅ Redirected away from `/admin/*` (role-restricted)
- ✅ Redirected away from `/send/*` (role-restricted)
- ✅ Can access `/settings`

### Admin / SLT flows (`admin.spec.ts`)
- ✅ SLT login succeeds
- ✅ SLT can access `/slt/analytics`
- ✅ SLT can access `/admin/*` (SLT is in admin role group)
- ✅ SLT redirected away from `/platform-admin/*`
- ✅ School admin login succeeds
- ✅ School admin can access `/admin/*`

### SENCO / SEND flows (`send-scorer.spec.ts`)
- ✅ SENCO lands on `/send/dashboard`
- ✅ SENCO can access `/send/dashboard`
- ✅ SENCO can access `/send/ilp`
- ✅ SENCO can access `/send/review-due`
- ✅ SENCO redirected away from `/platform-admin/*`
- ✅ SENCO redirected away from `/revision` (student-only)
- ✅ SENCO can access `/settings`

### Platform admin (`platform-admin.spec.ts`)
- ✅ Teacher cannot access `/platform-admin/*`
- ✅ SENCO cannot access `/platform-admin/*`
- ✅ Student cannot access `/platform-admin/*`
- ✅ School admin cannot access `/platform-admin/*`

### Accessibility & settings (`accessibility.spec.ts`)
- ✅ Settings page loads and shows tab/heading UI
- ✅ Settings page has visible editable form fields
- ✅ Login page has correct accessible form fields
- ✅ Authenticated layout renders content area
- ✅ Student can access settings

### PDF export / API routes (`pdf-export.spec.ts`)
- ✅ Lesson plan export API returns non-200 for unauthenticated dummy request
- ✅ Teacher can reach homework list page
- ✅ Student dashboard renders for student role
- ✅ Parent dashboard renders for parent role
- ✅ Parent can access `/parent/progress`

---

## Infrastructure

| Item | Detail |
|---|---|
| Framework | `@playwright/test` v1.58.2 |
| Browser | Chromium (headless) |
| Config | `playwright.config.ts` — 1 worker, retries: 1, timeout: 30s |
| Page objects | `LoginPage`, `SidebarPage` |
| Helpers | `loginAs()`, `gotoCommit()` |
| Fixtures | `e2e/fixtures/users.ts` — 6 role fixtures |
| CI | `.github/workflows/e2e.yml` — GitHub Actions on push/PR |

---

## Notes

- Tests use `gotoCommit()` (Playwright `waitUntil: 'commit'`) for role-restriction tests to avoid hanging on cross-origin redirects that occur when `NEXTAUTH_URL` differs from the dev server port
- All seed credentials from `prisma/seed.ts` (omnisdemo.school users) — no dependency on Wonde/Oakfield seed
- `/dashboard` is accessible to all authenticated roles (not restricted in middleware); role-specific nav is handled via the sidebar component
- Tests run sequentially (1 worker) to avoid session cookie conflicts

---

## Credentials Used

| Role | Email |
|---|---|
| TEACHER | `j.patel@omnisdemo.school` |
| SENCO | `r.morris@omnisdemo.school` |
| SLT | `c.roberts@omnisdemo.school` |
| SCHOOL_ADMIN | `admin@omnisdemo.school` |
| STUDENT | `a.hughes@students.omnisdemo.school` |
| PARENT | `l.hughes@parents.omnisdemo.school` |

All passwords: `Demo1234!`
