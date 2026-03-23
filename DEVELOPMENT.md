# Omnis — Development Prompt Library
## General Bug Fixing & Feature Building

> Each entry: **What** (one sentence) · **Prompt** (paste into Claude Code terminal) · **Check** (single verification before moving on)
> Run `npm run build` cleanly before starting. Commit after each step passes its check.

---

## Fix a specific bug

**What:** Diagnoses and fixes a named bug using the codebase context in CLAUDE.md.

**Prompt:**
```
Read CLAUDE.md for context. Bug: [describe exactly what is broken, what page/component/action is involved, and what the expected vs actual behaviour is].

1. Read the relevant file(s) first before making changes.
2. Identify the root cause — don't guess, trace the data flow.
3. Fix only the broken path. Do not refactor surrounding code.
4. If the fix touches a server action, confirm multi-tenancy: every Prisma query must include schoolId from session.
5. Run: npx tsc --noEmit to confirm no TypeScript errors.
6. Explain the root cause in one sentence.
```

**Check:** Reproduce the original bug steps — confirm the bug no longer occurs. TypeScript compiles clean.

---

## Fix a TypeScript error

**What:** Resolves a TypeScript type error without suppressing it with `any` or `// @ts-ignore`.

**Prompt:**
```
Read CLAUDE.md for context. TypeScript error:

[paste the full tsc error including file path and line number]

1. Read the file at the line indicated.
2. Fix the type error properly — do not use `any` or `@ts-ignore` unless the type genuinely cannot be known at compile time.
3. If the error is a missing field on a Prisma-generated type, check schema.prisma first — the field may not exist on the model.
4. If the fix requires updating a shared type (e.g. CalendarLessonData), update all callers.
5. Run: npx tsc --noEmit to confirm zero errors remain.
```

**Check:** `npx tsc --noEmit` outputs nothing (zero errors).

---

## Fix a Prisma / database error

**What:** Resolves a Prisma client or database query error, including schema mismatches and missing fields.

**Prompt:**
```
Read CLAUDE.md for context. Prisma/database error:

[paste the full error message]

1. Identify whether this is a schema mismatch (field doesn't exist in DB), a query error (wrong where clause), or a connection error.
2. If a field is missing: add it to schema.prisma, then run: source .env.local && npx prisma db push. Never use npx prisma migrate for this project.
3. If a query error: read the action file and fix the Prisma query. Remember: every query must be scoped with schoolId.
4. If a connection error: check DATABASE_URL in .env.local uses port 6543 with ?pgbouncer=true&connection_limit=5.
5. After fixing: restart the dev server (Prisma client goes stale after schema changes).
6. Run: npx tsc --noEmit to confirm no type errors from the schema change.
```

**Check:** The operation that caused the error succeeds. No Prisma-related console errors in the dev server log.

---

## Fix a Vercel deployment failure

**What:** Diagnoses and fixes a build error that is causing Vercel deployments to fail.

**Prompt:**
```
Read CLAUDE.md for context. Vercel deployment is failing. Build error:

[paste the Vercel build log error]

Rules for this project:
- Do NOT add a "functions" block to vercel.json — it is only valid for Pages Router. App Router route handlers use `export const maxDuration = N` inside the route file itself.
- All environment variables (DATABASE_URL, NEXTAUTH_SECRET, ANTHROPIC_API_KEY etc.) must be set in the Vercel dashboard, not committed to the repo.
- Run: npm run build locally first to reproduce. Fix the error locally, confirm the build passes, then push.
- Common causes: TypeScript errors, missing env vars, import from a server-only module in a client component, dynamic import missing { ssr: false }.

Fix the root cause. Do not add workarounds like `// eslint-disable` unless the lint rule is genuinely incorrect.
```

**Check:** `npm run build` completes with no errors locally. Push triggers a successful Vercel deploy.

---

## Fix an infinite loading spinner

**What:** Resolves a UI state where a loading spinner never stops because an async operation doesn't resolve or an error is silently swallowed.

**Prompt:**
```
Read CLAUDE.md for context. Bug: [component name] shows an infinite loading spinner that never resolves.

1. Read the component. Find the state variable controlling the spinner (e.g. isLoading, isPending, generatingHw).
2. Trace every code path that sets it true — confirm there is a corresponding false in every branch including error paths.
3. If using useTransition or startTransition, confirm the async function inside doesn't silently throw.
4. If using a useEffect to trigger an async load, ensure the effect has: try/catch/finally, a `cancelled` flag to prevent state updates after unmount, and that the finally block always sets loading to false.
5. Fix all missing false-setting paths.
6. Pattern to follow (from LessonFolder.tsx):
   useEffect(() => {
     let cancelled = false
     async function load() {
       try { ... } catch (err) { ... } finally { if (!cancelled) setLoading(false) }
     }
     load()
     return () => { cancelled = true }
   }, [dep])
