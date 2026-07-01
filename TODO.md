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
