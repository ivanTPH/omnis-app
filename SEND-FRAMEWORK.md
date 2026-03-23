# Omnis — SEND Framework
## Prompt Framework: ILP / EHCP / APDR / K Plan / Adaptive SEND System

> Each entry: **What** (one sentence) · **Prompt** (paste into Claude Code terminal) · **Check** (single verification before moving on)
> Run `npm run build` cleanly before starting. Commit after each step passes its check.

---

## K Plan / Learning Passport — Concept

A **K Plan** (also called a Learning Passport in some UK authorities) is a one-page pupil profile created collaboratively by the student, their parents, and the SENCO. It sits alongside or within an ILP and answers: *"What works for me in the classroom."* Unlike a clinical ILP target, it is:

- **Student-authored** — written in the student's own voice ("I learn best when…", "Please help me by…", "Don't do this…")
- **Shareable with every teacher** — surfaces inside the lesson planning view so teachers see it before the lesson, not after
- **Living document** — updated each APDR cycle, not just at annual review
- **Not a diagnosis** — never contains clinical labels or test scores; focuses only on classroom strategies

### K Plan fields (schema)
| Field | Type | Description |
|---|---|---|
| `iLearnBestWhen` | `String?` | Free text, student voice |
| `pleaseHelpMeBy` | `String?` | Specific teacher actions that help |
| `dontDoThis` | `String?` | Things that are unhelpful or cause anxiety |
| `myStrengths` | `String[]` | Strengths identified by student / SENCO |
| `communicationStyle` | `String?` | How the student prefers to receive feedback |
| `examAccessArrangements` | `String[]` | Formal access arrangements (reader, extra time, etc.) |
| `lastUpdatedBy` | `String?` | userId of last editor |

### K Plan rules
- One K Plan per student (`studentId` unique on the model)
- Always scoped by `schoolId` — never cross-school
- Visible to: the student, their parents, SENCO, SLT, and any teacher who teaches a class the student is enrolled in
- Writable by: SENCO only (student and parent input is collected in a form, then SENCO publishes)
- K Plan content must never be passed to external APIs without explicit consent flag (`gdprConsented: true`)
- Show in LessonFolder SEND & Inclusion tab alongside ILP targets — use a distinct pastel-green card to visually separate it from clinical data

---

## Current Status

| Step | Feature | Status |
|---|---|---|
| 1 | Auto-generate ILPs from SEND concerns | 🟡 Partial — concerns exist, ILP creation is manual |
| 2 | ILP audit log | 🟡 Partial — AuditLog exists, ILP changes not always logged |
| 3 | EHCP escalation from ILP | 🟢 Built — EhcpPlan model exists, escalation action exists |
| 4 | Assess Plan Do Review (APDR) cycle | 🟡 Partial — review dates exist, APDR workflow not complete |
| 5 | ILP targets feed adaptive homework | 🟡 Partial — ilpTargetIds on Homework, not used in generation |
| 6 | Homework marks feed ILP evidence | 🟢 Built — IlpHomeworkLink + HomeworkEhcpEvidence exist |
| 7 | SLT SEND reporting dashboard | 🔴 Not built |
| 8 | SEND visibility in lesson planning | 🟡 Partial — SEND tab exists in LessonFolder, class-level only |
| 2A | SEND risk screen on submission | 🟢 Built — Claude Haiku screen fires after submitHomework; stores Submission.sendRiskScore |
| 2B | SEND flagging to teacher + SENCO | 🟢 Built — SUBMISSION_FLAGGED Notification when sendRiskScore > 60, deduped |
| 2C | Adaptive profile update after marking | 🟢 Built — sendConcernLevel + lastHomeworkAt on StudentLearningProfile |
| 9 | K Plan / Learning Passport generation | 🔴 Not built |
| 10 | In-lesson teacher action strip | 🔴 Not built |

---

## Step 1 — Auto-generate ILPs from SEND concerns

