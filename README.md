# Omnis — UK Secondary School Management Platform

Omnis is a multi-tenant SaaS for UK secondary schools covering the full teaching workflow: lesson planning, Oak National Academy resource integration, AI-powered homework generation and marking, SEND/ILP/EHCP management, adaptive learning, analytics, MIS sync (Wonde), staff and student management, GDPR compliance, and a public marketing site.

**Production:** https://omnis.education
**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · Prisma v6 · PostgreSQL (Supabase) · NextAuth v5 · Anthropic Claude · Resend · Puppeteer · Playwright

---

## Getting Started

### Prerequisites
- Node.js 22+
- `.env.local` configured (see Environment Variables below)

### Install and run
```bash
npm install
npm run dev        # Turbopack dev server → http://localhost:3000
```

### Before every push
```bash
npx tsc --noEmit   # TypeScript check — must pass
npm run build      # Production build — must exit 0
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooled connection — port 6543, `?pgbouncer=true&connection_limit=5` |
| `DIRECT_URL` | Supabase direct connection — port 5432, used by `prisma db push` |
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `NEXTAUTH_URL` | `http://localhost:3000` in dev · `https://omnis.education` in prod |
| `ANTHROPIC_API_KEY` | Claude API key for AI homework, ILP generation, agents |
| `RESEND_API_KEY` | Resend key for all transactional email |
| `CRON_SECRET` | Bearer token protecting `/api/cron/*` endpoints |
| `WONDE_API_TOKEN` | Wonde MIS API token |
| `WONDE_SCHOOL_ID` | Wonde school ID (`A1930499544` for test school) |

---

## Key Commands

```bash
# Development
npm run dev                    # Dev server (Turbopack)
npm run build                  # Production build
npm run lint                   # ESLint

# Database
npx prisma db push             # Apply schema changes (uses DIRECT_URL)
npx prisma studio              # DB browser UI
npx tsc --noEmit               # TypeScript check only

# Seeds
npm run db:seed                # Main seed — demo school, users, lessons, homework
npm run send:seed              # SEND data — concerns, ILPs, EHCP plans
npm run platform:seed          # Platform admin + 3 demo schools

# E2E tests (Playwright)
npm run test:e2e                                                         # Headless, localhost
PLAYWRIGHT_BASE_URL=https://omnis.education npx playwright test          # Against production
```

---

## Demo Credentials (password: `Demo1234!`)

| Email | Role |
|---|---|
| `j.patel@omnisdemo.school` | Teacher |
| `r.morris@omnisdemo.school` | SENCO |
| `t.adeyemi@omnisdemo.school` | Head of Year |
| `d.brooks@omnisdemo.school` | Head of Department |
| `c.roberts@omnisdemo.school` | SLT |
| `admin@omnisdemo.school` | School Admin |
| `a.hughes@students.omnisdemo.school` | Student |
| `l.hughes@parents.omnisdemo.school` | Parent |
| `j.taylor@omnisdemo.school` | Teaching Assistant |
| `platform@omnis.edu` | Platform Admin |

---

## Deployment

Production runs on **Coolify** (DigitalOcean droplet) using a 3-stage Dockerfile (Node 22 Alpine).

```bash
# Trigger deploy via Coolify API
curl -X POST http://165.232.96.51:8000/api/v1/applications/zmbvss33zr570jiwqxdjrtkv/restart \
  -H "Authorization: Bearer <token>"
```

Auto-deploy triggers on push to `main` if enabled in the Coolify UI.

See `CLAUDE.md` for full architecture reference, route map, schema summary, and development guidelines.

---

## Compliance

- **UK GDPR / Data Protection Act 2018** — DPA acknowledgement gate for all staff on first login; Terms and privacy notice gate for parents and students; full immutable audit log (`AuditLog` table); data subject request handling at `/admin/gdpr`; privacy policy and terms at `/marketing/privacy` and `/marketing/terms`
- **UK SEND Code of Practice 2015** — Full ILP, EHCP, APDR lifecycle management; SEND early warning system; TA notes with audit trail; cohort and cross-school aggregation for evidence-based intervention
- **Email authentication** — SPF, DKIM (Resend), and DMARC configured on `omnis.education`; all transactional mail via Resend from `notifications@omnis.education`
- **Security headers** — CSP, HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` applied to all routes via `next.config.ts`
- **Rate limiting** — Contact form endpoints rate-limited per IP via `lib/kv.ts`
- **Input sanitisation** — All user-supplied data HTML-escaped before inclusion in email templates
