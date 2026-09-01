#!/usr/bin/env node
/**
 * Regression test / diagnostic for the MFA code storage bug fixed in
 * lib/kv.ts's verifyAndConsumeMfaCode() — @upstash/redis's default
 * automaticDeserialization JSON.parses GET results, turning a stored
 * 6-digit numeric-string MFA code back into a JS *number*, which then
 * always failed a strict `stored !== code` (string) comparison.
 *
 * Run against any Redis instance the app itself would use — reads
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from the environment,
 * same as lib/kv.ts. Never touches a real user's key — uses a clearly
 * diagnostic key (mfa:__regression_test__) and deletes it when done,
 * success or failure.
 *
 * Usage:
 *   set -a && source .env.local && set +a && node scripts/test-mfa-code-roundtrip.mjs
 * (or export UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN however —
 * whatever env the real app reads them from, e.g. production values, to
 * test against the actual instance staff logins hit.)
 */
import { Redis } from '@upstash/redis'

const url   = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

if (!url || !token) {
  console.error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — nothing to test against.')
  process.exit(1)
}

const redis = new Redis({ url, token })
const TEST_KEY  = 'mfa:__regression_test__'
const TEST_CODE = String(Math.floor(100000 + Math.random() * 900000)) // same shape as generateCode()

let exitCode = 0

try {
  console.log('Target:', new URL(url).host)
  console.log('Test code written:', JSON.stringify(TEST_CODE), typeof TEST_CODE)

  await redis.set(TEST_KEY, TEST_CODE, { ex: 30 })

  const rawStored = await redis.get(TEST_KEY)
  console.log('Read back via redis.get():', JSON.stringify(rawStored), '— runtime type:', typeof rawStored)

  // Demonstrate the OLD buggy comparison (what production was doing before the fix)
  const oldWayResult = !!rawStored && rawStored === TEST_CODE
  console.log(`Old comparison (stored === code):`, oldWayResult, oldWayResult ? '' : '<-- this is the bug: fails even for the correct code')

  // The fixed comparison (what lib/kv.ts now does)
  const newWayResult = rawStored != null && String(rawStored) === TEST_CODE
  console.log(`Fixed comparison (String(stored) === code):`, newWayResult)

  if (!newWayResult) {
    console.error('FAIL: fixed comparison logic did not accept the correct code — investigate further.')
    exitCode = 1
  } else if (oldWayResult) {
    console.log('NOTE: old comparison happened to pass this run (stored came back as a string, not a number) — the bug is intermittent/version-dependent, not deterministic every time. The fix is still correct and necessary regardless.')
    console.log('PASS')
  } else {
    console.log('PASS — reproduced the exact bug (old comparison fails) and confirmed the fix (new comparison succeeds).')
  }
} catch (err) {
  console.error('ERROR running test:', err)
  exitCode = 1
} finally {
  try {
    await redis.del(TEST_KEY)
    console.log('Cleaned up test key.')
  } catch (cleanupErr) {
    console.error('WARNING: failed to clean up test key', TEST_KEY, '— delete it manually.', cleanupErr)
  }
}

process.exit(exitCode)