**What:** When a SEND concern is raised for a student, automatically draft an ILP with targets pre-populated from the concern details using AI.

**Prompt:**
```
Read CLAUDE.md for context. Feature: when a SENCO raises or approves a SendConcern for a student, the system should offer to auto-generate a draft ILP.

1. Check app/actions/send-support.ts — find the action that creates or updates a SendConcern. After the concern is saved with status APPROVED or ESCALATED, trigger ILP draft generation.
2. Create a new server action generateIlpDraft(concernId: string) in app/actions/send-support.ts:
   a. Fetch the concern: category, description, urgency, studentId, schoolId.
   b. Fetch the student's existing SendStatus (need area, activeStatus).
   c. Call the Anthropic API (claude-sonnet-4-6, max_tokens: 1000) with a prompt:
      "You are a UK SENCO generating a draft Individual Learning Plan. Student concern: [concern description]. SEND category: [category]. Generate 3 specific, measurable ILP targets with success criteria following the SMART framework. Return JSON: { targets: [{ target: string, strategy: string, successMeasure: string, targetDate: string (ISO, 12 weeks from now) }] }"
   d. Parse the response and create an IndividualLearningPlan record (status: DRAFT) with the generated IlpTarget records.
   e. Write an audit entry: AuditAction.ILP_CREATED.
3. In the SENCO UI (components/send-support/SencoDashboard.tsx or the concern detail view): after approving a concern, show a banner: "Draft ILP generated — review and activate in /senco/ilp/[studentId]".
4. Fall back gracefully if the API call fails — create an empty ILP shell without targets rather than blocking.
5. Run: npx tsc --noEmit.
```

**Check:** Approve a SEND concern as the demo SENCO → a draft ILP appears in /senco/ilp/[studentId] with 3 pre-populated targets. Prisma Studio shows an IndividualLearningPlan record with status DRAFT and linked IlpTarget rows.

---

## Step 2 — ILP audit log

**What:** Ensures every change to an ILP or its targets is recorded in the AuditLog so SENCO and SLT have a complete history.

**Prompt:**
```
Read CLAUDE.md for context. Feature: all ILP mutations must write to the AuditLog so that SEND history is fully traceable.

1. Check app/actions/send-support.ts and app/actions/ehcp.ts — find every function that creates, updates, or archives an ILP or IlpTarget.
2. After each mutation, call writeAudit() from lib/prisma.ts. Use AuditAction.ILP_CREATED for creation, and add new AuditAction values if needed: ILP_UPDATED, ILP_TARGET_ACHIEVED, ILP_ARCHIVED (add to schema.prisma AuditAction enum if missing, then run: source .env.local && npx prisma db push).
3. Each audit entry must include: userId (the SENCO making the change), schoolId, targetId (the ILP id), action, and a details JSON with: { studentId, field changed, old value, new value }.
4. In the SENCO ILP detail view (/senco/ilp/[studentId]): add a collapsible "Change history" section at the bottom. Fetch AuditLog entries where targetId = ilp.id, ordered by createdAt DESC, and render each as: "[date] [user name] — [action] — [details summary]".
5. Run: npx tsc --noEmit.
```

**Check:** Update an ILP target as the SENCO → the Change history section shows the new entry. Prisma Studio shows the AuditLog record with correct fields.

---

## Step 3 — EHCP escalation from ILP

**What:** Allows a SENCO to escalate an active ILP to an EHCP request when the student's needs exceed what SEN Support can address, creating an EhcpPlan draft linked to the ILP.

