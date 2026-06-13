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
