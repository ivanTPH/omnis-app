/**
 * Explicit per-request timeout + retry options for Anthropic SDK calls in the
 * homework and ILP/EHCP generation pipelines.
 *
 * Without this, the SDK's own default (`BaseAnthropic.DEFAULT_TIMEOUT`, 10
 * minutes) is the only thing bounding a hung call. Next.js Server Actions
 * have no platform-level duration cap on this deployment (Coolify — a
 * persistent Node server, not Vercel serverless functions), so a genuinely
 * hung Anthropic call would otherwise hold a request open for up to 10
 * minutes, with the user seeing an indefinite spinner and no error.
 *
 * The SDK retries a timed-out request by default (`maxRetries: 2`, so up to
 * 3 attempts) — verified live: a 50ms timeout with the SDK default actually
 * took ~1.5s to finally reject, not 50ms. Both option sets below also pin
 * `maxRetries: 1` so the worst case is a bounded "timeout × 2" (one retry),
 * not "timeout × 3" — still lets a single transient blip recover, without
 * turning a short configured timeout into a much longer real-world wait.
 *
 * See evidence/phase6-load-resilience/failure-tests.md.
 */

/** Single client.messages.create() calls — ILP/EHCP/K-Plan/APDR generation,
 *  progress reports, and the non-streaming homework-content fallback.
 *  Worst case ≈ 120s (60s × 2 attempts) before the caller sees a result. */
export const AI_ONE_SHOT_OPTS = { timeout: 60_000, maxRetries: 1 } as const

/** client.messages.stream() calls in the two SSE generation routes. Kept
 *  under each route's own `maxDuration`, and close to the client-side 45s
 *  stale-stream guard in lib/ai-stream.ts so the server doesn't keep holding
 *  a connection open long after the client has already given up. Bounds
 *  time-to-first-response; the client-side stale-stream guard remains the
 *  primary defence against a stream that starts but then stalls mid-flight.
 *  Worst case ≈ 90s (45s × 2 attempts) before the server gives up. */
export const AI_STREAM_OPTS = { timeout: 45_000, maxRetries: 1 } as const
