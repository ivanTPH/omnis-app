# Omnis — Adaptive Learning Loop
## Prompt Framework: Teacher Lesson → Adaptive Student Journey

> Each entry: **What** (one sentence) · **Prompt** (paste into Claude Code terminal) · **Check** (single verification before moving on)
> Run `npm run build` cleanly before starting. Commit after each step passes its check.

---

## Current Status

| Step | Feature | Status |
|---|---|---|
| 1 | Teacher selects class from calendar | 🔴 Bug — classes not appearing |
| 2 | Resources filtered by lesson topic | 🔴 Bug — unfiltered / broken |
| 3 | Homework generated from resources | 🟡 Built but needs wire-up to lesson context |
| 4 | Homework sent to class on lesson completion | 🟢 Built |
| 5 | SEND screening during homework submission | 🟡 Partial — scoring exists, not triggered on submit |
| 6 | Flag SEND needs to teacher + SENCO | 🟡 Partial — early warning exists, not linked to homework |
| 7 | Adaptive learning profile per student | 🟡 Partial — adaptive actions exist, not fully wired |

---

## Step 1 — Fix: Classes disappearing from the teacher calendar

**What:** Diagnoses why a teacher's classes no longer appear on the weekly calendar and restores them.

**Prompt:**
```
Read CLAUDE.md for context. Bug: a teacher opens the weekly calendar on /dashboard and their classes have disappeared — the calendar is empty. Investigate:
1. Check getWeekLessons() in app/actions/lessons.ts — confirm the OR query fetches lessons where the class has this teacher OR lessons created by this teacher (classless lessons).
2. Check WeeklyCalendar.tsx — confirm it is calling getWeekLessons() correctly and passing the right weekStartISO.
3. Check that the demo teacher in the seed has classes assigned — run: npx prisma studio and inspect the SchoolClass table for teacherId.
4. If the query is correct but data is missing, re-run: npm run db:seed then npm run db:seed-classes.
Fix whatever is broken and explain the root cause.
```

**Check:** Log in as the demo teacher (`teacher@demo.com` / `Demo1234!`), open `/dashboard` — at least 3 lessons appear on the current week's calendar.

---

## Step 2 — Fix: Resources must be filtered by lesson topic

**What:** Ensures that when a teacher opens the Resources tab inside a lesson, only resources relevant to that lesson's subject and topic are shown — not the full library.

**Prompt:**
```
Read CLAUDE.md for context. Bug/feature gap: when a teacher opens LessonFolder and goes to the Resources tab, the resource search (UnifiedResourceSearch) either shows everything or shows nothing. It should automatically search for resources matching the lesson's topic title (e.g. "Battle of Hastings 1066") using:
1. Oak National Academy search — searchOakLessons() using per-term splitting on the lesson title keywords, scoped to the lesson's subject slug and year group.
2. School library search — getSchoolResourceLibrary() filtered by subject and keyword match.

Check UnifiedResourceSearch.tsx:
- It should receive props: lessonId, subjectSlug, yearGroup, lessonTitle.
- On mount it should fire an initial search using keywords extracted from lessonTitle (split to 2-3 meaningful terms, strip stop words like "the/of/a").
- Two-pass search: first with yearGroup filter, if < 3 results broaden to subject-only.
- The subjectSlug guard must be present — skip load if subjectSlug is absent.
- After adding a resource, show the "Generate homework from these resources?" banner.

Also check LessonFolder.tsx passes the correct props to UnifiedResourceSearch and that toOakSubjectSlug() maps the lesson subject correctly.

Fix all gaps and test with a History lesson titled "Battle of Hastings 1066".
```

**Check:** Open a History lesson in the calendar → Resources tab. Within 2 seconds, relevant Oak resources for the lesson topic appear. Adding one resource shows the "Generate homework?" banner.

---

## Step 3 — Wire-up: Homework generation pulls from saved lesson resources

**What:** Connects the "Generate Homework" flow so it reads the resources already saved to the lesson and uses them as the source material for AI-generated questions.

