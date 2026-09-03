## Curriculum/exam-board alignment build prompt, and review + recommendation on Reporting IA + AI-drafted report cards
### 2 September 2026

---

## Build prompt A — curriculum/exam-board alignment (onboarding, retrieval, marking)

Correcting the earlier review slightly now that the marking/generation code has been read directly: exam-board *awareness* already exists in both `generateHomeworkFromResources` and `autoMarkSubmission` — both already read `class.examBoard` and put it in the AI prompt ("Mark these answers using {examBoard} mark scheme conventions"). Two real gaps remain, one of them more serious than first thought:

1. `findOakDataForTopics()` (the Oak curriculum-content retrieval used to ground generation) still ignores `examBoard` entirely — the AI is *told* the exam board but not given board-specific source material.
2. `autoMarkSubmission` has a **hardcoded fallback**: `const examBoard = hw.class?.examBoard ?? 'AQA'` — if a class's exam board was never set (the onboarding gap from the previous review), marking silently proceeds as if the school runs AQA, even when they don't. That's not just a missed optimisation, that's a real risk of applying the wrong mark scheme conventions to a live grade a student and parent will see.

**Prompt:**
```
Read CLAUDE.md for context. Wire real exam-board alignment through
onboarding, resource retrieval, homework generation, and marking.

Step 1 — Onboarding: add exam board / curriculum alignment to
/admin/onboarding. Either a new step (school's core GCSE/A-level
subjects with an exam board dropdown each, pre-filled from
saveSubjectConfig) or, if a full step is too much for v1, a dismissible
banner on /admin/subjects that appears whenever a core subject has no
exam board set and links straight there. Reuse getSubjectConfigs /
saveSubjectConfig / applySubjectConfigToAllClasses in app/actions/admin.ts
— all already built, this is UI wiring, not new backend.

Step 2 — Fix the silent AQA fallback. In app/actions/homework.ts
around line 2397, autoMarkSubmission currently does
`const examBoard = hw.class?.examBoard ?? 'AQA'`. Replace the silent
default: when examBoard is null, either (a) mark using explicitly
general/board-agnostic UK GCSE conventions in the prompt (say so, don't
guess a board), and/or (b) surface a one-time warning to whoever
generated/marked it ("This class has no exam board set — marking used
general conventions, not board-specific ones. Set it in
/admin/subjects.") Do not silently default to AQA.

Step 3 — Make Oak retrieval exam-board-aware. Add an optional
examBoard parameter to findOakDataForTopics() in lib/oak-content.ts.
When provided and OakLesson rows matching it exist, prefer/filter to
those; fall back to board-agnostic results otherwise (don't return zero
results just because nothing matches the board — KS3 content generally
has no board at all, and coverage will be uneven across boards early
on). Thread the class's examBoard (falling back to the school's
SubjectConfig via the class's subject) through from both
generateHomeworkFromResources and wherever else findOakDataForTopics is
called for KS4/KS5 subjects — leave KS3 calls unfiltered, exam boards
don't apply pre-GCSE.

Step 4 — Verify end to end: set a class's exam board to something
other than AQA (e.g. Edexcel) in /admin/subjects, generate homework for
it, and confirm both the generated content and a test submission's
auto-marking feedback actually reference that board, not AQA. Then
unset a different class's exam board entirely and confirm marking now
says "general conventions" rather than silently claiming AQA.

npx tsc --noEmit && npm run build, commit, push — this is additive and
low-risk (no schema changes, existing fields only), unlike the CSP/
Ofsted changes I don't think this one needs a held-for-review pause,
but your call.
```

**Check:** Edexcel-configured class → homework generation and marking feedback both say "Edexcel," not "AQA." Unset-exam-board class → marking feedback says general conventions, not a silently wrong board. Onboarding/admin nudge visible for any core subject missing an exam board.

---

## Reporting navigation — should the Inclusion Evidence Report sit under a "Reporting" section with analytics and other reports?

Yes, straightforwardly. Right now report-generation is scattered by feature area (SEND Overview lives under senco, the new Inclusion Report under /senco/inclusion-report, class/department/board reports presumably wherever their owning feature lives). A single "Reporting" hub — one place with the Inclusion Evidence Report, analytics, and whatever the report card below becomes — is a better mental model for a Head or SLT member who thinks "I need a report," not "which feature area was that under." Worth a small, low-risk nav-only pass once there are two or three reports living in one place rather than doing it just for one.

---

## The report card / open evening report — recommend building it, with real guardrails, not because it's easy but because it's genuinely good

**Worth building.** This is a real, well-understood pain point (teachers spend hours hand-writing reports every term) and it fits a pattern Omnis already does well elsewhere: AI produces a first draft, a human reviews and edits it, only then does it become real. That's exactly the same shape as homework generation and ILP generation — nothing structurally new here, "just" a new application of an established, safe pattern.

