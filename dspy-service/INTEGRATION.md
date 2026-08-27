# Integration notes for the Next.js app

This service only has database access (via Supabase) to the "Ivan Omnis" project --
not the app's repository. Three concrete changes are needed on the app side; none
of them are large, but they're the load-bearing wiring, so they're spelled out
precisely rather than left as "instrument things."

## 1. Record teacher edits (the "how much did they change it" signal)

Wherever the app currently lets a teacher edit AI-generated content before it's
saved/published -- the homework question editor, K Plan / ILP target editing,
"Suggest adaptation" acceptance, resource regeneration -- add a `ResourceVersion`
write at the point the edit is saved, alongside whatever the existing save does:

```ts
// after the teacher saves their edited version, before/alongside the existing write
await prisma.resourceVersion.create({
  data: {
    resourceId: resource.id,
    version: nextVersionNumber,
    url: resource.url,       // or wherever the edited content actually lives
    fileKey: resource.fileKey,
    createdBy: session.user.id,
    editSource: "teacher_edit",
    editDistance: levenshtein(originalAiContent, editedContent), // any string-distance lib is fine
    diffSummary: diffToJson(originalAiContent, editedContent),    // e.g. from `diff` npm package
  },
});
```

If the original AI-generated version was never written as a `ResourceVersion` row
either, write that too (`editSource: "ai_generated"`, `editDistance: null`) at
generation time -- then editDistance is always relative to the *previous* version,
not to some external baseline.

**Where this matters most first:** the homework question editor (Set Homework step)
and K Plan/ILP target edits, since those are the highest-volume, highest-value
generators (see DESIGN.md's pilot recommendation).

## 2. Consume the optimized prompt

Wherever an agent call currently builds its prompt from a hardcoded instruction
string for a given `(agentType, skillId)`, look up the active `AgentSkillVersion`
first and fall back to the hardcoded version if none exists yet (every skill starts
with zero `AgentSkillVersion` rows until the first successful weekly run):

```ts
async function getSkillPrompt(agentType: AgentType, skillId: AgentSkillId) {
  const active = await prisma.agentSkillVersion.findFirst({
    where: { agentType, skillId, isActive: true },
  });
  if (!active) return HARDCODED_PROMPTS[agentType][skillId]; // existing behaviour
  return {
    instructions: active.instructions,
    demonstrations: active.demonstrations as FewShotExample[],
  };
}
```

Then when you write an `AgentAuditEntry` row for that call (which the app is
already doing, going by the 19k existing rows), set `skillVersion` to
`active?.version ?? 0` so the audit trail stays resolvable to the exact prompt
that produced it -- this is also the core of the XAI explanation (see XAI.md).

Note this is genuinely per-`(agentType, skillId)`, not per-`skillId` -- a skill
several agents share (e.g. `SEND_DIFFERENTIATION`, used by all five agents) can
have a different active `AgentSkillVersion` for each agent, since each agent's
optimization run trains only on its own reviewed `AgentAuditEntry` rows (see
DESIGN.md's "Multi-agent skill sharing"). Always pass the calling agent's own
`agentType`, never a different agent's, even if the skill is shared.

## 3. Wire the weekly run into the existing Oak cron

Per your own CLAUDE.md, the Oak delta sync runs as `npm run oak:delta`. Add the
DSPy weekly run as the next step in that same scheduled job, AFTER the Oak sync
completes (so CURRICULUM_ALIGNMENT judging happens against freshly-synced content):

```
npm run oak:delta && python3 /path/to/omnis-dspy/weekly_run.py
```

This service is Python (DSPy has no JS/TS equivalent), so it can't run inside a
Vercel serverless function alongside the rest of the app. Three ways to actually
schedule it, roughly in order of how much new infra they need:

- **If the Oak cron is already a GitHub Action or external scheduler** (not a
  Vercel Cron hitting a Next.js route) -- just add this as a second step/job in
  that same workflow. Simplest option if it applies.
- **A small dedicated worker** (Railway, Fly.io, a container on whatever you're
  already using for anything non-Vercel) that both the Oak sync and this run on,
  triggered by the same scheduler.
- **A Vercel Cron endpoint that shells out** -- possible but awkward, since Python
  isn't part of the Next.js runtime; would need a separate Python-capable function
  or a call out to the worker above. Not recommended as the primary path.

Either way, `DATABASE_URL` needs to point at the same Supabase Postgres instance,
and whichever LM API key the app already uses for agent calls should be reused here
(optimizing against a different model than what's in production doesn't transfer).

## Rollback

Every promotion is reversible by hand: `isActive=false` the current row, `isActive=true`
the previous version for that `(agentType, skillId)`. Nothing about the app's request
path depends on there being an active `AgentSkillVersion` at all -- the fallback in
step 2 means a bad promotion degrades to "back to the old hardcoded prompt," not
an outage.
