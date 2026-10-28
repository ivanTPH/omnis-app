# Oak engineering posts vs Omnis — assessment and curriculum-graph spike

_28 October 2026. Read-only investigation: no schema, code or production data was changed._

Sources reviewed:
- Oak, "Making the national curriculum machine-readable" (knowledge graph, Oct 2026) — repo `oaknational/oak-curriculum-ontology` v0.1.3
- Oak, "Taking Aila from a mega prompt to an agentic system" (Jul 2026)
- Oak, "Optimising prompts at Oak … using DSPy" (Aug 2026) — repo `oaknational/oak-dspy-mcq-eval`

## Summary

| Oak approach | Where Omnis is today | Recommendation |
|---|---|---|
| Split one big prompt into planner + section agents, each an "inference spec" (Zod schema + messages + model params) | Partly there. The five agents in `lib/agents/` (COACH, QUALITY, PLAN_SYNTHESIS, EVIDENCE, ENGAGE) are already separate with skill fragments and versioning. The highest-volume paths are still single prompts: homework generation, marking and ILP generation. | **Adopt, narrowly**, for homework generation first. |
| DSPy prompt optimisation against an expert-labelled "golden" set with a held-out test | Designed and built (`dspy-service/`, `AgentSkillVersion`, `lib/agents/skill-prompt.ts`) but **never run** — no training data yet. | **Adopt Oak's data strategy**: start from a small golden set instead of waiting for teacher feedback. |
| Open curriculum knowledge graph | Omnis already syncs most of the same lesson-level content via the Oak API. | **Don't integrate yet.** Revisit when lessons are linked to statutory descriptors and IRIs are frozen. |

## 1. Agentic decomposition (Aila post)

Findings in the codebase:
- Homework generation is one large prompt, and it exists **twice**: `app/api/ai/generate-homework/route.ts:252` and `app/actions/homework.ts:848`. Any fix has to be made in both places.
- Output is requested as "JSON only" in the system prompt and read with `JSON.parse`, with a retry on failure. None of the AI routes validate the result with a Zod schema.
- Marking (`app/actions/homework.ts:2420`) and ILP generation (`app/api/ai/generate-ilp/route.ts`) are also single prompts.
- These paths do not go through `skill-prompt.ts`, so the DSPy pipeline could not optimise them even if it ran.

Oak's lesson is not "be more autonomous". It is "make each reasoning step explicit, typed and testable". For Omnis that means:
1. Merge the two homework prompt builders into one module.
2. Define each step as an inference spec: Zod response schema, messages and model parameters. Use structured output rather than "return JSON" instructions.
3. Split homework generation into three steps. A **planner** chooses question types and count from the lesson and class SEND profile. A **question generator** writes each item. A **validator** checks the schema and runs the quality judge (section 2).
4. Release behind a feature flag. Keep the current path as the fallback, as Oak did.

## 2. DSPy and evaluation (prompt-optimisation post)

Database state (Supabase "Ivan Omnis", 28 Oct 2026):

| Table | Rows |
|---|---|
| AgentSkillVersion | 0 |
| AgentOptimizationRun | 0 |
| ResourceVersion (teacher edits) | 0 |
| AgentAuditEntry | 36,467 |
| AgentAuditEntry with a teacher review | 69 |
| Homework with an aiDecision | 14 of 181 |

The pipeline depends on teacher reviews and edits. Almost none exist, and current pupil data is Wonde sandbox data. It cannot produce a useful optimisation run before the trial.

Oak did not wait for production feedback. They used **311 multiple-choice questions scored by 20 experienced teachers**, split into train/dev/held-out test, and optimised one well-defined judge. Results: error (MSE) roughly halved, from 2.72 to 1.40. Agreement within ±1 of the teacher score rose from 62% to 80%. The run cost about £10. Two further findings matter for Omnis:
- **The dataset is reusable.** `oak-dspy-mcq-eval` ships the 311 teacher-scored questions under OGL v3. Omnis generates multiple-choice homework (including the weekly demo homework), so this can calibrate an Omnis **distractor-quality judge** directly.
- **Uncalibrated LLM judges are harsh.** The model scored far lower than teachers (277 of 311 rated 1, against 66 by teachers). Do not show AI quality scores to teachers until they have been checked against human scores.
- Oak optimised against GPT-4o. Omnis uses `claude-sonnet-4-6`, so results must be re-measured on Claude, not assumed to transfer.

