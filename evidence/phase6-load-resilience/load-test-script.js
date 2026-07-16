// Phase 6.1 — k6 load test script (prepared, NOT yet run)
//
// IMPORTANT: do not point this at the production URL. The heaviest routes
// below call the real Anthropic API (cost per call) and, for Wonde, the
// real Wonde sandbox/live API. Run this against a Vercel preview deployment
// or a Supabase-branch-backed environment only (see evidence/phase5-mis-
// synthetic-data/mis-breadth-decision.md for the branching discussion).
//
// Usage once a safe target exists:
//   k6 run -e BASE_URL=https://<preview-or-branch-url> -e SESSION_COOKIE="..." load-test-script.js
//
// SESSION_COOKIE: log in as a demo user in a browser against the target
// environment, copy the `authjs.session-token` (or `next-auth.session-token`)
// cookie value, and pass it here. k6 doesn't run a browser, so it can't
// complete the NextAuth credentials flow itself for a JS-rendered login form.

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const COOKIE = __ENV.SESSION_COOKIE || '';

const authHeaders = {
  headers: {
    Cookie: `authjs.session-token=${COOKIE}`,
    'Content-Type': 'application/json',
  },
};

export const options = {
  scenarios: {
    ramp_10: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      exec: 'lightRoutes',
    },
  },
  thresholds: {
    // Targets from OMNIS_TRIAL_READINESS_PLAN.md §4.2 / this checklist's 6.1
    http_req_duration: ['p(95)<5000'], // analytics: <5s
  },
};

// ── Light, read-only, safe-to-repeat routes ─────────────────────────────
// These are real GET endpoints confirmed to exist in app/api/ that don't
// call the AI or an external MIS, making them safe for a first load-test
// pass even before a fully isolated environment is available for the
// heavier AI/sync routes below.
export function lightRoutes() {
  const arborStatus = http.get(`${BASE_URL}/api/arbor/sync`, authHeaders);
  check(arborStatus, { 'arbor status 200/401': (r) => [200, 401].includes(r.status) });

  const dashboard = http.get(`${BASE_URL}/dashboard`, authHeaders);
  check(dashboard, { 'dashboard loads': (r) => r.status === 200 || r.status === 307 });

  sleep(1);
}

// ── Heavy routes — DO NOT enable against production ─────────────────────
// Uncomment and point at an isolated environment only. Each call to
// generate-homework / generate-ilp is a real Anthropic API call with real
// cost; each wonde/sync call hits the real Wonde API and writes to the DB.
//
// export function heavyRoutes() {
//   const homeworkGen = http.post(
//     `${BASE_URL}/api/ai/generate-homework`,
//     JSON.stringify({ /* real payload shape needed — inspect the action's
//                          expected body before enabling */ }),
//     authHeaders,
//   );
//   check(homeworkGen, { 'homework gen <30s': (r) => r.timings.duration < 30000 });
//
//   const wondeSync = http.post(`${BASE_URL}/api/wonde/sync`, null, authHeaders);
//   check(wondeSync, { 'wonde sync ok': (r) => r.status === 200 });
// }
