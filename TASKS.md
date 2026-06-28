# Omnis — Application Review & Task Tracker
_Full 11-role review cycle: June 2026 | Updated: 2026-06-28_
_Status: Active development — implement, verify, and tick each task before marking complete_

**Status key:** ✅ Complete | 🔄 Partial | ❌ Open | 🆕 New finding
**Priority key:** P0 Blocker | P1 High | P2 Medium | P3 Low

---

## SECTION A — CRITICAL BLOCKERS (P0)

---

### TASK-003: Homework list persistent session failure

Status: ❌ OPEN (WORSENED — failed 4/4 attempts in latest review)
Priority: P0 Blocker
Role(s): Teacher
Finding: /homework fails to load with "Couldn't load homework — There was a problem fetching your homework data." after initial page load. "Try again" button is ineffective. Navigating away and back does not resolve. First load in session succeeds but subsequent loads fail. Root cause: likely stale auth token not being refreshed on re-navigation, or a race condition in the homework fetch hook.
Acceptance criteria: /homework loads successfully on first load AND on every subsequent navigation to the page within the same session. "Try again" button triggers a fresh authenticated fetch and resolves the error. Tested across 5 consecutive navigations to /homework without failure.
Verified: [ ]

---

### TASK-005: Class Report PDF silent failure

Status: ❌ OPEN
Priority: P0 Blocker
Role(s): Teacher
Finding: "Download Class Report PDF" button in /classes produces zero response — no loading state, no download, no error message, no network request visible. Complete silent failure.
Acceptance criteria: Button triggers a PDF generation request with a loading spinner shown. On success, PDF downloads automatically or a download link appears. On failure, a clear error toast is shown with retry option. PDF contains class name, student list, grades, SEND summary.
Verified: [ ]

---

### TASK-001: No confirmation toasts on mutating actions (global)

Status: 🔄 PARTIAL (toast added to Publish Homework only; all other actions still silent)
Priority: P0 Blocker
Role(s): All roles
Finding: The following actions complete silently with no user feedback: Save Note (teacher dashboard), Remind All (homework marking), Approve All AI (homework marking), EHCP approval, any form save. Only Publish Homework has a toast. This violates basic UX feedback principles.
Acceptance criteria: Every mutating action shows: (a) loading indicator during request, (b) green success toast on completion ("Note saved", "Reminders sent to 31 students", "EHCP approved and activated"), (c) red error toast on failure. Toasts auto-dismiss after 4 seconds. Actions covered: Save Note, Remind All, Approve All AI, EHCP Approve, Mark as ILP Evidence, APDR status update, any form submission.
Verified: [ ]

---

### TASK-006: Student receives no notification when homework is published

Status: 🔄 PARTIAL (Notification records created in DB but not surfaced in student UI)
Priority: P0 Blocker
Role(s): Teacher → Student
Finding: When a teacher publishes homework, the student's Alerts tab shows no new notification. The cross-role notification chain is broken.
Acceptance criteria: When teacher publishes homework: (1) student dashboard "To Do" count increments, (2) Alerts tab shows "New homework set: [title] — Due [date]" entry with direct link, (3) homework appears in /student/homework list. Tested end-to-end.
Verified: [ ]

---

### TASK-007: Parent receives no notification when homework is set or submitted

Status: 🔄 PARTIAL (Notification records created but parent UI has no notification feed)
Priority: P0 Blocker
Role(s): Teacher/Student → Parent
Finding: Parent dashboard has no notification system. When teacher sets homework or student submits, the parent receives no alert. Parent Learning Insights section exists but is static.
Acceptance criteria: Parent dashboard shows Activity Feed. Events: (1) Teacher sets homework → "New homework: [title] — Due [date]", (2) Child submits → "Aiden submitted: [title]", (3) Homework graded → "Aiden's [title] marked — Grade [X]". Tested end-to-end.
Verified: [ ]

---

## SECTION B — HIGH PRIORITY (P1)

---

### TASK-008: TA SEND strategies view not built

Status: 🔄 PARTIAL (SEND profile shown inline in TaNotesHub; dedicated /ta/send-students route returns "Coming soon")
Priority: P1 High
Role(s): Teaching Assistant
Finding: /ta/send-students returns "Coming soon". TAs have no dedicated route to view SEND strategies, ILP targets, or classroom adjustments for students they support.
Acceptance criteria: /ta/send-students loads SEND students the TA supports. Per student: SEND category and tier, active ILP targets (2–4), classroom adjustment strategies, current APDR phase. Read-only. Filterable by year group and SEND category. Tested with j.taylor login.
Verified: [ ]

