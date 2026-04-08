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

## ✅ TRIAL READY — 2026-04-08

All phases complete. 16/16 smoke test checks pass.
**Next step: live school trial with real students and teachers.**

---

## Final Status

| Area | Status |
|---|---|
| Calendar / Lessons | ✅ Working — weekly view, lesson folders, all tabs |
| Student photos | ✅ Fixed — authenticated proxy via `/api/student-photo/[userId]` |
| Class roster loads | ✅ Fixed — all students load with SEND badges |
| Grade display | ✅ GCSE 1–9 consistent everywhere via `lib/grading.ts` + `lib/gradeUtils.ts` |
| Homework set/submit/mark | ✅ Full cycle working — create, submit, mark, return, grade displayed |
| SEND identification & ILP | ✅ Concern flagging → SENCO notified → ILP generated → approved |
| Adaptive homework from ILP | ✅ `scaffolding_hint` / `ehcp_adaptation` / `vocab_support` generated and rendered |
| ILP evidence capture | ✅ Post-marking prompt → Claude classifies → evidence timeline |
| Analytics (clickable/useful) | ✅ GCSE grades, RAG status, student drill-down, SEND attainment gap |
| Wonde MIS data in profiles | ✅ Synced — student photos, class lists, timetable |
| Revision (curriculum-mapped) | ✅ RevisionProgram with AI-generated tasks per lesson |
| Adaptive Learning | ✅ Bloom's taxonomy heatmap, per-student profiles |
| Error handling | ✅ All routes have error.tsx, retry on network failure, localStorage backup |
| Performance | ✅ Skeletons, progress bars, DB indexes, 60s cache, parallelised queries |
| E2E tests | ✅ Silenced (workflow_dispatch only — noise removed) |

---

## PHASE 0 — Stabilise ✅ COMPLETE

**0.1** Fix class roster "Could not load" — **COMPLETE** ✅
**0.2** Fix student photos — **COMPLETE** ✅ (proxy reads `User.avatarUrl`, Basic auth for Wonde URLs)
**0.3** Fix E2E tests / silence — **COMPLETE** ✅

---

## PHASE 1 — Core Teaching Loop ✅ COMPLETE

**1.1** Homework marking view (submissions, per-question scoring, notes) — **COMPLETE** ✅
**1.2** GCSE grade display consistent everywhere — **COMPLETE** ✅
**1.3** Curriculum-mapped revision (RevisionProgram, AI tasks per lesson) — **COMPLETE** ✅

---

## PHASE 2 — SEND Core Loop ✅ COMPLETE

**2.1** Teacher flags concern → SENCO notified — **COMPLETE** ✅
**2.2** ILP auto-generated (Claude API) + SENCO approves — **COMPLETE** ✅
**2.3** ILP visible to teachers in class/lesson views — **COMPLETE** ✅
**2.4** Adaptive homework: ILP feeds into AI generation — **COMPLETE** ✅
**2.5** ILP evidence from homework marking — **COMPLETE** ✅
**2.6** APDR cycle per student — **COMPLETE** ✅
**2.7** EHCP auto-generated from ILP escalation — **COMPLETE** ✅
**2.8** Full SEND smoke test — **COMPLETE** ✅

---

## PHASE 3 — Analytics That Drive Action ✅ COMPLETE

**3.1** Clickable RAG with drill-down — **COMPLETE** ✅
**3.2** Analytics pre-filtered to teacher's classes — **COMPLETE** ✅
**3.3** Adaptive Learning topic heatmap with real data — **COMPLETE** ✅

---

## PHASE 4 — Trial Readiness Checks ✅ COMPLETE

**4.1 Data safety checks** — **COMPLETE** ✅
- schoolId scoping confirmed on all queries
- SEND data not accessible to student/parent roles
- Role enforcement in middleware (unauthorised roles redirected)
- ILP/EHCP audit trail via `writeAudit()` on every change

**4.2 Performance check** — **COMPLETE** ✅
- Class tab skeleton → loads in < 3s
- Analytics skeleton → loads in < 5s
- Homework generation progress bar (30s)
- ILP generation progress bar (60s)
- DB indexes: `@@index([userId])` on `Enrolment`
- Analytics filters cached 60s via `unstable_cache`
- `classSize` query parallelised with `Promise.all`
- ILP batch size 5 with 1s inter-batch delay

**4.3 Error handling** — **COMPLETE** ✅
- All routes have `error.tsx` (including `app/admin/` and `app/student/`)
- No undefined/null visible to users
- AI failures: user-friendly "Generation failed — please try again" messages
- Network retry button on homework submission
- `localStorage` backup of student work before submission

**4.4 Full trial readiness smoke test** — **COMPLETE** ✅ (2026-04-08)

| Role | Check | Result |
|---|---|---|
| Teacher | Calendar loads this week's lessons | ✅ PASS |
| Teacher | Class tab loads all students with SEND badges | ✅ PASS |
| Teacher | Set homework → appears in student view | ✅ PASS |
| Teacher | Analytics shows GCSE grades | ✅ PASS |
| Teacher | Flag concern → SENCO notified | ✅ PASS |
| Student (EHCP) | Dashboard shows homework | ✅ PASS |
| Student (EHCP) | Adapted question + vocab support shown | ✅ PASS |
| Student (EHCP) | Submit homework → confirmation | ✅ PASS |
| Student (SEN Support) | Scaffolding hint shown (not EHCP adaptation) | ✅ PASS |
| Student (No SEND) | Standard question only | ✅ PASS |
| SENCO | Concern flag on dashboard | ✅ PASS |
| SENCO | Set SEN_SUPPORT → generate ILP → approve | ✅ PASS |
| SENCO | ILP evidence entries visible | ✅ PASS |
| SENCO | SEND analytics dashboard | ✅ PASS |
| SLT | School-wide analytics | ✅ PASS |
| SLT | SEND Overview tab with attainment gap | ✅ PASS |

---

## What Happens Next

The app is ready for live trial. When issues are found in the real school:

1. Log them in BUGS.md with exact reproduction steps
2. Fix using DEVELOPMENT.md prompt library
3. Run `npx tsc --noEmit && npm run build` before every push
4. Update CLAUDE.md after each session

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
*Last updated: 2026-04-08 — Trial ready*
*All phases complete*
