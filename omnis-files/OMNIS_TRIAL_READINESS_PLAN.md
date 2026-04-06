# Omnis — Trial Readiness Master Plan
## Version 1.0 — April 2026
### For use with Claude Code — work through one phase at a time

---

> **Why this document exists**
> This application is preparing for a live trial in a real school with real 
> students and teachers. Some students have SEND needs. Getting this wrong 
> has real consequences for children. Every phase below must be verified 
> to actually work — not just "built and pushed" — before moving to the next.
>
> **Rule: Never mark a phase complete until every check passes in the live app.**

---

## Current Honest Status

| Area | Status | Blocks Trial? |
|---|---|---|
| Calendar / Lessons | 🟡 Works but some lessons show "no class" | No |
| Student photos | ❌ Not displaying — proxy broken | No |
| Class roster loads | ❌ "Could not load" error on some classes | YES |
| Grade display | 🟡 Inconsistent — some fixed, some not | No |
| Homework set/submit/mark | 🟡 Partially working | YES |
| SEND identification & ILP | 🟡 Data exists, UI broken | YES |
| Adaptive homework from ILP | ❌ ILP not feeding into AI prompts | YES |
| APDR cycle | ❌ Not built | YES |
| Revision (curriculum-mapped) | ❌ Generic only, not curriculum-mapped | YES |
| Adaptive Learning | ❌ Empty state — no data feeding it | YES |
| Analytics (clickable/useful) | ❌ Shows numbers, not interactive | No |
| Wonde MIS data in profiles | 🟡 Synced but not fully displayed | No |
| EHCP auto-generation | ❌ Not built | YES |
| E2E tests passing | ❌ Failing on every push | No |

---

## PHASE 0 — Stabilise (Must complete before any new features)
### Goal: App works reliably for a teacher going through a normal day

**0.1 Fix "Could not load class roster" — CRITICAL**
```
Read CLAUDE.md. The class roster fails to load in both the lesson 
Class tab and the Classes & Analytics page showing "Could not load 
class roster." This blocks the core teacher workflow.

Debug steps:
1. Open browser dev tools → Network tab → find the failing API call
2. Check app/actions/students.ts getClassRoster — run it directly:
   npx tsx --env-file=.env.local -e "
   const {getClassRoster}=require('./app/actions/students');
   getClassRoster('demo-class-10E-En2','school-id').then(console.log).catch(console.error);"
3. Report the exact error — is it a Prisma relation error, a missing 
   field, or a TypeScript runtime error?
4. Fix the root cause — do not wrap in try/catch to hide the error
5. Verify: open lesson → Class tab → all students load for ALL lessons
   Also verify: Classes & Analytics → Run → Roster tab loads students

Run: npx tsc --noEmit && npm run build before pushing.
✓ Check: Every lesson class tab loads students. Classes & Analytics 
  Roster tab loads students. No "Could not load" errors anywhere.
```

**0.2 Fix student photos — definitive**
```
Read CLAUDE.md. Student photos have not displayed despite multiple 
fix attempts. Do this diagnostic FIRST and report findings before 
touching any code:

Step 1 — Check what avatarUrl looks like:
npx tsx --env-file=.env.local -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.user.findFirst({
  where:{avatarUrl:{not:null},role:'STUDENT'},
  select:{id:true,firstName:true,lastName:true,avatarUrl:true}
}).then(u=>console.log(JSON.stringify(u,null,2)));"

Step 2 — Check if proxy route exists:
ls -la app/api/student-photo/

Step 3 — Test the proxy route directly:
Start dev server, then in a new terminal:
curl -I http://localhost:3000/api/student-photo/[userId-from-step-1]
Report the HTTP status code.

Step 4 — Based on findings:
IF avatarUrl starts with 'https://api.wonde.com':
  The proxy MUST fetch it with Authorization header using WONDE_API_TOKEN.
  Update app/api/student-photo/[userId]/route.ts to:
  - Look up user.avatarUrl from DB
  - fetch(user.avatarUrl, {headers:{Authorization:'Basic '+
    Buffer.from(process.env.WONDE_API_TOKEN+':').toString('base64')}})
  - Stream response back with correct Content-Type
  - Test: curl must return HTTP 200 with Content-Type: image/jpeg

IF avatarUrl is a public CDN URL (not Wonde):
  Use it directly in <img src={user.avatarUrl}>
  No proxy needed.

DO NOT mark this fixed until curl returns 200 image/jpeg.

✓ Check: Open class roster in live app — students show real photos 
  or coloured initials (never broken image icons).
```

