-- Applied directly to the "Ivan Omnis" Supabase project on 2026-08-25 via the
-- Supabase MCP migration tool. Additive only: two new tables, three new nullable
-- columns on an existing-but-empty table, and one new ConsentPurpose row per school.
-- Nothing existing was altered or dropped.
--
-- IMPORTANT: this was applied as raw SQL, outside the app's normal Prisma
-- migration flow (there was no repo checked out in the session that built this).
-- Before your next `prisma migrate dev` / `db push`, reconcile schema.prisma with
-- what's now actually in the database -- either:
--   (a) run `npx prisma db pull` to introspect these tables into schema.prisma,
--       then hand-add the relations/enums DSPy code expects (see signatures.py's
--       AGENT_TYPES / AGENT_SKILL_MAP for the enum values used), or
--   (b) hand-write the equivalent Prisma models + a migration file that matches
--       this SQL exactly, then mark it resolved (`prisma migrate resolve --applied`)
--       so `_prisma_migrations` doesn't drift from the real schema.
-- Either way, do this before anyone on the team runs a Prisma migration that
-- Prisma thinks is starting from a schema without these tables -- it will try to
-- create them again and fail, or (worse) generate a diff that drops them.

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
