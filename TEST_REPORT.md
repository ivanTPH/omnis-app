# Omnis E2E Test Report

**Date:** 2026-03-12
**Suite:** Playwright E2E — Phase 6D
**Environment:** Next.js dev server (localhost:3001), Chromium headless
**Total:** 82 tests — **82 passed, 0 failed**

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
| PDF export / API routes | 5 | 5 | 0 | ~10s |
| SENCO workflow (Phase 6D) | 8 | 8 | 0 | ~48s |
| Adaptive homework (Phase 6D) | 5 | 5 | 0 | ~45s |
| Cover management (Phase 6D) | 4 | 4 | 0 | ~55s |
| Revision planner (Phase 6D) | 4 | 4 | 0 | ~56s |
| AI resource generator (Phase 6D) | 4 | 4 | 0 | ~56s |
| GDPR consent management (Phase 6D) | 4 | 4 | 0 | ~56s |
| Student avatars (Phase 6D) | 3 | 3 | 0 | ~11s |
| **Total** | **82** | **82** | **0** | **~9.7 min** |

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
- ✅ SENCO lands on `/send/dashboard` (role home page)
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

### SENCO workflow — Phase 6D (`senco.spec.ts`)
- ✅ SENCO can access `/senco/dashboard` (Phase 5 proactive monitoring dashboard)
- ✅ SENCO can access `/senco/concerns` (SEND Concerns list)
- ✅ SENCO can access `/senco/ilp` (Individual Learning Plans)
- ✅ SENCO can access `/senco/early-warning` (Early Warning System)
- ✅ SENCO can access `/senco/ehcp` (EHCP Plans — Phase 6D)
- ✅ SENCO can access `/senco/ilp-evidence` (ILP Evidence Dashboard — Phase 6D)
- ✅ Teacher cannot access `/senco/*` routes (middleware RBAC)
- ✅ Student cannot access `/senco/*` routes (middleware RBAC)

### Adaptive homework — Phase 6D (`adaptive-homework.spec.ts`)
- ✅ Teacher can access homework list
- ✅ Teacher can access `/analytics/adaptive` (Adaptive Learning Analytics)
- ✅ Student cannot access `/analytics/adaptive` (middleware blocks `/analytics` for students)
- ✅ Student can access `/student/dashboard`
- ✅ SENCO cannot access `/analytics/adaptive` (middleware blocks `/analytics` for SENCO — only TEACHER, HEAD_OF_DEPT, HEAD_OF_YEAR, SLT, SCHOOL_ADMIN)

### Cover management — Phase 6D (`cover-management.spec.ts`)
- ✅ School admin can access `/admin/cover`
- ✅ SLT can access `/admin/cover`
- ✅ Teacher cannot access `/admin/cover` (redirected to `/dashboard`)
- ✅ Student cannot access `/admin/cover` (redirected to `/student/dashboard`)

### Revision planner — Phase 6D (`revision-planner.spec.ts`)
- ✅ Student can access `/revision` (revision planner)
- ✅ Teacher cannot access `/revision` (student-only route)
- ✅ Parent cannot access `/revision` (student-only route)
- ✅ SENCO cannot access `/revision` (student-only route)

### AI resource generator — Phase 6D (`ai-generator.spec.ts`)
- ✅ Teacher can access `/ai-generator`
- ✅ SENCO can access `/ai-generator`
- ✅ Student cannot access `/ai-generator` (middleware RBAC)
- ✅ Parent cannot access `/ai-generator` (middleware RBAC)

### GDPR consent management — Phase 6D (`gdpr.spec.ts`)
- ✅ School admin can access `/admin/gdpr`
- ✅ SLT can access `/admin/gdpr`
- ✅ Teacher cannot access `/admin/gdpr` (blocked by `/admin` prefix RBAC)
- ✅ Student cannot access `/admin/gdpr` (blocked by `/admin` prefix RBAC)

### Student avatars — Phase 6D (`student-photos.spec.ts`)
- ✅ Admin student table at `/admin/students` renders student list with heading
- ✅ Sidebar shows settings link (avatar chip) for teacher
- ✅ Sidebar shows settings link (avatar chip) for student

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
- SENCO home page after login is `/send/dashboard` (not `/senco/dashboard`) — senco-specific Phase 5/6 routes live at `/senco/*`
- `/analytics` prefix in middleware only allows: TEACHER, HEAD_OF_DEPT, HEAD_OF_YEAR, SLT, SCHOOL_ADMIN (not SENCO) — pages themselves may have broader role checks but middleware runs first
- Text assertions use `h1` heading locators where page content could produce many matches (e.g. student email addresses containing "students")

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