**0.3 Fix E2E tests or silence them**
```
Read CLAUDE.md. GitHub Actions E2E tests fail on every push creating 
alert noise. Fix or disable:

1. Check .github/workflows/e2e.yml — does the app actually start 
   before tests run? Is there a 'wait-on' step?
2. Check if DATABASE_URL is set in GitHub repository secrets
3. Run tests locally: npx playwright test 2>&1 | head -50
   Report which tests fail and why.
4. If tests can be fixed in < 30 minutes: fix them.
5. If not: set the workflow trigger to manual only:
   Change 'on: push' to 'on: workflow_dispatch'
   This stops the noise without deleting the tests.

✓ Check: Push a commit — no E2E failure email received.
```

---

## PHASE 1 — Core Teaching Loop
### Goal: A teacher can set homework, students can submit, teacher can mark
### This is the foundation everything else depends on

**1.1 Homework: teacher can view all submissions**
```
Read CLAUDE.md. Brief §2 / §4.2: A teacher who sets homework cannot 
see student submissions. This is Critical.

Fix: In homework marking view, teacher must see:
- List of all students in the class
- Each student's submission status (Not started / Submitted / Marked)
- Click a student → see their full answers to each question
- The mark scheme for each question visible alongside
- A GCSE 1-9 grade selector (dropdown 1-9, not free text) per question
- An overall grade field
- Teacher notes field (date-stamped)
- Save grade → student sees their grade

✓ Check: Set homework for 9E/En1 → log in as student → submit 
  answers → log in as teacher → see submission → mark it with 
  Grade 6 → log in as student → see Grade 6 (B) on their homework.
```

**1.2 Grade display: consistent GCSE 1-9 everywhere**
```
Read CLAUDE.md. Ensure lib/gradeUtils.ts exists with formatGrade(), 
gradeLabel(), gradeColour() functions. Then audit EVERY place a 
score or grade is displayed and replace with gradeUtils functions.

Use gradeLabel() for compact views (e.g. class roster): "6 (B)"
Use formatGrade() for full views (e.g. student profile): "Grade 6 (B)"
Use gradeColour() for colour-coded pills.

Never show: "88/9", "Grade 75", "4.3 pts", raw numbers without context.

✓ Check: Open class roster, homework marking view, student profile, 
  analytics, parent view, HOY view, SLT view — all show consistent 
  GCSE grade format.
```

**1.3 Revision: curriculum-mapped, not generic**
```
Read CLAUDE.md. Brief §10, §24: Revision is currently generic 
("complete a retrieval practice task"). It must be curriculum-mapped.

Fix:
1. Revision tasks must pull the topic from the lesson (Lesson.title 
   and Lesson.objectives) not use generic text
2. Questions must be generated by Claude API using the actual topic 
   and objectives as context:
   - 5 questions per revision task
   - Each question mapped to a specific learning objective
   - Questions increase in difficulty: knowledge → application → analysis
   - Mark scheme for each question (1-3 marks each, total 10 marks)
   - GCSE grade boundaries: 9-8=90%+, 7=80%+, 6=70%+, 5=60%+, 4=50%+
3. When student submits: auto-mark where possible, flag for teacher 
   where judgment needed
4. Student sees their score, the mark scheme, and which objectives 
   they need to revisit

✓ Check: Teacher creates revision for "An Inspector Calls — Character 
  Study" → 5 questions about Inspector Calls characters appear (not 
  generic) → student answers → sees grade and mark scheme.
```

---

## PHASE 2 — SEND Core Loop
### Goal: SEND students are identified, ILPs exist, teachers can see needs
### This is the most important phase for trial safety

**2.1 SEND identification: teacher flags concern → SENCO reviews**
```
Read CLAUDE.md. SEND-FRAMEWORK.md Step 1. A teacher must be able to 
flag a student as a potential SEND concern from the class roster.

Build:
1. In class roster, each student row has a "Flag concern" button 
   (⚑ icon). Clicking opens a small form: concern description, 
   urgency (routine/urgent).
2. This creates an EarlyWarningFlag record: studentId, raisedBy, 
   description, urgency, status (OPEN/REVIEWED/ACTIONED), createdAt
3. SENCO dashboard (/senco/dashboard) shows all open flags with 
   student name, teacher, concern, date raised.
4. SENCO can: mark as Reviewed, change student SendStatusValue to 
   SEN_SUPPORT, and trigger ILP generation.
5. Teacher who raised the flag gets a notification when SENCO acts.

✓ Check: Log in as Jay Patel → class roster → flag Rehan Ali → 
  log in as SENCO → see flag on dashboard → mark reviewed and set 
  to SEN_SUPPORT → Jay Patel gets notification.
```