```

**Check:** Trigger the loading state → it resolves within 10 seconds. Trigger an error condition → spinner still stops.

---

## Build a new page / route

**What:** Creates a new App Router page with the correct layout, auth guard, and server-side data fetch.

**Prompt:**
```
Read CLAUDE.md for context. Build a new page at [route path] for role [ROLE].

Requirements:
- [describe what the page should show and do]

Rules:
1. Create: app/[route]/page.tsx (server component). Fetch data server-side using Prisma directly or via a server action.
2. Auth guard: const session = await auth(); if (!session) redirect('/login'). Check role matches before rendering.
3. Multi-tenancy: scope every Prisma query with schoolId from session.
4. Wrap in <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>.
5. Create: app/[route]/error.tsx — a basic error boundary for this route.
6. If the page has client interactivity, extract it into a client component in components/.
7. Add the route to CLAUDE.md under ## Routes.
8. Run: npx tsc --noEmit. Then: npm run build.
```

**Check:** Navigate to the route as the correct role — page renders with real data. Wrong role is redirected. Error boundary file exists.

---

## Add a new server action

**What:** Adds a typed, authenticated server action to the correct actions file.

**Prompt:**
```
Read CLAUDE.md for context. Add a new server action: [describe what it does, what inputs it takes, what it returns].

Rules:
1. Add to the correct file in app/actions/ — match the domain (lessons.ts, homework.ts, analytics.ts etc.).
2. Top of file must have 'use server'.
3. Always start with: const session = await auth(); if (!session) throw new Error('Unauthenticated').
4. Extract schoolId (and userId if needed) from session.user.
5. Every Prisma query must be scoped with schoolId.
6. If the action modifies data: call writeAudit() from lib/prisma.ts with the appropriate AuditAction enum value.
7. If the action modifies data visible to the current page: call revalidatePath() with the relevant route.
8. Export the TypeScript return type explicitly so callers can import it.
9. Add the action to the actions table in CLAUDE.md.
10. Run: npx tsc --noEmit.
```

**Check:** Call the action from a page or component — it returns the expected data. Prisma Studio shows any DB changes. Audit log shows the entry if applicable.

---

## Add a new Prisma model

**What:** Adds a new model to the database schema, migrates, and regenerates the Prisma client.

**Prompt:**
```
Read CLAUDE.md for context. Add a new Prisma model: [describe the model, its fields, and its relationships to existing models].

Rules:
1. Open prisma/schema.prisma and add the model following the existing patterns.
2. Every model must have: id String @id @default(cuid()), schoolId String, createdAt DateTime @default(now()).
3. Add a @@index([schoolId]) at minimum. Add composite indexes for common query patterns.
4. Add the relation field to the parent model (e.g. if adding HomeworkComment, add comments HomeworkComment[] to Homework).
5. Run: source .env.local && npx prisma db push (uses DIRECT_URL, port 5432).
6. Restart the dev server — Prisma client goes stale after schema changes.
7. Run: npx tsc --noEmit to confirm the generated types are clean.
8. Add the model to the "Model Groups" section in CLAUDE.md under ## Database Schema Summary.
```

**Check:** Prisma Studio shows the new table. TypeScript compiles clean. Existing queries still work (no broken relation types).

---

## Add a new homework type

**What:** Adds a new homework variant end-to-end: schema enum, AI generation prompt, student submission renderer, and teacher marking view.

**Prompt:**
```
Read CLAUDE.md for context. Add a new homework type: [TYPE_NAME] — [describe what it is and how students interact with it].

Steps:
1. If needed, add the new value to the HomeworkType enum in schema.prisma. Run: source .env.local && npx prisma db push.
2. In app/actions/homework.ts:
   a. Add a case to buildTypePrompt() — define the AI prompt and the exact JSON structure to return.
   b. Add a case to noApiKeyFallback() — define stub questions for when the API is unavailable.
   c. Update generateHomeworkFromResources to handle the new type.
3. In components/LessonFolder.tsx: add the type to the homework type selector dropdown in the wizard.
4. In components/homework/HomeworkTypeRenderer.tsx: add a case to the switch statement to render the student submission UI for this type.
5. In components/HomeworkMarkingView.tsx or SubmissionMarkingView.tsx: ensure the new type's submissions display correctly for teachers.
6. Run: npx tsc --noEmit. Then: npm run build.
```

**Check:** Select the new type in the homework wizard → AI generates valid questions → student can submit → teacher can mark. TypeScript compiles clean.

---

## Add a new analytics chart

**What:** Adds a new Recharts chart to an analytics page, backed by a new or extended server action.

**Prompt:**
```
Read CLAUDE.md for context. Add a new analytics chart to [page/component]: [describe what it should visualise and what data it needs].