---

### TASK-009: MIS attendance data not flowing / no demo attendance data

Status: ❌ OPEN
Priority: P1 High
Role(s): HOY, SLT, School Admin
Finding: HOY /hoy/absence shows "No attendance data yet." Student timetable shows "No timetable available." No attendance or timetable data is available anywhere in the platform.
Acceptance criteria: Seed realistic demo attendance data (90+ school days, realistic attendance patterns, 1–2 students with persistent absence <85%). HOY /hoy/absence shows attendance %, persistent absentees (<85%), attendance trend. Student /student/timetable shows weekly grid with subjects, rooms, teachers.
Verified: [ ]

---

### TASK-014: HOY dashboard tiles non-interactive

Status: 🔄 PARTIAL (href added to Reviews Due + Low Attendance tiles; Integrity/Detentions/Exclusions tiles still inert)
Priority: P1 High
Role(s): HOY
Finding: HOY dashboard tiles (Year Analytics, Integrity, Detentions, Exclusions) show hover cursor-pointer but clicking produces no navigation.
Acceptance criteria: Each tile navigates on click: Year Analytics → /hoy/analytics, Integrity → /hoy/integrity, Detentions → /hoy/detentions, Exclusions → /hoy/exclusions. Tested as t.adeyemi.
Verified: [ ]

---

### TASK-019: APDR Manage button does not navigate (regression)

Status: 🔄 PARTIAL (APDR page built ✅; Manage button on student rows produces no navigation ❌)
Priority: P1 High
Role(s): SENCo
Finding: /senco/apdr loads fully. However "Manage" button on each student row produces no navigation — user stays on list page.
Acceptance criteria: "Manage" button navigates to per-student APDR detail view showing: full cycle history, current phase with editable fields, ability to advance phase, create new cycle, link to ILP/EHCP. Tested with at least 2 student rows.
Verified: [ ]

---

### TASK-NEW-001: Resource Generator silent failure with no topic

Status: 🆕 NEW
Priority: P1 High
Role(s): Teacher, SENCo
Finding: In /ai-generator, when selected class has "No curriculum topics found", clicking "Generate Resource" produces no loading indicator, no output, no error. Complete silent failure.
Acceptance criteria: (1) If no topic available, button is disabled with tooltip. (2) If triggered with no topic, clear inline error appears. (3) Client-side validation before API call. Tested by selecting class with no topics.
Verified: [ ]

---

### TASK-NEW-002: Parent Progress Report PDF silent failure

Status: 🆕 NEW
Priority: P1 High
Role(s): Parent
Finding: /parent/report "Download PDF summary report" button produces zero response — no loading state, no download, no error.
Acceptance criteria: Button shows loading state. PDF downloads successfully or clear error toast appears. PDF contains: child name, grades by subject, recent homework summary, attendance %, active ILP targets, SEND status. Tested as l.hughes.
Verified: [ ]

---

### TASK-NEW-003: Parent Letters Home page not built

Status: 🆕 NEW
Priority: P1 High
Role(s): Parent
Finding: Parent sidebar "Letters Home" link unresponsive. /parent/letters shows "Coming soon". Statutory letters (SEND review invitations, attendance letters, behaviour notifications) are missing.
Acceptance criteria: /parent/letters loads list of communications. Each shows: sender, date, subject, read/unread status. Clicking opens full letter. Minimum 3 demo letters seeded. Sidebar link navigates correctly. Tested as l.hughes.
Verified: [ ]

---

### TASK-NEW-004: SENCo Analytics, Interventions, AI Insights — all "Coming soon"

Status: 🆕 NEW
Priority: P1 High
Role(s): SENCo
Finding: /senco/analytics, /senco/interventions, /senco/ai-insights all return "Coming soon". SENCo has no analytics view for APDR progress, intervention effectiveness, or AI early identification.
Acceptance criteria: /senco/analytics shows: APDR cycle completion rates (chart), ILP evidence gap rate (metric + drill-down), SEND tier distribution, early warning flags (>3 concerns in 30 days, attendance <85% + SEND). /senco/interventions shows active interventions with start date, type, assigned TA/teacher, review date. Tested as r.morris.
Verified: [ ]

---

### TASK-011: Student photos absent

