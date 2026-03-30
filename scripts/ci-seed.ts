/**
 * scripts/ci-seed.ts
 *
 * CI-safe seed guard — only runs the main seed when the database is empty.
 * Prevents re-seeding (and thereby corrupting) the shared Supabase database
 * when the E2E workflow fires on every push to main.
 *
 * Run via: npm run db:seed:ci
 */

import { PrismaClient } from '@prisma/client'
import { execSync }     from 'child_process'

const prisma = new PrismaClient()

const count = await prisma.school.count()

if (count === 0) {
  console.log('Database is empty — running seed...')
  execSync('npx prisma db seed', { stdio: 'inherit' })
} else {
  console.log(`Database already has ${count} school(s) — skipping seed to preserve existing data.`)
}

await prisma.$disconnect()