Rules:
1. Data: add or extend a server action in app/actions/analytics.ts. Scope all queries with schoolId. Return typed data.
2. Component: add the chart to the correct component in components/. Use Recharts (already installed): BarChart, LineChart, or PieChart. Import from 'recharts'.
3. Tailwind v4: use full literal class strings — no dynamic class construction.
4. Loading state: show a skeleton or spinner while data loads (useTransition or local loading state).
5. Empty state: show a friendly message if there is no data yet.
6. Responsive: wrap in <ResponsiveContainer width="100%" height={240}>.
7. Run: npx tsc --noEmit.
```

**Check:** Navigate to the analytics page as the correct role — chart renders with real data. Empty state shows if no data. No console errors.

---

## Add a new role or permission

**What:** Adds a new user role and wires it through auth, middleware routing, sidebar nav, and any relevant data queries.

**Prompt:**
```
Read CLAUDE.md for context. Add a new role: [ROLE_NAME] — [describe what this role can see and do].

Steps:
1. Add the value to the Role enum in schema.prisma. Run: source .env.local && npx prisma db push.
2. In auth.config.ts: add the role to ROLE_ROUTES and getRoleHome() so middleware redirects correctly after login.
3. In components/Sidebar.tsx: add a nav items case for the new role following the existing pattern.
4. Guard all new pages for this role: check session.user.role === '[ROLE_NAME]' in every server component and action.
5. Add a demo user seed entry in prisma/seed.ts with a memorable test email.
6. Run: npm run db:seed to create the demo account.
7. Add the role to the Sidebar Nav table and Demo Credentials table in CLAUDE.md.
8. Run: npx tsc --noEmit. Then: npm run build.
```

**Check:** Log in as the new demo user → correct home route → sidebar shows correct nav → attempting to access a restricted route redirects correctly.

---

## Remove dead code

**What:** Safely removes unused components, actions, or imports without breaking anything.

**Prompt:**
```
Read CLAUDE.md for context. Remove dead code in: [file or area].

Rules:
1. Before deleting anything, grep the entire codebase to confirm the symbol is not imported or called anywhere else.
2. Remove in this order: (a) the call site if it exists, (b) the export, (c) the import at the top of the file.
3. Do not leave commented-out code — delete it entirely.
4. Do not add backwards-compatibility re-exports.
5. Run: npx tsc --noEmit after each deletion to catch broken imports immediately.
6. Run: npm run build to confirm no runtime module errors.
```

**Check:** `npx tsc --noEmit` is clean. `npm run build` passes. The deleted code is genuinely gone — not commented out or re-exported.

---

## Add a missing error boundary

**What:** Adds a route-level `error.tsx` file for a Next.js App Router route that currently has none.

**Prompt:**
```
Read CLAUDE.md for context. Add a missing error boundary for the route: [route path].

Create: app/[route]/error.tsx following this pattern:

'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h2 className="text-lg font-semibold text-gray-800">Something went wrong</h2>
      <p className="text-sm text-gray-500">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
        Try again
      </button>
    </div>
  )
}

Remove the route from the "Missing error boundary" list in CLAUDE.md ## Outstanding Tasks.
Run: npx tsc --noEmit.
```

**Check:** The error.tsx file exists at the correct path. TypeScript is clean. The route is removed from the missing error boundaries list in CLAUDE.md.

---

## Write E2E tests

**What:** Adds Playwright end-to-end tests for a feature or user journey.

**Prompt:**
```
Read CLAUDE.md for context. Write Playwright E2E tests for: [feature or user journey].

Rules:
1. Create: e2e/tests/[feature-name].spec.ts
2. Use the existing demo credentials from CLAUDE.md (all password: Demo1234!).
3. Each test must: log in as the correct role, navigate to the correct route, perform the action, assert the outcome.
4. Use page.getByRole(), page.getByText(), page.getByLabel() over CSS selectors where possible.
5. Never hardcode IDs — use text/role selectors or data-testid attributes.
6. Add data-testid attributes to any element that has no accessible name — add these to the component too.
7. Keep each test independent — no shared state between tests.
8. Run: npm run test:e2e to confirm the tests pass.
```

**Check:** `npm run test:e2e` passes for the new test file with no flaky failures.

---

## Trigger Wonde sync

**What:** Manually triggers a full MIS sync from Wonde into the local Wonde* tables.

**Prompt:**
```
Read CLAUDE.md for context. I need to trigger a Wonde MIS sync.

Option A — via the admin UI:
1. Log in as admin@omnisdemo.school (SCHOOL_ADMIN role).
2. Navigate to /admin/wonde.
3. Click "Run Full Sync" — this calls POST /api/wonde/sync which has a 300s maxDuration.
4. Wait for the sync result panel to show counts (employees, students, classes etc.).

