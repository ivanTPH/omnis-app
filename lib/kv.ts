/**
 * Upstash Redis + rate limiting — gracefully no-ops when env vars are absent.
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable.
 */
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

function createRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const redis = createRedis()

/**
 * Login rate limit: 5 attempts per 15 minutes per IP.
 * Returns { success: true } when no Redis is configured (fail-open).
 */
const loginRatelimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'rl:login' })
  : null

export async function checkLoginRatelimit(identifier: string): Promise<{ success: boolean; remaining?: number }> {
  if (!loginRatelimiter) return { success: true }
  const result = await loginRatelimiter.limit(identifier)
  return { success: result.success, remaining: result.remaining }
}

/**
 * Contact form rate limit: 5 submissions per hour per IP.
 */
const contactRatelimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'rl:contact' })
  : null

export async function checkContactRateLimit(identifier: string): Promise<{ success: boolean }> {
  if (!contactRatelimiter) return { success: true }
  const result = await contactRatelimiter.limit(identifier)
  return { success: result.success }
}

/**
 * AI generation rate limit: 30 requests per hour per user.
 */
const aiRatelimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'rl:ai' })
  : null

export async function checkAiRateLimit(identifier: string): Promise<{ success: boolean }> {
  if (!aiRatelimiter) return { success: true }
  const result = await aiRatelimiter.limit(identifier)
  return { success: result.success }
}

/**
 * Staff MFA (email one-time code) — ephemeral, stored in Redis only, no
 * schema changes needed. Codes expire after 5 minutes. Gracefully no-ops
 * when Redis isn't configured (same convention as the rate limiters above):
 * mfaInfraAvailable() lets callers decide whether to skip MFA entirely in
 * that case (dev/CI) rather than lock everyone out.
 */
const MFA_CODE_TTL_SECONDS = 5 * 60

export function mfaInfraAvailable(): boolean {
  return redis !== null
}

export async function storeMfaCode(userId: string, code: string): Promise<void> {
  if (!redis) return
  await redis.set(`mfa:${userId}`, code, { ex: MFA_CODE_TTL_SECONDS })
}

/**
 * Verifies the code and deletes it on success (single use).
 *
 * `redis.get<string>()`'s type parameter is a TypeScript-only assertion —
 * it does not affect the runtime value. The @upstash/redis client's default
 * `automaticDeserialization` JSON.parses every GET result, and every MFA
 * code is a 6-digit numeric string (generateCode() in app/actions/mfa.ts),
 * which JSON.parse happily turns into a JS *number* (e.g. stored "482913"
 * comes back as 482913, not "482913"). A strict `stored !== code` then
 * compares a number against `code` (always a string, from the login form) —
 * always unequal, so every correct code was being rejected. Coercing both
 * sides through String() before comparing fixes this regardless of which
 * type actually comes back. Confirmed live against production Upstash and
 * with a real end-to-end sign-in — see
 * scripts/test-mfa-code-roundtrip.mjs and the incident write-up this fix
 * shipped with.
 */
export async function verifyAndConsumeMfaCode(userId: string, code: string): Promise<boolean> {
  if (!redis) return true // infra unavailable — treat as satisfied, matches mfaInfraAvailable() gate upstream
  const stored = await redis.get<string | number>(`mfa:${userId}`)
  if (stored == null || String(stored) !== code) return false
  await redis.del(`mfa:${userId}`)
  return true
}

/**
 * Password reset rate limit: 3 requests per hour per IP.
 * Prevents email-bombing any address with reset emails.
 */
const passwordResetRatelimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '1 h'), prefix: 'rl:pwreset' })
  : null

export async function checkPasswordResetRateLimit(identifier: string): Promise<{ success: boolean }> {
  if (!passwordResetRatelimiter) return { success: true }
  const result = await passwordResetRatelimiter.limit(identifier)
  return { success: result.success }
}

/** Max 3 code requests per user per 10 minutes — prevents email-bombing a staff inbox. */
const mfaRatelimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, '10 m'), prefix: 'rl:mfa' })
  : null

export async function checkMfaRequestRateLimit(userId: string): Promise<{ success: boolean }> {
  if (!mfaRatelimiter) return { success: true }
  const result = await mfaRatelimiter.limit(userId)
  return { success: result.success }
}
