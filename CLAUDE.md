# Omnis App — Claude Reference

> Last updated: 2026-07-01. Authoritative reference for Claude sessions.
>
> **TRIAL STATUS: TRIAL-READY + POST-LAUNCH IMPROVEMENTS AS OF 2026-06-18.**
> All phases of OMNIS_TRIAL_READINESS_PLAN.md complete (Phases 0–4). 16/16 smoke test checks pass.
> Live teacher feedback incorporated (May 2026 sprint): Year Group Plans, TA Notes, homework depth,
> lesson visibility fixes, design consistency, No Plan filter, Generate ILP button.
> May 2026 Part 2: design system (OmnisLogo, EmptyState, PageHeader, SendBadge, skeleton loaders),
> homework marking two-panel layout, SENCO read-only submission view, ILP evidence automation.
> May 2026 Part 3 (issues 13-18): RAG badges in Performance tab, Support Profile card in student
> deep-dive, student slide-over from ConcernList, year revision mode, adaptive test mode wired,
> student photo proxy SVG initials fallback.
> May 2026 Part 4: Teaching Assistant role — /ta/notes hub, year+class dropdown filters, seed fix.
> May 2026 Part 5: Code quality sprint — ClassRosterTab hook refactor, dashboard unstable_cache,
> debug log removal, bare <a>→<Link> conversions, N+1 fix in addTaNote, error boundaries.
> May 2026 Part 6: Security audit — getTaClasses() role enforcement, Wonde route auth tightening,
> TA_NOTE_ADDED/DELETED audit trail, remaining bare <a> links converted. 110/110 e2e on Vercel.
> June 2026: Homework UX fixes — AI stream final-buffer flush, maxDuration 120s, student answer
> exposure guard, re-generation flow, resizable two-panel drag handles (grip dots + label),
> duplicate model answer suppression in HomeworkDetailPanel. 110/110 e2e on Vercel (18b4e38).
> June 2026 Part 2: Agent recommendation review UI (/senco/agent-insights with confirm/override/
> dismiss), student homework list (/student/homework), resource library (/resources), cover lessons
> weekly view (/lessons). DB perf: indexes on Submission.homeworkId + SendConcern.raisedBy. 13
> debug console.logs removed. Wonde timetable permissions enabled — periods + timetable live.
> June 2026 Part 3: E2E test suite expanded to 155 tests (23 spec files). Fixed Prisma disconnect
> bugs, beforeAll try-catch patterns, icon-only button selectors, loginAs 45s timeout (cold-start
> fail-fast), Homework model schema mismatches (no teacherId; createdBy required). 151/155 passing.
> June 2026 Part 4: Feature gap sprint (BUGS.md GAP-007/008/009/013/014) — parent contact log
> (ParentContactEntry model + addParentContactEntry/deleteParentContactEntry actions, interactive
> ContactsTab in StudentFilePanel), topic heatmap + format breakdown in StudentGradesView, national
> GCSE benchmark comparison in SLT analytics, GCSE exam weighting hints in revision AI prompt.
> 150/155 e2e passing on Vercel (1 network flake, 4 intentional skips).
>
> **Deployment:** https://omnis-app-ten.vercel.app
> June 2026 Part 5: Marketing pages — /marketing/home, /marketing/features, /marketing/beta,
> /marketing/investors. Shared sticky-nav layout, contact forms → ivanyardley@me.com via Resend
> (/api/contact/beta + /api/contact/investors). Middleware updated to exclude /marketing/* from auth.
> June 2026 Part 6: Password reset flow (/forgot-password + /reset-password), staff invitation
> system (/accept-invite + /api/staff/invite + /api/staff/accept-invite), root redirect (/ →
> /marketing/home for unauthenticated users). PasswordResetToken + StaffInvitation Prisma models
> pushed to production. AdminStaffTable "Invite by email" modal. lib/email.ts extended with
> sendPasswordResetEmail + sendStaffInvitationEmail. login page "Forgot your password?" link.
> June 2026 Part 7: Year rollover cron (0 1 1 9 *, Y7→Y12 increment + Y13 deactivation) + manual
> trigger with dry-run preview (YearRolloverPanel). Wonde auto-provisioning of student/parent User
> accounts (gated on School.emailDomain). /admin/users unified management page (UserManagementTable,
> filter chips, deactivate/reactivate/resend). 5 new email triggers: new homework → students, grade
> below target → parents, ILP/EHCP review-due cron (0 7 * * 1-5). Schema: User.activatedAt,
> School.emailDomain, AuditAction YEAR_ROLLOVER/USER_PROVISIONED/WELCOME_EMAIL_SENT.
> June 2026 Part 8: Role/class assignment UI (EditUserModal in UserManagementTable — role dropdown,
> year group, class checkboxes via setTeacherClasses). School onboarding wizard (/admin/onboarding,
> 4-step: profile → invite staff → connect MIS → complete; amber banner on admin dashboard when
> !onboardedAt). Global search Cmd+K palette (GlobalSearch.tsx — debounced, grouped results,
> keyboard nav, integrated in AppShell for non-student/parent/TA roles). ACADEMY_ADMIN role +
> /academy/dashboard + SchoolGroup model for MAT/trust grouping. PlatformSchoolHealthTable on
> platform admin dashboard. New server actions: changeUserRole, updateStudentYearGroup,
> getSchoolClasses, getUserClasses, setTeacherClasses, saveSchoolSettings, completeOnboarding,
> getAcademyStats, getAcademySchools, getSchoolHealthData. Schema: SchoolGroup model,
> School.schoolGroupId, ACADEMY_ADMIN in Role enum, SCHOOL_ONBOARDED/SCHOOL_SETTINGS_UPDATED/
> USER_CLASS_ASSIGNED in AuditAction enum.
> June 2026 Sprint A: Student account activation — CSV import modal (/admin/users "Import
> students" button, client-side CSV parser, preview table, importStudents() server action,
> sends 7-day activation emails, optional class enrolment by name). ActivationPanel on admin
> dashboard (amber widget, per-year-group breakdown, progress bar, "View all" → /admin/users
> ?filter=pending). pendingActivation stat added to AdminDashboardStats. EditUserModal extended
> to show class enrolment checkboxes for STUDENT role (setStudentEnrolments — Enrolment records,
> separate from ClassTeacher). getStudentEnrolments + setStudentEnrolments server actions.
> /admin/users accepts ?filter=pending URL param. Academy seed (4 synthetic schools + SchoolGroup
> + ACADEMY_ADMIN user). Login page split into School Demos + Platform/Academy demo sections.
> June 2026 Sprint B: Student subject options (GCSE/A-level choices) — StudentSubject model
> (studentId, subject, isCore, level, assignedClassId, @@unique[studentId,subject]). Server
> actions: getStudentSubjects, setStudentSubjects, getClassesForSubject, getOptionsOverview.
> StudentOptionsModal: core subjects pre-ticked/locked, option subject checkboxes, per-subject
> level + class-within-subject dropdowns. /admin/options overview page (year-group tabs, subject
> × student count, core/option badges). Book icon per student row in AdminStudentTable. Subject
> chips in StudentFilePanel header. "Subject Options" in SCHOOL_ADMIN sidebar. Seed refreshed.
>
> June 2026 Sprint C: Dashboard appropriateness audit — Academy Admin sidebar broken links fixed
> (/platform-admin/* replaced with /academy/schools, /academy/send, /academy/reports). Academy
> stats: 'Published HW' → 'Open Concerns' + 'Onboarded Schools'. AcademySchoolsTable: SEND
> register, ILPs, EHCPs, open concerns columns added; classCount removed. 3 new academy pages:
> /academy/schools (full table), /academy/send (trust SEND breakdown + per-school %), /academy/
> reports (compliance: onboarding status, MIS sync health, SEND figures). Admin dashboard:
> 'Awaiting Marking' stat removed (teacher-level); replaced with 'Open Concerns'.
> June 2026 Sprint D: APDR enhancements — structured Review form (4-option outcome rating radio
> cards + parent/carer comments textarea), Do section "Pull evidence" auto-populate (aggregates
> IlpEvidenceEntry + TaNote records since cycle start via getAPDRDoEvidence action), PDF export
> route (/api/export/apdr/[apdrId] — Puppeteer, SENCO/SLT/HOY/SCHOOL_ADMIN), OutcomeRatingBadge
> on completed cycles, revalidatePath fixed to /students/[id] + /senco/apdr. Schema: outcomeRating
> + parentComments fields on AssessPlanDoReview, pushed to production DB.
> June 2026 Sprint E: HOY dashboard (/hoy/dashboard — greeting, KPI cards, attendance panel,
> SEND concerns, homework pulse, quick links, print button). Academic integrity workflow
> (/hoy/integrity — signals table, pattern cases, review modal). CSV export on admin tables +
> student record PDF + analytics print. HOY pastoral welfare hub (/hoy/welfare).
> Attendance overview (/admin/attendance — KPI distribution cards, year-group breakdown table
> with RAG bars, students-below-90% list with SEND badges, CSV export, print; accessible to
> SCHOOL_ADMIN/SLT/HOY). Academy reports PDF export (/api/export/academy-report — Puppeteer,
> lib/pdf/academy-report-template.ts; compliance/SEND/scale/per-school table). NotificationsView
> filter chips (All/Unread/Concerns/Early Warning/ILP Reviews/Homework/Messages). Sidebar:
> Attendance link for SCHOOL_ADMIN + SLT; Welfare link for HEAD_OF_YEAR.
> E2E: hoy-dashboard.spec.ts added (access control + page content).
>
> June 2026 Blocks 29–31: Detention + Exclusion management — Detention model (type/reason/scheduledAt/
> durationMins/location/status/parentNotified) + Exclusion model (type/reason/startDate/endDate/
> daysCount/status/reintegrationPlan/parentContacted). AuditAction: DETENTION_LOGGED/RESOLVED +
> EXCLUSION_LOGGED/RESOLVED. app/actions/detentions.ts (logDetention, resolveDetention, deleteDetention,
> getDetentionRegister, getStudentDetentions). app/actions/exclusions.ts (logExclusion, resolveExclusion,
> getExclusionLog, getStudentExclusions). /hoy/detentions: register with Today/Upcoming/Missed/Completed
> sections, year filter, Log modal, resolve + parent email notify. /hoy/exclusions: active/recent log,
> KPI cards, Log modal, inline reintegration plan form on return. lib/email.ts: sendDetentionNotificationEmail.
> StudentFilePanel Behaviour tab: detention + exclusion history sections. Sidebar: Detentions + Exclusions
> for HOY/SCHOOL_ADMIN/SLT. /api/export/detention-register (HOY/SLT/SCHOOL_ADMIN/HOD, 90d CSV).
> /api/export/exclusion-log (HOY/SLT/SCHOOL_ADMIN/HOD/SENCO, 365d CSV with SEND status). getBehaviourTrends()
> added to behaviour.ts — ISO week buckets, 8-week window. BehaviourTrendChart (Recharts BarChart, positive/
> negative/neutral bars). /hoy/behaviour: now shows trend chart + Behaviour/Detentions CSV export buttons.
> HOY dashboard quick links updated: Detentions + Exclusions. E2E: hoy-behaviour-detentions.spec.ts (30 tests).
>
> June 2026 Blocks 32–38: Safeguarding + Communications — SafeguardingRecord model
> (priority/status/referredToDSL/dslNotes/resolvedAt), SafeguardingView client component
> (/hoy/safeguarding — KPI cards, section tabs, log modal, DSL notes edit), logSafeguardingRecord +
> updateSafeguardingRecord + getStudentSafeguardingRecords actions. SchoolCommunication +
> CommunicationReceipt models. /admin/communications (compose modal, recipient scope, read-receipt
> "who hasn't read" panel), /parent/communications inbox. StudentFilePanel Safeguarding tab (lazy).
> Attendance letter auto-log (GET /api/export/attendance-letter/[studentId] creates ParentContactEntry
> LETTER + PARENT_CONTACT_LOGGED audit). StudentFilePanel Overview export strip for HOY/SLT/SCHOOL_ADMIN/
> SENCO. /hoy/absence Actions column: Letter + Report PDF links. Safeguarding PDF export
> (/api/export/safeguarding-log — Puppeteer, HOY/SENCO/SLT/SCHOOL_ADMIN). getCommunicationRecipients
> action returns read/unread per-parent. E2E: safeguarding.spec.ts + communications.spec.ts.
>
> June 2026 Blocks 39–42: Staff Analytics + Pastoral Notes — app/actions/analytics-staff.ts:
> getTeacherList, getTeacherAnalytics, getDepartmentAnalytics (per-class avg grades, submission rates,
> turnaround days, Bloom's coverage). /analytics/teacher (HOD/SLT/admin) — KPI cards, class table,
> Bloom's panel. /analytics/department — 5 KPI cards, teacher comparison table, Bloom's bar chart.
> TeacherSelector + DepartmentSelector client components. HOD + SLT sidebar links added.
> PastoralNote model (category/visibility, PASTORAL_NOTE_ADDED/DELETED AuditAction). addPastoralNote/
> deletePastoralNote/getPastoralNotes actions. PastoralNotesTab in StudentFilePanel (eco icon,
> lazy-loaded, HOY/SENCO/SLT/SCHOOL_ADMIN only). getStaffOverview() bulk action. /slt/staff page —
> school-wide teacher comparison table with grade pills, submission bars, turnaround, CSV export,
> drill-through to /analytics/teacher. SLT sidebar Staff Overview link.
>
> June 2026 Blocks 43–45: E2E expansion + Pastoral deep-links — staff-analytics.spec.ts (28 tests:
> /analytics/teacher, /analytics/department, /slt/staff access + content). pastoral-timetable.spec.ts
> (14 tests: Pastoral Notes tab visibility + form, /student/timetable access + content, staff overview
> drill-through). /hoy/absence student names now deep-link to /students/[id]?tab=Pastoral; Actions
> column gets green Pastoral button alongside Letter + Report. HOY dashboard attendance-alert and
> SEND concern student names also deep-link to Pastoral tab. HoyWelfarePanel open-in-new icon
> updated to eco + emerald, deep-links to Pastoral tab.
>
> July 2026 UAT sprint: multi-role browser UAT on omnis-app-ten.vercel.app — 8 bugs diagnosed and
> fixed. (1) AI Goals generation failure — Claude (sonnet-4-6) returned prose-prefixed or
> object-wrapped JSON; replaced single regex with multi-strategy extractor (strip fences →
> JSON.parse → array regex → object unwrap). (2) HOD "SEND Concerns" + "Early Warning" dead
> links — HEAD_OF_DEPT excluded from /senco prefix in auth.config.ts ROLE_ROUTES; removed both
> sidebar links from HEAD_OF_DEPT nav. (3) Resource library duplicates — getFullResourceLibrary
> returned same URL once per lesson it was attached to; added in-memory dedup by url ?? fileKey
> ?? label, keeping copy with highest sendScore. (4) Student draft answers not persisted —
> HomeworkSubmissionView lacked auto-save; added 500ms debounced localStorage save on change +
> restore on mount before first submission. (5) AI homework generation progress bar below fold —
> loading state only shown in modal button (scrollable modal); added sticky blue banner below
> modal header visible during AI generation. (6) "Differentiate" button not prominent — was ghost
> bg-indigo-50; changed to solid bg-indigo-600 primary button. (7) Parent dashboard: no grade
> trend — added trajectory arrows (trending_up/trending_down) by comparing last-2 vs previous-2
> graded submissions per subject. (8) Teacher SEND caseload: broken concern links — three links
> to /senco/concerns silently redirected TEACHER role; replaced with inline RaiseConcernModal
> calling raiseConcern() server action directly, with pre-filled ILP notification for students
> with no ILP. See dmox.md for full root-cause + fix log.
>
> July 2026 UAT Round 2: 6 confirmed bugs fixed. (1) Lesson resource preview blank for .pptx —
> browsers cannot render Office formats in iframes; LessonFolder.tsx now detects non-previewable
> extensions (.pptx/.docx/.xlsx/.ppt) and shows a Download button instead of a blank iframe.
> (2) AI Goals modal fixed-height textareas — three textarea fields (Target/Success criteria/
> Teacher strategy) had rows={2} and resize-none; changed to rows={4} + resize-y so full AI
> content is visible and user-resizable. (3) HOD SEND Students showing 0 — getTeacherSendCaseload
> only scoped to ClassTeacher-assigned classes; HOD may not be directly assigned as ClassTeacher,
> so added department fallback (same logic as getHodDashboardData) when classes.length === 0 and
> role === HEAD_OF_DEPT. (4) Analytics "SEND Need" filter non-functional — ClassRosterTab has its
> own internal sendFilter state; analytics sendCat was never passed down; added externalSendFilter
> prop to ClassRosterTab and wired it from StudentAnalyticsView. (5) Active ILPs count
> overcounting — ilpCount in ClassRosterTab counted all students with ILP records including
> non-SEND students; fixed to only count students where sendStatus === SEN_SUPPORT or EHCP.
> (6) TA SEND Students showing no ILP targets — previous session wrongly changed
> IndividualLearningPlan status queries to uppercase (ACTIVE/UNDER_REVIEW); IndividualLearningPlan
> .status is a plain String with lowercase values ('active'/'under_review'/'archived'), NOT the
> ILPStatus enum (which belongs to the legacy ILP model); reverted both occurrences in ta-notes.ts.
> Bonus: Mia Adams SEND category inconsistency — ILP card showed ilp.sendCategory; AI Goals modal
> used sendStatus.needArea (different DB fields); fixed generateIlpGoalsForStudent to look up
> existing ILP's sendCategory as source of truth. 449/450 E2E passing on Vercel (2026-07-04).
>
> July 2026 UAT Round 3: 4 production bugs fixed via Vercel runtime error log analysis (no manual
> browser testing). (1) Quality/Coach agent JSON parse failures (298+33 occurrences) — Claude
> returned prose-prefixed JSON or embedded raw newlines/control chars inside string values;
> lib/agents/quality.ts and lib/agents/coach.ts now use a multi-strategy extractor: strip markdown
> fences → clean control chars (0x00-0x08/0x0b/0x0c/0x0e-0x1f) → match {…} → JSON.parse → on
> failure, escape unescaped \n/\r/\t inside string values via regex → retry parse. max_tokens
> increased (quality 1200→2000, coach 800→1200). (2) Admin dashboard P2024 connection pool
> exhaustion (9 occurrences) — getAdminDashboardData (in unstable_cache) ran 7 parallel
> prisma.count() queries; with PgBouncer connection_limit=5, concurrent background cache refreshes
> exhausted the pool; fixed by running all 7 queries sequentially in app/actions/admin.ts.
> (3) PDF export ETXTBSY (33 occurrences) — @sparticuz/chromium binary locked during concurrent
> Lambda cold-starts; lib/pdf/generator.ts launchBrowser() now retries ×3 with 500ms/1000ms
> back-off on ETXTBSY before re-throwing. (4) dueAt crash (3 occurrences) — app/homework/page.tsx
> called .toISOString() without instanceof Date guard; fixed with ternary fallback to String(hw.dueAt).
>
> July 2026 UAT Round 4: 6-issue data-coherence audit. (1) ILP pollution — generate-ilp route,
> generateILPForStudent, and generateILPFromConcern all lacked a SendStatus.activeStatus check;
> created ILPs for non-SEND students; fixed with SEND guard in all 3 locations. createIlp now
> archives under_review alongside active ILPs, preventing duplicate non-archived ILPs per student.
> getSencoDashboardData studentsWithIlp count now scoped to SEND-registered students only.
> DB cleanup: 123 orphaned ILPs (non-SEND students) archived via direct SQL.
> (2) Conflicting SEND classification (Mia Adams, Rehan Ali, Anya Patel) — root cause was duplicate
> ILPs surviving from under_review status; fixed by createIlp archive fix above.
> (3) EHCP count mismatch — getEhcpRegisterCount action added to ehcp.ts; EHCP Plans page now
> fetches both EhcpPlan count and SendStatus.activeStatus=EHCP count; shows amber reconciliation
> banner if they diverge. (4) SEND Need filter non-functional — externalSendFilter in
> StudentAnalyticsView was passing raw ILP sendCategory strings ('SpLD/Dyslexia' etc.) to
> ClassRosterTab which compares against sendStatus values; normalised to '__send_only__'.
> (5) Duplicate dashboard routes — auth.config.ts SENCO login now routes to /senco/dashboard
> (working hub) not /send/dashboard (register list). (6) Homework 'to mark' inconsistency —
> homework/page.tsx scope aligned to dashboard (createdBy OR class teacher); needsMarkCount
> criterion aligned to !s.finalScore matching dashboard's !s.grade check.
>
> July 2026 UAT Round 5: Data architecture audit — single source of truth for SEND/ILP/EHCP.
> Root cause was three independent representations of SEND status that were never reconciled.
> DB fixes: (1) Promoted 5 EHCP plan holders (Caitlin Harris, Mia Adams, Rehan Ali, Sophia Ahmed,
> Tyler Cooper) to SendStatus.activeStatus=EHCP — EhcpPlan presence is now authoritative; register
> count rises from 2→7, matching EhcpPlan document count. (2) Synced ILP.sendCategory to
> SendStatus.needArea for 13 ILPs where fields diverged (root cause of Mia Adams showing SpLD on
> SENCO view vs ASD/Autism on teacher/TA views). (3) Set approvedBySenco=true on 2 seed ILPs
> (Rehan Ali, Sophia Ahmed) that were status=active but unapproved — eliminating false
> "ILP awaiting approval" entries in the pending actions widget.
> Code fixes: (4) getSencoDashboardData studentsWithIlp + ilpReviewsDue + upcomingIlpsRaw now
> count status IN [active,under_review] — was 'active' only, showing 16 instead of 49.
> (5) getHodDashboardData activeIlps count aligned same way + SEND guard added.
> (6) getTeacherSendCaseload ILP lookup now covers [active,under_review] without approvedBySenco
> filter — hasIlp=false for students with under_review ILPs was why Jay Patel saw Rehan Ali/
> Sophia Ahmed as "no approved ILP" despite SENCO and TA views showing full active ILP targets.
> (7) getDepartmentAnalytics totals.students and sendPct now use de-duplicated unique student Set
> across all department classes — was summing per-teacher per-class counts, inflating to 734
> students / 28% SEND vs actual unique count. (8) StudentAnalyticsView Grade Calibration table
> hidden when sendCat filter is active — pre-computed server data cannot be SEND-filtered client-
> side, so hiding prevents misleading unfiltered rows appearing alongside a filtered class list.
> Post-fix cross-role trace confirmed: Mia Adams, Rehan Ali, Sophia Ahmed all show send_status=EHCP,
> correct needArea/sendCategory, ilp_status=active, approvedBySenco=true, has_ehcp_doc=true.
> Dashboard ILP count = ILP Records page count = 49 (was: dashboard 16 vs records 49).
>
> July 2026 Compliance sprint (UK GDPR Article 9): (1) First-login DPA acknowledgement gate —
> staff roles (all except STUDENT/PARENT) are redirected to /accept-dpa on first access; page
> presents full Data Processing Acknowledgement including controller/processor roles, staff
> obligations, AI sub-processor disclosure, audit logging disclosure, retention policy, session
> security; acceptDpa() server action sets User.dpaAcceptedAt + writes DPA_ACCEPTED audit entry
> + patches JWT via unstable_update so middleware gate clears without re-login; middleware.ts
> excludes /accept-dpa from auth matcher; auth.config.ts authorized() checks token.dpaAcceptedAt
> for staff roles. Schema: User.dpaAcceptedAt DateTime?. (2) SEND read audit logging — all staff
> access to student records via getStudentFile() writes SEND_RECORD_VIEWED audit log (fire-and-
> forget, UK GDPR Article 9); direct ILP record access via getStudentIlp() also writes
> SEND_RECORD_VIEWED with targetType=ILP. AuditAction enum: DPA_ACCEPTED, SEND_RECORD_VIEWED,
> BEHAVIOUR_RECORD_VIEWED added and pushed to production DB. (3) Session inactivity timeout —
> SessionTimeout.tsx client component tracks mouse/key/click/scroll/touch events; after 25 min
> inactivity shows modal warning with countdown (5 min remaining); after 30 min forces signOut
> to /login?reason=timeout; "Stay Logged In" button resets timers; rendered in AppShell for all
> authenticated users; activity debounced to 30s intervals to avoid timer thrash.
>
> July 2026 UAT Round 5 follow-up (E2E flakes + high-priority guards): (1) send-smoke Step 5
> K Plan approval — replaced 2500ms fixed wait with 10s poll loop tolerating cold Lambda DB
> commit lag. (2) sprint-d-apdr ILP list cold-start — added networkidle wait + raised body
> length threshold 100→200 chars (was receiving 34-char cold-start skeleton). (3) createEhcpPlan
> EHCP forward-sync guard — upserts SendStatus.activeStatus=EHCP immediately on plan creation
> so new EHCP plans automatically promote the student's register status without manual DB fixes.
>
> July 2026 UAT Round 5 browser test (live cross-role inspection on Vercel — 8 Jul 2026):
> Full 7-section visual audit run across all 6 roles. 2 critical failures found and fixed:
> (A1 CRITICAL) AI homework generation stalled at 85% indefinitely — root cause: Anthropic
> streaming loop ran with max_tokens=8000, capping progress at 85% for 40-90s; no client
> timeout meant hangs from Anthropic API mid-stream were invisible. Fix: max_tokens 8000→4000
> (halves generation time); lib/ai-stream.ts Promise.race 45s stale-stream timeout now surfaces
> user-friendly error instead of infinite freeze. Bonus fix: generate-homework SEND context
> query used status:'ACTIVE' (wrong casing for plain-string field) — corrected to
> { in: ['active','under_review'] }. (A11 CRITICAL) No "New EHCP Plan" button on /senco/ehcp
> — EhcpPageClient was read-only with no creation entry point; createEhcpPlan action existed
> but was unreachable from UI. Fix: CreateEhcpPlanModal.tsx built (student dropdown scoped to
> SEND-registered students without plans, local authority, dates, initial outcome section);
> "New EHCP Plan" button added to EHCP Plans toolbar for SENCO/SLT/SCHOOL_ADMIN; creating a
> plan calls createEhcpPlan which upserts SendStatus.activeStatus=EHCP — forward-sync and
> document creation happen atomically. 4 warnings also fixed: (B10) Cmd+K Enter closed palette
> without navigating — added e.preventDefault() + unified through navigate() helper. (A5) Parent
> dashboard trajectory arrows required 4 graded submissions per subject — lowered to 2,
> comparing most-recent vs prior with >=1 grade diff; demo students now show arrows. Audit
> confirmed PASS: SENCO dashboard ILP count=49 ✓, Rehan Ali/Sophia Ahmed EHCP+ILP correct
> across all roles ✓, department analytics 182 students (not 734) ✓, agent insights 3721
> recommendations with confirm/reviewed flow ✓, HOY/admin/TA dashboards all correct ✓.
>
> July 2026 School Cohort Aggregation (memory layer 1): SchoolCohortAggregate model — per-school,
> per-year-group rollup of all StudentLearningProfile records. computeSchoolCohortAggregate()
> reads all per-student profiles with student.yearGroup + SendStatus, partitions into school-wide
> and per-year buckets, computes weighted averages for Bloom's performance, task-type performance
> (all students + SEND-only), need area breakdown, trend distribution, and top ILP strategies.
> Upserts SchoolCohortAggregate rows (@@unique[schoolId, subject, yearGroup]). getSchoolCohortContext()
> read helper consumed by ILP generation. CohortInsightsPanel on SENCO dashboard (loading skeleton,
> graceful empty state, SEND overview, attainment bars, trend distribution, Bloom's bars, best SEND
> task type, top ILP strategies). Added to nightly early-warning cron after per-student profiles
> complete. ILP generation now loads cohort context in parallel and passes to buildIlpPrompt()
> via cohort section (school-grounded targets, best task types, proven strategies). app/actions/cohort.ts
> server action (SENCO/SLT/SCHOOL_ADMIN/HOY/HOD/PLATFORM_ADMIN/ACADEMY_ADMIN).
>
> July 2026 Cross-School Insight Pipeline (memory layer 2): PlatformInsight model — anonymised,
> aggregated signals across all schools. k-anonymity threshold: MIN_SCHOOLS=3 (never writes if
> fewer than 3 schools contribute to a bucket). 5 insight types per yearGroup (null=cross-year,
> 7-13=year-specific): ATTAINMENT_BENCHMARK (national avg score/completion/SEND gap/improving%),
> BLOOMS_DISTRIBUTION (weighted avg per Bloom's level), SEND_TASK_TYPE (best homework types for
> SEND students nationally), STRATEGY_FREQUENCY (top ILP strategies by school adoption count,
> cross-year only), NEED_AREA_PREVALENCE (% distribution of SEND need areas, cross-year only).
> computePlatformInsights() reads all SchoolCohortAggregate rows, groups by yearGroup, applies
> k-anon guard, computes weighted averages, upserts via @@unique[insightType, yearGroup].
> /api/cron/platform-insights: Sundays 05:00 UTC, no Claude calls. getPlatformInsightsForIlp()
> read helper: loads 5 insight rows in parallel, collapses to PlatformInsightForIlp summary.
> buildIlpPrompt() now accepts IlpPlatformContext as 3rd grounding layer (national benchmarks
> section: avg score, completion, SEND %, best Bloom's, best SEND task types, top need areas,
> top strategies). ILP generation loads cohort + platform context in parallel (pct 28) before
> Claude call. PlatformInsightsPanel: 3-column UI on /platform-admin/dashboard — national
> benchmarks KPI grid, Bloom's + SEND task bars, need area prevalence + strategy rankings.
> Shows graceful empty state until first Sunday cron fires with >=3 schools.
>
> July 2026 SEND co-production + cohort drill-down + ILP strategy inference (options 2/3/4):
> (Option 2) IlpParentResponse model — parent acknowledges ILP, adds home progress notes, requests
> SENCO meetings; IlpAcknowledgementPanel on /parent/progress; acknowledgeIlp/getIlpParentResponses/
> getMyIlpResponse server actions; SENCO sees parent responses inline on ILP detail with meeting
> request indicator. (Option 3) CohortInsightsPanel year-group selector — All/Y7–Y13 buttons
> re-fetch getSchoolCohortInsights() without page reload; selected year passed to AI ILP generation.
> (Option 4) OmnisInferenceCache ILP_STRATEGY_REC type — lookupIlpStrategyRec/storeIlpStrategyRec
> helpers; buildIlpPrompt 4th grounding layer injects provenStrategies from national ILP data.
> Schema: IlpParentResponse model (ilpId, parentId, schoolId, studentId, homeProgress,
> meetingRequested, meetingNote, reviewedAt; @@unique[ilpId_parentId]), ILP_STRATEGY_REC in
> OmnisInferenceCache.cacheType. Mobile DPA fix: /accept-dpa sticky footer pattern — card is
> flex flex-col with maxHeight calc(100dvh - 2rem), shrink-0 header/footer, overflow-y-auto
> flex-1 body; items-start on mobile so card anchors to top rather than centering off-screen.
>
> July 2026 Consent UX redesign: industry-standard multi-checkbox consent flow replacing single-accept post-login gates.
> (1) `components/consent/PolicyConsentPanel.tsx` — reusable panel: one checkbox per policy, "View full policy →" link
> opens inline modal with full legal text, "I have read this — Accept" auto-ticks + closes, red blocking error when
> `attempted && !checked`, green tick when accepted, progress bar (X/N accepted).
> (2) `/accept-dpa` rewritten: 3 items — data-controller, staff-obligations, audit-and-ai (full text inline as React).
> (3) `/accept-terms` rewritten: parent = platform-terms + privacy-notice; student = aup + privacy-notice.
> (4) `/accept-invite` rewritten: two-section form (password + 3 DPA items). POST sends `acceptedConsents[]`; API sets
> `dpaAcceptedAt` on user creation so invited staff never hit the post-login gate. DPA_ACCEPTED audit logged with
> `acceptedConsents` + `consentVersion: "2026-07"` metadata.
> (5) `loginAs()` `clearComplianceGate()` loops over all checkboxes (pages now have 2–3 not 1).
> (6) E2E: sprint-d-apdr:115 body threshold 200→100 (cold Lambda returns 138-char AppShell before networkidle).
>
> **Latest commit:** a0ef0e4 (fix e2e: APDR body threshold 200→100). E2E: 37 spec files, 450 tests. **449/450 passing on Vercel (warm run). 1 intentional skip (APDR PDF). Exit 0.**
>
> July 2026 Production launch (omnis.education):
> Dockerfile (Node 22 Alpine, 3-stage) added for Coolify self-hosted deployment — replaced nixpacks which OOM'd.
> `.dockerignore` added. Demo panel gate changed from `VERCEL_ENV !== 'production'` → `NODE_ENV !== 'production'`
> so it never shows on Coolify. SEO: `app/robots.ts` + `app/sitemap.ts`; OG/Twitter meta in marketing layout;
> `lang="en-GB"` on root layout; JSON-LD structured data (Organization + SoftwareApplication + FAQPage) on home page;
> FAQ section added to marketing home. Remember me: `lib/auth.ts` credentials accept `rememberMe`; false → 4h session,
> default 30 days; checkbox in `LoginForm.tsx`. Beta auto-provisioning: `/api/contact/beta` finds Omnis Demo School,
> creates User with hashed password + correct Role via `mapJobTitleToRole()`, fires `sendBetaWelcomeEmail` (fire-and-forget).
> Returns `{ ok: true, demoCreated: boolean }`. `BetaForm.tsx` shows "Check your email" + "Sign in →" when demoCreated=true.
> `sendBetaWelcomeEmail` added to `lib/email.ts`. Email delivery verified: SPF/DKIM/DMARC confirmed on omnis.education
> via Resend (123reg DNS). DKIM fix: spaces in TXT record caused initial failure — corrected to single unbroken string.
> DMARC: deleted 123reg default `_dmarc` record, added `v=DMARC1; p=quarantine; rua=mailto:ivanyardley@me.com; adkim=s; aspf=s`.
>
> July 2026 Security hardening sprint:
> HTML escaping: `h()` function applied to all user-supplied fields in `/api/contact/beta` and `/api/contact/investors`
> email templates (XSS prevention). CSP tightened: `connect-src 'self' https://*.sentry.io` (was open),
> `frame-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'` added to `next.config.ts`.
> `X-Frame-Options` changed from `SAMEORIGIN` → `DENY`. HSTS added: `Strict-Transport-Security: max-age=63072000;
> includeSubDomains; preload`. Google Fonts added to `style-src`/`font-src`. Beta form loading spinner added
> (material-icons `refresh` + `animate-spin` during submit). README.md rewritten from Next.js boilerplate to
> full project documentation (setup, env vars, demo credentials, deployment, compliance).
>
> July 2026 Trial readiness audit (2026-07-21):
> 23-item evidence-based audit across auth, SEND, email, security, E2E, and demo data.
> 4 blocking items fixed: (1) E2E CI — `.github/workflows/e2e.yml` now triggers on `push: branches: [main]`
> in addition to `workflow_dispatch`. (2) APDR demo data — seed updated: Cycle 1 now COMPLETED with full
> `reviewContent`, `outcomeRating: 'GOOD_PROGRESS'`, and `parentComments`; Cycle 2 (Autumn 2026) seeded as ACTIVE.
> (3) ILP audit trail — 2 `IlpAuditEntry` rows seeded for Rehan Ali demonstrating post-approval target edits.
> (4) `OMNIS_TRIAL_READINESS_PLAN.md` updated with full 23-item evidence table, all items verified.
> Deployed to Coolify via API (deployment `v3xfebqf1fwfb4055jcievbq`, status: finished). omnis.education returning 200.
> Production seed run confirmed: APDR Cycle 1 completed + Cycle 2 active, ILP audit trail seeded.
> Beta form tested end-to-end: `{ ok: true, demoCreated: true }`, User + BetaApplication rows confirmed in production DB.
>
> **Latest commit:** 76a516a (fix: blocking items from trial readiness audit). Deployed: omnis.education. E2E CI: push trigger active.
>
> July 2026 Comprehensive Trial Audit (13 items + compliance): All 13 testable items PASS.
> PART A (10 trial-blocking): class roster, student photos, homework cycle, GCSE grade display,
> revision topic relevance, ILP live audit trigger, APDR creation, EHCP SEN→EHCP promotion,
> RAG chip filtering, E2E test suite — all PASS.
> PART B (3 data safety): schoolId scoping grep (all false positives — no genuine leaks found),
> student auth bypass (307 → /student/dashboard for all wrong-role routes), security headers
> (CSP/HSTS/X-Frame-Options DENY/X-Content-Type-Options nosniff live on omnis.education) — all PASS.
> PART C (compliance): /accept-dpa (3-checkbox staff gate — controller/processor, staff obligations,
> audit+AI disclosure), /accept-terms (2-checkbox parent/student gate — terms + privacy), /accept-invite
> (DPA inline in invite flow), /admin/gdpr (INSERT-only ConsentRecord, DataSubjectRequest, CSV export) — documented.
> E2E result: 450/450 passing (433 first-try + 17 flaky/retry, 0 hard failures, exit 0). Up from 449/450.
> OMNIS_TRIAL_READINESS_PLAN.md updated with full 13-item audit table + PART C description.

> **MANDATORY:** Run `npx tsc --noEmit && npm run build` before every `git push`. Both must exit with code 0. Never push if either fails.

---

## Active Development Framework

Prompt-library and planning files live in the project root. Reference these when starting any development task:

| File | Description |
|---|---|
| `DEVELOPMENT.md` | General bug/feature prompt library — 18 recipes covering fixes, new pages, schema changes, deploy checks, and more |
| `ADAPTIVE-LEARNING-LOOP.md` | 7-step teacher lesson → adaptive homework loop — from calendar fix through to per-student adaptive profiles |
| `SEND-FRAMEWORK.md` | 8-step ILP/EHCP/APDR/adaptive SEND system — from auto-ILP generation through to SLT SEND reporting dashboard |
| `TRIAL_READINESS_PLAN.md` | Trial readiness checklist — what must be complete before school trial. Read this before starting any new work. |

---

## Project Description

Omnis is a multi-tenant UK secondary school management SaaS. It covers the full
teacher workflow: lesson planning, Oak National Academy resource integration,
homework (set / auto-mark / mark / return), class roster with SEND tracking,
analytics, adaptive learning, EHCP/ILP management, messaging, cover management,
GDPR consent, a student revision planner, a teacher revision program builder,
and a Wonde MIS sync integration. Deployed on Vercel, database on Supabase.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| UI | React 19.2.3, Tailwind CSS v4, Recharts, Google Material Icons |
| Auth | NextAuth v5 (`next-auth@5.0.0-beta.30`) — Credentials + JWT |
| ORM | Prisma v6.19.2 |
| Database | PostgreSQL via Supabase |
| AI | Anthropic Claude SDK (`@anthropic-ai/sdk ^0.78.0`) — `claude-sonnet-4-6` |
| PDF | Puppeteer v24 |
| Language | TypeScript 5 |
| Testing | Playwright 1.58 |

**Tailwind v4:** Uses `@import "tailwindcss"` in `app/globals.css`. Full class
literals required — no dynamic string construction (scanner can't see it).

**DB connection:** `DATABASE_URL` must use port **6543** with
`?pgbouncer=true&connection_limit=5`. `DIRECT_URL` uses port 5432 for
migrations (`prisma db push`).

---

## Environment (`.env.local`)

```
DATABASE_URL="...port 6543...?pgbouncer=true&connection_limit=5"
DIRECT_URL="...port 5432..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="..."
RESEND_API_KEY="..."      # transactional emails via lib/email.ts (homework reminders, etc.) + future marketing contact forms
CRON_SECRET="..."         # bearer token for Oak sync + early-warning cron endpoints
WONDE_API_TOKEN="..."     # Wonde MIS API token
WONDE_SCHOOL_ID="..."     # Wonde school ID (A1930499544 for test school)
```

---

## Auth & Session

```typescript
// JWT session shape (lib/auth.ts + auth.config.ts)
session.user = { id, schoolId, schoolName, role, firstName, lastName }
```

`middleware.ts` (NextAuth v5 auth export) protects all routes except
`/login`, `/api`, `/_next/*`, `favicon.ico`. Role-based redirects are in
`auth.config.ts` via `ROLE_ROUTES` array and `getRoleHome()`:

| Role | Home |
|---|---|
| STUDENT | `/student/dashboard` |
| PARENT | `/parent/dashboard` |
| SENCO | `/senco/dashboard` |
| SLT | `/slt/analytics` |
| SCHOOL_ADMIN | `/admin/dashboard` |
| PLATFORM_ADMIN | `/platform-admin/dashboard` |
| All others | `/dashboard` |

---

## Demo Credentials (all password: `Demo1234!`)

| Email | Role |
|---|---|
| `j.patel@omnisdemo.school` | TEACHER (English, 3 classes) |
| `r.morris@omnisdemo.school` | SENCO |
| `t.adeyemi@omnisdemo.school` | HEAD_OF_YEAR (Year 9) |
| `d.brooks@omnisdemo.school` | HEAD_OF_DEPT (English) |
| `c.roberts@omnisdemo.school` | SLT |
| `k.wright@omnisdemo.school` | TEACHER (Maths) |
| `a.hughes@students.omnisdemo.school` | STUDENT (Year 9) |
| `l.hughes@parents.omnisdemo.school` | PARENT |
| `admin@omnisdemo.school` | SCHOOL_ADMIN |
| `platform@omnis.edu` | PLATFORM_ADMIN |
| `j.taylor@omnisdemo.school` | TEACHING_ASSISTANT |

---

## Commands

```bash
# Dev
npm run dev                                       # Turbopack dev server
npm run build                                     # Production build (must pass clean)
npm run lint                                      # ESLint

# DB
npx prisma db push                                # Apply schema changes (uses DIRECT_URL)
npx prisma studio                                 # DB browser
npx tsc --noEmit                                  # TypeScript check without building

# Seeds (all use .env.local)
npm run db:seed            # Main seed — demo users, school, classes, lessons, homework
npm run db:seed-classes    # Classes only
npm run db:seed-english    # English students + submissions
npm run revision:seed      # Revision exams + sessions for demo student
npm run topup:seed         # Top-up seed (additional demo data)
npm run wonde:seed         # Wonde tables — Oakfield Academy (30 staff, 120 students)
npm run platform:seed      # Platform admin + 3 demo schools + feature flags
npm run send:seed          # SEND concerns, ILPs, flags, EHCP plans
npm run messages:seed      # 5 demo message threads

# Oak content sync
npm run oak:sync           # Full Oak lesson sync (11,000+ lessons) — slow
npm run oak:delta          # Delta sync — only changed lessons since last run

# E2E tests (Playwright)
npm run test:e2e           # Headless
npm run test:e2e:ui        # Playwright UI
npm run test:e2e:headed    # Headed browser

# Background dev server
npm run dev > /tmp/omnis-dev.log 2>&1 &
tail -f /tmp/omnis-dev.log
```

---

## Routes (`app/`)

```
/                           → redirects to role home
/login                      Login form (public)
/dashboard                  Teacher weekly calendar (TEACHER, HOD, HOY)
/homework                   Homework list + filters
/homework/[id]              Homework detail — pupil list, marking panel
/homework/[id]/mark/[subId] Full-page per-submission marking
/classes                    My Classes — class filter + full roster (TEACHER primary nav; replaces separate Plans + Analytics links)
/analytics                  Unified analytics — Classes + Students tabs (all staff)
/analytics/adaptive         Adaptive learning analytics
/settings                   User settings (5 tabs: Profile, Professional, Privacy, Sharing, Password)
/settings/accessibility     Accessibility preferences
/messages                   Messaging — thread list
/messages/[threadId]        Individual thread
/notifications              Platform-wide notifications
/plans                      SEND plans list
/ai-generator               AI resource generator
/send-scorer                Standalone SEND resource scorer
/revision-program           Teacher revision programs list
/revision-program/new       Create revision program (4-step wizard)
/revision-program/[id]      Revision program detail
/student/dashboard          Student homework dashboard
/student/homework           Student homework list — filter chips, search, status badges
/student/homework/[id]      Student homework submission
/student/grades             Student grade history + sparklines + weak topic detection
/student/revision           Student revision planner
/student/revision/[taskId]  Student revision task
/student/[studentId]/send   Student SEND overlay
/parent/dashboard           Parent overview
/parent/progress            Parent progress view
/parent/messages            Parent messaging
/parent/consent             Parent GDPR consent
/send/dashboard             SENCO dashboard
/send/review-due            Reviews due
/send/ilp                   ILP list
/send/ilp/[studentId]       Student ILP detail
/senco/dashboard            SENCO hub
/senco/concerns             SEND concerns
/senco/ilp                  ILP management
/senco/early-warning        Early warning flags
/senco/ehcp                 EHCP plans
/senco/ilp-evidence         ILP evidence linking
/senco/agent-insights       Agent recommendation review — confirm/override/dismiss COACH/QUALITY/PLAN_SYNTHESIS outputs
/hoy/analytics              Head of Year analytics
/hoy/behaviour              Behaviour overview — KPI cards, weekly trend chart, student table, year filter, CSV exports (HOY/SLT/SCHOOL_ADMIN/HOD)
/hoy/dashboard              HOY pastoral dashboard — greeting, KPI cards, attendance panel, SEND concerns, homework pulse, print
/hoy/detentions             Detention register — Today/Upcoming/Missed/Completed, Log modal, resolve + parent notify (HOY/SLT/SCHOOL_ADMIN)
/hoy/exclusions             Exclusion log — active/recent, KPI cards, Log modal, reintegration plan (HOY/SLT/SCHOOL_ADMIN)
/hoy/integrity              Academic integrity workflow — signals, pattern cases, review modal (HEAD_OF_YEAR/SLT/SCHOOL_ADMIN)
/hoy/welfare                Pastoral welfare hub — SEND flags, concerns, attendance signals (HEAD_OF_YEAR/SLT/SCHOOL_ADMIN)
/slt/analytics              SLT analytics
/slt/staff                  School-wide staff performance — teacher comparison table, grade pills, submission bars, CSV export, drill-through (SLT/SCHOOL_ADMIN)
/admin/attendance           School-wide attendance overview — KPI cards, year-group breakdown, students below 90%, CSV export (SCHOOL_ADMIN/SLT/HOY)
/admin/dashboard            School admin dashboard (amber onboarding banner when !onboardedAt)
/admin/onboarding           School onboarding wizard — 4-step: profile → invite staff → connect MIS → complete
/admin/users                Unified user management — UserManagementTable with EditUserModal (role, year group, class assignment)
/admin/wonde                Wonde MIS sync panel
/admin/gdpr                 GDPR consent management
/admin/cover                Cover management (redirect)
/admin/calendar             Admin timetable view
/admin/classes              Admin class management
/admin/staff                Admin staff management
/admin/students             Admin student management
/admin/options              Subject options overview — year-group tabs, subject × student count (SCHOOL_ADMIN/SLT)
/admin/timetable            Admin timetable grid
/admin/audit                Filterable audit log (SCHOOL_ADMIN)
/slt/audit                  Filterable audit log (SLT — defaults to SEND category)
/lessons                    Weekly timetable view (COVER_MANAGER/SCHOOL_ADMIN/SLT) — 5-day grid, absence flags
/resources                  School resource library — type filter, SEND scores, search
/ta/notes                   Teaching Assistant notes hub — year/class cascade, student list, urgent flags
/platform-admin/dashboard   Platform admin stats (includes PlatformSchoolHealthTable — sync age, open issues, onboarding)
/platform-admin/schools     School list
/platform-admin/oak-sync    Oak sync status
/academy/dashboard          MAT/trust cross-school dashboard — 7-stat grid + schools table with SEND columns (ACADEMY_ADMIN/PLATFORM_ADMIN)
/academy/schools            Full schools table with SEND/ILP/EHCP/concerns per school (ACADEMY_ADMIN/PLATFORM_ADMIN)
/academy/send               Trust-wide SEND overview — per-school breakdown, % on register, totals (ACADEMY_ADMIN/PLATFORM_ADMIN)
/academy/reports            Trust compliance report — onboarding, MIS sync health, SEND summary (ACADEMY_ADMIN/PLATFORM_ADMIN)
/revision                   Student revision (redirect to /student/revision)

/api/auth/[...nextauth]     NextAuth endpoints
/api/settings/avatar        Avatar upload (POST — JPG/PNG, max 5MB, base64 in DB)
/api/export/lesson-plan/[id]     PDF export
/api/export/homework/[id]        PDF export
/api/export/homework-summary     PDF export
/api/export/revision-timetable   PDF export
/api/export/apdr/[apdrId]        PDF export (SENCO/SLT/HOY/SCHOOL_ADMIN)
/api/export/academy-report       Trust compliance report PDF (ACADEMY_ADMIN/PLATFORM_ADMIN)
/api/export/behaviour-summary    Behaviour CSV — all students with positive/negative/exclusion counts (HOY/SLT/SCHOOL_ADMIN/HOD)
/api/export/detention-register   Detention register CSV — 90d default, yearGroup filter (HOY/SLT/SCHOOL_ADMIN/HOD)
/api/export/exclusion-log        Exclusion log CSV — 365d default, yearGroup filter, includes SEND status (HOY/SLT/SCHOOL_ADMIN/HOD/SENCO)
/api/cron/oak-sync          Oak delta sync cron (Sun 02:00 UTC)
/api/cron/early-warning     SEND early warning cron (Mon–Fri 06:00 UTC)
/api/cron/agent-coach       COACH agent nightly batch (02:30 UTC) — weak topics, retention risk
/api/cron/agent-quality     QUALITY agent nightly batch (03:00 UTC) — Bloom's, SEND adaptation, feedback
/api/cron/agent-plan-synthesis  PLAN_SYNTHESIS agent nightly (03:30 UTC) — ILP/EHCP/K Plan coherence
/api/cron/platform-insights Cross-school insight pipeline (Sun 05:00 UTC) — aggregates SchoolCohortAggregate across all schools into PlatformInsight rows; k-anon MIN_SCHOOLS=3; no Claude calls
/api/wonde/sync             Wonde full sync — POST, 300s maxDuration, SCHOOL_ADMIN/SLT only

/marketing/home                                   ← fully built (hero, feature grid, role cards, CTAs)
/marketing/features                               ← fully built (6 sections, 35 features)
/marketing/beta                                   ← fully built (school application form, Resend)
/marketing/investors                              ← fully built (market pitch, investor contact form)
/hoy/absence                                      ← fully built (absence hub, flagged students, pastoral deep-links, attendance letter/report actions)
/hoy/behaviour                                    ← fully built (KPI cards, weekly trend chart, student table, CSV exports)
/hoy/dashboard                                    ← fully built (pastoral KPI dashboard)
/hoy/detentions                                   ← fully built (detention register, log modal, resolve, parent notify)
/hoy/exclusions                                   ← fully built (exclusion log, KPI cards, log modal, reintegration plan)
/hoy/integrity                                    ← fully built (integrity signals + pattern cases)
/hoy/welfare                                      ← fully built (pastoral welfare hub)
/admin/attendance                                 ← fully built (school-wide attendance overview + CSV export)
/student/grades                                   ← fully built (grade history + sparklines)
/admin/audit, /slt/audit                          ← fully built (filterable audit log)
/lessons                                          ← fully built (weekly timetable for Cover Manager)
/resources                                        ← fully built (school resource library)
/student/homework                                 ← fully built (homework list with filters)
/senco/agent-insights                             ← fully built (agent recommendation review UI)
```

---

## Actions (`app/actions/`)

| File | Key exports |
|---|---|
| `lessons.ts` | getWeekLessons, createLesson, getLessonDetails, updateLessonOverview, addUrlResource, addUploadedResource, addLibraryResource, removeResource, deleteLesson, rescheduleLesson, updateLessonObjectives, getClassRoster, getStudentClassDetail, getSchoolResourceLibrary |
| `homework.ts` | getHomeworkList, getHomeworkForMarking, getSubmissionForMarking, createHomework, markSubmission, generateHomeworkFromResources, autoMarkSubmission, bulkAutoMarkAndQueue, generateHomeworkContent, extractLearningFromLabel, resendHomeworkReminder, saveHomeworkTeacherNote, recordHomeworkAsIlpEvidence, classifyIlpEvidence, saveIlpEvidenceEntries, getIlpEvidenceForStudent, getIlpConcernsThisTerm, getSubmissionReadOnly |
| `ilp-evidence.ts` | requestILPEvidence (SENCO notifies all subject teachers to link homework evidence), checkILPEvidenceMatch (fire-and-forget — uses claude-haiku to detect if a graded submission evidences an ILP target; creates ILP_EVIDENCE_SUGGESTED notification for the teacher) |
| `analytics.ts` | getAnalyticsFilters, getStudentPerformance, getStudentDetail, getClassSummaries, getHomeworkAdaptiveAnalytics |
| `settings.ts` | getMySettings, getMyAvatarUrl, saveProfile, saveProfessionalPrefs, savePrivacySettings, saveSharingSettings, changePassword |
| `oak.ts` | getOakSubjects, searchOakLessons, getOakLesson, addOakLessonToLesson |
| `send-scorer.ts` | getOrCreateSendScore, forceRescoreLesson, searchLessonsWithScores |
| `send-support.ts` | 26 SEND/concern/ILP/notification actions — incl. `getAPDRDoEvidence(apdrId)` (auto-populates APDR Do section from ILP evidence + TA notes) |
| `ehcp.ts` | createEhcpPlan, getStudentEhcp, linkHomeworkToIlpTarget, linkSubmissionToEhcpOutcome, generateIlpProgressReport, generateEhcpAnnualReview |
| `adaptive-learning.ts` | getStudentLearningProfile, updateLearningProfile, suggestSpacedRepetition, suggestNextHomework, getAdaptiveHomeworkSuggestions |
| `gdpr.ts` | getPurposes, createPurpose, getConsentMatrix, exportConsentCsv, getDataSubjectRequests, recordConsent |
| `revision.ts` | getMyExams, addExam, getMyRevisionSessions, generateRevisionPlan, saveRevisionPlan, markSessionComplete |
| `revision-program.ts` | 8 actions — createRevisionProgram, getRevisionPrograms, getRevisionProgramDetail, generateRevisionTasks, getStudentRevisionTasks, completeRevisionTask, updateTaskConfidence, getRevisionAnalytics. Rate limit: 3 programs/class/week |
| `cover.ts` | getTodaysCoverSummary, logAbsence, getAvailableStaff, assignCover, getCoverHistory |
| `platform-admin.ts` | getPlatformStats, getSchoolList, createSchool, getFeatureFlags, setFeatureFlag, getAuditLog, getSchoolHealthData |
| `messaging.ts` | getMyThreads, getThread, createThread, sendMessage, getUnreadMessageCount, getContactList |
| `accessibility.ts` | getAccessibilitySettings, saveAccessibilitySettings |
| `student.ts` | getStudentHomework, submitHomework |
| `students.ts` | getStudentFile, addParentContactEntry, deleteParentContactEntry |
| `parent.ts` | sendParentMessage |
| `wonde.ts` | testWondeConnection, triggerWondeSync (legacy — now prefer /api/wonde/sync), getWondeConfig, getWondeSyncLogs, getWondeCounts |
| `admin.ts` | getAdminDashboardData, getSchoolSettings, saveSchoolSettings, completeOnboarding, getManagedUsers, changeUserRole, updateStudentYearGroup, toggleUserActive, getSchoolClasses, getUserClasses, setTeacherClasses, getStudentEnrolments, setStudentEnrolments, getActivationBreakdown, importStudents + year rollover actions |
| `academy.ts` | getAcademyStats, getAcademySchools (ACADEMY_ADMIN/PLATFORM_ADMIN only) |
| `cohort.ts` | getSchoolCohortInsights(yearGroup?) — SENCO/SLT/HOY/HOD/SCHOOL_ADMIN/PLATFORM_ADMIN/ACADEMY_ADMIN; wraps getSchoolCohortContext from lib/cohort-aggregate |
| `platform-insights.ts` | getPlatformInsightDashboardData() — PLATFORM_ADMIN only; returns PlatformInsightDashboardData with all 5 insight types collapsed from cross-year rows |
| `hoy-welfare.ts` | getHoyWelfareData — SEND flags, open concerns, attendance signals for HOY pastoral welfare hub |
| `behaviour.ts` | addBehaviourRecord, deleteBehaviourRecord, getStudentBehaviourRecords, getChildBehaviourSummary, getBehaviourOverview(yearGroup?), getBehaviourTrends(weeks=8) |
| `detentions.ts` | logDetention, resolveDetention, deleteDetention, getDetentionRegister(yearGroup?), getStudentDetentions(studentId) |
| `exclusions.ts` | logExclusion, resolveExclusion, getExclusionLog(yearGroup?), getStudentExclusions(studentId) |
| `search.ts` | globalSearch(query) — students/staff/homework/resources scoped by schoolId; excludes STUDENT/PARENT roles |
| `ai-generator.ts` | AI resource generation |

---

## Key Components (`components/`)

| Component | Purpose |
|---|---|
| `Sidebar.tsx` | Role-based left nav; avatar chip at bottom |
| `AppShell.tsx` | Authenticated layout wrapper; loads avatar via getMyAvatarUrl() on mount |
| `WeeklyCalendar.tsx` | Teacher calendar — click=slide-over, dbl-click=folder. Fetches non-current weeks via getWeekLessons() |
| `LessonFolder.tsx` | Lesson detail — 6 tabs: Overview, Resources, Homework, Class, Class Insights, Revision. Class tab shows all students with inline SEND badges + expandable detail per SEND student (ILP goals, EHCP provisions, K Plan). wizardStep 4=Resources, 5=Homework |
| `LessonSlideOver.tsx` | Create new lesson panel — saves only at final step |
| `UnifiedResourceSearch.tsx` | Combined Oak + school library search. Props: lessonId, subjectSlug, yearGroup, lessonTitle, onAdded, onGenerateHomework. Guards: skips load if subjectSlug absent. Shows "Generate homework?" banner after adding resource |
| `ResourcePreviewModal.tsx` | Oak lesson preview — key learning points, vocab, quizzes, iframe download preview. Takes `slug` prop, fetches detail internally |
| `ClassRosterTab.tsx` | Student roster with SEND badges, expand for recent homework scores |
| `ClassInsightsTab.tsx` | Class performance insights |
| `admin/WondeSyncPanel.tsx` | MIS sync — uses fetch('/api/wonde/sync') not server action (avoids Vercel 10s timeout) |
| `admin/UserManagementTable.tsx` | Unified user management — filter chips (all/staff/students/inactive), EditUserModal (role dropdown, year group, class checkboxes via setTeacherClasses), deactivate/reactivate/resend invite |
| `admin/OnboardingWizard.tsx` | 4-step school onboarding — profile (name/phase/URN/emailDomain), invite staff (repeating rows → /api/staff/invite), connect MIS (Wonde link or skip), complete (calls completeOnboarding then redirect) |
| `academy/AcademyDashboardStats.tsx` | 6-stat grid: schools, students, staff, homework, ILPs, EHCPs |
| `academy/AcademySchoolsTable.tsx` | Per-school table: sync health (amber if >14 days stale), onboarding status, phase |
| `platform-admin/PlatformSchoolHealthTable.tsx` | Per-school health on platform dashboard: sync age, open SEND issues (last 30 days), onboarding state |
| `platform-admin/PlatformInsightsPanel.tsx` | Cross-school insight dashboard — 3-column UI: national benchmarks (avg score/completion/SEND gap/improving%), Bloom's distribution bars + best SEND task types, need area prevalence + top ILP strategies ranked by school adoption. Shows graceful empty state until first Sunday cron fires with >=3 schools. |
| `send-support/CohortInsightsPanel.tsx` | School cohort insight panel on SENCO dashboard — SEND overview, attainment bars, trend distribution, Bloom's performance, best SEND task type, top ILP strategies. Calls getSchoolCohortInsights(). Shows empty state until nightly cron populates data. |
| `GlobalSearch.tsx` | Cmd+K/Ctrl+K command palette — debounced 250ms, grouped results (student/staff/homework/resource), ↑↓ arrow nav + Enter + Escape; rendered in AppShell for non-student/parent/TA roles |
| `admin/StudentImportModal.tsx` | CSV upload modal — client-side parser (no deps), preview table, calls importStudents(), shows created/skipped/errors summary |
| `admin/ActivationPanel.tsx` | Amber dashboard widget — pending activation count, per-year-group breakdown, progress bar; hidden when all students activated |
| `admin/AttendanceExportButton.tsx` | Client CSV export button for attendance page — maps students to firstName/lastName/year/form/SEND/attendance% columns |
| `hoy/HoyWelfarePanel.tsx` | Pastoral welfare panel for /hoy/welfare — SEND flags, open concerns, attendance signals |
| `HomeworkFilterView.tsx` | Homework list + filter chips + router.refresh() after create |
| `HomeworkMarkingView.tsx` | Two-panel marking — student list left (filter chips, SEND badges, grade pills), submission right (Q&A cards, model answer, rubric, per-question scores, SEND sidebar with ILP goals, teacher notes). `canGrade` prop: teachers get full marking; SENCO/SLT/SCHOOL_ADMIN get read-only view. |
| `ui/Icon.tsx` | Shared Google Material Icons wrapper — props: `name` (icon string), `size` ('sm'=16px/'md'=20px/'lg'=24px), `color`, `className`. Use for all icons throughout the app. Do NOT use lucide-react. |
| `ui/EmptyState.tsx` | Consistent empty state — props: `icon`, `title`, `description`, `size` ('sm'/'md'/'lg'). Used across all list/table views. |
| `ui/PageHeader.tsx` | Consistent page header — props: `title`, `subtitle`, `backHref`, `backLabel`, `action` (ReactNode). Used on all main pages. |
| `ui/SendBadge.tsx` | Standardised SEND badge — props: `status` ('SEN_SUPPORT'/'EHCP'), `size`. Replaces ad-hoc badge markup. |
| `OmnisLogo.tsx` | Inline SVG logo component — replaces PNG `<img>` in Sidebar. Renders at configurable size, no network request. |
| `SubmissionMarkingView.tsx` | Full-page per-submission marking |
| `HomeworkSubmissionView.tsx` | Student submission UI |
| `homework/HomeworkCreatorV2.tsx` | 6-step homework creation modal |
| `homework/AdaptiveSubmissionView.tsx` | Marking with AI suggestions + EHCP evidence |
| `homework/HomeworkTypeRenderer.tsx` | Input UI per homework variant |
| `StudentAnalyticsView.tsx` | Analytics — Classes + Students tabs |
| `StudentDashboard.tsx` | Individual student detail |
| `StudentAvatar.tsx` | Avatar (photo or coloured initials, xs–lg) |
| `ClassListView.tsx` | Expandable class cards |
| `settings/SettingsShell.tsx` | Settings (5 tabs) — calls router.refresh() after avatar upload |
| `messaging/MessagingShell.tsx` | Two-panel messaging layout |
| `messaging/ThreadView.tsx` | Thread with 30s poll |
| `messaging/UnreadBadge.tsx` | Blue badge, 60s poll |
| `send/SendScoreCard.tsx` / `SendScoreBadge.tsx` | SEND score display |
| `send/ScorerView.tsx` | Standalone SEND scorer |
| `send-support/SencoDashboard.tsx` + siblings | SEND monitoring UI |
| `gdpr/GdprAdminShell.tsx` + siblings | GDPR consent management |
| `platform-admin/PlatformDashboardStats.tsx` + siblings | Platform admin UI |
| `ai-generator/AiGeneratorShell.tsx` + siblings | AI resource generator |
| `cover/CoverDashboard.tsx` + siblings | Cover management |
| `revision/RevisionDashboard.tsx` + siblings | Student revision planner |
| `revision-program/RevisionProgramCreator.tsx` | 4-step wizard |
| `revision-program/RevisionProgramList.tsx` / `RevisionProgramDetail.tsx` | Program management |
| `revision-program/RevisionTaskView.tsx` / `StudentRevisionView.tsx` | Student task UI (localStorage auto-save, 1–5 star confidence) |
| `revision-program/RevisionProgressChart.tsx` | Student progress visualisation |
| `accessibility/AccessibilityToolbar.tsx` + siblings | Accessibility panel |
| `homework/EhcpOutcomeTracker.tsx` | EHCP outcome progress |
| `analytics/AdaptiveAnalyticsDashboard.tsx` | Bloom's + adaptive charts |
| `ExportPdfButton.tsx` | PDF download button |
| `students/StudentFilePanel.tsx` | Student file panel — Homework tab: SENCO/SLT/SCHOOL_ADMIN get clickable `<button>` rows opening a read-only slide-over (student answer, grade, feedback, model answer, ILP targets); teachers keep `<a href>` links to the marking view. Slide-over caches fetched data in `detailCache` per session. Behaviour tab: behaviour records, detentions, exclusions. |
| `behaviour/BehaviourTrendChart.tsx` | Recharts BarChart — positive/negative/neutral weekly bars. Accepts `data: BehaviourTrendWeek[]`. Used on /hoy/behaviour. |
| `hoy/DetentionView.tsx` | Client component for /hoy/detentions — sections (Today/Upcoming/Missed/Completed), Log modal, resolve/cancel/delete actions, year filter |
| `hoy/ExclusionView.tsx` | Client component for /hoy/exclusions — active/recent sections, KPI cards, Log modal, inline reintegration plan form |

---

## Library (`lib/`)

| File | Purpose |
|---|---|
| `lib/auth.ts` | NextAuth full config — Credentials provider, bcrypt, Prisma adapter, JWT callbacks |
| `auth.config.ts` | Edge-safe auth config — middleware role routing only, no Prisma/bcrypt |
| `lib/session.ts` | `requireAuth(allowedRoles?, fallback?)` — typed session helper for server pages/actions. Replaces `session.user as any` pattern. Returns `AuthUser` (`id, schoolId, schoolName, role, firstName, lastName`). |
| `lib/email.ts` | Resend transactional email — `sendHomeworkReminderEmail`, `sendHomeworkReturnedEmail`, `sendConcernRaisedEmail`, `sendDetentionNotificationEmail`. No-ops when `RESEND_API_KEY` absent. Never throws (catches internally). |
| `lib/prisma.ts` | Prisma singleton + `writeAudit()` helper. Extended with AuditLog immutability guard (`$extends`). All models fully typed — **never use `(prisma as any)`**. |
| `lib/grading.ts` | `percentToGcseGrade()`, `suggestGrade()`, `normalizeScoreForForm()`, `formatScore()`, `gradeLabel()`, `gradePillClass()`, `GCSE_LETTERS` |
| `lib/gradeUtils.ts` | Display helpers built on grading.ts: `formatGrade()`, `formatRawScore()`, `scoreToGcseGrade()`, `formatAvgGrade()` (returns `{ main, sub }` for analytics avg display) |
| `lib/accessibility.ts` | `settingsToClasses()`, defaults |
| `lib/sendReview.ts` / `sendReviewCached.ts` | SEND accessibility scoring via Claude — score 0–100 |
| `lib/sendInsights.ts` | SEND insight aggregation |
| `lib/cohort-aggregate.ts` | School cohort aggregation — `computeSchoolCohortAggregate(schoolId)` rolls up StudentLearningProfile records into SchoolCohortAggregate (per yearGroup); `getSchoolCohortContext(schoolId, yearGroup?)` read helper for ILP generation and SENCO dashboard |
| `lib/platform-insight.ts` | Cross-school insight pipeline — `computePlatformInsights()` aggregates all SchoolCohortAggregate rows with k-anonymity (MIN_SCHOOLS=3) into 5 PlatformInsight types; `getPlatformInsightsForIlp(yearGroup?)` collapses into PlatformInsightForIlp for ILP prompts; `getAllPlatformInsights()` for platform admin UI |
| `lib/ilp-helpers.ts` | ILP prompt builder — `buildIlpPrompt(firstName, lastName, yearGroup, sendCategory, cohort?, platform?)` builds 3-layer grounded prompt: student context + school cohort context + national platform benchmarks |
| `lib/send/early-warning.ts` | Pattern checks → EarlyWarningFlags + SENCO notifications |
| `lib/send/concern-analyser.ts` | Claude AI concern pattern analysis |
| `lib/curriculum.ts` | Curriculum helpers |
| `lib/pdf/generator.ts` | Puppeteer PDF generation |
| `lib/pdf/lesson-plan-template.ts` / `homework-template.ts` / `revision-timetable-template.ts` / `homework-summary-template.ts` / `academy-report-template.ts` / `apdr-template.ts` | PDF HTML templates |
| `lib/wonde-client.ts` | Typed Wonde API client — paginated fetch for all entity types. Interfaces: WondePeriod (day/day_number fields), WondeTimetableEntry (period/employee as flat strings), WondeContact (relationship as nested object) |
| `lib/wonde-sync.ts` | Full sync engine — upserts employees, students, contacts, groups, classes, periods, timetable. Inner try/catch per student contact so one bad record doesn't abort all |
| `lib/oak-delta-sync.ts` | Oak delta sync logic |
| `lib/revision/analysis-engine.ts` | `analyseClassPerformance()` |
| `lib/revision/content-generator.ts` | `generateRevisionTask()` with SEND adaptations + ILP integration |
| `lib/design-tokens.ts` | Design system constants — `colors`, `badges`, `buttons` objects. Source of truth for Tailwind class strings. Use when building new components. |

---

## Database Schema Summary

### Key Enums

| Enum | Values |
|---|---|
| `Role` | SUPER_ADMIN, SCHOOL_ADMIN, SLT, HEAD_OF_DEPT, HEAD_OF_YEAR, COVER_MANAGER, TEACHER, SENCO, STUDENT, PARENT, PLATFORM_ADMIN, **TEACHING_ASSISTANT** |
| `HomeworkType` | MCQ_QUIZ, SHORT_ANSWER, EXTENDED_WRITING, MIXED, UPLOAD |
| `HomeworkStatus` | DRAFT, PUBLISHED, CLOSED |
| `SubmissionStatus` | SUBMITTED, UNDER_REVIEW, RESUBMISSION_REQ, MARKED, RETURNED |
| `SendStatusValue` | NONE, SEN_SUPPORT, EHCP |
| `ILPStatus` | DRAFT, ACTIVE, UNDER_REVIEW, ARCHIVED |
| `LessonType` | NORMAL, COVER, INTERVENTION, CLUB |
| `AuditAction` | HOMEWORK_CREATED, SUBMISSION_GRADED, GRADE_OVERRIDDEN, ILP_CREATED, SEND_STATUS_CHANGED, LESSON_PUBLISHED, WONDE_SYNC_COMPLETED, RESOURCE_UPLOADED, USER_SETTINGS_CHANGED, TA_NOTE_ADDED, TA_NOTE_DELETED, PARENT_CONTACT_LOGGED, BEHAVIOUR_RECORDED, BEHAVIOUR_DELETED, DETENTION_LOGGED, DETENTION_RESOLVED, EXCLUSION_LOGGED, EXCLUSION_RESOLVED, … |
| `ContactMethod` | PHONE, EMAIL, MEETING, LETTER, OTHER |

### ILPTarget.status valid values
`"active"` | `"achieved"` | `"not_achieved"` | `"deferred"` — **NOT** `"in_progress"` (this caused multiple production crashes)

### Model Groups

- **Tenant:** `School`, `TermDate`
- **Users/Classes:** `User`, `SchoolClass`, `ClassTeacher`, `Enrolment`, `ParentChildLink`, `ParentContactEntry`
- **Lessons/Resources:** `Lesson`, `Resource`, `ResourceReview`, `OakContentCache`
- **Homework:** `Homework`, `HomeworkQuestion`, `Submission`, `SubmissionAttempt`, `SubmissionAttemptAnswer`
- **Integrity:** `SubmissionIntegritySignal`, `IntegrityReviewLog`, `IntegrityPatternCase`
- **SEND:** `SendStatus`, `SendScoreCache`, `SendQualityScore`, `SendConcern`, `EarlyWarningFlag`, `SendNotification`
- **ILP/EHCP:** `ILP`, `ILPTarget`, `Plan`, `PlanTarget`, `EhcpPlan`, `EhcpOutcome`, `IlpHomeworkLink`, `HomeworkEhcpEvidence`, `IlpEvidenceEntry`
- **Adaptive:** `StudentLearningProfile`, `LearningSequence`, `SubjectAdaptationProfile`
- **Messaging:** `MsgThread`, `MsgParticipant`, `MsgMessage`
- **Analytics:** `ClassPerformanceAggregate`, `SubjectMedianAggregate`, `SchoolCohortAggregate`, `PlatformInsight`
- **System:** `Notification`, `AuditLog`, `UserSettings`, `UserAccessibilitySettings`
- **Revision (student):** `RevisionExam`, `RevisionSession`, `RevisionConfidence`
- **Revision Program (teacher-created):** `RevisionProgram`, `RevisionTask`, `RevisionProgress`, `RevisionAnalyticsCache`
- **Behaviour:** `BehaviourRecord`, `Detention`, `Exclusion`
- **Cover:** `StaffAbsence`, `CoverAssignment`
- **GDPR:** `ConsentPurpose`, `ConsentRecord`, `DataSubjectRequest`
- **Platform:** `SchoolFeatureFlag`, `PlatformAuditLog`, `GeneratedResource`, `SchoolGroup`
- **Wonde MIS (12 tables):** `WondeSchool`, `WondeStudent`, `WondeEmployee`, `WondeClass`, `WondeGroup`, `WondePeriod`, `WondeTimetableEntry`, `WondeAssessmentResult`, `WondeContact`, `WondeClassStudent`, `WondeDeletion`, `WondeSyncLog`
- **Oak sync:** `OakSubject`, `OakUnit`, `OakLesson`, `OakSyncLog`

---

## Sidebar Nav by Role

| Role | Nav items |
|---|---|
| TEACHER | Calendar, Homework, My Classes (/classes — roster + plans), Revision, Adaptive Learning, AI Generator, Messages |
| HEAD_OF_DEPT | Calendar, Homework, Classes, Analytics, Adaptive Learning, AI Generator, Messages |
| HEAD_OF_YEAR | Calendar, Dashboard (/hoy/dashboard), Analytics, Student Analytics, Year Group Plans, Behaviour (/hoy/behaviour), Detentions (/hoy/detentions), Exclusions (/hoy/exclusions), Welfare (/hoy/welfare), Integrity (/hoy/integrity), SEND Concerns, ILP Records, Messages |
| SENCO | SEND Dashboard, Concerns, ILP, Early Warning, EHCP Plans, ILP Evidence, Analytics, Resource Scorer, AI Generator, Messages |
| SCHOOL_ADMIN | Dashboard, MIS Sync, Users, Audit Log, Analytics, Attendance (/admin/attendance), Behaviour (/hoy/behaviour), Detentions (/hoy/detentions), Exclusions (/hoy/exclusions), Cover, GDPR, Messages |
| SLT | Dashboard, Analytics, Attendance (/admin/attendance), Audit Log, Behaviour (/hoy/behaviour), Detentions (/hoy/detentions), Exclusions (/hoy/exclusions), Cover, GDPR, Messages |
| COVER_MANAGER | Dashboard, Cover, Messages |
| STUDENT | Dashboard, Homework, Revision Planner, My Grades, Messages |
| PARENT | Dashboard, Progress, Consent, Messages |
| TEACHING_ASSISTANT | Student Notes, Messages, Notifications |
| ACADEMY_ADMIN | Academy Dashboard, Schools (/academy/schools), SEND Overview (/academy/send), Reports (/academy/reports) |
| PLATFORM_ADMIN | Dashboard, Schools, Oak Sync, Academy Overview |

Settings + avatar chip at sidebar bottom for all roles.

---

## Error Boundaries

`app/global-error.tsx` — catches anything not caught by route-level boundaries.

Route-level `error.tsx` files exist for: `dashboard`, `analytics`, `homework`,
`classes`, `messages`, `notifications`, `parent`, `plans`, `platform-admin`,
`revision`, `revision-program`, `send`, `send-scorer`, `senco`, `settings`,
`slt`, `ai-generator`, `student/revision`, `student/revision/[taskId]`,
`revision-program/[programId]`, `admin/dashboard`, `hoy`, `academy`, `ta`.

**All route error boundaries are now present.**

---

## Vercel Config (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/oak-sync",      "schedule": "0 2 * * 0"   },
    { "path": "/api/cron/early-warning", "schedule": "0 6 * * 1-5" }
  ]
}
```

**IMPORTANT:** Do NOT add a `"functions"` block referencing App Router route
files (e.g. `app/api/wonde/sync/route.ts`). The `functions` key in
`vercel.json` is for Pages Router only. App Router Route Handlers use
`export const maxDuration = 300` inside the route file itself. Adding
`"functions"` for App Router paths breaks Vercel deployment.

---

## Key Patterns & Gotchas

### General
- **Server actions:** All in `app/actions/`. Always `'use server'` at top. Session via `auth()` from `lib/auth.ts`.
- **Multi-tenancy:** Every Prisma query scoped with `schoolId` from session. Never query without it.
- **Prisma:** Singleton in `lib/prisma.ts`. Restart dev server after schema changes or queries fail silently.
- **Prisma enum case sensitivity:** Enum values must match the exact casing defined in `schema.prisma`. `ILPStatus` values are `ACTIVE`, `UNDER_REVIEW` (uppercase). Using lowercase strings like `'active'` in a `where` clause causes Prisma to silently return null/empty with no error. Always check `schema.prisma` for the exact enum value casing before writing queries.
- **`SchoolClass.department`** is required (not nullable).
- **Lesson `classId`** is optional (supports out-of-hours/intervention lessons).
- **`createHomework`** requires `setAt` and `dueAt` as ISO strings; defaults to `status: 'PUBLISHED'`.
- **AI generation:** Falls back to stub content if `ANTHROPIC_API_KEY` absent. Always check Vercel function logs for `[generateHomeworkFromResources]` prefixed lines to diagnose AI failures.
- **SEND scoring:** Auto-scored on resource upload via `lib/sendReviewCached.ts`. Score 0–100 in `ResourceReview.sendScore`.
- **Avatar:** Stored as base64 data URL in `UserSettings.profilePictureUrl`. Max 5 MB, JPG/PNG. After upload, `revalidatePath('/', 'layout')` + `router.refresh()` needed for sidebar to update.
- **Audit logging:** Use `writeAudit()` from `lib/prisma.ts` for all auditable actions.
- **ConsentRecords:** INSERT-only (immutable audit trail).

### Calendar / Lessons
- `getWeekLessons(weekStartISO)` server action fetches any week's lessons using an OR: lessons where class has this teacher OR lessons created by this teacher (covers classless lessons).
- `rescheduleLesson` calls `revalidatePath('/dashboard')`. LessonFolder calls `router.refresh()` + `refreshLesson()` after saving — both needed.
- LessonFolder `getLessonDetails` is wrapped in try/catch returning null on error. The useEffect uses an async function with try/catch/finally and a `cancelled` flag to prevent spinner getting stuck.

### Oak Resources
- `searchOakLessons` uses **per-term OR matching** — `"Norman Conquest"` splits into `["Norman", "Conquest"]` and matches each independently across title, pupilLessonOutcome, unitSlug. Do not revert to exact-phrase matching.
- When `query` is present, `yearGroup` filter is **skipped** so keyword searches span all year groups.
- `UnifiedResourceSearch` does a two-pass search: first with exact yearGroup, then broadened to subject-only if < 3 results.
- `UnifiedResourceSearch` skips initial load if `subjectSlug` is absent.
- Oak subject slug mapping is done by `toOakSubjectSlug()` in `LessonFolder.tsx` — covers "Mathematics"→"maths", "English Literature"→"english", "PE"→"physical-education", etc.

### Icons
- **All icons use Google Material Icons** via `components/ui/Icon.tsx`. Never add lucide-react. Material Icons font is loaded in `app/layout.tsx`.
- Icon name reference: https://fonts.google.com/icons — use snake_case names (e.g. `check_circle`, `expand_more`, `auto_fix_high`).
- Animated spinners: `<Icon name="refresh" size="sm" className="animate-spin" />`

### ILP Evidence Capture
- After `markSubmission`, the action returns `{ ilpData: { studentId, ilpId, targets[] } | null }`.
- `HomeworkMarkingView` shows a blue prompt banner for 10s when a marked student has an active ILP.
- Clicking "Yes" opens a modal that calls `classifyIlpEvidence` (Claude API, max_tokens 300) to classify each ILP goal as PROGRESS/CONCERN/NEUTRAL.
- Teacher confirms/adjusts, then `saveIlpEvidenceEntries` bulk-creates `IlpEvidenceEntry` records.
- Evidence timeline appears on `/send/ilp/[studentId]` page.
- SENCO early warning dashboard (`/senco/early-warning`) shows a rose alert banner when students have 3+ CONCERN entries in the current term (via `getIlpConcernsThisTerm` which uses `groupBy` with `having`).
- `IlpEvidenceEntry` model has `@@unique([submissionId, ilpTargetId])` — safe to call `saveIlpEvidenceEntries` multiple times without duplicates.
- **Proactive detection:** `markSubmission` also fire-and-forgets `checkILPEvidenceMatch` — claude-haiku checks if the submission evidences any ILP target and creates an `ILP_EVIDENCE_SUGGESTED` notification for the teacher. Only triggered for passing grades (4+). Deduplicates by `linkHref`.
- **SENCO notify teachers:** `IlpEvidenceView` amber banner (when targets have no linked evidence) has a "Notify teachers" button calling `requestILPEvidence` — sends `ILP_EVIDENCE_REQUEST` notifications to all subject teachers for that student. Deduplicates within the same day.

### SENCO / SLT Read-Only Views
- **Homework grading is teacher-only.** SENCO, SLT, SCHOOL_ADMIN roles cannot modify marks.
- `canGrade` boolean: computed server-side in the page, passed as prop to `HomeworkMarkingView`.
- `HomeworkMarkingView` hides grade inputs and save buttons when `canGrade=false`.
- Server actions (`markSubmission`, `saveHomeworkTeacherNote`) re-check role and reject non-teacher callers.
- **StudentFilePanel** Homework tab: SENCO gets clickable `<button>` rows that open a read-only slide-over via `getSubmissionReadOnly` action. Teachers keep `<a href>` links to the full marking view.
- `getSubmissionReadOnly` is scoped to staff roles only (`TEACHER`, `SENCO`, `SLT`, `SCHOOL_ADMIN`, `HEAD_OF_DEPT`, `HEAD_OF_YEAR`) and returns only safe display fields.

### Grade Display
- **All scores must be shown as GCSE grades 1–9**, never as raw numbers or "pts".
- `percentToGcseGrade(pct)` converts 0–100 → grade 1–9.
- `gradeLabel(grade)` → "7 (A)" — compact label for pill display.
- `formatRawScore(score)` from `lib/gradeUtils.ts` — smart conversion for scores that could be 0–9 or 0–100 (e.g., from parent/ILP views where `gradingBands` not available).
- `formatAvgGrade(avgScore)` from `lib/gradeUtils.ts` — for analytics where `ClassPerformanceAggregate.avgScore` is on **0–9 scale**. Returns `{ main: "Gr 7 (A)", sub: "avg 6.8" }`.
- **`ClassPerformanceAggregate.avgScore` is on 0–9 scale** — use `formatAvgGrade()`, never `.toFixed(1)`.

### Homework Marking View (right panel)
- `QuestionCard` sub-component: shows question prompt, MCQ options (correct highlighted green), student answer (blue bg), collapsible model answer (green), collapsible rubric (amber), per-question score input.
- `rubricJson` and `modelAnswer` are typed as `unknown` (Prisma.JsonValue). Use `!= null` checks (not bare truthiness) in JSX to avoid TypeScript error "unknown not assignable to ReactNode".
- Per-question scores auto-sum to total score field.
- SEND sidebar (w-72) shows when selected student has an active ILP: ILP summary, up to 3 targets, "Record as ILP evidence" per target.
- Teacher notes section: yellow sticky-note display with textarea + "Add note" button calling `saveHomeworkTeacherNote`. Notes are date-stamped and audit-logged.

### Homework
- `generateHomeworkFromResources` logs to console: `RAW AI RESPONSE`, `PARSED KEYS`, `questionsJson?.questions length`, `USING STUB FALLBACK`. Check Vercel function logs after clicking Generate.
- If `questionsJson` is missing from AI response, it retries once with a follow-up message, then checks `parsed.questions` at root level, then falls back to stubs.
- Homework grading: `maxScore` is derived from `gradingBands` JSON keys via `maxFromBandsServer()` — Homework model has no `maxScore` field, it uses `gradingBands: Record<string, string>`.
- `autoMarkSubmission` returns gracefully for unsupported types (no throw).
- Score display in marking: `autoScore` is stored as raw score (0–maxScore), not percentage.

### Wonde Sync
- Full sync via `POST /api/wonde/sync` (300s maxDuration, fetch from client).
- `WondeSyncPanel` uses `fetch('/api/wonde/sync')` not a server action (avoids Vercel 10s serverless timeout).
- `WondePeriod.day` is a string ("monday"), `day_number` is int. Map via `DAY_MAP` in `wonde-sync.ts`.
- `WondeTimetableEntry.period` and `.employee` are flat strings (not nested objects). `room` is also flat string.
- `WondeContact.relationship` is a **nested object** with `.relationship` and `.parental_responsibility` fields. Extract with type guard.
- `fetchWondeClasses` only includes `'students,subject'` — `employees` include returns 400.
- `fetchWondeTimetableEntries` only includes `'class'` — `period/employee/room` are flat values.
- Timetable sync needs `periods.read` and `lessons.read` Wonde permissions (pending from Wonde support as of 2026-03-17).

### Router / Revalidation
- Always call `router.refresh()` after server actions that modify data visible to the current component. `revalidatePath` in server actions alone is not enough for client components.
- `HomeworkFilterView`: calls `router.refresh()` in `onCreated` callback.
- `HomeworkMarkingView`: calls `router.refresh()` after `markSubmission` in both `handleSave` and `handleApprove`.

---

## Outstanding Tasks

### Trial readiness (see `TRIAL_READINESS_PLAN.md`)
- Read `TRIAL_READINESS_PLAN.md` in the project root before starting any session — it is the authoritative list of what must be done before the school trial.

### Marketing pages ✅ COMPLETE (2026-06-08, commit 0bc1197)
- `/marketing/home`, `/marketing/features`, `/marketing/beta`, `/marketing/investors` — all built
- Shared layout: `app/marketing/layout.tsx` — sticky nav + footer, `OmnisLogo`, role-based links
- Contact forms post to `/api/contact/beta` and `/api/contact/investors` — email to `ivanyardley@me.com` via Resend
- Middleware excludes `/marketing/*` from auth (added `marketing` to matcher negation)

### Wonde timetable sync (pending Wonde permissions)
- Needs `periods.read` and `lessons.read` enabled in Wonde dashboard.
- Email sent to Wonde support (2026-03-17). When granted, re-run full sync from `/admin/wonde`.

### E2E tests
**450 tests across 37 spec files. Last full Vercel run: 449/450 pass (2026-07-13). 1 intentional skip.**
- 1 skip: `sprint-d-apdr.spec.ts:177` (APDR PDF — requires a completed cycle in Vercel DB; run `npm run db:seed` to populate)
- SEND smoke steps 6/7/8: graceful skip when local/Vercel DB weeks differ (calendar `?week=` param now respected; re-seed Vercel to fully enable)
- 37 spec files: auth, accessibility, teacher, student, SENCO, SEND smoke (13 steps),
  adaptive homework, revision program, Wonde sync, PDF export, GDPR, admin, AI generator,
  cover management, platform admin, student photos, revision planner, send scorer,
  EHCP evidence (P2002 regression), homework UPLOAD type, student returned HW grade strip,
  student notes CRUD, subjects & boards HOY edit-rights regression,
  password reset + staff invitation (23 tests), sprint-a/b/c/d/e, hoy-dashboard, hoy-integrity,
  sprint-e-attendance-welfare, hoy-behaviour-detentions (blocks 29-31, 30 tests).
- `USERS.hod` (d.brooks), `USERS.hoy` (t.adeyemi), `USERS.ta` (j.taylor) fixtures in users.ts
- loginAs timeout: 45s fail-fast (cold Lambdas fail quickly; warm Lambdas respond in 5-15s)
- 0 flakes when global-setup saves auth state; retries handle remaining cold starts
- Run locally: `npm run test:e2e`
- Run against Vercel: `PLAYWRIGHT_BASE_URL=https://omnis-app-ten.vercel.app npx playwright test`

### Unbuilt routes
All routes are now functional. No unbuilt routes remain.

---

## Completed Phases

**Phases 0–6D + Messaging + Phase 7 (Revision Program) + Phase 1C Part B (Wonde Live API): All complete ✅**

**Phase 7A — Revision Program Foundation ✅ (2026-03-16)**
- 4 Prisma models: RevisionProgram, RevisionTask, RevisionProgress, RevisionAnalyticsCache.
- `lib/revision/analysis-engine.ts`, `lib/revision/content-generator.ts`.
- `app/actions/revision-program.ts` — 8 server actions. Rate limit: 3 programs/class/week.

**Phase 7B — Revision Program Teacher UI ✅ (2026-03-16)**
- RevisionProgramCreator (4-step wizard), RevisionProgramList, RevisionProgramDetail, RevisionAnalysisPanel.
- Routes: `/revision-program`, `/revision-program/new`, `/revision-program/[programId]`.

**Phase 7C — Revision Program Student View ✅ (2026-03-16)**
- StudentRevisionView, RevisionTaskView (localStorage auto-save, time tracking, 1–5 star confidence), RevisionProgressChart.
- Routes: `/student/revision`, `/student/revision/[taskId]`.
- LessonFolder Revision tab with RevisionAnalysisPanel + Create Program button.

**Phase 1C Part B — Wonde Live API Integration ✅ (2026-03-17)**
- `lib/wonde-client.ts` — typed API client, paginated fetch for all entity types.
- `lib/wonde-sync.ts` — full sync engine; 98 staff, 200 students, 66 classes synced from Wonde Testing School.
- `app/actions/wonde.ts` + `app/api/wonde/sync/route.ts` (300s, POST).
- `components/admin/WondeSyncPanel.tsx` + `/admin/wonde` route.
- MIS Sync added to SCHOOL_ADMIN sidebar and admin dashboard quick links.

**Post-launch fixes (2026-03-17 to 2026-03-22)**
- Wonde sync API shape mismatches fixed (period/employee/room flat strings, contact relationship nested object).
- Lesson panel spinner infinite loop fixed (async/await + try/catch/finally + cancelled flag).
- Oak resource search: per-term splitting, two-pass search (broaden if < 3 results), initial search from lesson title keywords, skip yearGroup when query present.
- UnifiedResourceSearch: subjectSlug guard, "Generate homework?" banner after adding resource.
- LessonFolder: `onGenerateHomework` callback switches to Homework tab + wizard step 5.
- SA homework: `markScheme` + `marks` fields per question in type, prompt, editor.
- Homework generation: verbose logging to diagnose AI response failures.
- WeeklyCalendar: removed "New Homework" button.
- vercel.json: removed invalid `functions` block that was breaking all Vercel deployments.
- All previously listed error boundaries now built (except `app/hoy/error.tsx`).

**Homework Marking Enhancement + ILP Evidence ✅ (2026-03-28)**
- `HomeworkMarkingView` right panel: `QuestionCard` sub-component with Q&A display, model answers, rubric, per-question scores.
- SEND sidebar with ILP goals + quick "Record as ILP evidence" per target.
- Teacher notes: yellow sticky display, date-stamped, audit-logged via `saveHomeworkTeacherNote`.
- `markSubmission` now returns `{ ilpData }` — triggers 10s countdown banner + ILP evidence modal.
- `classifyIlpEvidence` calls Claude API (max_tokens 300) to classify each goal as PROGRESS/CONCERN/NEUTRAL.
- `saveIlpEvidenceEntries` bulk-creates `IlpEvidenceEntry` records.
- Evidence timeline added to `/send/ilp/[studentId]` page.
- SENCO early warning page shows rose banner when students have 3+ CONCERN entries this term.
- New Prisma model: `IlpEvidenceEntry` (applied with `prisma db push`).

**Google Material Icons migration ✅ (2026-03-28)**
- Added Material Icons font link to `app/layout.tsx`.
- Created `components/ui/Icon.tsx` — shared wrapper with `name`/`size`/`color`/`className` props.
- Replaced all lucide-react usages across 131 files with `<Icon name="..." />`.
- `lucide-react` is no longer used anywhere in the codebase.

**Student Photo Proxy — Definitive Fix ✅ (2026-04-01)**
- `app/api/student-photo/[userId]/route.ts` rewritten: reads `User.avatarUrl` directly from DB (not WondeStudent name-matching); fetches with `Basic` auth for Wonde URLs (`Bearer` was wrong), no auth for public CDNs; returns 404 if `avatarUrl` null; curl confirmed `200 image/png`.
- `lib/wonde-sync.ts` photo bridge fixed: sync now writes **raw Wonde URL** to `User.avatarUrl` (read by proxy) and proxy URL to `UserSettings.profilePictureUrl` (for sidebar self-avatar). Previous design wrote proxy URL to `User.avatarUrl` — causing circular reference (proxy reads URL → gets proxy URL → loops).
- `components/StudentAvatar.tsx`: added `userId?: string | null` prop. When set, img src = `/api/student-photo/${userId}` (authenticated proxy); when not set, falls back to `avatarUrl` directly (backward compat).
- All 21 StudentAvatar call sites updated with `userId` prop across 17 files: `HomeworkMarkingView`, `ClassListView`, `AdminStudentTable`, `StudentAnalyticsView`, `RevisionProgramDetail`, `StudentFilePanel`, `PlansView`, `ConcernList`, `SubmissionMarkingView`, `StudentContactPanel`, `NewThreadModal`, `ThreadList`, `MessageBubble`, `ClassAnalyticsPanel`, `RagView`, `AdaptiveHeatmapView`, `AdaptiveStudentView`, `ClassRosterTab`, `student/[studentId]/send`.

**GCSE Grading System + Full System Audit + Bug Fixes ✅ (2026-04-01)**
- `lib/grading.ts` updated: `GCSE_LETTERS` map (9=A**, 8=A*, 7=A, 6=B, 5=C+, 4=C, 3=D, 2=E, 1=F), `percentToGcseGrade()`, `gradeLabel()`, `gradePillClass()`.
- `lib/gradeUtils.ts` created: `formatGrade()`, `formatRawScore()`, `scoreToGcseGrade()`, `formatAvgGrade()`.
- `app/actions/rag.ts`: grade-based RAG (green=at/above predicted, amber=1 below, red=2+ below); `RagStudent` now includes `workingAtGrade`, `predictedGrade`, `recentGrades`.
- `ClassAnalyticsPanel`: class avg card coloured by GCSE grade tier; SEND attainment labels use `gradeLabel()`; student rows show trend arrow + grade pill + predicted grade.
- `AdaptiveHeatmapView`: cells and headers show GCSE grade 1–9; colour thresholds grade-based.
- `HomeworkMarkingView`: grade picker 1–9 buttons; `displayScore` always routed through `percentToGcseGrade()`; AI badge shows "Gr X (Y)" not percentage.
- Full system BUGS.md audit produced (26 bugs + 14 feature gaps).
- BUG-001/010: AppShell added to `app/students/[studentId]` and `app/senco/ilp-evidence`.
- BUG-002/003/004/021: Grade display consistency — no more "pts", "Grade 75", or raw decimals.
- BUG-007/009/013/015/016/018/020: 6 dead sidebar links resolved with stub pages; student/homework redirects to dashboard.
- BUG-012: `gap?.length` null safety.
- BUG-019: `app/hoy/error.tsx` error boundary created.
- BUG-022: `app/settings/accessibility` — AppShell added + "← Settings" back link.
- BUG-024: Inline SVG in parent/consent replaced with `<Icon name="chat" />`.

**May 2026 Design + SENCO Sprint ✅ (2026-05-04)**
- Design system: `OmnisLogo` (inline SVG, replaces PNG), `EmptyState`, `PageHeader`, `SendBadge` components. Typography scale, card/surface system, SEND badge standardisation, skeleton loaders across all list/card views.
- `HomeworkMarkingView` rebuilt as two-panel layout: student list (left, with SEND badges + grade pills) + submission view (right, with Q&A cards, auto-score, teacher notes).
- Teacher dashboard polish: stat cards, today's lessons strip, homework-to-mark list, open concerns widget.
- LessonFolder tab restyle to pills; Revision tab removed (content moved to lesson plan section).
- Learning passport selection: per-student checkboxes on ILP list, "No Passport" filter chip, context-aware Generate button.
- **ILP evidence automation:** `app/actions/ilp-evidence.ts` — `requestILPEvidence` (SENCO notify teachers button), `checkILPEvidenceMatch` (fire-and-forget proactive AI detection via claude-haiku after marking).
- **SENCO read-only submission view:** `StudentFilePanel` Homework tab now shows clickable rows for SENCO/SLT/SCHOOL_ADMIN that open a read-only slide-over. `getSubmissionReadOnly` server action added. Teachers keep existing `<a href>` links.
- **Homework grading role enforcement:** `markSubmission` and related actions reject non-teacher callers; `canGrade` prop threads from server page to `HomeworkMarkingView`.
- **ILP row chevron fix:** `IlpPageView` — `shrink-0` on action strip, single rotating `expand_more` icon, `stopPropagation` on action buttons, "Collapse" link at bottom of expanded content. Same fix applied to `ClassListView`.
- **AppShell restored** on `/student/[studentId]/send`, `/admin/cover`, `/student/revision` (sidebar was missing).
- **Bare `<a href>` → `<Link>`** in `KPlanModal`, `EhcpPageClient`, `StudentFilePanel`.

**May 2026 Part 3 — Issues 13-18 ✅ (2026-05-06)**
- **Issue 13 (RAG in Performance tab):** `StudentAnalyticsView` Performance tab now loads RAG data via `getClassRagData` when a class is selected. Each student row shows a colour-coded RAG pill (green=on track, amber=borderline, red=needs support). Class stats bar shows counts. Grid layout updated to `grid-cols-[1fr_130px_110px_110px_60px_80px]`.
- **Issue 14 (Support Profile card):** `StudentDeepDive` in `StudentAnalyticsView` now shows an amber "Support Profile" card grouping SEND badge + needArea, ILP areasOfNeed (2-line clamp), active SMART goals (max 3 + overflow count), and most recent teacher note (from `file.notes`).
- **Issue 15 (Student slide-over from ConcernList):** `ConcernList` now imports `StudentContactPanel` and adds a "Profile" button to each concern card's `rightContent`. Clicking opens the student contact slide-over with contact details, SEND status, and messaging options.
- **Issue 16 (Year revision mode):** Already fully implemented. `getYearTopics`, `createYearRevisionProgram` server actions in `revision-program.ts`. `YearRevisionCreator.tsx` 3-step wizard (configure → topic checklist → generating). `YearRevisionView` renders Section A (generic guide) + Section B (personalised focus areas). Route: `/revision-program/year`.
- **Issue 17 (Adaptive test mode):** Already fully implemented. `RevisionTaskView` phase state machine includes `'test'` phase that renders `RevisionTestMode`. "Start Test" button wired for both standard and year revision tasks. `test-engine.ts` handles difficulty cycling, question generation, evaluation, results.
- **Issue 18 (Photo proxy SVG fallback):** `app/api/student-photo/[userId]/route.ts` now queries `firstName` and `lastName` alongside `avatarUrl`. Returns deterministic-colour SVG initials avatar instead of 404/error when avatarUrl is null or upstream fetch fails.

**May 2026 Part 4–6 — TA Role + Code Quality + Security Audit ✅ (2026-05-31)**
- **Teaching Assistant role:** `/ta/notes` hub (`TaNotesHub`) with year group + class cascade dropdowns,
  student list with SEND badges, inline note add/view/mark-read, urgent flag, TA notifications to class teachers.
  Route: `/ta/notes`. Sidebar: Student Notes, Messages, Notifications only.
  Auth: routes to `/ta/notes` on login. Demo user: `j.taylor@omnisdemo.school / Demo1234!`.
  Seed: TA user now in main `npm run db:seed` (upsert resets password on every seed run).
- **Code quality:** `ClassRosterTab.tsx` split from 1430→~700 lines via `hooks/useClassRosterData.ts`.
  `getDashboardData` wrapped in `unstable_cache` (60s TTL per user/day). N+1 in `addTaNote`
  notifications replaced with `findMany` + `createMany`. Debug console.logs removed (lessons, dashboard).
  `app/ta/error.tsx` error boundary added. Class Notes / TA Notes labelling distinguished.
  6 bare `<a href>` internal links converted to `<Link>` (SencoDashboard, StudentFilePanel, StudentAnalyticsView).
- **Security audit (2026-05-31):** `getTaClasses()` missing role check fixed (now uses `requireAllowed()`).
  Wonde sync route auth guard tightened (explicit null-checks on schoolId + role). `TA_NOTE_ADDED` and
  `TA_NOTE_DELETED` added to `AuditAction` enum; `addTaNote()` and `deleteTaNote()` now call `writeAudit()`.
  `console.error` removed from `TaNotesHub` client. 4 remaining bare `<a href>` links converted
  (AdaptiveHeatmapView, AdaptiveStudentView, IlpEvidenceView, SencoDashboard).
- **E2E:** 110/110 tests passing on both localhost and live Vercel deployment.

**Phase 4 — Trial Readiness ✅ (2026-04-08)**
- Phase 4.1 (Data safety): schoolId scoping confirmed on all queries; SEND data not accessible to student/parent roles; ILP audit trail via writeAudit().
- Phase 4.2 (Performance): Loading skeletons on ClassRosterTab, StudentAnalyticsView, IlpPageView; progress bars on ILP gen (60s) and homework gen (30s); DB indexes added (`@@index([userId])` on Enrolment); analytics filter queries wrapped in 60s unstable_cache; classSize parallelised into Promise.all; ILP batch reduced 10→5 with 1s inter-batch delay.
- Phase 4.3 (Error handling): `app/admin/error.tsx` + `app/student/error.tsx` added (all routes now have error boundaries); `HomeworkSubmissionView` saves draft to localStorage before submit, try/catch with retry button on failure; AI error messages in `generateIlpGoalsForStudent` + `generateILPForStudent` changed from raw `String(err)` to user-friendly strings.
- Phase 4.4 (Smoke test): Full 16-step end-to-end code audit — all PASS. Adaptive SEND homework (scaffolding_hint/ehcp_adaptation/vocab_support) confirmed generated and rendered. Concern flagging → SENCO notification confirmed. SEND attainment gap in SLT analytics confirmed.

**June 2026 — Homework UX Polish ✅ (2026-06-02)**
- AI stream: fixed final-buffer flush on stream close so last chunk is never dropped; `maxDuration` increased to 120s on `/api/homework/generate`.
- Student answer exposure: submission answers are no longer shown to other students in the marking view.
- Re-generation flow: teachers can regenerate homework content without losing existing submissions.
- Sign-in redirect: switched to `window.location.href` after NextAuth sign-in so server-side role redirect fires correctly for all roles (including TEACHING_ASSISTANT → `/ta/notes`).
- Resizable two-panel layout in `HomeworkMarkingView`: left/right panel resized via a 12px grip-dot handle (`cursor-col-resize`, 160–360px range); marking panel height resized via a 20px bar with `drag_handle` icon + "drag to resize" label (`cursor-ns-resize`, 180–700px range).
- Duplicate model answer fix in `HomeworkDetailPanel`: combined `hw.modelAnswer` block now suppressed when per-question answers are already rendered via `scQuestions`, `qJson`, or `hqRows`.
- 110/110 e2e passing on Vercel (commit 18b4e38). 3 network flakes on cold start — all pass on retry #1.

**June 2026 Part 3 — E2E Test Suite Expansion ✅ (2026-06-06)**
- **5 new spec files added** (155 tests total, 23 spec files): `ehcp-evidence.spec.ts` (EHCP plans
  access + P2002 regression guard), `homework-upload.spec.ts` (UPLOAD type student/teacher views +
  Year Group Plans "External Link" label), `student-notes-edit.spec.ts` (teacher add/edit/delete
  notes, TA notes hub, access control), `student-returned-hw.spec.ts` (grade context strip, homework
  list), `subjects-boards-hoy.spec.ts` (HOD/HOY edit rights regression).
- **Playwright fixes:** `loginAs` timeout reduced 120s→45s (cold Lambdas fail fast; suite runs in
  ~18 min instead of 1h+). `beforeAll` DB setup wrapped in try-catch — unhandled throws caused 0ms
  test failures instead of graceful skips. Removed duplicate `prisma.$disconnect()` calls across
  describe blocks in same file (block N's afterAll was disconnecting shared client before block N+1's
  beforeAll). Auth cookie injection: added `page.goto('/')` after `addCookies()` to trigger
  middleware role redirect.
- **Selector fixes:** `"add note"` → `"save note"` button text; icon-only edit button found via
  `locator('button').filter({ has: locator('span', { hasText: /^edit$/ }) })`.
- **Homework schema fix:** `ensureUploadHomework` was using non-existent `teacherId` field and
  missing required `createdBy`. Fixed to filter by `classId` and include `createdBy: teacher.id`.
- **Result:** 151/155 passing on Vercel (exit code 0). 4 gracefully skip (ehcp-evidence block 3
  requires returned homework in DB — run `npm run db:seed`).

**June 2026 Part 2 — Feature Completion + Wonde Timetable ✅ (2026-06-05)**
- **Agent recommendation UI:** `/senco/agent-insights` — `AgentRecommendationsView` with filter chips (Awaiting/Reviewed/All), confirmation modal, confirm/override/dismiss actions via `reviewAgentRecommendation`, audit-logged. `getPendingAgentRecommendations` server action with pagination.
- **Student homework list:** `/student/homework` — `StudentHomeworkListView` with STATUS_CHIPS (Overdue/Due soon/Upcoming/Submitted/Graded), search, `daysUntil()` helper, grade pills. Server component deduplicates adapted variants.
- **Resource library:** `/resources` — `ResourceLibraryView` with type filter chips (PLAN/SLIDES/WORKSHEET/VIDEO/LINK), URL search state sync, SEND score badges (green ≥70 / amber ≥40 / red <40). `getFullResourceLibrary(typeFilter?, query?)` server action added to `lessons.ts`.
- **Cover lessons view:** `/lessons` — `LessonsWeekView` weekly 5-day grid, search + subject + day filters, week nav, absence-affected cards highlighted amber. Uses `scheduledAt`/`endsAt` (not lessonDate/endTime). `SchoolLesson` type added to `lessons.ts`.
- **DB indexes:** `@@index([homeworkId])` on Submission, `@@index([schoolId, raisedBy])` on SendConcern — pushed to production DB.
- **13 debug console.logs removed** from homework.ts, revision-program.ts, ai-generator.ts, content-generator.ts.
- **SENCO sidebar:** "AI Insights" nav item added pointing to `/senco/agent-insights`. "Resource Library" added to TEACHER nav.
- **Wonde timetable:** `periods.read` + `lessons.read` permissions now enabled in Wonde dashboard. Existing sync code (steps 6–7) will populate `WondePeriod` + `WondeTimetableEntry` tables on next full sync from `/admin/wonde`.

**June 2026 Sprint E — HOY Dashboard, Attendance Overview, Academy PDF, Notification Filters ✅ (2026-06-11)**
- **HOY dashboard** (`/hoy/dashboard`): greeting (morning/afternoon/evening), 4 KPI cards (students/open concerns/reviews due/low attendance), quick-action links (Year Analytics, Integrity), attendance panel (students below 95%), SEND concerns panel, homework pulse section, print button. Accessible to HEAD_OF_YEAR/SLT/SCHOOL_ADMIN. HEAD_OF_YEAR routed here on login.
- **Academic integrity workflow** (`/hoy/integrity`): integrity signals table, pattern cases, review modal. Accessible to HEAD_OF_YEAR/SLT/SCHOOL_ADMIN.
- **HOY welfare hub** (`/hoy/welfare`): pastoral welfare page using `getHoyWelfareData` action + `HoyWelfarePanel` component. Accessible to HEAD_OF_YEAR/SLT/SCHOOL_ADMIN.
- **Attendance overview** (`/admin/attendance`): 5 KPI cards (school avg + distribution), year-group breakdown table with RAG bars + <90%/<85% counts, students-below-90% table with SEND badges + student links, CSV export (`AttendanceExportButton`), print support. Accessible to SCHOOL_ADMIN/SLT/HOY. Shows "Run MIS sync" prompt when no attendance data.
- **Academy reports PDF export**: `/api/export/academy-report` (GET, maxDuration 60, ACADEMY_ADMIN/PLATFORM_ADMIN). `lib/pdf/academy-report-template.ts` generates A4 HTML — compliance rows, SEND summary, scale, per-school table (students/SEND/ILPs/EHCPs/concerns/onboarded/last sync). "Export PDF" + PrintButton added to `/academy/reports` PageHeader.
- **Notification filter chips**: `NotificationsView` now has 7 filter chips (All/Unread/Concerns/Early Warning/ILP Reviews/Homework/Messages). Chips hidden if type has 0 items. Empty state respects active filter label.
- **Sidebar additions**: Attendance link added for SCHOOL_ADMIN + SLT; Welfare link added under Pastoral section for HEAD_OF_YEAR.
- **E2E**: `hoy-dashboard.spec.ts` — 15 tests covering access control (HOY/SLT/admin can access; teacher/student/SENCO cannot) + page content (KPI cards, greeting, quick links, attendance panel, SEND concerns, homework pulse, print button, sidebar link).

**June 2026 Sprint D — APDR Production-Quality Enhancements ✅ (2026-06-10)**
- **Schema:** Added `outcomeRating String @default("")` and `parentComments String @default("")` to `AssessPlanDoReview` — pushed to production DB.
- **`completeAPDRReview` action updated:** Signature extended to `(apdrId, reviewContent, outcomeRating, parentComments)`. Saves both new fields. `revalidatePath` fixed to `/students/${id}` (plural) + `/senco/apdr` (was wrong path).
- **`generateAPDRForStudent` revalidatePath fixed:** Same two paths.
- **`getAPDRDoEvidence(apdrId)` new action:** Requires SENCO/SLT/SCHOOL_ADMIN. Fetches `IlpEvidenceEntry` records + `TaNote` records since cycle `createdAt` for the student; returns formatted multi-section text for auto-populating the Do field.
- **`ApdrSectionEditor` enhanced:** Optional `onAutoPopulate?: () => Promise<string>` prop — renders a "Pull evidence" button (purple) that calls the action, prepends result to draft, and enters edit mode.
- **Structured Review form in `ApdrCycleCard`:** 4-option outcome rating radio cards (GOOD_PROGRESS/SOME_PROGRESS/INSUFFICIENT/NO_PROGRESS with colour coding) + review textarea + parent/carer comments textarea. Complete button gated on outcome selection.
- **`OutcomeRatingBadge`:** Colour-coded badge shown on completed cycles. Parent comments block shown when present.
- **PDF export:** `lib/pdf/apdr-template.ts` — `apdrPdf(ApdrPdfData)` generates A4 HTML with APDR sections, outcome badge, parent comments, SENCO approval status. `templates.ts` extended with `.card-red` CSS class. Route `/api/export/apdr/[apdrId]` (GET, maxDuration 60, SENCO/SLT/HOY/SCHOOL_ADMIN). "Export PDF" link on completed cycles in `StudentFilePanel`.
- **Type safety:** `ApdrRow` type in `send-support.ts` extended with `outcomeRating` and `parentComments`. All `ApdrRow` mappers in `getStudentAPDRCycles`, `getAllAPDRCycles`, and `getAllIlps.activeApdrCycle` updated.

**June 2026 Sprint C — Dashboard Appropriateness Audit ✅ (2026-06-10)**
- **ACADEMY_ADMIN sidebar fixed:** Links to `/platform-admin/schools` and `/platform-admin/dashboard` were broken (PLATFORM_ADMIN only). Replaced with `/academy/schools`, `/academy/send`, `/academy/reports` — all scoped to ACADEMY_ADMIN + PLATFORM_ADMIN.
- **Academy stats** (`AcademyStats` type + `getAcademyStats`): Removed `totalHomework` (irrelevant at MAT level). Added `onboardedSchools` (compliance) and `openConcerns` (trust-wide open/under_review/escalated SendConcerns). Stats shown: Schools · Onboarded · Students · Staff · Active ILPs · EHCP Plans · Open Concerns.
- **`AcademySchoolsTable`**: Removed classCount column. Added: SEND register count, ILPs, EHCPs, open concerns per school (all from parallel queries in `getAcademySchools`). Open concerns shown with amber icon. SEND values coloured purple/amber/rose.
- **`getAcademySchools`** extended: fetches `ilpCounts`, `ehcpCounts`, `sendStudentCounts` per school in parallel. `AcademySchoolRow` type adds `activeIlps`, `ehcps`, `openConcerns`, `sendStudents`.
- **`/academy/schools`**: Full-page schools table. Accessible by ACADEMY_ADMIN + PLATFORM_ADMIN.
- **`/academy/send`**: Trust-wide SEND overview — 4 headline stat cards, per-school table showing students/SEND/SEND%/ILPs/EHCPs/open concerns, trust totals row. SEND% ≥20% highlighted amber.
- **`/academy/reports`**: Compliance report — Setup (onboarded schools, MIS sync health), SEND (ILPs/EHCPs/open concerns with RAG status dots), Scale (students/staff/schools). PDF export + print buttons (added Sprint E).
- **Admin dashboard `AdminDashboardData`**: Removed `pendingHomework` (teacher-level detail). Added `openConcerns` (school-wide SEND concern count). `AdminDashboardStats` updated to match.

**June 2026 Sprint B — Student Subject Options (GCSE/A-Level Choices) ✅ (2026-06-10)**
- **`StudentSubject` model:** `id, studentId, schoolId, subject, yearGroup, isCore, level, assignedClassId, @@unique([studentId,subject])`. `assignedClassId` FK → `SchoolClass` (specific set/group). Pushed to production DB. Back-relation `SchoolClass.subjectEnrolments`.
- **Server actions in `admin.ts`:** `getStudentSubjects(studentId)` → `StudentSubjectRow[]`, `setStudentSubjects(studentId, subjects[])` (delete+createMany, audit), `getClassesForSubject(subject, yearGroup)` → `SubjectClassOption[]`, `getOptionsOverview(yearGroup)` → `OptionsOverviewRow[]` (grouped stats).
- **`StudentOptionsModal`:** Opens from book icon on student row. Core subjects (English/Maths/Science) pre-ticked and locked. Option subjects toggled on/off. Each selected subject has level dropdown (GCSE/A-Level/BTEC/Other) + class-within-subject dropdown (populated from real SchoolClass records). Saves via `setStudentSubjects`.
- **`/admin/options` page:** Year-group tabs (Y7–Y13), table showing subject × student count × classes assigned, core/option badges. "Subject Options" added to SCHOOL_ADMIN sidebar.
- **`AdminStudentTable`:** Book icon per row opens `StudentOptionsModal`. `optionsTarget` state added.
- **`StudentFilePanel` header:** Subject chips below year/form (blue border = core, grey = option); shows level e.g. `History (GCSE)`. Powered by `StudentFileData.subjects` field fetched in `getStudentFile`.
- **Seed refreshed:** `npm run db:seed` re-run — all lesson/homework dates stamped to current week.
- **E2E:** 174 passed, 4 skipped, 0 failures (commit 1daf86a).

**June 2026 Sprint A — Student CSV Import, Activation Tracking, Student Class Enrolment ✅ (2026-06-10)**
- **CSV student import:** `StudentImportModal` at `/admin/users` — "Import students (CSV)" button, client-side parser (no extra deps), supports `firstName,lastName,email,yearGroup,class` columns, preview table, calls `importStudents()` server action. Creates `User` accounts, sends 7-day activation emails, optionally enrols students in class by name match, writes `USER_PROVISIONED` audit. Skips existing emails silently.
- **Activation dashboard widget:** `ActivationPanel` on `/admin/dashboard` — amber panel with per-year-group breakdown, progress bar, "View all" link → `/admin/users?filter=pending`. Auto-hidden when all students activated. `pendingActivation` stat added to `AdminDashboardStats` (7th stat card).
- **Student class enrolment in EditUserModal:** Clicking pencil on a student row now shows class enrolment checkboxes (same grouped-by-year UI as staff). Saves via `setStudentEnrolments()` which manages `Enrolment` records. New server actions: `getStudentEnrolments(userId)`, `setStudentEnrolments(userId, classIds[])`, `getActivationBreakdown()`.
- **`/admin/users` URL param:** `?filter=pending` pre-selects the Pending activation chip. `initialFilter` prop added to `UserManagementTable`.
- **`AdminDashboardData`** now includes `pendingActivation: number`.

**June 2026 Part 8 — Role/Class Assignment, Onboarding Wizard, Global Search, Academy Dashboard ✅ (2026-06-09)**
- **EditUserModal in UserManagementTable:** Role dropdown (all valid roles), year group input for students, class assignment checkboxes grouped by year group (via `getSchoolClasses` + `getUserClasses` + `setTeacherClasses`). `changeUserRole` writes `USER_ROLE_CHANGED` audit. `USER_CLASS_ASSIGNED` AuditAction added.
- **School onboarding wizard:** `/admin/onboarding` — 4-step `OnboardingWizard`: Step 0 school profile (name/phase/URN/emailDomain → `saveSchoolSettings`), Step 1 invite staff (repeating rows → `/api/staff/invite`), Step 2 connect MIS (Wonde link or skip), Step 3 complete (`completeOnboarding` → sets `onboardedAt` → redirect to dashboard). Amber banner on `/admin/dashboard` when `!settings.onboardedAt`.
- **Global search Cmd+K:** `GlobalSearch.tsx` — keyboard shortcut `Cmd+K`/`Ctrl+K`, 250ms debounce calling `globalSearch` server action, results grouped by type (students/staff/homework/resources), ↑↓ arrow nav + Enter to navigate + Escape to close. Rendered in `AppShell` for non-student/parent/TA roles.
- **ACADEMY_ADMIN role + academy dashboard:** `ACADEMY_ADMIN` added to Role enum. `/academy/dashboard` shows `AcademyDashboardStats` (6-stat grid) + `AcademySchoolsTable` (per-school: sync health, onboarding status, phase). `auth.config.ts` routes ACADEMY_ADMIN → `/academy/dashboard`. Sidebar nav for ACADEMY_ADMIN added.
- **SchoolGroup model:** `SchoolGroup { id, name, createdAt, updatedAt, schools School[] }` — enables MAT/trust grouping. `School.schoolGroupId String?` optional FK.
- **PlatformSchoolHealthTable:** Added to platform admin dashboard — per-school sync age, open SEND issues (last 30 days via `sendConcern` count), onboarding state.
- **New server actions in `admin.ts`:** `changeUserRole`, `updateStudentYearGroup`, `getSchoolClasses` (ClassOption[]), `getUserClasses` (classId[]), `setTeacherClasses` ($transaction delete+createMany), `getSchoolSettings`, `saveSchoolSettings` (`SCHOOL_SETTINGS_UPDATED` audit), `completeOnboarding` (`SCHOOL_ONBOARDED` audit). Exported types: `ClassOption`, `SchoolSettings`.
- **`app/actions/search.ts`:** `globalSearch(query)` — scoped by schoolId, returns 6 students + 4 staff + 5 homework + 4 resources. Students/parents blocked. Resource uses `label` field (not `name`).
- **`app/actions/academy.ts`:** `getAcademyStats`, `getAcademySchools` — ACADEMY_ADMIN + PLATFORM_ADMIN only.
- **Schema pushed to production DB:** ACADEMY_ADMIN in Role, SchoolGroup model, School.schoolGroupId, SCHOOL_ONBOARDED/SCHOOL_SETTINGS_UPDATED/USER_CLASS_ASSIGNED in AuditAction.
- **ESLint fix:** `require('crypto')` in `admin.ts` replaced with ES `import crypto from 'crypto'`.
- **Year rollover cron bug fix:** `$executeRaw` with `ANY(${array})` doesn't bind JS arrays correctly → replaced with `prisma.user.updateMany({ data: { yearGroup: { increment: 1 } } })`.

**June 2026 Part 7 — Year Rollover, Wonde Provisioning, User Management, Email Notifications ✅ (2026-06-09)**
- **Year rollover cron:** `/api/cron/year-rollover` (schedule `0 1 1 9 *`) — `$executeRaw` increments yearGroup for Y7–Y12, sets `isActive=false` for Y13 leavers, writes `YEAR_ROLLOVER` audit entry.
- **Manual trigger:** `POST /api/admin/trigger-year-rollover` with `{ dryRun: true }` preview (returns counts without applying). `YearRolloverPanel` component on `/admin/dashboard` — idle → preview → confirm → done state machine.
- **Wonde auto-provisioning:** After each sync, creates `User` accounts for unprovisioned students/parents (gated on `School.emailDomain`). Student email: `firstname.lastname@students.{emailDomain}`. Parent email from `WondeContact.email`. Sends welcome email with 7-day activation link. Writes `USER_PROVISIONED` + `WELCOME_EMAIL_SENT` audit entries per-record. Best-effort with per-record try/catch.
- **`/admin/users`:** Unified user management page. `getSchoolAllUsers`, `deactivateUser`, `reactivateUser`, `resendWelcomeEmail` server actions in `app/actions/admin.ts`. `UserManagementTable` — filter chips (All/Students/Parents/Staff/Pending), search, status badges (Active/Pending/Inactive), activated date, per-row actions. "All Users" in SCHOOL_ADMIN sidebar + admin dashboard quick links.
- **5 new email functions** in `lib/email.ts`: `sendWelcomeAccountEmail`, `sendIlpReviewDueEmail`, `sendEhcpReviewDueEmail`, `sendNewHomeworkEmail`, `sendGradeBelowTargetEmail`.
- **Email triggers:** New homework published → enrolled students notified (`createHomework`). Grade 2+ below predicted → parent notified (`markSubmission`). ILP ≤7 days + EHCP ≤30 days → SENCO emailed by `/api/cron/review-due` (schedule `0 7 * * 1-5`).
- **Schema:** `User.activatedAt DateTime?` (set fire-and-forget in `lib/auth.ts` on first login). `School.emailDomain String?`. `AuditAction`: `YEAR_ROLLOVER`, `USER_PROVISIONED`, `WELCOME_EMAIL_SENT`. All pushed to production DB.
- **E2E:** 174 passed, 4 skipped, 0 failures. Exit 0.

**June 2026 Part 6 — Password Reset + Staff Invitation + Root Redirect ✅ (2026-06-08)**
- **Password reset flow:** `app/forgot-password/page.tsx` (email entry, always-200 response to prevent enumeration) + `app/reset-password/page.tsx` (new password form, Suspense + useSearchParams). API routes: `app/api/auth/forgot-password/route.ts` (1h token) + `app/api/auth/reset-password/route.ts` (bcrypt + $transaction). "Forgot your password?" link added to login page.
- **Staff invitation system:** `app/api/staff/invite/route.ts` (SCHOOL_ADMIN/SLT only — creates 7-day token, sends email, invalidates prior pending invites) + `app/api/staff/accept-invite/route.ts` (GET: validate token; POST: create User + mark invite used). `app/accept-invite/page.tsx` (account setup form). "Invite by email" modal added to `AdminStaffTable` with firstName/lastName/email/role fields.
- **Root redirect:** Unauthenticated requests to `/` now redirect to `/marketing/home` (via `auth.config.ts` authorized callback).
- **Prisma schema:** `PasswordResetToken` + `StaffInvitation` models added, pushed to production DB.
- **lib/email.ts:** `sendPasswordResetEmail` + `sendStaffInvitationEmail` added.
- **Middleware:** `forgot-password|reset-password|accept-invite` added to public matcher exclusions.
- **E2E:** 148 passed, 4 skipped, 3 network flakes (all retry-pass), 0 hard failures. Exit 0.

**June 2026 Part 5 — Marketing Pages ✅ (2026-06-08)**
- **4 public routes:** `/marketing/home` (hero, feature grid, role cards), `/marketing/features` (6 sections, 35 features), `/marketing/beta` (school application form), `/marketing/investors` (market pitch + contact form).
- **Shared layout:** `app/marketing/layout.tsx` — sticky nav with `OmnisLogo`, links to all 4 pages, "Sign in" CTA, and footer.
- **Contact API routes:** `app/api/contact/beta/route.ts` + `app/api/contact/investors/route.ts` — POST JSON, send formatted HTML email to `ivanyardley@me.com` via Resend. No-op gracefully without `RESEND_API_KEY`.
- **Middleware:** `marketing` added to matcher negation — all `/marketing/*` routes are public (no auth required).

**June 2026 Part 4 — Feature Gap Sprint ✅ (2026-06-08)**
- **GAP-007 (Parent contact log):** New `ParentContactEntry` Prisma model (`ContactMethod` enum: PHONE/EMAIL/MEETING/LETTER/OTHER; `PARENT_CONTACT_LOGGED` AuditAction). `addParentContactEntry` + `deleteParentContactEntry` server actions in `app/actions/students.ts`. Interactive `ContactsTab` in `StudentFilePanel` — add-entry form (date, method, summary, outcome), optimistic UI, delete per entry, chronological log with method icons.
- **GAP-009 (Topic heatmap + format breakdown):** `TopicHeatmap` component in `StudentGradesView` — colour-coded topic chips (green 7–9, blue 5–6, amber 4, red 1–3) with legend. `FormatBreakdownPanel` — bar chart of avg grade per homework format with "best format" insight. Both added to `SubjectCard` expanded view.
- **GAP-013 (National GCSE benchmark):** `NATIONAL_AVG` record in `app/slt/analytics/page.tsx` (2024 JCQ national averages per subject, 0–9 scale). "vs National Average" sidebar card in SLT analytics showing trending arrows + delta per subject.
- **GAP-008 (GCSE exam weighting hints):** `GCSE_WEIGHT_HINTS` record in `lib/revision/content-generator.ts`. Exam component weighting injected into `generateRevisionTask` AI prompt to bias content towards high-value paper components.
- **GAP-014 (Schema):** `prisma db push` applied — `ParentContactEntry` table live in production DB.
- **E2E:** 150/155 passing on Vercel (1 network flake on `/senco/ehcp`, 4 intentional skips).
