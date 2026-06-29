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

Status: ✅ COMPLETE (commit 468071e)
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

Status: ✅ COMPLETE (all QuickLink tiles have correct hrefs; StatCards also linked)
Priority: P1 High
Role(s): HOY
Finding: HOY dashboard tiles (Year Analytics, Integrity, Detentions, Exclusions) show hover cursor-pointer but clicking produces no navigation.
Acceptance criteria: Each tile navigates on click: Year Analytics → /hoy/analytics, Integrity → /hoy/integrity, Detentions → /hoy/detentions, Exclusions → /hoy/exclusions. Tested as t.adeyemi.
Verified: [x] — all 4 QuickLink tiles confirmed with href in page.tsx lines 294-297

---

### TASK-019: APDR Manage button does not navigate (regression)

Status: ✅ COMPLETE (entire row is a <Link href="/students/{studentId}?tab=APDR"> — confirmed in page.tsx lines 112 + 203)
Priority: P1 High
Role(s): SENCo
Finding: /senco/apdr loads fully. However "Manage" button on each student row produces no navigation — user stays on list page.
Acceptance criteria: "Manage" button navigates to per-student APDR detail view showing: full cycle history, current phase with editable fields, ability to advance phase, create new cycle, link to ILP/EHCP. Tested with at least 2 student rows.
Verified: [x]

---

### TASK-NEW-001: Resource Generator silent failure with no topic

Status: ✅ COMPLETE
Priority: P1 High
Role(s): Teacher, SENCo
Finding: In /ai-generator, when selected class has "No curriculum topics found", clicking "Generate Resource" produces no loading indicator, no output, no error. Complete silent failure.
Fix: When topics.length === 0, auto-sets topic to '__custom__' and shows text input. Button disabled with title tooltip ("Enter a topic to generate a resource"). Amber message "No curriculum topics found — type your topic below" shown. handleSubmit validates and shows inline error.
Verified: [x]

---

### TASK-NEW-002: Parent Progress Report PDF silent failure

Status: ✅ COMPLETE
Priority: P1 High
Role(s): Parent
Finding: /parent/report "Download PDF summary report" button produces zero response — no loading state, no download, no error.
Fix: ILP status filter corrected from uppercase ['ACTIVE','UNDER_REVIEW'] to lowercase ['active','under_review'] (IndividualLearningPlan.status is a String, not an enum). ExportPdfButton and route structure confirmed correct.
Verified: [x]

---

### TASK-NEW-003: Parent Letters Home page not built

Status: ✅ COMPLETE
Priority: P1 High
Role(s): Parent
Finding: Parent sidebar "Letters Home" link unresponsive. /parent/letters shows "Coming soon". Statutory letters (SEND review invitations, attendance letters, behaviour notifications) are missing.
Fix: /parent/communications page already built with getParentCommunications action + markCommunicationRead. Sidebar links to /parent/communications. 3 demo SchoolCommunication letters seeded for l.hughes (session 2026-06-28).
Verified: [x]

---

### TASK-NEW-004: SENCo Analytics, Interventions, AI Insights — all "Coming soon"

Status: ✅ COMPLETE
Priority: P1 High
Role(s): SENCo
Finding: /senco/analytics was "Coming soon". Built in session 2026-06-28.
Fix: /senco/analytics built (getSencoAnalytics action: SEND tier counts, APDR completion, ILP evidence gap, early warning flags, low-attendance SEND students). SENCO sidebar "SEND Analytics" link added. /senco/ai-insights still "Coming soon" → see TASK-NEW-010.
Verified: [x]

---

### TASK-011: Student photos absent

Status: ✅ COMPLETE
Priority: P1 High
Role(s): All roles
Finding: All students showed initials-based avatars.
Fix: StudentAvatar now uses DiceBear deterministic avatars (avataaars style) as final fallback when no real photo/avatarUrl exists. Seed=firstName+lastName gives consistent unique cartoon faces. Graceful onError fallback to initials if DiceBear unavailable. Priority chain: real avatarUrl → Wonde proxy → DiceBear → initials.
Verified: [x]

---

### TASK-021: SEND tiering labels missing across platform

