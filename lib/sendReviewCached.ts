import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { reviewResource, type ReviewResult } from './sendReview'

function hashInputs(type: string, label: string, url?: string): string {
  const key = JSON.stringify({
    type:  type.toUpperCase(),
    label: label.toLowerCase().trim(),
    url:   url ? url.toLowerCase().trim() : null,
  })
  return createHash('sha256').update(key).digest('hex')
}

export async function sendReviewCached(params: {
  type:         string
  label:        string
  url?:         string
  description?: string
}): Promise<ReviewResult & { fromCache: boolean }> {
  const hash = hashInputs(params.type, params.label, params.url)

  // Try cache lookup — if the cache table doesn't exist yet, skip silently
  try {
    const cached = await prisma.sendScoreCache.findUnique({ where: { contentHash: hash } })
    if (cached) {
      // Best-effort hit-count update (ignore failures)
      prisma.sendScoreCache.update({
        where: { contentHash: hash },
        data:  { hitCount: { increment: 1 }, lastUsedAt: new Date() },
      }).catch(() => {})
      return {
        score:       cached.score,
        suggestions: cached.suggestions as string[],
        fromCache:   true,
      }
    }
  } catch {
    // Cache table not available — fall through to live review
  }

  // Call Claude API (or fallback if no API key)
  const result = await reviewResource(params)

  // Best-effort cache write — never block the caller on this
  prisma.sendScoreCache.upsert({
    where:  { contentHash: hash },
    create: { contentHash: hash, score: result.score, suggestions: result.suggestions },
    update: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
  }).catch(() => {})

  return { ...result, fromCache: false }
}
