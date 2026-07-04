# Omnis App — UAT Follow-up Todo

> Last updated: 2026-07-01. Based on browser UAT session on omnis-app-ten.vercel.app.
> All items verified against codebase before marking DONE.

---

## DONE — Fixed this session

| # | Item | Commit |
|---|------|--------|
| 1 | **AI Goals generation failure** — Claude wraps JSON in prose/fences; `raw.match(/\[[\s\S]*\]/)` returned null → "AI returned unexpected format". Replaced with multi-strategy extractor (strip fences → JSON.parse → array regex → object unwrap). | 6643824 |
| 2 | **HOD "SEND Concerns" + "Early Warning" dead links** — `auth.config.ts` `/senco` prefix excludes `HEAD_OF_DEPT`; middleware silently redirected HOD to `/hod/dashboard`. Removed both links from HOD sidebar. | 6643824 |
| 3 | **Resource library duplicates** — `getFullResourceLibrary` returns the same URL/file attached to multiple lessons. Added in-memory dedup by `url ?? fileKey ?? label`, keeping the copy with the highest SEND score. | 6643824 |
| 4 | **Student draft answers not persisted** — `HomeworkSubmissionView` only saved to localStorage just before submit. Now auto-saves 500ms after keyup and restores on mount before first submission. | b3826a7 |
| 5 | **AI generation progress bar below fold** — "Generating..." state only shown in modal button (can be below fold). Added sticky generating banner directly below modal header during AI generation. | b3826a7 |
| 6 | **"Differentiate" button not prominent** — was ghost `bg-indigo-50`; changed to solid `bg-indigo-600` primary button so it reads as a key action when SEND students are in the class. | 13b15d1 |
| 7 | **Parent dashboard: no grade trend** — subject performance showed only a flat average. Added trajectory arrows (trending_up/trending_down) by comparing last-2 vs previous-2 graded submissions per subject. | 13b15d1 |
| 8 | **Teacher SEND caseload: broken concern links + no ILP shortcut** — "Raise concern" pointed to `/senco/concerns` (inaccessible to TEACHER role). Replaced with inline `RaiseConcernModal` calling `raiseConcern()` directly. Students with no ILP get "Notify SENCO to create ILP" with pre-filled description. | ae7ff86 |

---

## TODO — Still Open

### Medium priority

- [ ] **Calendar doesn't refresh after lesson save** — `saveOverview()` calls `router.refresh()` which should cascade to the WeeklyCalendar `lessons` prop. Possibly only affects non-current weeks (client-fetched). Needs targeted reproduction.

- [ ] **ILP Records: bulk approve for SENCO** — Bulk generate exists for students without ILP. Bulk approve of pending edits/generated ILPs does not. Needs checkbox list on ILP cards + `approveGeneratedIlp` loop.

- [ ] **ILP Records: bulk ILP goals CSV export** — `/api/export/send-register` exports the SEND register. A dedicated ILP goals export (name, targets, success criteria, review date) would support SENCO reporting to governors.

- [ ] **Inconsistent save feedback across forms** — Some forms use `toast()`, others update local state silently, some show no confirmation. Audit: lesson overview, TA notes, ILP targets, APDR sections, school settings. Standardise to `toast('Saved')`.

### Lower priority

- [ ] **Adaptive Learning: ILP/EHCP evidence rates low (11%/18%)** — `checkILPEvidenceMatch` fires after marking (grade 4+), but haiku may return false negatives. Consider lowering confidence threshold or triggering for all grades.

- [ ] **Student homework: "Q X of Y" indicator** — Already exists in `HomeworkTypeRenderer` stepper. Tester may have been on EXTENDED_WRITING homework (textarea, no stepper). Likely not a gap.

---

## UAT Round 2 — 3 July 2026

### Fixed this session

| # | Item | Commit |
|---|------|--------|
| B-001 | **AI ILP Goals fails 100%** — max_tokens 600 truncated the JSON array; parse failed silently → 'Could not generate goals'. Fixed: max_tokens → 1200 + maxDuration = 60 on senco/ilp page. | 2ae51ed |
| B-003 | **Lesson resource search duplicates** — getSchoolResourceLibrary returned same file once per lesson it was attached to. Added dedup by url ?? fileKey ?? label (same logic as getFullResourceLibrary). | 2ae51ed |
| B-006 | **HOD Quick Access 'SEND Concerns' broken link** — /senco/concerns is inaccessible to HEAD_OF_DEPT (middleware redirects to HOD home). Replaced with 'SEND Students' → /send-caseload. | 2ae51ed |
| B-007 | **TA SEND Students page: ILP targets empty** — getTaSendStudents queried ILPStatus with lowercase ('active','under_review') but Prisma enum requires uppercase (ACTIVE, UNDER_REVIEW). Silent empty result fixed. | 2ae51ed |
| B-009 | **AI Goals error modal: no retry button** — Added 'Try again' button; error state stores retryIlp so generation restarts without closing the modal. | 2ae51ed |

### Not bugs — already implemented

| Item | Status |
|------|--------|
| GAP-001: Draft auto-save | Already live — HomeworkSubmissionView saves to localStorage on keyup (500ms debounce), restores on mount |
| GAP-004: Parent grade trends | Already live — trending_up/down arrows in parent dashboard based on last 4 graded submissions |

### Browser re-test confirmations (3 July 2026)

| Item | Result |
|------|--------|
| AI ILP Goals generation | Confirmed working — ~10s, valid structured output |
| Resource library duplicates | Confirmed unique results |
| HOD Staff Overview sidebar | Confirmed working |
| TA SEND Students page | Confirmed working — shows strategies and ILP targets |
| Student homework Q progress indicator | Confirmed exceeded spec (step navigation) |
| Teacher inline ILP referral | Confirmed working |
| Resource Generator speed | Improved ~26s → ~16s |

### Still open

- [ ] **GAP-001: Student draft answers not persisted** — being fixed this session (see below)
- [ ] **GAP-005: AI Resource Generator streaming** — full wait ~16s. Medium effort; batch → stream requires SSE route.
- [ ] **Parent grade trend indicator** — lower priority; arrows exist in parent dashboard for subjects with ≥4 graded submissions. Works once more homework is marked.

---

## UAT Round 2 Follow-up — 3 July 2026

### Fixed

| # | Item | Commit |
|---|------|--------|
| GAP-001 | **Student draft answers not persisted** — HomeworkTypeRenderer ignores value prop after initial mount; localStorage restore from parent useEffect had no effect on internal answers state. Fixed by adding a useEffect in HomeworkTypeRenderer that syncs answers when value prop changes to a valid JSON object. | (current) |
