import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkLoginLimitAgainst,
  recordFailedLoginAgainst,
  resetLoginRateLimitAgainst,
  formatLoginRateLimitMessage,
  normalizeLoginEmail,
  type LoginLimitStore,
} from './kv'

// In-memory fake of the Redis-backed LoginLimitStore, so the rate-limit
// logic itself can be exercised without a live Upstash connection.
function fakeStore(): LoginLimitStore {
  const counts = new Map<string, number>()
  const expiresAt = new Map<string, number>()
  const now = () => Date.now() / 1000
  return {
    async get(key) {
      return counts.get(key) ?? null
    },
    async incr(key) {
      const v = (counts.get(key) ?? 0) + 1
      counts.set(key, v)
      return v
    },
    async expire(key, seconds) {
      expiresAt.set(key, now() + seconds)
    },
    async ttl(key) {
      const exp = expiresAt.get(key)
      if (exp == null) return -1
      return Math.max(0, Math.round(exp - now()))
    },
    async del(key) {
      counts.delete(key)
      expiresAt.delete(key)
    },
  }
}

test('30 different accounts sign in successfully from one IP without ever being limited', async () => {
  const store = fakeStore()
  const ip = '203.0.113.5'
  for (let i = 0; i < 30; i++) {
    const email = `pupil${i}@school.ac.uk`
    const status = await checkLoginLimitAgainst(store, email, ip)
    assert.equal(status.limited, false, `pupil${i} should not be limited`)
    // Successful sign-in — nothing recorded.
  }
})

test('5 failed attempts lock that account+IP only, a 6th is refused', async () => {
  const store = fakeStore()
  const email = 'mia.adams@omnisdemo.school'
  const ip = '203.0.113.9'

  for (let i = 0; i < 5; i++) {
    const status = await checkLoginLimitAgainst(store, email, ip)
    assert.equal(status.limited, false, `attempt ${i + 1} should be allowed`)
    await recordFailedLoginAgainst(store, email, ip) // simulates a wrong password
  }

  const sixth = await checkLoginLimitAgainst(store, email, ip)
  assert.equal(sixth.limited, true)
  assert.ok((sixth.retryAfterSeconds ?? 0) > 0)
})

test('a different account from the same IP still signs in after one account is locked', async () => {
  const store = fakeStore()
  const ip = '203.0.113.9'
  for (let i = 0; i < 6; i++) {
    await recordFailedLoginAgainst(store, 'locked.pupil@omnisdemo.school', ip)
  }
  const locked = await checkLoginLimitAgainst(store, 'locked.pupil@omnisdemo.school', ip)
  assert.equal(locked.limited, true)

  const otherAccount = await checkLoginLimitAgainst(store, 'other.pupil@omnisdemo.school', ip)
  assert.equal(otherAccount.limited, false)
})

test('successful sign-ins do not consume the limit', async () => {
  const store = fakeStore()
  const email = 'teacher@omnisdemo.school'
  const ip = '203.0.113.9'

  for (let i = 0; i < 50; i++) {
    const status = await checkLoginLimitAgainst(store, email, ip)
    assert.equal(status.limited, false)
    // No recordFailedLoginAgainst call — this is the "signed in fine" path.
  }
})

test('a success resets the account+IP counter but leaves the coarse per-IP counter alone', async () => {
  const store = fakeStore()
  const email = 'mia.adams@omnisdemo.school'
  const ip = '203.0.113.9'

  await recordFailedLoginAgainst(store, email, ip)
  await recordFailedLoginAgainst(store, email, ip)
  await resetLoginRateLimitAgainst(store, email, ip)

  const afterReset = await checkLoginLimitAgainst(store, email, ip)
  assert.equal(afterReset.limited, false)

  // Recording 2 failures then resetting should not have reset the whole
  // store — a fresh set of failures still only needs 5 more to lock again.
  for (let i = 0; i < 5; i++) await recordFailedLoginAgainst(store, email, ip)
  const relocked = await checkLoginLimitAgainst(store, email, ip)
  assert.equal(relocked.limited, true)
})

test('100 failed attempts across many accounts on one IP trips the coarse IP ceiling', async () => {
  const store = fakeStore()
  const ip = '203.0.113.200'

  for (let i = 0; i < 100; i++) {
    await recordFailedLoginAgainst(store, `attacker${i}@example.com`, ip)
  }

  const next = await checkLoginLimitAgainst(store, 'attacker100@example.com', ip)
  assert.equal(next.limited, true, 'a 101st distinct account from the same IP should hit the coarse per-IP ceiling')
})

test('email normalisation keys the per-account limit regardless of case/whitespace', () => {
  assert.equal(normalizeLoginEmail('  Mia.Adams@OmnisDemo.School  '), 'mia.adams@omnisdemo.school')
})

test('rate-limit message states minutes, not the wrong-password text', () => {
  assert.equal(formatLoginRateLimitMessage(60), 'Too many attempts. Please try again in 1 minute.')
  assert.equal(formatLoginRateLimitMessage(601), 'Too many attempts. Please try again in 11 minutes.')
  assert.equal(formatLoginRateLimitMessage(undefined), 'Too many attempts. Please try again in 15 minutes.')
})
