/**
 * Omnis Inference Layer (Layer 3)
 *
 * Caches Claude agent outputs keyed by coarse student profile signatures.
 * Instead of calling Claude for every student, we:
 *   1. Build a bucketed profile signature (yearGroup × needArea × perf/retention tiers)
 *   2. Look up OmnisInferenceCache — if hit, inject cached advice into a shorter prompt
 *   3. On miss — full Claude call; extract + cache the generic SEND advice portion
 *
 * Profile signature clustering:
 *   ~49 meaningful types (7 year groups × 7 need areas × overlapping perf buckets).
 *   Cache saturates quickly; hits compound across schools as platform scales.
 *
 * Cache types:
 *   COACH_SEND_ADVICE — SEND-specific coaching advice for a profile type (TTL 30 days)
 *
 * Stats (tracked per entry):
 *   hitCount — how many times cached output was served
 *   estimatedSavingsUsd — computed at read time (~$0.0002 per hit at haiku pricing)
 */

import { createHash }  from 'crypto'
import { prisma }      from '@/lib/prisma'

// ── TTL config ────────────────────────────────────────────────────────────────

const TTL_DAYS: Record<string, number> = {
  COACH_SEND_ADVICE: 30,
}

// ── Signature types ───────────────────────────────────────────────────────────

export type CoachSignatureInputs = {
  yearGroup:       number | null
  needArea:        string | null
  sendStatus:      string | null
  performanceTier: 'high' | 'mid' | 'low'
  weakTopicBucket: '0' | '1-2' | '3+'
  retentionBucket: '0' | '1-2' | '3+'
}

