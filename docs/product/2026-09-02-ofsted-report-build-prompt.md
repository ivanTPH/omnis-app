## Ofsted-ready SEND/Inclusion evidence report — build prompt for Claude Code

**What:** Adds a filterable, exportable "Inclusion Evidence Report" (PDF + CSV) for HOY/SLT/SENCO/Head, covering SEND identification, ILP/EHCP coverage and currency, evidence-backed progress, and review-cycle compliance — the exact substance Ofsted's Inclusion evaluation area (2025-26 report card reforms) looks for, plus a few additions aimed at evidencing "Strong"/"Exemplary" rather than just "Secure."

**Prompt:**
```
Read CLAUDE.md for context. Build an "Inclusion Evidence Report" — a
filterable, exportable report for school leaders (SLT, SENCO, Head of
Year, School Admin) that pulls together SEND/ILP/EHCP data into a
document they could hand an Ofsted inspector or a governor.

Step 0 — Inventory before building (report back before writing new code):
- Does getSENDAnalytics already exist in app/actions/analytics.ts (spec'd
  in SEND-FRAMEWORK.md Step 7)? If so, what does it currently return —
  reuse and extend it rather than duplicating the query logic.
- Does /api/export/send-register (mentioned in TODO.md) already exist?
  What format/library does it use for CSV? Reuse that pattern.
- Is there an existing PDF-generation pattern anywhere in the app (the
  DSAR PDF export mentioned in claude/dspy-optimization-and-xai-design.md
  — check if it's built or still spec-only)? If yes, reuse it. If not,
  puppeteer is already a project dependency — use it (render an HTML
  template server-side, print to PDF) rather than adding a new library.
- Confirm the exact field names on ILP/ILPTarget, SendStatus, EhcpPlan/
  EhcpAnnualReview/EhcpOutcome, AssessPlanDoReview, IlpEvidenceEntry,
  EarlyWarningFlag — the schema has some near-duplicate model names
  (ILP vs IlpTarget vs ILPTarget) so verify against prisma/schema.prisma
  directly rather than assuming.

Step 1 — Filters (all schoolId-scoped, obviously):
- Year group (single, multiple, or all)
- Date range (defaults to current academic year/term)
- SEND status (NONE / SEN_SUPPORT / EHCP / all)
- Optional: single named student (for an individual case file / annual
  review pack rather than a whole-cohort report)

Step 2 — Report sections (this is the "what Ofsted actually looks for"
part — see docs/product/2026-09-02-ofsted-video-portal-recommendations.md
for the reasoning):
1. SEND register summary — headcount and % of roll by SendStatusValue,
   trend vs previous term if data exists
2. Identification & responsiveness — average time from a raised concern
   (EarlyWarningFlag/SendConcern created) to an approved ILP; this is a
   genuinely strong "graduated response is working" metric most schools
   cannot produce from paper records
3. ILP coverage & currency — % with an approved ILP, % overdue for
   review, oldest overdue case flagged by name for action
4. EHCP compliance — total EHCPs, % reviewed within the statutory
   12-month window (SEND Code of Practice 9.166), any overdue flagged
   by name (this is a compliance risk metric, not just a nice stat —
   surface it prominently)
5. Evidence-backed progress — attainment gap chart (NONE vs SEN_SUPPORT
   vs EHCP, reuse the existing analytics query), plus count of
   ILPEvidenceEntry records by type (PROGRESS/CONCERN/NEUTRAL) as a
   measure of how consistently the graduated approach is actually being
   evidenced day to day, not just planned on paper
6. Parent & pupil voice — count of IlpParentResponse entries (parent
   engagement in reviews) and, once it exists, any pupil-voice input;
   Ofsted's Inclusion area and the SEND Code of Practice both expect to
   see the child's and parent's views represented, so this section
   matters even if the numbers are modest right now
7. Optional narrative appendix — for the single-student mode, an
   anonymisable case-study layout (need identified → plan → evidence
   of what was tried → outcome) suitable for an annual review or an
   inspector conversation; this is the "prove the system works" section,
   not just the "prove we're compliant" section

Step 3 — Output: PDF as primary format (print-styled, school logo/name
header, generated-on date, clear section headers); CSV as a secondary
download of the underlying row-level data for governors who want to
pivot it themselves.

Step 4 — Access control: SLT, SCHOOL_ADMIN, SENCO, HEAD_OF_YEAR only.
Check role in the server action, same pattern as getSENDAnalytics.

Step 5 — Do NOT claim "Ofsted-compliant" anywhere in the UI copy or the
generated document itself — use language like "Inclusion evidence
summary" or "SEND provision evidence report." Ofsted doesn't certify
products or prescribe a report format; overclaiming here is a real risk
if a school ever quotes it back to an inspector.

Build clean, run npx tsc --noEmit && npm run build, commit, but do NOT
push — I want to review the diff first given this touches SEND/EHCP
data across several models.
```

**Check:** Generate the report for a filtered year group with mixed SEND/EHCP students in the demo data → PDF renders with real numbers in all 7 sections, no placeholder/undefined values → CSV export matches the PDF's underlying data → log in as a TEACHER or STUDENT and confirm the report route is not accessible (redirect/403).