**Prompt:**
```
Read CLAUDE.md for context. Feature: EHCP escalation flow from an existing ILP.

The EhcpPlan model and createEhcpPlan action already exist in app/actions/ehcp.ts. Wire up the escalation UI:

1. In the SENCO ILP detail view (/senco/ilp/[studentId]): add an "Escalate to EHCP" button, visible only when the ILP status is ACTIVE and the student's SendStatus.activeStatus is SEN_SUPPORT (not already EHCP).
2. Clicking the button should call a new server action escalateIlpToEhcp(ilpId: string) in app/actions/ehcp.ts:
   a. Fetch the ILP and its active targets.
   b. Create an EhcpPlan (status: DRAFT) with: studentId, schoolId, a note linking it to the source ILP id (store in a new field or in the plan text).
   c. Update the student's SendStatus.activeStatus to EHCP.
   d. Write audit entries: SEND_STATUS_CHANGED and ILP_ARCHIVED (set the ILP status to ARCHIVED).
   e. Create a Notification for the SENCO confirming escalation.
3. After escalation, redirect to /senco/ehcp to show the new draft EHCP plan.
4. Run: npx tsc --noEmit.
```

**Check:** Open an active ILP as SENCO → click "Escalate to EHCP" → redirected to /senco/ehcp showing a new DRAFT plan for this student. Student's SendStatus shows EHCP in Prisma Studio. Original ILP status is ARCHIVED.

---

## Step 4 — Assess Plan Do Review (APDR) cycle

**What:** Implements the statutory APDR review cycle: triggers a scheduled review prompt when an ILP target review date is due, records the review outcome, and re-plans new targets for the next cycle.

**Prompt:**
```
Read CLAUDE.md for context. Feature: Assess Plan Do Review (APDR) cycle for ILP management.

1. Review trigger — the early warning cron already runs Monday–Friday at 06:00 UTC (/api/cron/early-warning). Extend lib/send/early-warning.ts to also check:
   - Any IlpTarget where status = 'active' AND targetDate <= today + 7 days.
   - For each, create a Notification for the SENCO: "ILP target review due: [student name] — [target description]. Review by [targetDate]."
   - Do not create duplicate notifications — check for an existing notification with the same targetId within the last 7 days.

2. Review action — in the ILP detail view, each IlpTarget should have a "Record review" button. Clicking it opens a modal with:
   a. Outcome: achieved / not_achieved / deferred (maps to IlpTarget.status valid values from CLAUDE.md).
   b. Progress notes textarea.
   c. New target date (if deferred).
   Create a server action recordIlpTargetReview(targetId, outcome, notes, newTargetDate?) that updates the IlpTarget and writes an audit entry ILP_TARGET_ACHIEVED (or ILP_UPDATED).

3. Re-plan — after marking ALL targets on an ILP as achieved or not_achieved, show a "Start new APDR cycle" button that calls generateIlpDraft(concernId) (from Step 1) to generate fresh targets, adding them to the same ILP (do not create a new one).

4. Run: npx tsc --noEmit.
```

**Check:** Set an IlpTarget.targetDate to yesterday in Prisma Studio → restart dev server → check /notifications as SENCO — review-due notification appears. Record a review outcome → IlpTarget.status updates. AuditLog shows the review entry.

---

## Step 5 — ILP targets feed adaptive homework generation

**What:** Uses a student's active ILP targets as additional context when generating homework, so AI-generated questions explicitly address their identified learning needs.

**Prompt:**
```
Read CLAUDE.md for context. Feature: ILP targets from the class's SEND students must directly influence AI homework generation.

The SEND context block is already partially built in generateHomeworkFromResources (app/actions/homework.ts). Extend it:

1. In the SEND context fetch block (after fetching sendStatuses), also fetch active IlpTargets for all SEND students in the class:
   - Find enrolled students with SendStatus.activeStatus != NONE.
   - For each, fetch their active IlpTargets (status = 'active').
   - Group by need area.

2. Extend the SEND context block added to the AI prompt:
   "ACTIVE ILP TARGETS FOR THIS CLASS:
   [list up to 5 unique targets: "Target: [target description] — Success measure: [successMeasure]"]
   When generating scaffolding_hint values for each question, reference these specific ILP targets where relevant. Use sentence starters or vocabulary scaffolds that address: [need areas]."

3. After homework is created (createHomework in app/actions/homework.ts), auto-link the homework to relevant ILP targets:
   - For each IlpTarget that was included in the prompt context, call prisma.ilpHomeworkLink.create({ ilpTargetId, homeworkId, linkedBy: userId, evidenceNote: 'Auto-linked during homework generation' }).

4. Run: npx tsc --noEmit.
```

