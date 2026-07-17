# DPIA Addendum — Outcome Benchmarking Feature

**Reference:** Phase Outcome Benchmarking
**Date drafted:** 2026-07
**Status:** DRAFT — requires DPO review and sign-off before feature is enabled in production
**Owner:** Product / Engineering
**DPO review required by:** [DATE TBD]

---

## 1. Purpose

This addendum describes the data processing activities introduced by the Outcome Benchmarking
feature and the privacy controls implemented to meet UK GDPR obligations.

Outcome Benchmarking computes an uplift metric per school cohort: the difference between a
pupil's predicted GCSE attainment (derived from prior attainment scores such as KS2 SATs or
CATs) and their actual average performance on Omnis homework assessments. This metric is
intended to give schools and, in aggregate, the platform operator insight into the platform's
educational effectiveness.

---

## 2. Data Subjects and Data Processed

| Category | Data elements | Source |
|---|---|---|
| Pupils (students) | `StudentBaseline.baselineScore` (KS2/SATs/CATs, 0–100) | Entered by school staff / MIS import |
| Pupils | `Submission.finalScore` (homework grade, 0–100) | Homework marking workflow |
| Pupils | `User.yearGroup`, `User.schoolId` | User account record |
| Parents | Consent record (opted in / not) | `/accept-terms` portal flow |

**Special category data:** None directly. Indirectly, attainment data for SEND pupils may be
included in aggregates; however, SEND status is not used as a field in any benchmark row.

---

## 3. Lawful Basis

- **Required platform data** (baselines, grades): processed by the school under **UK GDPR Article 6(1)(e)** — public task / performance of a contract with the school.
- **Outcome benchmarking contribution:** processed under **UK GDPR Article 6(1)(a) — consent**, given by the parent/guardian via the explicit opt-in checkbox in `/accept-terms`. Consent is recorded in `ConsentRecord` with `method: 'portal'` and is linked to the school's `ConsentPurpose` with slug `outcome-benchmarking`.
- Consent is entirely **optional**. Declining does not affect any feature of the platform.

---

## 4. Privacy Controls

### 4.1 Consent Gate

The aggregation job (`lib/attainment-benchmark.ts :: computeAttainmentBenchmarks()`) loads
`ConsentRecord` rows for the `outcome-benchmarking` purpose and builds a set of consented
student IDs. Only those students' baseline scores and submission grades are included in any
calculation. Non-consented students are excluded entirely.

### 4.2 Suppression Threshold

The constant `MIN_BENCHMARK_COHORT = 10` (defined in `lib/attainment-benchmark.ts`) sets the
minimum number of consented students required in a school/year-group bucket before any metric
values are stored or surfaced. When `consentedCohortSize < MIN_BENCHMARK_COHORT`:

- The `AttainmentBenchmark` row is written with `suppressed = true`.
- All metric fields (`avgPriorAttainment`, `avgPredictedOutcome`, `avgActualOutcome`, `upliftPercent`) are stored as `0`.
- The platform admin UI displays a "Suppressed" badge; no metric values are shown.
- The marketing export (`getNetworkBenchmarkAggregate`) excludes suppressed rows from all calculations.

**This threshold must not be lowered without explicit DPO sign-off.**

### 4.3 No School-Level External Disclosure

The `getNetworkBenchmarkAggregate()` function returns only:
- A count of contributing schools
- A weighted mean uplift across all un-suppressed cohorts

It does not return school-level or year-group-level breakdowns. This function is accessible
only to PLATFORM_ADMIN role and is not exposed to any public endpoint.

### 4.4 Uplift Model — Placeholder Status

**⚠️ IMPORTANT:** The current `predictedOutcome()` function in `lib/attainment-benchmark.ts`
is a **placeholder linear interpolation** only. It maps a prior attainment score (0–100)
to a predicted GCSE grade (1–9) using a simple linear formula. This model has not been
validated against real cohort data.

Before any uplift figures are:
- shown to school leadership;
- cited in investor materials;
- used in any published research;

the prediction model must be replaced with a validated value-added regression model,
reviewed by an independent academic with expertise in educational measurement, and
signed off by the DPO and product owner.

### 4.5 Internal-Only Dashboard

The `AttainmentBenchmarkPanel` component is rendered only on `/platform-admin/dashboard`,
which is accessible only to the `PLATFORM_ADMIN` role. It carries a visible "Internal —
do not share externally" badge. This data is not surfaced to school admins, teachers,
parents, or students.

---

## 5. Consent Management

### Adding the `outcome-benchmarking` ConsentPurpose to a school

The `ConsentPurpose` record must be seeded for each school before the feature activates.
This can be done via the GDPR admin panel (`/admin/gdpr`) or via a migration script.

Recommended values:

```json
{
  "slug": "outcome-benchmarking",
  "title": "Outcome Benchmarking",
  "description": "Anonymised attainment uplift analysis using prior attainment and homework grades, contributed to the Omnis network benchmark.",
  "lawfulBasis": "consent",
  "isActive": true
}
```

### Withdrawal

A parent who wishes to withdraw consent should contact their school's DPO. The school admin
can mark the relevant `ConsentRecord.decision` as `"withdrawn"`. The next time the aggregation
job runs, the withdrawn student will be excluded from the consented cohort. If the remaining
consented cohort falls below `MIN_BENCHMARK_COHORT`, the row will be re-suppressed.

---

## 6. Retention

`AttainmentBenchmark` rows are keyed by `schoolId + yearGroup + periodLabel`. Each academic
year's benchmark overwrites the prior row via upsert. Rows are retained for the lifetime of
the school account and deleted if the school account is closed, consistent with the platform's
general data retention schedule.

---

## 7. Sign-Off Required

| Item | Required from | Status |
|---|---|---|
| Uplift model validation | Academic lead with educational measurement expertise | ❌ Pending |
| DPIA review | DPO | ❌ Pending |
| Consent UX copy review | Legal / DPO | ❌ Pending |
| Suppression threshold confirmation | DPO | ❌ Pending |
| Feature enablement in production | Product owner + DPO | ❌ Pending |

**This feature must not be promoted from internal dashboard to any external-facing output
until all items above are signed off.**