Recommendation: point `dspy-service` at the Oak dataset first, for one judge (MCQ distractor quality), with a held-out test. Then build a small Omnis golden set of 50–100 SEND items (ILP targets, adapted homework) scored by a SENCO. Use the teacher-feedback loop once real trial data exists.

## 3. Curriculum knowledge graph — spike

Method: cloned `oak-curriculum-ontology` v0.1.3 and extracted all lesson and unit identifiers from the Turtle data (12,812 lessons, 1,580 units). Took a random sample of 146 live `OakLesson` slugs from Omnis (ordered by md5, so unbiased) and matched them on `curric:slug`. A full join was not possible: direct Postgres connections are blocked from the sandbox, so the sample went through the Supabase connector.

### Match rate

- **133 of 146 matched (91%).**
- All 13 misses are in subjects the graph does not cover yet: religious education (8), RSHE (1), plus 4 in music and maths.
- **Within covered subjects: 133 of 137 (97%).**
- Omnis slugs with a numeric suffix (e.g. `bubble-sort-23973`) match exactly, so no slug transformation is needed.
- **Join key:** `OakLesson.slug` = `curric:slug`. The graph's own numeric id is `curric:id`, with IRI `oakcurric:lesson-<id>`.

### Fields available per lesson in the graph

Key learning points, keywords, pupil lesson outcome, misconceptions, position in unit (via LessonInclusion), and unit variant / exam board. Units add "why this, why now", prior-knowledge requirements and threads.

**Omnis already stores almost all of this** from the Oak API: `keyLearningPoints`, `lessonKeywords`, `pupilLessonOutcome`, `misconceptionsAndCommonMistakes` (populated on 11,444 of 14,327 lessons), `priorKnowledgeRequirements`, `threads` and unit sequencing. Homework generation already feeds misconceptions to the model in both builders.

### What the graph adds today

1. **Shared entities.** 1,087 misconceptions and 6,439 keywords are reused across multiple lessons. This would make it possible to track a recurring misconception for a pupil across different lessons and units, which is useful for SEND evidence.
2. **National-curriculum taxonomy.** Subjects → disciplines → strands → sub-strands → content descriptors (1,204 descriptors, 1,215 sub-descriptors).
3. **Stable IRIs** for future interoperability with other systems.

### What it does not add yet

- **Lessons and units are not linked to content descriptors.** Descriptors are listed only per key stage × sub-strand ("Progression", 274 of them). Statutory coverage per homework or per pupil cannot be computed from v0.1.3.
- **No lesson-to-lesson prerequisite links.** Prior knowledge is unit-level free text, as in the Oak API.
- IRIs are still subject to change until the revised national curriculum is published (2027, first teaching 2028).

### Recommendation

Do not integrate now. When it is worth revisiting:
- add a nullable `oakGraphId` (the graph's `curric:id`) to `OakLesson`, filled by slug match during `oak:delta`;
- build a "recurring misconceptions" view for SENCOs using shared misconception entities;
- once Oak links lessons to content descriptors, add statutory coverage charts.

Trigger to revisit: a graph release that links units or lessons to content descriptors, or Oak freezing IRIs.

## Suggested order

1. Merge the duplicated homework prompt and add Zod-validated structured output. This is low risk and immediately useful.
2. MCQ distractor-quality judge calibrated on Oak's 311-item dataset. This is the first real `dspy-service` run, for about £10 one-off.
3. Planner / generator / validator split for homework generation, behind a feature flag.
4. Curriculum graph: watch only, using the trigger above.

## Marketing note

Once item 2 exists, "Omnis's AI quality checks are calibrated against experienced teachers' judgement, using Oak National Academy's open evaluation dataset" is a credible and checkable claim for schools and the local authority. Do not claim curriculum-graph alignment until it is integrated.