Status: ❌ OPEN
Priority: P1 High
Role(s): All roles
Finding: All students show initials-based avatars. No student photos anywhere. Staff have photos; students do not.
Acceptance criteria: Seed consistent placeholder photos for all demo students (or confirm Wonde sync is working for photos). Photos appear in: homework marking view, /classes student list, SENCo ILP list, parent dashboard. Graceful fallback to initials if image fails. Tested across all views.
Verified: [ ]

---

### TASK-021: SEND tiering labels missing across platform

Status: 🆕 NEW (previously listed but not tracked)
Priority: P1 High
Role(s): Teacher, SENCo, HOY, TA
Finding: SEND tier labels (Universal / Targeted / Targeted-Plus / Specialist) from the Feb 2026 White Paper digital-ISP framework are absent. Platform shows SEN Support/EHCP but not the four-tier model required for statutory compliance.
Acceptance criteria: SEND tier labels shown on: (1) SENCo SEND dashboard student list, (2) Teacher class view SEND badge tooltips, (3) APDR cycle student rows, (4) Student /student/support page, (5) TA SEND students view. Tier determined by: Universal = no SEND, Targeted = SEN Support Tier 1, Targeted-Plus = SEN Support Tier 2, Specialist = EHCP. Tested across all views.
Verified: [ ]

---

## SECTION C — MEDIUM PRIORITY (P2)

---

### TASK-NEW-005: HOY Homework Pulse — 2% submission rate looks like calculation error

Status: 🆕 NEW
Priority: P2 Medium
Role(s): HOY
Finding: HOY /hoy/dashboard Homework Pulse shows 9E/En1: 2 set, 1 submitted, 2% rate (red). 1 of 2 should be 50%, not 2%. Rate may be correct if calculated as submissions / (students × assignments) but denominator is not shown.
Acceptance criteria: (1) Verify submission rate logic is correct. (2) If rate = submissions / (students × assignments), show denominator clearly ("1 of 50 expected"). (3) Fix calculation if bug. (4) Add tooltip explaining formula. Tested as t.adeyemi.
Verified: [ ]

---

### TASK-NEW-006: ILP evidence data — 0 of 39 targets on track (no positive demo data)

Status: 🆕 NEW
Priority: P2 Medium
Role(s): SENCo
Finding: /senco/ilp-evidence shows 8/39 targets evidenced, 38 behind, 0 on track. Impossible to demonstrate the positive use case. Undermines sales demos.
Acceptance criteria: Seed 3–5 ILP targets as "On Track" with evidence entries. At least 1 student shows "Target Met". Distribution: ~20% on track, ~60% in progress, ~20% behind. Tested in SENCo ILP Evidence view.
Verified: [ ]

---

### TASK-NEW-007: Adaptive Differentiation — AI failure for individual student has no retry

Status: 🆕 NEW
Priority: P2 Medium
Role(s): Teacher
Finding: In homework marking Adaptive Differentiation panel, one student shows "SEND adaptation requested — AI unavailable, original content returned." No retry button. No guidance for teacher.
Acceptance criteria: (1) "Retry AI" button per failed student card. (2) Retry triggers single-student AI call. (3) On retry success, card updates. (4) On retry failure: show ILP targets inline as manual fallback. Tested by verifying retry UI present.
Verified: [ ]

---

### TASK-NEW-008: Teacher /my-send-students — "Coming soon"

Status: 🆕 NEW
Priority: P2 Medium
Role(s): Teacher
Finding: /my-send-students returns "Coming soon". Teachers need visibility of SEND students across their classes without navigating class-by-class.
Acceptance criteria: /my-send-students shows all SEND students across teacher's classes. Per student: name, class, SEND category, tier, top 2 active ILP targets, key classroom adjustments (top 3). Filterable by class and SEND category. Links to full student profile. Tested as j.patel.
Verified: [ ]

---

### TASK-NEW-009: Teacher /adaptive-learning — "Coming soon"

Status: 🆕 NEW
Priority: P2 Medium
Role(s): Teacher
Finding: /adaptive-learning returns "Coming soon". Adaptive learning loop is the core product differentiator.
Acceptance criteria: /adaptive-learning shows per-student adaptive loop status: (1) ILP target active, (2) last homework adapted (Y/N, date), (3) last resource adapted (Y/N, date), (4) loop health indicator (Green = adapted this week, Amber = not adapted 14d, Red = never). Timeline of adaptations per student. Tested as j.patel.
Verified: [ ]

---

### TASK-NEW-010: SENCo AI Insights page not built

