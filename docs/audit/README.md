# Omnis — audit structure

This folder is the canonical home for pre-launch and ongoing audit reports — security reviews, tenant-scoping checks, and infrastructure/build audits. Each audit gets its own dated file; findings that are fixed get a `STATUS:` line at the top of the file noting the fix commit and how it was verified.

## Index

| Date | Audit | Status | File |
|---|---|---|---|
| 2026-03-09 | Full codebase security audit (auth, RBAC, IDOR, headers, GDPR) | All 15 findings fixed | [`/SECURITY_AUDIT.md`](../../SECURITY_AUDIT.md) (repo root — pre-dates this folder) |
| 2026-08-26 | schoolId tenant-scoping audit (cross-tenant IDOR sweep) | 7 RISKY findings fixed, tested, deployed | [`2026-08-26-schoolid-tenant-scoping-audit.md`](./2026-08-26-schoolid-tenant-scoping-audit.md) |
| 2026-08-27 | DSPy weekly-optimization + XAI integration | In progress — see file for step-by-step status | [`2026-08-27-dspy-agent-skill-optimization.md`](./2026-08-27-dspy-agent-skill-optimization.md) |
| 2026-08-27 | Hardening-phase security/compliance sweep (exports, actions, DSPy inputRefs) | 14 findings fixed, commit `7a6503c` — needs `tsc`/build verification from a terminal | [`2026-08-27-hardening-security-sweep.md`](./2026-08-27-hardening-security-sweep.md) |

## Conventions

- File name: `YYYY-MM-DD-short-slug.md`, dated to when the audit was run (not when findings were fixed).
- Every audit that finds issues gets a `STATUS:` line near the top once fixes ship, naming the commit hash and how the fix was verified (type-check, lint, build, e2e, manual production check — whichever apply).
- Findings that are identified but deliberately not fixed (low severity, out of scope, deferred) stay listed under a `NEEDS REVIEW` or `not fixed` heading rather than being deleted, so the gap stays visible to the next person who reads the repo.
- New audits (security, performance, accessibility, infra) should land here going forward rather than as loose root-level files, so `docs/audit/` stays the single index of "what's been checked and what hasn't."