Option B — via curl (dev only):
curl -X POST http://localhost:3000/api/wonde/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: [copy session cookie from browser dev tools]"

After sync completes:
- Check Prisma Studio: WondeStudent, WondeEmployee, WondeClass tables should have records.
- Check WondeSyncLog for a new entry with status SUCCESS.
- If errors appear in the result, check the errors[] array for field-level failures.

If the sync is failing with 403 on periods or timetable: this is expected — those permissions are pending from Wonde support. The sync will still complete for employees, students, and classes.
```

**Check:** WondeSyncLog shows a new SUCCESS entry. WondeStudent count matches what Wonde reports in their dashboard.

---

## Sync Oak content

**What:** Runs the Oak National Academy lesson sync to populate or refresh the OakLesson table.

**Prompt:**
```
Read CLAUDE.md for context. I need to sync Oak National Academy content.

Full sync (first time or full refresh — slow, 11,000+ lessons):
  npm run oak:sync

Delta sync (only lessons changed since last run — fast, use this normally):
  npm run oak:delta

After sync completes:
- Check Prisma Studio: OakLesson table should have 11,000+ records (full) or a smaller delta.
- Check OakSyncLog for a new entry with status SUCCESS and the lesson count.
- If the sync hangs: check ANTHROPIC_API_KEY is not being called — Oak sync uses direct Fetch only, no AI.
- If you see rate limit errors from Oak: the sync has a built-in delay; wait and retry.

Note: the Oak delta sync also runs automatically via Vercel cron at 02:00 UTC every Sunday (/api/cron/oak-sync).
```

**Check:** OakSyncLog shows a SUCCESS entry. Searching for "Battle of Hastings" in UnifiedResourceSearch returns at least 3 Oak lessons.

---

## Pre-deploy checklist

**What:** Runs through all checks before pushing to production on Vercel.

**Prompt:**
```
Read CLAUDE.md for context. Run the pre-deploy checklist before pushing to production.

1. TypeScript: npx tsc --noEmit — must output nothing (zero errors).
2. Build: npm run build — must complete with no errors.
3. Lint: npm run lint — fix any errors (warnings are acceptable).
4. vercel.json: confirm there is NO "functions" block — it breaks App Router deployments.
5. Environment variables: confirm all required vars are set in Vercel dashboard:
   DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, ANTHROPIC_API_KEY, RESEND_API_KEY, CRON_SECRET, WONDE_API_TOKEN, WONDE_SCHOOL_ID.
6. DATABASE_URL must use port 6543 with ?pgbouncer=true&connection_limit=5 in Vercel (not port 5432).
7. Schema: confirm any new prisma/schema.prisma changes have been pushed to the production DB via DIRECT_URL.
8. Commit: git add -A && git commit -m "[your message]"
9. Push: git push origin main

If any step fails, fix it before pushing.
```

**Check:** Vercel dashboard shows a green deployment. The production URL loads the login page. No runtime errors in Vercel function logs within 5 minutes of deploy.

---

## Update CLAUDE.md after a session

**What:** Keeps CLAUDE.md accurate after a development session by recording what was built, fixed, or changed.

**Prompt:**
```
Read CLAUDE.md for context. Update CLAUDE.md to reflect the work done in this session.

1. If a new route was built: add it to the ## Routes section.
2. If a new server action was added: add it to the ## Actions table.
3. If a new component was added: add it to the ## Key Components table.
4. If a schema model was added: add it to the ## Database Schema Summary model groups.
5. If a bug was fixed that had a workaround noted in ## Key Patterns & Gotchas: update or remove the note.
6. If a phase was completed: add it to ## Completed Phases with the date and bullet-point summary.
7. If an outstanding task was completed: remove it from ## Outstanding Tasks.
8. If a new outstanding task was discovered: add it to ## Outstanding Tasks.
9. Update the "Last updated" date at the top.

Do not rewrite sections that haven't changed. Only update what is actually different.
Run: git add CLAUDE.md && git commit -m "docs: update CLAUDE.md after [session description]"
```

**Check:** CLAUDE.md accurately reflects the current state of the codebase. No stale entries remain.

---

## Notes

- **Multi-tenancy first** — every Prisma query in every action must include `schoolId` from session. This is non-negotiable.
- **TypeScript clean** — `npx tsc --noEmit` must pass before every commit. Never suppress errors with `any` or `@ts-ignore` without a comment explaining why.
- **No functions block in vercel.json** — App Router route handlers use `export const maxDuration = N` in the route file. Adding a `functions` block breaks all Vercel deployments.
- **Prisma client goes stale** — restart the dev server after every `prisma db push`.
- **Router refresh after mutations** — always call `router.refresh()` after server actions that change data visible to the current client component. `revalidatePath` alone is not enough for client components.
- After completing a session: run `npm run build` clean, commit, then run the Update CLAUDE.md prompt above.
