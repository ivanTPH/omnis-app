-- Applied directly to the "Ivan Omnis" Supabase project on 2026-08-25 via the
-- Supabase MCP migration tool, then reconciled into this migration file on
-- 2026-08-26 (see schema.prisma's AgentOptimizationRun/AgentSkillVersion models
-- and ResourceVersion's editSource/editDistance/diffSummary fields).
--
-- This file is already applied to the database. Do not run `prisma migrate dev`
-- against it without first running:
--   npx prisma migrate resolve --applied 20260826150000_add_dspy_agent_skill_optimization
-- otherwise Prisma will try to re-run it and fail (tables/columns already exist).

CREATE TABLE "AgentOptimizationRun" (
  "id" text PRIMARY KEY,
  "triggeredBy" text NOT NULL,
  "status" text NOT NULL DEFAULT 'running',
  "skillsTargeted" jsonb NOT NULL,
  "summary" jsonb,
  "errorMessage" text,
  "startedAt" timestamp without time zone NOT NULL DEFAULT now(),
  "finishedAt" timestamp without time zone
);

CREATE TABLE "AgentSkillVersion" (
  "id" text PRIMARY KEY,
  "agentType" "AgentType" NOT NULL,
  "skillId" "AgentSkillId" NOT NULL,
  "version" integer NOT NULL,
  "instructions" text NOT NULL,
  "demonstrations" jsonb NOT NULL DEFAULT '[]',
  "metricScore" double precision,
  "metricBreakdown" jsonb,
  "trainingExampleCount" integer NOT NULL DEFAULT 0,
  "optimizerRunId" text REFERENCES "AgentOptimizationRun"("id"),
  "isActive" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
  "promotedAt" timestamp without time zone,
  UNIQUE ("agentType", "skillId", "version")
);
CREATE INDEX "AgentSkillVersion_active_idx" ON "AgentSkillVersion" ("agentType", "skillId", "isActive");

ALTER TABLE "ResourceVersion" ADD COLUMN "editSource" text;
ALTER TABLE "ResourceVersion" ADD COLUMN "editDistance" integer;
ALTER TABLE "ResourceVersion" ADD COLUMN "diffSummary" jsonb;

INSERT INTO "ConsentPurpose" ("id", "schoolId", "slug", "title", "description", "lawfulBasis", "isActive", "createdAt")
SELECT
  'cp_ai_decision_' || s."id", s."id", 'ai-decision-support',
  'AI-Assisted Educational Decision Support',
  'Use of AI agents (Coach, Quality, Plan Synthesis, Evidence, Engage) to draft or recommend homework, resource adaptations, K Plan / ILP targets, and engagement plans. All such outputs are reviewed by a qualified member of staff before being acted on; a full explanation of how each recommendation was produced is available on request.',
  'legitimate_interest', true, now()
FROM "School" s
WHERE NOT EXISTS (
  SELECT 1 FROM "ConsentPurpose" cp WHERE cp."schoolId" = s."id" AND cp."slug" = 'ai-decision-support'
);

-- RLS was initially missed on the two new tables (2026-08-26 security review) —
-- enabled here for consistency with every other table in the schema. Since the
-- app connects as the table owner via Prisma, this has no effect on the app
-- itself; it only blocks Supabase's public REST API (anon/authenticated roles).
ALTER TABLE "AgentOptimizationRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentSkillVersion" ENABLE ROW LEVEL SECURITY;
