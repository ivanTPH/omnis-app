# Phase 7.5 — Continuous Automated Security Scanning

**Date:** 31 August 2026
**Cost:** £0/month — every tool below is free for a public or private repo on
GitHub's standard plan, runs entirely inside GitHub Actions' free minutes
allowance for this repo's usage level, and none of them touch production
data or spend real money per run (see the ZAP section for exactly why that
matters here specifically, given Omnis calls the Anthropic API from live
POST routes).

**What this is not:** none of the three tools below are a substitute for
**Cyber Essentials Plus** (7.1) or an **independent third-party penetration
test** (7.2). Both of those require an accredited external assessor
physically/remotely testing the live system and are unaffected by anything
in this document — this is automated, continuous, free coverage that runs
*between* those periodic external assessments, catching drift (a new
dependency CVE, a newly-introduced code pattern, a newly-exposed
misconfiguration) in the gap, not replacing the accreditation itself.

---

## 1. Dependabot version updates — `.github/dependabot.yml`

**What it covers:** weekly scans of `package.json`/`package-lock.json` (npm
ecosystem) and every `.github/workflows/*.yml` action reference
(github-actions ecosystem), opening a PR for each available update.
Minor/patch updates within each ecosystem are grouped into one combined PR
(`minor-and-patch`) to cut down on PR noise; major version bumps are
deliberately left ungrouped so each lands as its own PR requiring an actual
look before merge — this repo pins major-version-sensitive packages (Next.js
16, React 19, Prisma 6) where a major bump is exactly the kind of change that
shouldn't get rubber-stamped inside a bundle. `open-pull-requests-limit: 10`
per ecosystem caps how many can be open at once.

**What it doesn't cover:** Dependabot version updates are about *staying
current*, not about scanning the dependencies you already have for known
CVEs — that's the separate "Dependabot alerts" feature (driven by GitHub's
Advisory Database), which is a repository *setting*
(Settings → Security → Code security → Dependabot alerts), not something a
YAML file turns on. **This needs enabling once, manually, in the repo
settings — it isn't a code change and isn't included in this commit.**
Once enabled, Dependabot alerts are what actually flags e.g. the Next.js
middleware-bypass CVEs already documented in
`evidence/phase7-security/dependency-scan.md` (7.3) as they're published,
independent of the weekly version-update PRs.

**Where to look:** open PRs appear in the repo's normal Pull Requests tab,
titled/labelled by Dependabot, with the `chore(deps)` / `chore(ci)` commit
prefix configured here. Dependabot alerts (once enabled) appear under the
repo's **Security → Dependabot** tab.

---

## 2. CodeQL static analysis — `.github/workflows/codeql.yml`

**What it covers:** GitHub's own SAST (static application security testing)
engine, configured for `javascript-typescript` with the `security-extended`
query pack (broader than the default `security-and-quality` set — includes
lower-confidence-but-still-useful checks like additional injection/taint-
tracking queries). Triggers on every push to `main`, every pull request
into `main`, and weekly (Sunday 03:00 UTC) so findings surface even without
new code activity (e.g. a newly-published CodeQL query catching a
previously-undetected pattern in existing code). Runs entirely against
source code in the checked-out repo — no build step is needed for CodeQL's
JS/TS analysis (it's not a compiled-language extraction), no live app
involved, no network calls out, no cost, no side-effect risk.

**What it doesn't cover:** CodeQL finds patterns its query pack knows about
— SQL/command injection shapes, unsafe regex, hardcoded credentials, missing
sanitisation before rendering, etc. — in the code as written. It does not
understand Omnis's actual runtime behaviour, doesn't know that
`requireAuth()` is the correct guard for a given route, and won't catch a
logic bug like "this query is missing a `schoolId` filter" unless that
specific shape happens to match a known taint-tracking pattern. The 27/30
August cross-tenant IDOR sweeps in this repo (`docs/audit/
2026-08-27-hardening-security-sweep.md`, `docs/audit/
2026-08-30-security-review-send-safeguarding-students.md`) found their
issues by a human/Claude reading `app/actions/*.ts` against the multi-tenant
`schoolId`-scoping convention — that class of finding is Omnis-specific
business logic, not a generic SAST pattern, and CodeQL should not be
expected to catch it. Treat CodeQL as a floor, not the SEND-data-specific
review this app actually needs.

**Where to look:** results appear under the repo's **Security → Code
scanning alerts** tab (standard GitHub Advanced Security UI, free for public
repos and included for private repos on GitHub Team/Enterprise — confirm
which plan this repo is on if results don't appear, since code-scanning
alerts specifically require either a public repo or GHAS). Individual PRs
also get inline annotations for any new alert introduced by that diff.

---

## 3. OWASP ZAP baseline scan — `.github/workflows/zap-scan.yml`

**What it covers:** a **passive-only** scan of `https://omnis.education`,
weekly (Sunday 04:00 UTC), using `zaproxy/action-baseline`. "Baseline"
specifically means ZAP's spider (traditional + the modern/client spider via
`-j`) crawls the live site to discover pages, then runs ZAP's *passive* rule
set against everything it observes — missing security headers, cookie flags,
information disclosure in responses, outdated/vulnerable JS libraries
detectable from served assets, etc. — without ever submitting a form or
sending a crafted request designed to trigger a vulnerability.

