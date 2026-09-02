# Ofsted evidence report, promo video screens, and student/parent portal — recommendations
### 2 September 2026

Three product-strategy questions Ivan raised in the same conversation. Captured here (not just in chat) per the "docs live in the repo" convention agreed the same day — see `CLAUDE.md` and `docs/audit/README.md` for the existing pattern this follows.

---

## 1. Inspector-facing evidence report (year heads / teachers / head of school)

**Recommendation: build it. This is well-timed, not just a nice-to-have.**

Ofsted's framework changed for the 2025-26 cycle: report cards now grade schools on a 5-point scale (Causing concern / Attention needed / Secure / Strong / Exemplary) across several evaluation areas, and **Inclusion is now one of those dedicated areas** — inspectors specifically examine how well a school supports vulnerable learners including those with SEND, not as a side note but as its own graded strand. ([gov.uk](https://www.gov.uk/government/news/ofsted-sets-out-proposals-for-fairer-education-inspections-and-new-more-detailed-report-cards))

That's exactly the evidence trail Omnis already generates: ILP goals and evidence entries, APDR cycles, EHCP reviews, attainment-gap-by-SEND-status data, and — per the SEND Code of Practice itself — the graduated approach (assess-plan-do-review) is meant to be a *repeatable, tracked process*, which is hard for a school to document convincingly from spreadsheets and paper files but is close to a byproduct of how Omnis already works (`SEND-FRAMEWORK.md` Step 7's SLT/admin SEND Overview dashboard is most of the data model this report needs — ILP coverage %, EHCP breakdown by need, attainment gap chart, review schedule, early-warning counts).

Two things worth being careful about:
- **Don't market it as "Ofsted-compliant" or "meets Ofsted requirements."** Ofsted doesn't certify products or prescribe a report format — inspectors look at what a school shows them, and the SEND-specific consultation language doesn't specify a fixed evidence checklist. The honest and stronger claim is "the evidence a school needs to demonstrate strong Inclusion practice, ready to hand an inspector" — true, defensible, and still a compelling pitch.
- **This is also a sales asset, separately from the report itself.** A head teacher who can generate a clean, dated, exportable PDF/CSV in two clicks — showing SEND register composition, ILP/EHCP coverage and currency, evidence-backed progress, review-cycle compliance — is seeing the product prove its own value in the artefact itself. Worth building the export with that dual purpose in mind (inspector-ready *and* board/governor-ready *and* "look what this saves you" demo material).

**Suggested scope, if you want to move on this:** a filtered export (year group / date range / SEND status / individual student) built on `getSENDAnalytics` plus the ILP/EHCP/evidence data already modelled, output as PDF (the pdf skill handles this cleanly) with a CSV option for governors who want to pivot the numbers themselves. I can turn this into a proper build spec whenever you want to prioritise it — it's a genuinely good roadmap item, not just an "always yes" answer.

## 2. Promotional video — recommended screens

Worth doing — a 60-90 second product tour is the highest-leverage marketing asset for something this feature-dense, because the value is hard to describe in words but easy to *see*. Suggested screen sequence, mapped to the messaging points you listed:

1. **MIS connection screen (Wonde sync)** — "connects to your existing MIS — SIMS and others — no re-keying, no migration project." Show a sync completing with real counts populating.
2. **Class roster / lesson Class tab** — the everyday teacher view, to establish "this is where teachers actually live," before jumping to the differentiated stuff.
3. **AI homework generation with SEND differentiation visibly happening** — same homework, three versions (standard / scaffolded / EHCP-adapted) side by side if it can be shown that way. This is the single best "we're not just mainstream ed-tech" shot you have.
4. **ILP / SEND Overview dashboard** — SMART goals, evidence timeline, coverage stats. Anchors "evidence-backed" and "individual learning pathway."
5. **Analytics with the attainment-gap chart and RAG drill-down** — anchors "real-time monitoring" and "powerful learning strategies."
6. **Parent dashboard / progress view** — briefly, to show the loop closes beyond the classroom.
7. Close on the inspector-report export if it exists by the time you film this — it's the single strongest proof-of-value shot for a school leader specifically.

Keep the messaging line close to what you drafted — mainstream ILP anchored to curriculum, inclusive by design not bolted on, real-time and evidence-backed, zero-re-keying MIS integration — that's a strong, differentiated line and matches what's actually built rather than overselling.

## 3. Student and parent interface — is it worth deepening?

**Parent side is already reasonably built** — dashboard, progress, messages, consent, behaviour, a report view, communications. Worth a UX pass, not a rebuild.

**Student side is comparatively thin** — grades view, homework list, timetable, a SEND page, revision. There's no dedicated engagement layer (points, streaks, rewards) built for students yet, though the school already has a behaviour/rewards concept in the admin-facing behaviour pages that a student-facing layer could sit on top of rather than inventing a second system.

Worth investing here, with one caveat: gamification research in education is genuinely mixed, and it matters more for SEND students specifically — external reward systems can undermine intrinsic motivation for some students and work very well for others depending on the individual, which is itself very on-brand for a product built around *individual* learning pathways rather than one-size-fits-all mechanics. I'd frame this less as "add badges and streaks" and more as "let the individual pathway decide what motivates this student" — some students get a leaderboard, some get a private progress streak, some get neither and just get clearer feedback loops. That's more work than bolting on generic gamification, but it's more defensible and more consistent with the rest of the product's positioning.

If you want to prioritise this, I'd suggest starting with the plumbing that's genuinely missing (a proper student-facing progress/achievement view, notification/feedback loops tied to the evidence already being captured) before deciding whether points/streaks/leaderboards are worth the added complexity for this specific user base.

---

Sources: [Ofsted sets out proposals for fairer education inspections and new, more detailed report cards — GOV.UK](https://www.gov.uk/government/news/ofsted-sets-out-proposals-for-fairer-education-inspections-and-new-more-detailed-report-cards)