**2.2 ILP: auto-generate and SENCO approve**
```
Read CLAUDE.md. SEND-FRAMEWORK.md Step 1 & 2.

Build auto-generated ILP:
1. Schema: confirm ILP model has autoGenerated, approvedBySenco, 
   approvedAt, approvedBy fields. Run npx prisma db push if needed.
2. generateILPForStudent(studentId, schoolId): calls Claude API to 
   generate a DRAFT ILP with:
   - Student info from DB (name, DOB, year, class, teacher)
   - 3 SMART goals based on year group curriculum expectations
   - Suggested strategies based on any flagged needs
   - Review date: end of current term
3. Bulk action: generateILPsForSchool(schoolId) loops all students 
   with sendStatus SEN_SUPPORT or EHCP who have no approved ILP
4. SENCO reviews in /senco/ilp: can edit all fields, then Approve
5. After approval: visible to class teachers (read-only)
6. ILP audit trail: every edit after approval logged with 
   writeILPAudit() — who, what, when, old value, new value

✓ Check: SEND-FRAMEWORK.md full smoke test steps 1-3 all pass.
```

**2.3 ILP visible to teachers in class and lesson views**
```
Read CLAUDE.md. SEND-FRAMEWORK.md Step 8.

In the lesson Class tab, for each student with an approved ILP:
- Show ILP badge (blue "ILP" tag — already exists)
- Clicking the tag or the student row opens StudentFilePanel
- StudentFilePanel Plans tab shows: ILP SMART goals (3), strategies, 
  review date, evidence entries to date
- In the lesson Overview tab: "Class SEND summary" card shows 
  count of SEN Support and EHCP students with link to full list
- SEND Overview disclosure in Class tab shows each SEND student's 
  primary need and top ILP goal (not just a count)

✓ Check: Jay Patel opens "An Inspector Calls" lesson → Class tab → 
  clicks Sophia Ahmed's ILP badge → sees her 3 SMART goals and 
  Dyslexia strategy. SEND Overview shows "10 students with SEN 
  Support" and lists their primary needs.
```

**2.4 Adaptive homework: ILP feeds into AI generation**
```
Read CLAUDE.md. SEND-FRAMEWORK.md Step 5.

In generateHomeworkFromResources (app/actions/homework.ts):

1. Before calling Claude API, fetch SEND profiles for the class:
   - Group students: NONE / SEN_SUPPORT (with ILP goals) / EHCP 
     (with Section F provisions)

2. Add to the Claude API homework generation prompt:
   "Class SEND profile:
   - [N] students: standard questions only
   - [N] students SEN Support — needs include: [list primary needs]
     For these students add: scaffolding_hint (sentence starter or 
     breaking question into steps)
   - [N] students EHCP — provisions include: [Section F summary]
     For these students add: simplified question text, vocab_support 
     glossary (5 key terms defined simply)"

3. Store per-question in DB: 
   standard_question, scaffolding_hint, ehcp_adaptation, vocab_support

4. Student submission UI (HomeworkTypeRenderer):
   - NONE: sees standard_question
   - SEN_SUPPORT: sees standard_question + scaffolding_hint in 
     blue box below
   - EHCP: sees ehcp_adaptation as main question + vocab_support 
     as collapsible glossary panel + "show original question" toggle

5. Marking view: teacher sees which adaptation was shown to each 
   student. Grade is against same mark scheme for all.

✓ Check: SEND-FRAMEWORK.md smoke test steps 6-8 pass.
  Generate homework for 9E/En1 → EHCP student sees adapted question 
  with vocab support → SEN Support student sees scaffolding hint → 
  standard student sees standard question only.
```

**2.5 ILP evidence from homework marking**
```
Read CLAUDE.md. SEND-FRAMEWORK.md Step 6.

After teacher marks a SEND student's homework:
1. Show non-blocking prompt: "Sophia has an ILP. Record this as 
   evidence? [Record] [Skip]"
2. If Record: show mini modal with ILP SMART goals and AI-suggested 
   evidence type (PROGRESS/CONCERN/NEUTRAL) pre-filled
3. Teacher confirms or edits → saves ILPEvidenceEntry
4. Evidence appears on student's ILP timeline
5. If 3+ CONCERN entries in a term → SENCO early warning flag raised 
   automatically

✓ Check: Mark homework for Sophia Ahmed → click Record → ILP 
  timeline shows new entry → SENCO dashboard shows evidence count.
```

