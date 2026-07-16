# Phase 7.3 — Dependency Vulnerability Scan

**Date:** 10 July 2026
**Method:** `npm audit` against the live repo's `package.json` / `package-lock.json`.
Read-only — no packages were installed, upgraded, or modified.

## Summary

**13 vulnerabilities: 2 low, 4 moderate, 7 high, 0 critical.**

| Package | Severity | Fix available |
|---|---|---|
| next | High | Yes — 16.1.6 → 16.2.10 (same major, not a breaking bump, but outside the exact-pinned range in package.json so `npm audit fix` alone won't apply it) |
| postcss (via next) | Moderate | Same fix as above (transitive) |
| @prisma/config | High | Yes, non-breaking |
| defu | High | Yes, non-breaking |
| effect | High | Yes, non-breaking |
| flatted | High | Yes, non-breaking |
| picomatch | High | Yes, non-breaking |
| prisma | High | Yes, non-breaking |
| brace-expansion | Moderate | Yes, non-breaking |
| ip-address | Moderate | Yes, non-breaking |
| js-yaml | Moderate | Yes, non-breaking |
| @babel/core | Low | Yes, non-breaking |
| esbuild | Low | Yes, non-breaking |

The Next.js advisories are the ones worth naming individually — several relate
to App Router / middleware bypass and cache poisoning, which is directly
relevant given Omnis relies on `middleware.ts` for role-based route protection:

- GHSA-492v-c6pp-mqqv — Middleware/Proxy bypass via dynamic route parameter injection
- GHSA-267c-6grr-h53f — Middleware/Proxy bypass via segment-prefetch routes
- GHSA-36qx-fr4f-26g5 — Middleware/Proxy bypass in Pages Router apps using i18n (Omnis is App Router only, so likely not applicable — worth confirming)
- GHSA-c4j6-fc7j-m34r — SSRF via WebSocket upgrades
- GHSA-h64f-5h5j-jqjh — DoS in the Image Optimization API
- GHSA-mg66-mrh9-m8jx — DoS via connection exhaustion (Cache Components)
- GHSA-wfc6-r584-vfw7, GHSA-vfv6-92ff-j949 — cache poisoning in React Server Component responses
- GHSA-ffhc-5mcf-pf4q, GHSA-gx5p-jg67-6x7h — XSS related to CSP nonces / beforeInteractive scripts

Given the role-enforcement middleware bypass advisories specifically, this
scan is a meaningful input to Phase 7.4 (access control re-verification) —
the current version in use should be treated as a real gap, not routine
housekeeping.

## Recommended action (not yet applied)

```
npm audit fix          # resolves picomatch, @prisma/config, defu, effect,
                        # flatted, prisma, brace-expansion, ip-address,
                        # js-yaml, @babel/core, esbuild — none are semver-major

npm audit fix --force  # additionally bumps next 16.1.6 → 16.2.10 (still
                        # Next 16, not a major version change — flagged as
                        # "outside range" only because package.json pins an
                        # exact version rather than a caret range)
```

Per CLAUDE.md's own mandatory rule, run `npx tsc --noEmit && npm run build`
(and ideally the E2E suite) immediately after applying either command, before
committing. Nothing here was applied automatically — this is a report only.

## Not covered by this scan

- No SAST (static application security testing) run — `npm audit` only checks
  known CVEs in dependencies, not custom code vulnerabilities
- Docker/build image scanning not applicable (Vercel-managed build)

## Update 10 Jul 2026 — fix attempted in this session, did not complete

Tried to apply `npm audit fix` directly against the live repo from this
session. It repeatedly failed with `ENOTEMPTY`/`Operation not permitted`
errors during npm's atomic package-rename step (specific casualty:
`node_modules/brace-expansion` was left in a broken, incomplete state mid-
install). This looks like a limitation of this sandbox's mounted-folder
filesystem, not a problem with the fix itself or your project.

**Repaired:** manually copied the missing files back into
`node_modules/brace-expansion` from the stray temp directory npm left
behind, restoring it to its original (pre-fix, working) version. Verified
via `node -p "require('./node_modules/brace-expansion/package.json').version"`
→ `1.1.12`. `package.json` and `package-lock.json` were never touched (confirmed
via `git diff --stat` — no changes) — so nothing was left half-upgraded at
the manifest level, but **no vulnerabilities were actually fixed.**

**Also left behind:** a stale `.git/index.lock` (0 bytes) that this session
couldn't delete (`Operation not permitted`, same filesystem quirk). It didn't
block `git status`/`git log`/`git diff` in this session, but if it blocks a
`git commit` for you locally, it's almost certainly safe to delete once you
confirm no git process is actually running (`rm .git/index.lock`).

**Recommendation:** run `npm audit fix` and `npm audit fix --force` directly
in your own terminal (not through this session), where you have full
filesystem permissions and no sandbox mount constraints. Then run
`npx tsc --noEmit && npm run build` per CLAUDE.md's rule before committing.
This should take a couple of minutes locally with no special handling needed.