**Why baseline and never active/full scan, specifically for this app:**
ZAP's baseline script (`zap-baseline.py`, what this action runs) never
invokes ZAP's active scanner regardless of flags passed to it — active
scanning is a structurally different script (`zap-full-scan.py`) that this
workflow deliberately does not use. This matters concretely for Omnis: an
active scan fuzzes every discovered form and POST endpoint with attack
payloads, which here would include `/api/ai/generate-homework` and
`/api/ai/generate-ilp` — each fuzzed request would be a real call to the
Anthropic API (real cost per call) and could leave junk `Homework`/`ILP`
rows in the production database. Baseline scanning structurally cannot do
this, which is why it's safe to run unattended, on a schedule, against the
real production URL, with no human watching.

**Failure gating:** the workflow reads the scan's JSON report and fails the
GitHub Actions job (`exit 1`, surfaced as a red ❌ on the workflow run and
in any branch-protection/status-check UI) if any **High**-severity
(`riskcode: "3"`) alert is present. Medium/Low/Informational findings don't
fail the build but are still in the uploaded report — worth a periodic skim
even without a red X, since some real issues (e.g. a missing security
header) score Medium, not High.

**Where to look:** the run itself appears under the repo's **Actions → ZAP
Baseline Scan** tab. Every run — pass or fail — uploads a build artifact
named `zap-baseline-report` (HTML, Markdown, and JSON versions of the same
report) attached to that run, downloadable from the run's summary page.
`allow_issue_writing` is deliberately set to `false` here (the action can
optionally auto-create/update a GitHub issue with findings) to keep this
first pass simple — worth turning on later if a persistent, always-current
tracking issue would be more useful than checking the Actions tab.

---

## Honest summary — what "continuous scanning is set up" does and doesn't mean

| | Dependabot | CodeQL | ZAP baseline |
|---|---|---|---|
| Cost | £0 | £0 | £0 |
| Touches production | No (reads GitHub's advisory DB + this repo's manifests) | No (reads source only) | Yes — but read-only/passive against the live URL, never a write/fuzz |
| Cadence | Weekly | Push to main + every PR + weekly | Weekly |
| Catches | Known-CVE dependencies, stale Actions | Generic code-level vulnerability *patterns* | Externally-observable web-app misconfig/vulnerabilities |
| Does NOT catch | App-specific business-logic bugs (e.g. missing `schoolId` scoping) | Same | Anything behind a form/POST it won't submit (by design) |
| Replaces CE+ / pen test? | **No** | **No** | **No** |

This closes the "no CI-integrated scanning at all" gap noted in 7.3
(`evidence/phase7-security/dependency-scan.md`'s closing line: *"Add npm
audit (or Dependabot/Snyk) to CI so this doesn't silently drift"*). It does
not close 7.1 (CE+, still needs the dependency fixes applied — see 7.3 — and
a paid external audit) or 7.2 (independent pen test, still needs an
accredited third party) — both remain genuinely open, external, and outside
what automated tooling can satisfy.