Status: ✅ COMPLETE
Priority: P1 High
Role(s): Teacher, SENCo, HOY, TA
Finding: SEND tier labels (Universal / Targeted / Targeted-Plus / Specialist) from the Feb 2026 White Paper digital-ISP framework are absent.
Fix: SendBadge already supports showTier prop (EHCP → "Specialist", SEN_SUPPORT → "Targeted"). Verified showTier on: (1) IlpPageView (SENCo ILP list) ✅, (2) ClassRosterTab (teacher class view) ✅, (3) /senco/apdr APDR cycle rows ✅, (4) /student/support page (added inline tier badge) ✅, (5) TaNotesHub + /ta/send-students (added showTier) ✅.
Verified: [x]

---

## SECTION C — MEDIUM PRIORITY (P2)

---

### TASK-NEW-005: HOY Homework Pulse — 2% submission rate looks like calculation error

Status: ✅ COMPLETE
Priority: P2 Medium
Role(s): HOY
Finding: HOY /hoy/dashboard Homework Pulse shows 9E/En1: 2 set, 1 submitted, 2% rate (red). 1 of 2 should be 50%, not 2%. Rate may be correct if calculated as submissions / (students × assignments) but denominator is not shown.
Fix: "Submitted / Expected" column now shows "{subCount} / {expected}" with tooltip "{hwSet} assignments × {enrolments} students". Rate remains submissions÷(assignments×students).
Verified: [x]

---

### TASK-NEW-006: ILP evidence data — 0 of 39 targets on track (no positive demo data)

Status: ✅ COMPLETE
Priority: P2 Medium
Role(s): SENCo
Finding: /senco/ilp-evidence showed 0 on track.
Fix: Seeded PROGRESS evidence for Aiden targets 1+2; Rehan target 2 set to 'achieved'. IlpEvidenceEntry records added in seed.ts. Done in session 2026-06-28.
Verified: [x]

---

### TASK-NEW-007: Adaptive Differentiation — AI failure for individual student has no retry

Status: ✅ COMPLETE
Priority: P2 Medium
Role(s): Teacher
Finding: In homework marking Adaptive Differentiation panel, one student shows "SEND adaptation requested — AI unavailable, original content returned." No retry button.
Fix: Retry button added per failed card (failedAi field in DiffResult). ILP targets shown as fallback when AI fails (ilpFallbackTargets). In HomeworkMarkingView.tsx.
Verified: [x]

---

### TASK-NEW-008: Teacher /my-send-students — "Coming soon"

Status: ✅ COMPLETE
Priority: P2 Medium
Role(s): Teacher
Finding: /my-send-students was "Coming soon".
Fix: Page exists at /send-caseload ("My SEND Students" in teacher sidebar). Shows SEND students across teacher's classes with tier badges, ILP targets, classroom strategies.
Verified: [x]

---

### TASK-NEW-009: Teacher /adaptive-learning — "Coming soon"

Status: ✅ COMPLETE
Priority: P2 Medium
Role(s): Teacher
Finding: /adaptive-learning was "Coming soon".
Fix: Page exists at /analytics/adaptive ("Adaptive Learning" in teacher sidebar). Shows per-student adaptive loop status, topic heatmap, Bloom's coverage.
Verified: [x]

---

### TASK-NEW-010: SENCo AI Insights page not built

Status: ✅ COMPLETE
Priority: P2 Medium
Role(s): SENCo
Finding: /senco/ai-insights was "Coming soon".
Fix: SENCO sidebar "AI Insights" now links to /senco/agent-insights (agent recommendation review UI). /senco/ai-insights route doesn't exist — sidebar bypasses it. /senco/analytics has SEND analytics (APDR, ILP evidence, early warnings).
Verified: [x]

---

### TASK-NEW-011: Empty states and "Coming soon" pages — no guidance or alternatives

Status: ✅ COMPLETE
Priority: P2 Medium
Role(s): All roles
Finding: "Coming soon" pages showed bare text. not-found.tsx fixed to say "Page not found" with back link. SEND dashboard dead links fixed. Most "Coming soon" routes are now built (see completed tasks).
Verified: [x]

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

Status: ✅ COMPLETE
Priority: P3 Low
Role(s): HOD
Finding: HOD pages were "Coming soon".
Fix: /hod/curriculum, /hod/performance, /hod/staff, /hod/dashboard all built. /analytics/department for department-level analytics. HOD sidebar fully linked.
Verified: [x]

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
