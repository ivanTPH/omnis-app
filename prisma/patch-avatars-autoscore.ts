/**
 * One-time patch: set plausible autoScores on SUBMITTED submissions so the
 * homework marking UI can demonstrate the AI pre-fill feature.
 *
 * Note: avatarUrl is no longer seeded here — StudentAvatar generates
 * deterministic coloured initials client-side from the student's name.
 *
 * Run with: npx tsx --env-file=.env.local prisma/patch-avatars-autoscore.ts
 */
import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL ?? ''
const connUrl = dbUrl.includes('?') ? dbUrl + '&connection_limit=1' : dbUrl + '?connection_limit=1'
const prisma = new PrismaClient({ datasources: { db: { url: connUrl } } })

// Plausible autoScore distribution (for 9-point scale)
// Weighted towards middle scores to look realistic
const SCORES_POOL = [2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9]
function pickScore(idx: number) {
  return SCORES_POOL[idx % SCORES_POOL.length]
}

async function main() {
  // ── Set autoScore on SUBMITTED submissions ─────────────────────────────────
  const submitted = await prisma.submission.findMany({
    where: { status: 'SUBMITTED', autoScore: null },
    select: { id: true },
    orderBy: { submittedAt: 'asc' },
  })
  console.log(`Patching autoScore for ${submitted.length} SUBMITTED submissions…`)

  let scoreCount = 0
  for (let i = 0; i < submitted.length; i++) {
    const sub = submitted[i]
    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        autoScore:    pickScore(i),
        autoMarked:   true,
        autoFeedback: 'AI-generated feedback: This response demonstrates a good understanding of the topic. Consider expanding your analysis with more specific textual evidence to strengthen your argument.',
      },
    })
    scoreCount++
  }
  console.log(`✓ Set autoScore on ${scoreCount} SUBMITTED submissions`)

  console.log('\nPatch complete ✓')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
