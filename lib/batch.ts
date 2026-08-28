/**
 * lib/batch.ts
 *
 * Bounded-concurrency runner for "do N independent units of work, but not
 * all N at once." Used where a strict sequential `for...await` loop risks
 * running out of time (the 4 nightly agent crons processing dozens of
 * schools one after another inside a single 300s serverless invocation),
 * but full unbounded `Promise.all` risks overwhelming a shared resource
 * (the Prisma connection pool, the Anthropic API rate limit).
 *
 * Each item's failure is isolated -- one item throwing never stops the
 * others, matching the pattern already used in lib/wonde-sync.ts's
 * inBatches() (kept separate there; this is the general-purpose version).
 */

export async function runBounded<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let cursor = 0

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, runNext)
  await Promise.all(workers)
}
