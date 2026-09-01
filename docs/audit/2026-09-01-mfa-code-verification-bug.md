# Incident — Staff MFA broken in production (2026-09-01)

**Severity:** High — blocked every staff sign-in from the moment
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` were added to
production. Staff MFA (email one-time code) had never actually run against
a real Redis instance before that — `mfaInfraAvailable()` gates the whole
code path on Redis being configured, so it was silently skipped entirely
until today.

**Symptom:** Requesting a sign-in code, receiving it by email, and entering
the exact code shown always produced *"Invalid or expired code. Try
again."*

## Root cause

`lib/kv.ts`'s `verifyAndConsumeMfaCode()` compared the value read back from
Redis against the submitted code with strict inequality:

```ts
const stored = await redis.get<string>(`mfa:${userId}`)
if (!stored || stored !== code) return false
```

`redis.get<string>()`'s type parameter is a TypeScript-only assertion — it
has no effect at runtime. The `@upstash/redis` client's default
`automaticDeserialization` runs every GET result through `JSON.parse()`.
Every MFA code is a 6-digit numeric string (`generateCode()` in
`app/actions/mfa.ts`, always `100000`–`999999`, never a leading zero, so it
always parses as a valid JSON integer). `JSON.parse("482913")` returns the
JavaScript **number** `482913`, not the string `"482913"` — so `stored`
came back as a `number` while `code` (from the login form) is always a
`string`. `number !== string` is always `true` under strict inequality,
regardless of whether the code was actually correct — every real code was
rejected, 100% of the time, by design of the comparison, not intermittently.

## Live reproduction against real production Upstash

Ran `scripts/test-mfa-code-roundtrip.mjs` directly against the production
Redis instance (`wanted-walrus-276752.upstash.io`), using a throwaway
diagnostic key (`mfa:__regression_test__`, never a real userId), cleaned up
afterward:

```
Test code written: "418782" string
Read back via redis.get(): 418782 — runtime type: number
Old comparison (stored === code): false   <-- the bug, reproduced exactly
Fixed comparison (String(stored) === code): true
PASS
```

Confirms the exact failure mode: a correctly-stored, correctly-submitted
code fails the old comparison every time.

## Fix

`lib/kv.ts`'s `verifyAndConsumeMfaCode()` now coerces both sides through
`String()` before comparing, which is correct regardless of which runtime
type Redis happens to hand back:

```ts
const stored = await redis.get<string | number>(`mfa:${userId}`)
if (stored == null || String(stored) !== code) return false
```

No changes needed to `storeMfaCode()`, `app/actions/mfa.ts`, or
`lib/auth.ts`'s `authorize()` — all three were already correct; the bug was
isolated entirely to this one comparison.

## Regression test

`scripts/test-mfa-code-roundtrip.mjs` — standalone script (no unit-test
framework exists in this repo; this follows the existing `scripts/`
convention). Writes a real numeric-string value through the actual
`@upstash/redis` client, reads it back, prints the runtime type, and
asserts the fixed comparison accepts it. Safe to re-run anytime against any
Redis instance the app uses (dev or production) — never touches a real
`userId`, always cleans up its own test key. Can also be pointed at a
*different* Redis provider in future without needing this specific bug to
still exist to be useful — it directly validates the type-safety of the
comparison logic against whatever `@upstash/redis` actually does at
runtime, which is exactly what a plain code review of `lib/kv.ts` would not
have caught (the bug is invisible from reading the TypeScript alone, since
the `<string>` type parameter is a lie the compiler has no way to check).

## Verification

- `npx tsc --noEmit` — exit 0.
- `npm run build` — exit 0.
- Live-reproduced and fix confirmed against real production Upstash Redis
  (above).
- End-to-end real staff sign-in with MFA: **confirm after deploy** — this
  step needs a real staff password, which this session never requests or
  handles; Ivan to confirm directly against `omnis.education` once this
  fix is deployed.
