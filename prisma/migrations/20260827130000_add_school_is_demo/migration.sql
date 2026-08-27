-- Applied directly to the "Ivan Omnis" Supabase project on 2026-08-27 via the
-- Supabase MCP migration tool, then reconciled into this migration file the
-- same session (see schema.prisma's School.isDemo field).
--
-- Purpose: distinguish the synthetic demo/trial school from real schools so
-- dspy-service/data.py can exclude its scripted AgentAuditEntry rows (written
-- by app/api/cron/demo-advance/route.ts) from DSPy training data. See
-- docs/audit/2026-08-27-dspy-agent-skill-optimization.md.
--
-- This file is already applied to the database. Do not run `prisma migrate dev`
-- against it without first running:
--   npx prisma migrate resolve --applied 20260827130000_add_school_is_demo
-- otherwise Prisma will try to re-run it and fail (column already exists).

ALTER TABLE "School" ADD COLUMN "isDemo" boolean NOT NULL DEFAULT false;
CREATE INDEX "School_isDemo_idx" ON "School" ("isDemo");

-- One-time backfill: flag the existing demo school by its known name/domain.
-- Future demo schools should be created with isDemo = true explicitly rather
-- than relying on this heuristic.
UPDATE "School" SET "isDemo" = true WHERE "name" = 'Omnis Demo School' OR "emailDomain" = 'omnisdemo.school';
