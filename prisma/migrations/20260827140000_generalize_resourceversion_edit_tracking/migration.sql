-- Applied directly to the "Ivan Omnis" Supabase project on 2026-08-27 via the
-- Supabase MCP migration tool, then reconciled into this migration file the
-- same session (see schema.prisma's ResourceVersion.resourceId comment).
--
-- Purpose: dspy-service/INTEGRATION.md's Step 1 ("Record teacher edits") calls
-- for a ResourceVersion write on any edited AI-generated content -- the homework
-- question editor, K Plan/ILP target edits, resource adaptation, etc. -- keyed
-- generically by "resourceId". The migration that originally created this table
-- (20260826150000) gave resourceId a hard foreign key to Resource, which makes
-- it unusable for non-Resource content (an IlpTarget.id would violate the FK).
-- dspy-service/data.py never relied on referential integrity here -- it joins
-- loosely via AgentAuditEntry.inputRefs->>'resourceId' -- so dropping the FK
-- brings the schema in line with how this table is actually meant to be used.
--
-- This file is already applied to the database. Do not run `prisma migrate dev`
-- against it without first running:
--   npx prisma migrate resolve --applied 20260827140000_generalize_resourceversion_edit_tracking
-- otherwise Prisma will try to re-run it and fail (constraint already dropped).

ALTER TABLE "ResourceVersion" DROP CONSTRAINT "ResourceVersion_resourceId_fkey";