**Prompt:**
```
Read CLAUDE.md for context. Feature wire-up: when a teacher clicks "Generate homework" (either from the Resources tab banner or the Homework tab in LessonFolder), the homework creator (HomeworkCreatorV2) should:

1. Pre-populate the resource source from the lesson's already-saved resources (getHomeworkForLesson or getLessonDetails — use the resources array already on the lesson).
2. Pass those resources into generateHomeworkFromResources() in app/actions/homework.ts.
3. The AI prompt inside generateHomeworkFromResources must include: the lesson title, the subject, the year group, and the full text/URL of each resource as context.
4. The teacher should be able to select homework type (quiz, short answer, structured essay, etc.) before generation — this type must be passed to the AI prompt so questions match the format.
5. After generation, the teacher reviews questions before saving — the existing HomeworkCreatorV2 wizard step 5 (review) handles this.

Ensure the onGenerateHomework callback in LessonFolder switches to the Homework tab and opens the wizard at step 5 (resource/generation step). Check this callback is wired correctly.

Log to console: [generateHomeworkFromResources] lesson title, resource count, homework type — so we can diagnose AI failures in Vercel logs.
```

**Check:** Open a lesson with at least 1 saved resource → click "Generate homework" → select "Quiz" type → AI returns 5+ questions with answers within 15 seconds. Questions are clearly about the lesson topic.

---

## Step 4 — Verify: Homework is sent to pupils when lesson ends

**What:** Confirms the existing homework publish flow correctly sends homework to all pupils in the class when the lesson is marked complete or at the scheduled due time.

**Prompt:**
```
Read CLAUDE.md for context. Verify the homework send flow end-to-end:
1. Check that when a teacher publishes homework (status: PUBLISHED), all students in the linked class can see it in their /student/dashboard and /student/homework/[id].
2. Check StudentDashboard.tsx and getStudentHomework() in app/actions/student.ts — confirm homework is fetched by the student's enrolled classes, not just by direct assignment.
3. Check that the homework due date, title, and type are displayed correctly on the student dashboard.
4. If any of the above is broken, fix it.
5. Add a brief console.log in getStudentHomework: [getStudentHomework] studentId, homeworkCount — for diagnostics.
```

**Check:** Log in as demo student (`student@demo.com` / `Demo1234!`) → `/student/dashboard` shows at least 1 published homework from their class.

---

## Step 5 — Enhance: SEND screening triggered automatically during homework submission

**What:** Ensures that every time a student submits homework, the system automatically runs SEND accessibility screening on their submission and stores a risk indicator.

**Prompt:**
```
Read CLAUDE.md for context. Feature: when a student submits homework (submitHomework in app/actions/student.ts), the system should automatically:

1. Run SEND risk screening on the submission content — check lib/sendReviewCached.ts for the existing scoring pattern. Create a lightweight equivalent for homework submissions: analyse the student's answers for indicators of potential SEND needs (spelling patterns, sentence structure, reading level, response gaps).
2. Store the result as a sendRiskScore (0–100) on the Submission record — add this field to the Submission model in schema.prisma if it doesn't exist, then run npx prisma db push.
3. Do NOT block the submission — run the screening asynchronously or after the save. If it fails, log the error and continue.
4. The risk score should be visible to the teacher in HomeworkMarkingView as a small badge next to the student's name (similar to the existing autoScore badge). Colour: green 0–30, amber 31–60, red 61–100.

Keep the screening simple and fast — a single Claude API call with a short prompt, max_tokens: 200, extracting 3 signals: spelling_concern (bool), engagement_level (low/medium/high), response_completeness (0–100).
```

**Check:** Submit homework as demo student → log in as teacher → open homework marking view → student submission shows a SEND risk badge. Check Prisma Studio: Submission record has sendRiskScore populated.

---

## Step 6 — Enhance: SEND flags automatically notify teacher and SENCO

**What:** Connects homework SEND risk scores to the existing early-warning system so that high-risk submissions automatically create notifications for the class teacher and the school SENCO.

**Prompt:**
```
Read CLAUDE.md for context. Feature: when a homework submission's sendRiskScore is above 60 (high risk), the system should:

1. Check lib/send/early-warning.ts — use or extend the existing EarlyWarningFlag pattern to create a new flag type: HOMEWORK_SEND_CONCERN.
2. Create a Notification for:
   a. The class teacher (the teacher who set the homework) — message: "Possible SEND need detected in [StudentName]'s submission for [HomeworkTitle]. Review their work."
   b. The school SENCO — find the SENCO by role (UserRole.SENCO) scoped to the same schoolId.
3. The notification should link to the homework marking view: /homework/[homeworkId]/mark/[submissionId].
4. Do NOT create duplicate notifications — check if a HOMEWORK_SEND_CONCERN flag already exists for this student + homework combination before creating.
5. Display these notifications in /notifications for both teacher and SENCO — they should already appear there via the existing notification system.

Trigger this check inside submitHomework (after saving the sendRiskScore) or as a follow-on action.
```