**Check:** Generate homework for a class that has at least one student with an active ILP → check Prisma Studio: IlpHomeworkLink records exist linking the homework to the ILP target(s). The AI prompt in Vercel function logs shows the "ACTIVE ILP TARGETS" section.

---

## Step 6 — Homework marks feed ILP evidence

**What:** Records marked homework submissions as evidence against linked ILP targets and EHCP outcomes, creating an automatic evidence trail for SEND reviews.

**Prompt:**
```
Read CLAUDE.md for context. The IlpHomeworkLink and HomeworkEhcpEvidence models already exist. Wire them into the marking flow so evidence is captured automatically.

1. In markSubmission (app/actions/homework.ts), after saving the final grade:
   a. Fetch any IlpHomeworkLink records where homeworkId = hw.id.
   b. For each linked IlpTarget, update its progressNotes by appending: "[date]: Homework '[homework title]' — Score: [finalScore]. Grade: [grade]."
   c. Write an audit entry ILP_UPDATED.

2. In markSubmission, also:
   a. Fetch any HomeworkEhcpEvidence records where submissionId = submission.id.
   b. For each linked EhcpOutcome, call linkSubmissionToEhcpOutcome from app/actions/ehcp.ts to record the mark as evidence.

3. In the SENCO ILP detail view, in the targets list, add a "Evidence" collapsible per target showing:
   - Each linked homework title, date set, student's score/grade.
   - Pull from IlpHomeworkLink → Homework → Submission (filtered to this student).

4. Run: npx tsc --noEmit.
```

**Check:** Mark a homework submission as teacher → open /senco/ilp/[studentId] → the ILP target linked to this homework shows the new evidence entry. Prisma Studio shows updated progressNotes on the IlpTarget.

---

## Step 7 — SLT SEND reporting dashboard

**What:** Builds a new SLT-accessible dashboard showing school-wide SEND metrics: student counts by status, ILP completion rates, EHCP pipeline, overdue reviews, and homework SEND engagement.

**Prompt:**
```
Read CLAUDE.md for context. Build a new SLT SEND reporting dashboard.

1. Create route: app/slt/send/page.tsx (server component). Guard: role must be SLT or SCHOOL_ADMIN.
2. Create server action getSendReportingData(schoolId) in app/actions/analytics.ts returning:
   a. sendCounts: { none: number, senSupport: number, ehcp: number } — from SendStatus grouped by activeStatus.
   b. ilpStats: { active: number, underReview: number, archived: number, overdueReviews: number (targetDate < today, status = active) }.
   c. ehcpStats: { draft: number, active: number, annualReviewDue: number }.
   d. homeworkSendEngagement: for the last 30 days, count submissions from SEND students vs total submissions, and average finalScore for SEND vs non-SEND students.
   e. topConcernCategories: top 3 SendConcern.category values by count, last 90 days.
3. Render with Recharts charts:
   - Donut/Pie: SEND status breakdown (none / SEN Support / EHCP).
   - Bar: ILP status counts.
   - Stat cards: overdue reviews count (red if > 0), EHCP annual reviews due.
   - Bar: SEND vs non-SEND average homework score (last 30 days).
4. Add "SEND Report" to the SLT sidebar nav in components/Sidebar.tsx.
5. Run: npx tsc --noEmit. Then: npm run build.
```

**Check:** Log in as c.roberts@omnisdemo.school (SLT) → /slt/send → dashboard renders with real data. Donut chart shows correct SEND breakdown matching Prisma Studio counts. "SEND Report" appears in sidebar.