// Cached portion of the coach output — generic across students with the same profile
export type CachedCoachSendAdvice = {
  sendSpecificAdvice: string    // 2-3 sentence SEND accommodation advice for this profile type
  preferredFormats:   string[]  // homework types that work best (e.g. ['MCQ_QUIZ'])
  bloomsRemediation:  string    // brief advice on Bloom's progression for this profile
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bucket3(n: number): '0' | '1-2' | '3+' {
  return n === 0 ? '0' : n <= 2 ? '1-2' : '3+'
}

function perfTier(avgScore: number): 'high' | 'mid' | 'low' {
  return avgScore >= 70 ? 'high' : avgScore >= 50 ? 'mid' : 'low'
}

// ── Signature builder ─────────────────────────────────────────────────────────

export function buildCoachSignature(
  student:            { yearGroup?: number | null; sendStatus?: string | null; needArea?: string | null },
  weakTopicCount:     number,
  retentionRiskCount: number,
  avgWeakScore:       number,
): { hash: string; inputs: CoachSignatureInputs } {
  const inputs: CoachSignatureInputs = {
    yearGroup:       student.yearGroup ?? null,
    needArea:        student.needArea   ?? null,
    sendStatus:      student.sendStatus ?? null,
    performanceTier: perfTier(avgWeakScore),
    weakTopicBucket: bucket3(weakTopicCount),
    retentionBucket: bucket3(retentionRiskCount),
  }
  // Sort keys for deterministic JSON; truncate to 16 hex chars (64 bits — more than enough
  // for ~49 distinct profile types)
  const hash = createHash('sha256')
    .update(JSON.stringify(inputs, Object.keys(inputs).sort()))
    .digest('hex')
    .slice(0, 16)
  return { hash, inputs }
}

// ── Cache read ────────────────────────────────────────────────────────────────

export async function lookupCoachAdvice(hash: string): Promise<CachedCoachSendAdvice | null> {
  const row = await (prisma.omnisInferenceCache as any).findUnique({
    where: { cacheType_signatureHash: { cacheType: 'COACH_SEND_ADVICE', signatureHash: hash } },
  })
  if (!row) return null
  if (new Date(row.expiresAt) < new Date()) return null  // expired

  // Increment hit count — fire-and-forget, never blocks the agent
  void (prisma.omnisInferenceCache as any).update({
    where: { cacheType_signatureHash: { cacheType: 'COACH_SEND_ADVICE', signatureHash: hash } },
    data:  { hitCount: { increment: 1 } },
  }).catch(() => {})

  return row.payload as CachedCoachSendAdvice
}

// ── Cache write ───────────────────────────────────────────────────────────────

export async function storeCoachAdvice(
  hash:   string,
  inputs: CoachSignatureInputs,
  advice: CachedCoachSendAdvice,
): Promise<void> {
  const ttl       = TTL_DAYS.COACH_SEND_ADVICE * 86_400_000
  const expiresAt = new Date(Date.now() + ttl)
  await (prisma.omnisInferenceCache as any).upsert({
    where:  { cacheType_signatureHash: { cacheType: 'COACH_SEND_ADVICE', signatureHash: hash } },
    update: { payload: advice, generatedAt: new Date(), expiresAt },
    create: {
      cacheType: 'COACH_SEND_ADVICE',
      signatureHash: hash,
      signature:     inputs,
      payload:       advice,
      expiresAt,
    },
  })
}

// ── Cache cleanup (called by early-warning cron) ──────────────────────────────

export async function purgeExpiredInferenceCache(): Promise<number> {
  const result = await (prisma.omnisInferenceCache as any).deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}

// ── Stats (for platform admin dashboard) ─────────────────────────────────────

export type InferenceStats = {
  totalEntries:        number
  totalHits:           number
  uniqueProfiles:      number
  estimatedSavingsUsd: number
  byType: Record<string, { entries: number; hits: number; estimatedSavingsUsd: number }>
  oldestEntry:         Date | null
  newestEntry:         Date | null
}

// Approximate token savings per cache hit:
// Coach prompt ~800 input tokens → cached = ~200 tokens (shorter prompt)
// Haiku input price ≈ $0.00025 / 1K tokens → 600 tokens saved ≈ $0.00015 per hit
const SAVINGS_PER_HIT_USD = 0.00015

export async function getInferenceStats(): Promise<InferenceStats> {
  const rows = await (prisma.omnisInferenceCache as any).findMany({
    select: { cacheType: true, hitCount: true, generatedAt: true },
  }) as Array<{ cacheType: string; hitCount: number; generatedAt: Date }>

  const totalEntries = rows.length
  const totalHits    = rows.reduce((s, r) => s + r.hitCount, 0)

  const byType: InferenceStats['byType'] = {}
  for (const r of rows) {
    if (!byType[r.cacheType]) byType[r.cacheType] = { entries: 0, hits: 0, estimatedSavingsUsd: 0 }
    byType[r.cacheType].entries++
    byType[r.cacheType].hits += r.hitCount
    byType[r.cacheType].estimatedSavingsUsd += r.hitCount * SAVINGS_PER_HIT_USD
  }

  const dates = rows.map(r => r.generatedAt.getTime())

  return {
    totalEntries,
    totalHits,
    uniqueProfiles:      totalEntries,
    estimatedSavingsUsd: totalHits * SAVINGS_PER_HIT_USD,
    byType,
    oldestEntry: dates.length ? new Date(Math.min(...dates)) : null,
    newestEntry: dates.length ? new Date(Math.max(...dates)) : null,
  }
}

// ── ILP Strategy Recommendations (per needArea, derived from platform data) ──
// These are computed without any Claude call during computePlatformInsights().
// TTL: 7 days (refreshes with weekly platform-insights cron).

export type IlpStrategyRec = {
  strategies:  string[]   // top strategies for this needArea, ordered by frequency
  schoolCount: number     // how many schools contributed (k-anon proof)
}

export async function lookupIlpStrategyRec(needArea: string): Promise<IlpStrategyRec | null> {
  const key = needArea.trim().toLowerCase()
  const row  = await (prisma.omnisInferenceCache as any).findUnique({
    where: { cacheType_signatureHash: { cacheType: 'ILP_STRATEGY_REC', signatureHash: key } },
  })
  if (!row || new Date(row.expiresAt) < new Date()) return null
  void (prisma.omnisInferenceCache as any).update({
    where: { cacheType_signatureHash: { cacheType: 'ILP_STRATEGY_REC', signatureHash: key } },
    data:  { hitCount: { increment: 1 } },
  }).catch(() => {})
  return row.payload as IlpStrategyRec
}

export async function storeIlpStrategyRec(needArea: string, rec: IlpStrategyRec): Promise<void> {
  const key       = needArea.trim().toLowerCase()
  const expiresAt = new Date(Date.now() + 7 * 86_400_000)
  await (prisma.omnisInferenceCache as any).upsert({
    where:  { cacheType_signatureHash: { cacheType: 'ILP_STRATEGY_REC', signatureHash: key } },
    update: { payload: rec, generatedAt: new Date(), expiresAt },
    create: {
      cacheType: 'ILP_STRATEGY_REC', signatureHash: key,
      signature: { needArea }, payload: rec, expiresAt,
    },
  })
}