**Check:** Submit homework with a low-quality/short answer as student → log in as teacher → `/notifications` shows a SEND concern notification linking to that submission. Log in as SENCO demo user → same notification appears.

---

## Step 7 — Enhance: Adaptive learning profile remembers each student's needs

**What:** Ensures the adaptive learning engine updates a student's learning profile after every marked homework and uses that profile to tailor the difficulty, format, and scaffolding of future homework assignments.

**Prompt:**
```
Read CLAUDE.md for context. Feature: close the adaptive learning loop so every marked homework updates the student's profile and influences the next homework generated for them.

Part A — Profile update after marking:
1. In markSubmission (app/actions/homework.ts), after saving the grade, call updateLearningProfile() from app/actions/adaptive-learning.ts.
2. Pass: studentId, homeworkType, score (as percentage), sendRiskScore, subjectSlug, yearGroup.
3. updateLearningProfile should update: preferredHomeworkType (weighted towards types where the student scores highest), averageScore per subject, sendConcernLevel (rolling average of sendRiskScore), lastHomeworkAt.

Part B — Profile used during homework generation:
1. In generateHomeworkFromResources, before building the AI prompt, fetch the student learning profiles for all students in the class via getStudentLearningProfiles(classId).
2. Add a section to the AI prompt: "Class profile: [X]% of students have SEND concerns. Average score last homework: [Y]%. Preferred format: [Z]. Adjust question difficulty and scaffolding accordingly while retaining GCSE curriculum standards."
3. The homework must still be a single set of questions (not per-student), but scaffolding hints should be included in the mark scheme for SEND-flagged students.

Part C — Display profile to teacher:
1. In the ClassInsightsTab for each class, add a row: "Adaptive profile last updated: [date]" and a summary: "Avg score: X% · SEND concern: Y students · Preferred type: Z".
2. Pull this from a new server action getClassAdaptiveProfile(classId) in app/actions/adaptive-learning.ts.

Retain all existing grading bands and GCSE grade mappings — the adaptive system adjusts scaffolding, not grades.
```

**Check:**
- Mark a homework submission as teacher → open ClassInsightsTab → adaptive profile summary shows updated date and scores.
- Generate a new homework for the same class → AI prompt in Vercel function logs shows "Class profile:" section.
- Student with high sendRiskScore sees scaffolding hints in their homework questions.

---

## The Full Loop — Integration smoke test

**What:** Runs through all 7 steps end-to-end in one session to confirm the full adaptive learning loop works together.

**Prompt:**
```
Read CLAUDE.md for context. Run an end-to-end smoke test of the adaptive learning loop:

1. Log in as teacher (teacher@demo.com / Demo1234!) → open /dashboard → confirm classes appear on calendar.
2. Click a lesson (e.g. Battle of Hastings) → Resources tab → confirm relevant Oak resources appear.
3. Add 2 resources → confirm "Generate homework?" banner appears → click it.
4. Select "Quiz" type → confirm AI generates 5+ questions about the lesson topic → save homework.
5. Confirm homework is published (status: PUBLISHED).
6. Log in as student (student@demo.com / Demo1234!) → /student/dashboard → confirm homework appears → submit with short answers.
7. Log in as teacher → /notifications → confirm any SEND concern notification appeared.
8. Log in as SENCO (senco@demo.com / Demo1234!) → /notifications → confirm SEND concern notification appeared.
9. Mark the homework as teacher → open ClassInsightsTab → confirm adaptive profile shows updated data.
10. Generate a second homework for the same class → check Vercel function logs for "Class profile:" in the AI prompt.

Report pass/fail for each step and any errors seen.
```

**Check:** All 10 steps report pass. No TypeScript errors (`npx tsc --noEmit`). Clean build (`npm run build`).

---

## Notes

- **SEND risk scoring** must never block a student's submission — always fire-and-forget or async.
- **Adaptive profiles never lower grades** — they adjust scaffolding only. GCSE grading bands in `lib/grading.ts` are untouched.
- **Multi-tenancy** — every new query must be scoped with `schoolId` from session.
- **Notifications** — use the existing Notification model and pattern in `lib/send/early-warning.ts`. Do not build a new notification system.
- **AI prompts** — always include lesson title, subject, year group as context. Check Vercel function logs for `[generateHomeworkFromResources]` prefix to diagnose failures.
- After completing all steps, run: `git add -A && git commit -m "feat: adaptive learning loop — steps 1-7 complete"`
- Then update CLAUDE.md: `claude "Update CLAUDE.md to reflect the completed adaptive learning loop — steps 1-7."`