---

## Step 8 — SEND visibility in lesson planning

**What:** Shows each teacher a real-time SEND summary when planning a lesson — student-level need areas, active ILP targets, and EHCP outcomes — so they can adapt resources and homework before the lesson happens.

**Prompt:**
```
Read CLAUDE.md for context. Feature: improve SEND visibility inside the lesson planning flow in LessonFolder.

The SEND & Inclusion tab already exists in LessonFolder. Enhance it:

1. In getLessonDetails (app/actions/lessons.ts), extend the SEND data already fetched to also include:
   a. For each enrolled student with a SEND status: their active IlpTargets (status = active, take 3 per student).
   b. For each enrolled student with an EHCP plan: the active EhcpOutcomes (take 2 per student).
   Return these as: ilpTargetsByStudent: Record<string, IlpTarget[]>, ehcpOutcomesByStudent: Record<string, EhcpOutcome[]>.

2. In the SEND & Inclusion tab of LessonFolder.tsx (look for activeTab === 'SEND & Inclusion'): for each student shown in the SEND list, add an expandable row showing:
   - Their ILP targets (as a compact list: target description + status badge).
   - Their EHCP outcomes if applicable (outcome description).
   - A "Suggest adaptation" button that calls a new server action suggestLessonAdaptation(studentId, lessonId) — a lightweight Claude API call returning 1–2 bullet point suggestions for adapting this lesson for this student's specific ILP targets.

3. In the lesson overview (Overview tab), add a compact SEND summary banner at the top if the class has any SEND students: "X students with SEND needs in this class — [link to SEND & Inclusion tab]". Pull the count from the already-loaded sendStatuses.

4. Run: npx tsc --noEmit.
```

**Check:** Open a lesson for a class that has SEND students → SEND & Inclusion tab shows each student's active ILP targets. Overview tab shows the SEND summary banner. "Suggest adaptation" returns a 1–2 bullet suggestion for a student with an active ILP.

---

## Step 9 — K Plan / Learning Passport generation

**What:** Creates a student-authored one-page profile (K Plan) describing how they learn best, surfaces it inside the teacher's lesson planning view, and generates a first draft from their ILP and SEND concern history using AI.

**Prompt:**
```
Read CLAUDE.md and SEND-FRAMEWORK.md (K Plan concept section) for context. Build the K Plan / Learning Passport feature.

1. Schema — add a new model KPlan to prisma/schema.prisma:
   model KPlan {
     id                     String   @id @default(cuid())
     schoolId               String
     studentId              String   @unique
     gdprConsented          Boolean  @default(false)
     iLearnBestWhen         String?
     pleaseHelpMeBy         String?
     dontDoThis             String?
     myStrengths            String[]
     communicationStyle     String?
     examAccessArrangements String[]
     lastUpdatedBy          String?
     createdAt              DateTime @default(now())
     updatedAt              DateTime @updatedAt
     school   School @relation(fields: [schoolId], references: [id])
     student  User   @relation(fields: [studentId], references: [id])
     @@index([schoolId])
   }
   Run: source .env.local && npx prisma db push.

2. Server actions — create app/actions/kplan.ts with:
   a. getKPlan(studentId): fetch KPlan for a student (staff or the student themselves).
   b. upsertKPlan(studentId, data): SENCO-only; create or update. Write audit entry K_PLAN_UPDATED.
   c. generateKPlanDraft(studentId): SENCO-only; fetches the student's ILP targets, SEND concerns,
      and sendConcernLevel from StudentLearningProfile. Calls Claude (claude-sonnet-4-6, max_tokens: 600):
      "You are a UK SENCO helping a student write their Learning Passport in their own voice.
       Based on: ILP targets [list], SEND concerns [list], need areas [list].
       Generate a draft K Plan as JSON:
       { iLearnBestWhen, pleaseHelpMeBy, dontDoThis, myStrengths: string[], communicationStyle }
       Write in first person, positive, practical — no clinical language, no diagnosis labels."
      Guard: only call if KPlan.gdprConsented = true.

3. SENCO UI — add a "K Plan" tab or section to /senco/ilp/[studentId]:
   - Show the K Plan fields in a pastel-green card.
   - "Generate draft" button calls generateKPlanDraft.
   - Editable form fields (SENCO can refine before publishing).
   - GDPR consent toggle must be on before generating.

4. Teacher visibility — in getLessonDetails (app/actions/lessons.ts), for each enrolled SEND student,
   also fetch their KPlan (if gdprConsented = true). Return as kPlanByStudent: Record<string, KPlan>.
   In LessonFolder SEND & Inclusion tab: render the K Plan as a distinct pastel-green card below each
   student's ILP targets. Show: iLearnBestWhen, pleaseHelpMeBy, examAccessArrangements only.

5. Run: npx tsc --noEmit. Then: npm run build.
```