**2.6 APDR cycle per student**
```
Read CLAUDE.md. SEND-FRAMEWORK.md Step 4.

Build Assess, Plan, Do, Review cycle:
1. Schema: AssessPlanDoReview model with all fields. db push.
2. Auto-generate APDR when ILP is approved: AI populates Assess 
   (from ILP diagnosis) and Plan (from ILP strategies). Do and 
   Review start blank.
3. APDR visible in StudentFilePanel as a dedicated tab
4. Teachers can read. SENCO can edit all sections. Teaching 
   assistants can add notes to Do section only.
5. Termly review: "Complete Review" button → saves review text → 
   marks cycle COMPLETE → auto-generates next cycle

✓ Check: Approve ILP for Rehan Ali → APDR auto-created → open 
  his StudentFilePanel → APDR tab shows Assess and Plan populated 
  → TA can add a note to Do section.
```

**2.7 EHCP: auto-generated from ILP escalation**
```
Read CLAUDE.md. SEND-FRAMEWORK.md Step 3.

When SENCO changes student from SEN_SUPPORT to EHCP:
1. Auto-trigger generateEHCPFromILP(studentId)
2. Generate full EHCP structure (Sections A-K per SEND Code of 
   Practice) using Claude API with ILP as source
3. EHCP starts DRAFT, SENCO-only until approved
4. Approved EHCP visible to teachers (read-only)
5. Purple EHCP badge appears next to student in all views

✓ Check: Change Rehan Ali to EHCP status → DRAFT EHCP appears in 
  SENCO dashboard → contains sections from his ILP → approve it → 
  purple badge appears in class roster.
```

**2.8 Full SEND smoke test**
```
Read CLAUDE.md. Run the complete SEND-FRAMEWORK.md smoke test.
All 10 steps must pass. Report pass/fail for each step.
Do not mark Phase 2 complete until all 10 pass.
```

---

## PHASE 3 — Analytics That Drive Action
### Goal: Teacher opens analytics and knows exactly what to do next

**3.1 Analytics: clickable RAG with drill-down**
```
Read CLAUDE.md. Brief §7.3 & §7.4.

Fix analytics so every number is actionable:

1. RAG chips are clickable: clicking "Borderline: 1" filters the 
   student list below to show only those students

2. Each student row in Analytics is clickable → opens StudentFilePanel

3. StudentFilePanel in analytics context shows:
   - GCSE grade trend: last 5 homeworks as a mini sparkline chart
   - Predicted grade vs working-at grade vs target grade
   - RAG status: Green (at/above predicted), Amber (1 grade below), 
     Red (2+ grades below)
   - SEND status and ILP goals if applicable
   - Attendance summary from Wonde (% this term)
   - Last 3 homework titles and grades
   - Teacher notes field

4. Predicted grade: comes from StudentBaseline.predictedGrade
   Teacher prediction: comes from TeacherPrediction model
   Working-at: average of HomeworkSubmission scores this term

5. National average benchmark: for GCSE subjects, national average 
   grade 4+ pass rate is ~67%. Show school vs national as context.

✓ Check: Open Analytics → click "Borderline: 1" → only borderline 
  students show → click a student → see grade trend, predicted vs 
  actual, SEND summary → all data accurate.
```

**3.2 Analytics: pre-filtered to teacher's classes**
```
Read CLAUDE.md. Brief §7.1.

On analytics page load for teacher role:
- Teacher filter: locked to logged-in teacher
- Subject: defaults to teacher's first subject
- Year group: defaults to teacher's first year group  
- Class: defaults to teacher's first class
- SEND filter: "All Pupils" as first option

✓ Check: Log in as Jay Patel → Analytics → pre-filtered to his 
  classes. Does not show other teachers' classes.
```

**3.3 Adaptive Learning: topic heatmap with real data**
```
Read CLAUDE.md. Brief §6.1 & §14.

Adaptive Learning must show real data:

1. For each class: topic heatmap based on homework scores from 
   lessons taught this term. Colour per topic:
   - Green: class avg Grade 6+ on homework for this topic
   - Amber: class avg Grade 4-5
   - Red: class avg Grade 1-3
   - Grey: no homework marked yet for this topic

2. Clicking a topic shows per-student performance on that topic

3. Clicking a student shows their personal topic performance profile:
   - Which topics they're strong in (green)
   - Which topics they need support on (red)
   - Recommended revision topics (auto-identified from red topics)
   - Learning format notes: teacher/SENCO can note "works well with 
     visual aids", "prefers quiz format", "needs oral explanation"
     These notes feed into homework/revision generation preferences.

4. "Generate targeted revision" button: for any red topic, generates 
   revision specifically for that student/topic combination

5. Sidebar must persist on ALL Adaptive Learning pages

✓ Check: Open Adaptive Learning → class heatmap shows real colours 
  based on marked homework → click a red topic → see which students 
  are struggling → click a student → see their topic profile → 
  generate targeted revision for their weakest topic.
```