Status: 🆕 NEW
Priority: P2 Medium
Role(s): SENCo
Finding: /senco/ai-insights returns "Coming soon". AI early identification and insights are central to the SEND intelligence positioning.
Acceptance criteria: /senco/ai-insights shows AI-generated early warning report: (1) Students showing emerging SEND signals (attendance drop + homework completion drop + teacher concern), (2) SEND students whose adaptations not used in 30+ days, (3) Students approaching EHCP review with incomplete evidence, (4) AI narrative summary per flagged student (2–3 sentences). At least 3 insight cards generated. Tested as r.morris.
Verified: [ ]

---

### TASK-NEW-011: Empty states and "Coming soon" pages — no guidance or alternatives

Status: 🆕 NEW
Priority: P2 Medium
Role(s): All roles
Finding: "Coming soon" pages show bare text with no feature description, ETA, or alternative action. Empty data states are blank or minimal. First-time users and trial evaluators are left confused.
Acceptance criteria: All "Coming soon" pages show: (1) Feature name and icon, (2) One-line description, (3) Expected availability label ("Available in next release"), (4) Primary CTA linking to related page. All empty data states show illustration, explanation, and action button. Tested across all "Coming soon" routes.
Verified: [ ]

---

### TASK-NEW-012: Accessibility — contrast, focus rings, keyboard navigation

Status: 🆕 NEW
Priority: P2 Medium
Role(s): All roles
Finding: Some amber badge text may not meet WCAG AA contrast. No visible focus ring on Tab navigation through forms. SEND-focused platform should be exemplary in accessibility.
Acceptance criteria: (1) Automated axe-core audit — resolve all critical and serious issues. (2) All text/background pairs meet WCAG AA (4.5:1 normal, 3:1 large text). (3) All interactive elements have visible focus rings. (4) Tab order logical across main pages. (5) All icons have aria-label. (6) Lighthouse Accessibility ≥ 90 on 5 key pages (dashboard, homework, ILP, APDR, student support).
Verified: [ ]

---

### TASK-NEW-013: Mobile responsiveness gaps

Status: 🆕 NEW
Priority: P2 Medium
Role(s): Parent, Student (primary mobile users)
Finding: Table-heavy views (Homework Pulse, ILP Evidence grid) likely do not collapse gracefully at mobile widths. Sidebar may lack hamburger/drawer at small breakpoints.
Acceptance criteria: (1) All pages correct at 375px and 768px. (2) Tables scroll horizontally or reformat to cards on mobile. (3) Sidebar collapses to bottom nav or hamburger at ≤768px. (4) Minimum 44px touch targets. (5) Lighthouse mobile score ≥ 85 on: parent dashboard, student dashboard, student homework, teacher homework marking.
Verified: [ ]

---

### TASK-NEW-014: AI call batching, caching, and cost documentation

Status: 🆕 NEW
Priority: P2 Medium
Role(s): Development
Finding: Adaptive Differentiation generates 9 per-student adaptations in ~28 seconds. Good. However cost/scalability at school scale not documented. No result caching confirmed.
Acceptance criteria: (1) Document AI call pattern in ARCHITECTURE.md. (2) Confirm batching used — all SEND students in one call, not one call per student. (3) Implement result caching keyed on homeworkId + studentId + ilpVersion. (4) Add token usage logging. (5) Document cost estimate per class. Confirmed in code review.
Verified: [ ]

---

### TASK-NEW-015: Root cause investigation — homework list auth/cache failure

Status: 🆕 NEW (root cause of TASK-003)
Priority: P2 Medium
Role(s): Teacher
Finding: /homework succeeds on first load but fails on subsequent navigations — pattern suggests auth token expiry or Next.js route cache staleness.
Acceptance criteria: (1) Identify exact failure point (log 401/500/timeout). (2) Implement auth token auto-refresh: if fetch returns 401, refresh token and retry once. (3) Ensure SWR/React Query stale time appropriate (suggest: staleTime 30s). (4) Add "Retry" button that forces fresh fetch bypassing cache. (5) 5 consecutive navigations all succeed.
Verified: [ ]

---

## SECTION D — LOW PRIORITY / POLISH (P3)

---

### TASK-NEW-016: ARCHITECTURE.md and code documentation

