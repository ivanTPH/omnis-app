# AI homework generation: one code path, validation, staged pipeline, calibrated MCQ checker

_28 October 2026. Prompted by three Oak National Academy engineering posts: Aila's move from one large
prompt to explicit steps, their DSPy work on an MCQ quality judge, and the open curriculum knowledge graph._

## What was wrong

1. **The homework prompt existed twice.** `app/api/ai/generate-homework/route.ts` (used by the "Generate with AI"
   button) and `generateHomeworkFromResources` in `app/actions/homework.ts` (no longer called anywhere) had drifted:
   - The **live route never returned `ilpTargetIds`**, although `LessonFolder` reads them to link saved homework to
     pupils' ILP targets. Homework generated from the UI was not being auto-linked as ILP evidence.
   - Only the unused copy sent the class's **ILP classroom strategies and EHCP outcomes**, and the class exam board.
   - The unused copy required 5 short-answer questions while the prompt asks for exactly 4, so it always made a
     second, wasted AI call.
2. **AI output was not validated.** JSON was parsed and used as-is: an MCQ with three options, a duplicate option or a
   correct-answer index of 4 reached the teacher's editor.

## What changed

| File | Purpose |
|---|---|
| `lib/homework/context.ts` | The single prompt/context builder (lesson, Oak content, SEND profile, scheme of work, Oak benchmark). ILPs `active` or `under_review` are used, matching the teacher SEND caseload. |
| `lib/homework/schema.ts` | Zod validation and normalisation of AI homework. Invalid questions are dropped and counted. |
| `lib/homework/generate.ts` | One entry point: single pass (default) or the staged pipeline. |
| `lib/homework/llm.ts` | Thin model-call adapter over `SafeAnthropic`, so every step can be tested with a fake. |
| `lib/homework/flags.ts` | `homework_pipeline` school feature flag (off by default) / `HOMEWORK_PIPELINE=on\|off`. |
| `lib/ai/judges/mcq-distractor*.{ts,mjs,json}` | Calibrated MCQ distractor-quality checker. |
| `scripts/calibrate-mcq-judge.mjs` | Reproducible calibration against teacher scores. |
| `app/api/ai/generate-homework/route.ts`, `app/actions/homework.ts` | Both now call the shared modules. Only successful generations count towards the daily limit. Audit metadata records `generation` (mode, attempts, dropped questions, checker scores). |

### Staged pipeline (flag `homework_pipeline`, off by default)

The model from Oak's Aila work: explicit steps with their own contracts, each validated, each falling back to the
previous step on failure, so it can never return less than single pass.

1. **Planner** (Haiku): what each question tests — learning point, Bloom level, misconception to expose.
2. **Writer** (Sonnet): writes to the plan.
3. **Checker** (Haiku, MCQs only): scores each question's distractors.
4. **Repair** (Sonnet): rewrites only the wrong options of flagged questions; a rewrite is kept only if it keeps the
   same correct answer and scores no worse.

Live run (Year 10 AQA Biology, photosynthesis): single pass 10 MCQs in 1 call / 42 s; staged 10 MCQs in 14 calls /
59 s; staged short answer 4 questions in 2 calls / 63 s. The plan visibly turned the lesson's known misconceptions
into questions.

## MCQ checker calibration

Data: 311 MCQs scored 1–5 by 20 experienced UK teachers (Clark et al. 2024), published by Oak National Academy in
`oaknational/oak-dspy-mcq-eval` (OGL v3). Credit: Oak National Academy.

Method: stratified 20/60/20 split (seed 1337); Oak's four worked examples removed from dev/test; two prompts (plain
rubric; Oak's DSPy-optimised instruction + examples) × two models (Haiku 4.5, Sonnet 4.6); a linear correction fitted
on dev; selection on dev only; results reported on the held-out test set (61 questions). Cost ≈ £1.30.

| Held-out test | Raw | Calibrated |
|---|---|---|
| MSE vs teachers | 4.16 | **1.69** |
| Within ±1 | 48% | **70%** |
| Mean bias | −1.54 (harsh) | **+0.05** |

Selected: Haiku + plain rubric. Oak's optimised prompt did not beat the plain rubric on Claude — their prompt was
tuned for GPT-4o, which is exactly their "never assume, always check" point.

**Limitation — important.** As a yes/no detector of questions teachers rate 1–2, the checker is weak: on the test set,
flagging raw score ≤ 1 has **precision 0.42 and recall 0.68**, against a base rate of 0.36; it flags about 59% of
questions. Sonnet is only slightly better (precision 0.48). It is good at matching teachers' scores on average, not at
picking out individual bad questions. Teacher agreement on this metric is itself low (Oak note this).

**Recommendation:** leave `homework_pipeline` off for real schools until Omnis has its own labelled set (50–100
Omnis-generated MCQs scored by two teachers). Then re-run `scripts/calibrate-mcq-judge.mjs` on that set and switch
on if precision improves. Use the logged `generation.distractorScores` in the audit log to compare.

To recalibrate: `ANTHROPIC_API_KEY=… node scripts/calibrate-mcq-judge.mjs <dataset.json> <out.json> --write`
(dataset format: `[{question, correct_answer, distractors[], human_score}]`).

## Tests

- `lib/homework/schema.test.ts` (10), `lib/homework/generate.test.ts` (12), `lib/ai/mcq-distractor-judge.test.ts` (6).
- Full unit suite 142/142; `tsc --noEmit` clean.