**What's already there to build on, so this isn't starting from zero:** two existing PDF exports already pull most of the raw material — `report-card-template.ts`/`app/api/export/report-card/[studentId]` (academic performance by subject, ILP targets, attendance, open SEND concerns) and `parent-report-template.ts`/`app/api/export/parent-report/[studentId]` (submissions/feedback over a 90-day window, ILP plan, upcoming revision exams, SEND concerns — and it already has correct RBAC for both staff *and* the linked parent). And `targetGrade`/`predictedGrade` already exist on the student record, plus dedicated `StudentBaseline`/`TeacherPrediction` models — the predicted-vs-actual benchmark you asked for doesn't need new data, just a query.

**What's genuinely new, and needs care:**
1. An AI-drafted narrative — performance / potential / areas for improvement, as you described — generated from the structured data above, editable by the teacher before anything is exported. Standard house pattern: draft, review, edit, only then does it leave the building.
2. **Source-data curation matters more here than anywhere else in the app so far.** `TaNote` has a staff-visibility flag (`TEACHER`/`SENCO`/`ALL_STAFF`) but nothing resembling "safe to show a parent" — none of the free-text staff note types in the schema have that distinction today. My recommendation: don't feed any free-text staff notes (TaNote, ParentContactEntry summaries) into the AI narrative automatically at all. Ground the narrative only in data that's already structurally parent-appropriate — grades, attendance, ILP targets (already shared with parents via the existing acknowledgement mechanism), behaviour/achievement points, predicted-vs-actual. If a teacher wants to reference something from an intervention or a note, that's exactly what the "edit before export" step is for — a human decides what's appropriate to say to a parent, the AI doesn't get to make that call from raw notes it wasn't built to filter.
3. Label the narrative as AI-assisted, reviewed and finalised by the named teacher — same reasoning as the XAI work already spec'd elsewhere: it's honest, it protects the teacher, and a parent reading "reviewed by Mx Patel" reads very differently to a wall of unattributed AI text.
4. Never auto-send. Generate → teacher reviews/edits on screen → teacher exports PDF → teacher hands it out or sends it themselves. No automatic parent delivery in v1.

**Prompt, once you're ready to build it:**
```
Read CLAUDE.md for context. Build an AI-drafted, teacher-reviewed
end-of-year / open-evening report generator.

Step 0 — Inventory: read app/api/export/parent-report/[studentId]/route.ts
and lib/pdf/parent-report-template.ts in full — reuse their data-fetch
pattern (submissions, ILP plan, revision exams, SEND concerns, RBAC for
staff + linked parent) rather than re-deriving it. Also read
report-card-template.ts for the academic-performance-by-subject layout.

Step 1 — Add a predicted-vs-actual comparison: pull targetGrade,
predictedGrade, and any StudentBaseline/TeacherPrediction rows,
compare against actual grades from returned submissions this
year/term, per subject.

Step 2 — New server action, e.g. generateReportNarrativeDraft(studentId,
sections?), that builds an AI prompt from ONLY structured data: grades
by subject, predicted vs actual, attendance, ILP targets (the ones
already shareable with parents — reuse whatever gate
SharedWithParentBadge/ChildTransparencyNotice already use), behaviour/
achievement points. Do NOT pull TaNote or ParentContactEntry free text
into this prompt — deliberately excluded, see reasoning above. Return
three draft narrative sections: Performance, Potential, Areas for
Improvement — plain, warm, specific language, no invented facts, no
scores or claims not present in the data it was given.

Step 3 — Teacher-facing review UI: a page where the teacher sees the
full pulled data (predicted vs actual, attendance, ILP targets) plus
the three AI-drafted narrative sections as editable text areas. A
"Regenerate" option per section if the draft misses the mark. Nothing
is final until the teacher is looking at their own edited text.

Step 4 — PDF export reusing the existing generatePdf()/pdfShell()
pipeline: final report includes the structured data, predicted-vs-
actual, and the teacher's (possibly edited) narrative — captioned
"Prepared by [teacher name], [date]" rather than presented as
unattributed system output.

Step 5 — Access: TEACHER/HOD/HOY/SENCO/SLT/SCHOOL_ADMIN can generate
for their own students, same pattern as the existing report-card route.
No parent-facing auto-generation or auto-send in this version.

Build clean, npx tsc --noEmit && npm run build, commit — hold for
review before push, this one touches what gets said to a parent about
their child and deserves a read before it goes live.
```

**Check before approving:** generate a draft for a real demo student with a predicted/target grade mismatch → narrative correctly reflects the gap without inventing anything → edit a section, regenerate another, confirm both save correctly → export PDF → confirm no TaNote/ParentContactEntry content appears anywhere in the output → confirm a PARENT role cannot reach the generation/review step, only staff can, and a parent can only ever receive the finished PDF handed to them by a teacher.