Status: 🆕 NEW
Priority: P3 Low
Role(s): Development
Finding: No ARCHITECTURE.md. As platform grows (SENCo AI, adaptive loop, MIS integration), documented architecture is essential for maintainability.
Acceptance criteria: ARCHITECTURE.md covers: tech stack, key data models (Student/ILP/APDR/EHCP/Homework/Evidence), AI call patterns and cost model, MIS/Wonde integration, auth flow, key env vars, deployment overview. Key component files have JSDoc comment blocks. ARCHITECTURE.md exists and is accurate.
Verified: [ ]

---

### TASK-NEW-017: HOD analytics and subject boards not built

Status: 🆕 NEW
Priority: P3 Low
Role(s): HOD
Finding: HOD sidebar "Teacher Analytics" and "Subjects & Boards" return "Coming soon". HOD is a key decision-maker in school purchases.
Acceptance criteria: (1) /hod/teacher-analytics — table of teachers in department: classes, avg homework completion %, avg grade, SEND students. (2) /hod/subjects — list of subjects with exam board (Edexcel/AQA/OCR), GCSE specification reference, link to specification URL. Tested as d.brooks.
Verified: [ ]

---

### TASK-NEW-018: Year 8 data and grade consistency check

Status: 🆕 NEW (partially flagged as TASK-010/TASK-012 in previous cycle)
Priority: P3 Low
Role(s): SLT, School Admin
Finding: Year 8 = 0 students (likely MIS mapping). Grade display inconsistency (numeric vs letter grades mixed across views). Not fully verified.
Acceptance criteria: (1) All demo students assigned to correct year groups. (2) Standardise grade display: numeric GCSE 1–9 primary with letter in brackets ("Grade 7 (A)"). No raw percentages mixed with letter grades without a key. (3) SLT analytics for Year 8 shows correct count and grades. Tested in SLT and Admin roles.
Verified: [ ]

---

## SECTION E — PREVIOUSLY RESOLVED ✅ (DO NOT REOPEN)

The following were confirmed working in the latest review cycle:

- TASK-002 ✅ AI homework generation no longer stalls (stream flush fixed June 2026)
- TASK-004 ✅ "Activate All" bulk activation button built in /admin/users
- TASK-013 ✅ Test account cleaned up from seed + E2E test finally block fixed
- TASK-015 ✅ Behaviour seed data added (17 records across positive/negative/neutral)
- TASK-016 ✅ GDPR ConsentPurpose records and ConsentRecord entries seeded
- TASK-017 ✅ ILP evidence "Add Evidence" inline form per target row built (this session)
- TASK-018 ✅ Proactive ILP evidence match (checkILPEvidenceMatch) implemented via claude-haiku
- TASK-019-APDR-PAGE ✅ APDR Cycles page fully built with phase stepper (June 2026 Sprint D)
- TASK-019-APDR-PDF ✅ APDR PDF export route built (/api/export/apdr/[apdrId])
- TASK-025 ✅ EHCP Plans page built, approval workflow functional
- NEW ✅ Student "My Support Plan" page (/student/support): built, shows ILP targets
- NEW ✅ Adaptive Differentiation AI in homework marking: built, 9/10 quality
- NEW ✅ EHCP GDPR compliance messaging (Article 9 banner): built
- NEW ✅ Parent Learning Insights AI (strengths/focus areas): built
- NEW ✅ HOY Year Group Analytics (/hoy/analytics): built with SEND at-risk panel
- NEW ✅ EHCP "Link evidence from homework" per outcome: built
- NEW ✅ EHCP Approve & Activate workflow: built and functional
- NEW ✅ Homework publish toast notification: built (HomeworkFilterView)
- NEW ✅ Student notifications DB records on homework publish: built (createHomework action)
- NEW ✅ Parent notifications DB records on homework submit: built (submitHomework action)
- NEW ✅ TA SEND profile panel inline in TaNotesHub: built (getTaSendProfile action)

---

## CROSS-ROLE WORKFLOW REGRESSION TESTS

Run after all Section A+B tasks complete:

1. **Homework end-to-end:** j.patel publishes → a.hughes sees notification + homework in list → a.hughes submits → l.hughes sees notification → j.patel sees submission
2. **Messaging:** j.patel sends message to a.hughes → a.hughes sees unread badge + content
3. **ILP evidence:** r.morris adds evidence via Add Evidence form → evidence count increments in /senco/ilp-evidence
4. **APDR Manage:** r.morris clicks Manage on APDR row → navigates to per-student detail view
5. **TA SEND view:** j.taylor views /ta/send-students → sees at least one student's strategies
6. **SEND tier:** r.morris assigns tier to student → visible on student profile, in ILP view

---

_End of TASKS.md — updated 2026-06-28_