---

## PHASE 4 — Trial Readiness Checks
### Goal: App is safe and reliable for a real school

**4.1 Data safety checks**
```
Read CLAUDE.md. Before trial, verify:

1. schoolId scoping: every Prisma query in app/actions/ must have 
   a schoolId where clause. Run:
   grep -r "prisma\." app/actions/ | grep -v "schoolId" | grep -v "//"
   Report any queries missing schoolId scoping.

2. SEND data visibility: ILP/EHCP content must never be visible to 
   students or parents. Check every route that a student session 
   can access — confirm no ILP/EHCP data leaks.

3. Role enforcement: middleware must redirect unauthorised roles.
   Test: log in as student, manually navigate to /senco/ilp → 
   must redirect, not show data.

4. Audit trail: every ILP/EHCP change after approval must create 
   an audit entry. Verify writeILPAudit() is called correctly.

✓ Check: All schoolId scoping confirmed. Student cannot access 
  SENCO routes. ILP audit entries created on edit.
```

**4.2 Performance check**
```
Read CLAUDE.md. Check performance for a class of 32 students:

1. Lesson Class tab load time: must be < 3 seconds
2. Analytics page load: must be < 5 seconds  
3. Homework generation: must complete < 30 seconds
4. ILP generation: must complete < 60 seconds (show progress bar)

If any are slow: add loading skeletons, paginate where needed, 
cache repeated queries.

✓ Check: All load times within limits on the Vercel deployment 
  (not just localhost).
```

**4.3 Error handling**
```
Read CLAUDE.md. Every user-facing error must be helpful:

1. No white screens — every page has error.tsx
2. No "undefined" or "null" visible to users
3. AI generation failures show: "Generation failed — please try 
   again. If this persists contact your administrator."
4. Network errors show retry option
5. Grade submission failures do not lose student work

✓ Check: Disconnect network mid-homework submission → student sees 
  clear error, work is preserved. AI generation with invalid input → 
  clear error message shown.
```

**4.4 Full trial readiness smoke test**
```
Read CLAUDE.md. Run complete end-to-end trial readiness test as 
each role:

AS TEACHER (Jay Patel):
□ Open calendar → see this week's lessons
□ Click a lesson → see Class tab with all students loaded
□ Set homework for 9E/En1 → verify it appears in student view
□ Open Analytics → see class performance with correct grades
□ Flag a student concern → confirm SENCO notified

AS STUDENT (EHCP student):
□ Log in → see homework in dashboard
□ Open homework → see adapted question with vocab support
□ Submit homework → see confirmation

AS STUDENT (SEN Support):
□ Open same homework → see scaffolding hint (not EHCP adaptation)

AS STUDENT (no SEND):
□ Open same homework → see standard question only

AS SENCO:
□ See teacher concern flag on dashboard
□ Set student to SEN_SUPPORT → generate ILP → approve ILP
□ See ILP evidence entries from marked homework
□ View SEND analytics dashboard

AS SLT:
□ Open analytics → see school-wide performance
□ See SEND Overview tab with attainment gap

Report: PASS / FAIL for each step with screenshot evidence.
Do not proceed to trial until all steps pass.
```

---

## What to Do Right Now (Today)

**Start with Phase 0.1 — the class roster error.**
This is blocking everything else. Paste prompt 0.1 into Claude Code.

After that: 0.2 (photos), 0.3 (E2E tests).

Then work through phases 1 → 2 → 3 → 4 in order.

**Do not skip ahead.** Phase 2 (SEND) depends on Phase 1 (homework 
marking) working correctly. Phase 3 (analytics) depends on Phase 1 
and 2 data existing.

---

## One Rule for Every Claude Code Session

End every session with:
```
Read CLAUDE.md. Run the pre-deploy checklist:
1. npx tsc --noEmit — must return zero errors
2. npm run build — must complete successfully
3. Update CLAUDE.md with what changed this session
4. git add -A && git commit -m "[phase] [description]" && git push
```

---

*Document owner: Omnis Education*  
*Last updated: April 2026*  
*Next review: After Phase 0 complete*
