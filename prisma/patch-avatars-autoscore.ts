/**
 * One-time patch: set DiceBear avatarUrls on all Student users,
 * and set plausible autoScores on SUBMITTED submissions so the
 * homework marking UI can demonstrate the AI pre-fill feature.
 *
 * Run with: npx tsx --env-file=.env.local prisma/patch-avatars-autoscore.ts
 */
import { PrismaClient } from '@prisma/client'

const dbUrl = process.env.DATABASE_URL ?? ''
const connUrl = dbUrl.includes('?') ? dbUrl + '&connection_limit=1' : dbUrl + '?connection_limit=1'
const prisma = new PrismaClient({ datasources: { db: { url: connUrl } } })

function dicebearUrl(firstName: string, lastName: string) {
  const seed = encodeURIComponent(`${firstName}${lastName}`)
  return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

// Plausible autoScore distribution (for 9-point scale)
// Weighted towards middle scores to look realistic
const SCORES_POOL = [2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9]
function pickScore(idx: number) {
  return SCORES_POOL[idx % SCORES_POOL.length]
}

async function main() {
  // ── 1. Set avatarUrl on all STUDENT users ──────────────────────────────────
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
    select: { id: true, firstName: true, lastName: true },
  })
  console.log(`Patching avatarUrl for ${students.length} students…`)

  let avatarCount = 0
  for (const s of students) {
    await prisma.user.update({
      where: { id: s.id },
      data: { avatarUrl: dicebearUrl(s.firstName, s.lastName) },
    })
    avatarCount++
  }
  console.log(`✓ Set avatarUrl on ${avatarCount} students`)

  // ── 2. Set autoScore on SUBMITTED submissions ──────────────────────────────
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
