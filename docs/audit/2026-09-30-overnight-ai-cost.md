# Overnight AI jobs: spend limited to live schools (30 Sep 2026)

## Finding
The API credit fell from $60 to $4 in about seven weeks, although no real pupils are on the platform.
The database showed about 14,000 overnight agent runs in the last 30 days:

| School | Runs | Share |
|---|---|---|
| Omnis Demo School (182 pupils) | about 12,000 | about 85% |
| Oakfield Academy (synthetic test school) | about 2,200 | about 15% |
| Real schools | none (there are none yet) | 0% |

The jobs were: plan synthesis about 7,300, quality about 4,500, coach about 2,000, engage about 430.
Each pupil was re-analysed nightly. The weekly `demo-advance` job also marked demo pupils as changed and called
Sonnet to write demo questions.

## Change
- New `lib/ai/agent-schools.ts`: the overnight AI jobs run only for schools with the **`ai_agents`** feature flag
  switched on. It is off by default and is set in **Platform admin → Schools → Feature flags → "Overnight AI agents"**.
- The agent-coach, agent-quality, agent-plan-synthesis and agent-engage crons use `getAiAgentSchools()`.
- The early-warning cron:
  - The evidence agent (AI-only) now runs only for flagged schools.
  - The adaptive-profile refresh still runs for everyone, but its AI summary is skipped for unflagged schools
    (`computeAndSaveAdaptiveProfile(…, { allowAi })`). Staff-initiated calls are unchanged.
- `demo-advance`: AI question generation only runs if the environment variable `DEMO_ADVANCE_AI=on` is set in Coolify.
  Otherwise the demo homework step is skipped and existing demo content stays.
- Staff-initiated AI (generating homework, ILPs, marking) is **not** affected in any school.

## At trial start
Switch on "Overnight AI agents" for the trial school only. Expected spend is then proportionate to real pupils.