**Check:** Log in as SENCO → /senco/ilp/[studentId] → K Plan section visible → toggle GDPR consent on → click "Generate draft" → K Plan fields populated in student's voice → save → log in as teacher → open a lesson for that student's class → SEND & Inclusion tab shows K Plan card in pastel green. Prisma Studio shows KPlan record with gdprConsented = true.

---

## Step 10 — In-lesson teacher action strip

**What:** Adds a compact, always-visible action bar at the top of the SEND & Inclusion tab in LessonFolder that gives teachers one-click access to the four most common mid-lesson SEND responses: request cover support, log a real-time concern, view a student's K Plan, and suggest a quick classroom adaptation.

**Prompt:**
```
Read CLAUDE.md and SEND-FRAMEWORK.md (K Plan concept section) for context. Build the in-lesson teacher action strip.

1. In LessonFolder.tsx, inside the SEND & Inclusion tab panel, add a horizontal action strip at the very top (before the student list). The strip has four buttons:

   a. "Request support" — opens a small modal to log a cover/support request:
      Fields: urgency (low/medium/high), details textarea. Calls a new action requestLessonSupport(lessonId, urgency, details) that creates a Notification for COVER_MANAGER and SENCO.

   b. "Log concern" — opens the existing SendConcern creation flow pre-filled with lessonId and classId. Reuse the existing concern creation server action from app/actions/send-support.ts.

   c. "View K Plans" — toggles an overlay panel listing all K Plans for SEND students in this class (fetched from the already-loaded kPlanByStudent from Step 9). Each shows iLearnBestWhen and pleaseHelpMeBy only. No external API call.

   d. "Quick adapt" — calls suggestLessonAdaptation(classId, lessonId) already built in Step 8 but at class level (not per-student). Returns 3 quick bullet-point suggestions for the whole class based on the SEND profile mix. Display inline below the strip.

2. The strip must be visually distinct: use a light amber background (`bg-amber-50 border border-amber-200`) to signal it is a live-lesson tool, not a planning tool.

3. Add the new action requestLessonSupport to app/actions/lessons.ts or a new app/actions/cover.ts. It must:
   - Create Notification records for all users with role COVER_MANAGER in the school.
   - Create Notification records for all users with role SENCO in the school.
   - Include the lesson date, class name, and teacher name in the notification body.
   - Write an audit entry: LESSON_PUBLISHED (reuse — or add LESSON_SUPPORT_REQUESTED to AuditAction enum if cleaner).

4. Run: npx tsc --noEmit. Then: npm run build.
```

**Check:** Open any lesson as teacher → SEND & Inclusion tab → amber action strip visible at the top. Click "Request support" → fill in the form → log in as SENCO in another tab → /notifications shows the support request. Click "View K Plans" → overlay shows K Plans for SEND students. Click "Quick adapt" → 3 bullet suggestions appear inline.

---

## The Full SEND Loop — Integration smoke test

**What:** Runs through all 10 steps end-to-end in one session to confirm the complete SEND system works together.

