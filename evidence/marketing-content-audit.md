# Marketing Content Audit — Omnis Education

**Date:** 2026-07
**Scope:** `/marketing/home`, `/marketing/features`, `/marketing/beta`, `/marketing/investors`
**Purpose:** Pre-commercial review of marketing copy accuracy, claims, and readiness for outcome benchmarking integration
**Status:** AUDIT ONLY — no live page changes have been made

---

## Summary

The four marketing pages are well-structured and appropriately claim-conservative. However,
three categories of issues were identified:

1. **Stale facts** — test count and route count in `InvestorsForm.tsx` are out of date.
2. **Unsourced market statistics** — three figures on the investors page carry no citation.
3. **Outcome benchmarking placeholder slots** — locations where a validated uplift statistic
   could be inserted once Part 1/2 ships and is signed off. These are marked with the agreed
   placeholder format and must NOT be populated until the DPIA addendum is signed off.

---

## 1. `/marketing/investors` — `InvestorsForm.tsx`

### 1a. Stale traction figures (INCORRECT — must update before external sharing)

**Current copy (Traction section):**
```
Full platform built and beta-ready: 12 roles, 50+ routes, 155 automated tests
Live Wonde MIS integration with 30+ staff and 120+ students in test school
```

**Issues:**
- "155 automated tests" is stale — current count is **450 tests across 37 spec files** (as of commit 425c309).
- "50+ routes" is a significant undercount — the platform has **80+ authenticated routes** plus public marketing and API routes (see CLAUDE.md route list).
- "30+ staff and 120+ students" reflects the Wonde test school seed; this is accurate but should clarify it is a test/pilot school, not a live customer.

**Proposed replacement:**
```
Full platform built and beta-ready: 12 roles, 80+ routes, 450 automated tests
Live Wonde MIS integration — student, staff, timetable, and attendance data operational
AI agents (COACH · QUALITY · PLAN_SYNTHESIS) running nightly on production infrastructure
Beta school cohort forming — first schools onboarding in 2026
```

---

### 1b. Unsourced market statistics

**Current copy (The opportunity section):**
```
3,600+  UK secondary schools
£2.4bn  EdTech market (UK, 2025)
1 in 5  Pupils have SEND needs
```

**Issues:**
- "3,600+" — close to the DfE figure for state-funded secondary schools in England (approx. 3,400 as of 2024 including academies, free schools, and maintained). Should cite DfE school census or EduBase.
- "£2.4bn EdTech market (UK, 2025)" — no citation given. Source should be provided (e.g. BESA, HolonIQ, or Technavio).
- "1 in 5 pupils have SEND needs" — the DfE 2023/24 SEND in England statistics give approximately 17.3% of pupils having SEN, which is closer to 1 in 6. "1 in 5" is a common rounded figure but could be challenged. The more defensible claim references the specific DfE percentage.

**Proposed replacement (with citation placeholders):**
```
3,400+  State secondary schools in England [DfE School Census 2024]
£Xbn    UK EdTech market [Source: BESA / HolonIQ — confirm figure before use]
17%     Of pupils have identified SEND needs [DfE SEND Statistics, Jan 2024]
```

---

### 1c. Outcome benchmarking placeholder slot

**Location:** After the "Traction" section, a future "Impact" section could be added once
outcome benchmarking data is available and signed off. Do not add this section until the
DPIA addendum (see `evidence/phase-outcome-benchmarking/README.md`) is signed off and
real uplift figures from consented school cohorts are validated.

**Placeholder (for internal planning only — do not publish):**
```
[OUTCOME STAT — DO NOT FILL IN until Part 1/2 ship and are signed off]
Schools using Omnis show [X]% average attainment uplift vs predicted outcomes
(consent-gated · cohort-suppressed · requires DPIA sign-off and academic review of uplift model)
```

---

## 2. `/marketing/home` — `page.tsx`

### 2a. Stats strip

**Current copy:**
```
12 roles    Teacher · SENCO · SLT · TA · Parent · Student…
EHCP-aware  Adapted homework for every SEND status
Wonde sync  Live MIS data — students, timetables, staff
AI agents   Nightly COACH · QUALITY · PLAN_SYNTHESIS runs
```

This strip is accurate and conservative — good. No changes required.

### 2b. Outcome benchmarking placeholder slot

**Location:** The stats strip or a dedicated "Results" section below the feature grid could
accommodate a network uplift figure once available.

**Placeholder (for internal planning only — do not publish):**
```
[OUTCOME STAT — DO NOT FILL IN until Part 1/2 ship and are signed off]
e.g. stat: "[X]%", label: "Average attainment uplift vs predicted (beta cohort)"
```

### 2c. No other issues

Hero copy ("The SEND-intelligent school platform"), feature grid, role cards, and CTAs are
all accurate and appropriately conservative for a beta product.

---

## 3. `/marketing/features` — `FeaturesClient.tsx`

This page lists 6 feature sections with 5–8 features each. Review was performed against the
CLAUDE.md feature list. All features described exist in the platform as of the latest commit.

**No factual errors found.**

Minor observation: The page does not currently reference the Outcome Benchmarking or ILP
Parent Co-Production features. These could be added to the SEND/ILP section once those
features are signed off. No action required now.

---

## 4. `/marketing/beta` — `BetaForm.tsx`

### 4a. Contact email visible in error state

**Current copy:**
```
Something went wrong. Please email us directly at ivanyardley@me.com.
```

This exposes a personal email address in publicly visible production source. Before wider
launch, replace with a role-based address (e.g. `hello@omnis.education`) or a generic
contact form.

**Proposed replacement:**
```
Something went wrong. Please email us at hello@omnis.education.
```

(Same change applies to `InvestorsForm.tsx` error state.)

### 4b. No other issues

Value propositions, form fields, and success states are accurate.

---

## 5. Meta / OpenGraph URLs

Both `/marketing/beta` and `/marketing/investors` set `openGraph.url` to
`https://omnis-app-ten.vercel.app/...`. Before external launch, update these to the
production domain once DNS is configured.

---

## 6. Action Summary

| # | Page | Issue | Priority | Action |
|---|---|---|---|---|
| 1 | investors | Test count stale (155 → 450) | **P0** | Update `InvestorsForm.tsx` traction bullet |
| 2 | investors | Route count stale (50+ → 80+) | **P0** | Update same bullet |
| 3 | investors | £2.4bn market stat — unsourced | P1 | Add citation or update figure |
| 4 | investors | "1 in 5" — slight overstatement vs DfE 17% | P1 | Update to "17%" with DfE citation |
| 5 | investors | "3,600+" school count — could be 3,400 | P2 | Verify vs DfE census and cite |
| 6 | beta | Personal email in error state | P1 | Replace with role-based address |
| 7 | investors | Personal email in error state | P1 | Replace with role-based address |
| 8 | all | OpenGraph URLs on Vercel preview domain | P2 | Update to production domain pre-launch |
| 9 | all | Outcome benchmarking stat slot | HOLD | Do not add until DPIA signed off |

Items marked **P0** should be fixed before any investor deck or external demo uses these URLs.
Items marked **HOLD** must not be touched until `evidence/phase-outcome-benchmarking/README.md`
sign-off items are complete.