**Prompt:**
```
Read CLAUDE.md for context. Run an end-to-end smoke test of the SEND framework:

1. Log in as SENCO (r.morris@omnisdemo.school / Demo1234!) → raise a SendConcern for a student → approve it → confirm a draft ILP is auto-generated at /senco/ilp/[studentId].
2. Open the ILP → confirm 3 targets exist with review dates → confirm AuditLog shows ILP_CREATED.
3. Set one ILP target's reviewDate to yesterday in Prisma Studio → restart dev server → check /notifications → confirm review-due notification appeared.
4. Record a review outcome for that target (achieved) → confirm IlpTarget.status = 'achieved'.
5. Click "Escalate to EHCP" on the ILP → confirm redirect to /senco/ehcp with a new draft EHCP plan.
6. Log in as teacher (j.patel@omnisdemo.school / Demo1234!) → open a lesson for the student's class → Resources tab → add a resource → generate homework → confirm SEND scaffolding hints appear in questions.
7. Check Prisma Studio → IlpHomeworkLink records exist for the generated homework.
8. Mark a student submission as teacher → open /senco/ilp/[studentId] → confirm evidence row appears under the linked ILP target.
9. Log in as SLT (c.roberts@omnisdemo.school / Demo1234!) → /slt/send → confirm SEND dashboard renders with the EHCP and ILP counts updated.
10. Open any lesson as teacher → SEND & Inclusion tab → confirm ILP targets are visible per student.
11. As SENCO: toggle GDPR consent on for a student → generate K Plan draft → confirm K Plan fields are populated in student voice. Open the lesson as teacher → SEND & Inclusion tab → confirm K Plan pastel-green card appears.
12. As teacher in the SEND & Inclusion tab → click "Request support" → confirm SENCO and cover manager receive a notification.
13. Check Submission.sendRiskScore in Prisma Studio for a recent student submission — confirm it has been set by the async SEND screen (may need to wait ~10s after submission).

Report pass/fail for each step and any errors seen.
```

**Check:** All 13 steps report pass. No TypeScript errors (`npx tsc --noEmit`). Clean build (`npm run build`).

---

## Notes

- **ILPTarget.status valid values:** `"active"` | `"achieved"` | `"not_achieved"` | `"deferred"` — **never** `"in_progress"`. This has caused production crashes before.
- **K Plan GDPR gate:** never pass K Plan content to any external API unless `KPlan.gdprConsented = true`. Check this in every server action that calls Claude with K Plan data.
- **K Plan is student voice, not clinical:** AI generation prompts must explicitly forbid diagnosis labels, test scores, and clinical terminology. Use positive, first-person language only.
- **K Plan visibility scope:** teachers see K Plan only for students in classes they teach. SENCO sees all. Parents and the student themselves can see their own. Never expose to other students.
- **Multi-tenancy** — every Prisma query must be scoped with `schoolId` from session. SEND data is especially sensitive.
- **SEND data is read by SENCO, SLT, and class teachers** — but only for students in their school. Never expose SEND data across school boundaries.
- **ILP auto-generation falls back silently** — if the Anthropic API call fails, create an empty ILP shell (no targets) rather than blocking. Teachers can add targets manually.
- **Notifications use the existing pattern** — use the Notification model and the pattern in `lib/send/early-warning.ts`. Do not build a new notification system.
- **Evidence is immutable** — IlpHomeworkLink and HomeworkEhcpEvidence are INSERT-only. Do not delete evidence records.
- **sendRiskScore is async** — it is written to Submission after the student sees their confirmation screen. Never block on it. Teachers see it when they open the marking panel.
- After completing all steps, run: `git add -A && git commit -m "feat: SEND framework — steps 1-10 complete"`
- Then update CLAUDE.md: `claude "Update CLAUDE.md to reflect the completed SEND framework — steps 1-10, K Plan model, in-lesson action strip."`
