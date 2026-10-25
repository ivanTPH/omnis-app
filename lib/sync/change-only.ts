/**
 * Change-only syncing.
 *
 * Every synced row stores a hash of the data it was written from (syncHash).
 * A sync loads the existing hashes once, then writes a row only when it is new
 * or its data changed, and never asks the database to send the row back.
 * Unchanged records cost nothing: no write, no egress, no table bloat.
 */
import { createHash } from 'node:crypto'

/** Keys that change on every run and must not count as a change. */
const VOLATILE = new Set(['syncedAt', 'updatedAt', 'lastSeenAt', 'misLastSyncedAt', 'syncHash'])

function normalise(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(normalise)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      if (VOLATILE.has(k)) continue
      const x = (v as Record<string, unknown>)[k]
      if (x !== undefined) out[k] = normalise(x)
    }
    return out
  }
  return v
}

/** Stable hash of a record's data: key order, Dates and timestamps don't matter. */
export function stableHash(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(normalise(value))).digest('hex')
}

/** Counts what a sync step actually did. */
export type ChangeCounts = { written: number; unchanged: number }

/**
 * Writes `create`/`update` through `write` only when the record's hash differs
 * from the one already stored. The hash is added to both objects as syncHash.
 */
export async function writeIfChanged<C extends Record<string, unknown>, U extends Record<string, unknown>>(
  prev: Map<string, string | null>,
  key: string,
  create: C,
  update: U,
  write: (create: C & { syncHash: string }, update: U & { syncHash: string }) => Promise<unknown>,
  counts?: ChangeCounts,
): Promise<boolean> {
  const hash = stableHash(create)
  if (prev.get(key) === hash) { if (counts) counts.unchanged++; return false }
  await write({ ...create, syncHash: hash }, { ...update, syncHash: hash })
  prev.set(key, hash)
  if (counts) counts.written++
  return true
}

/** Builds the key → hash map from rows loaded with `select: { <key>: true, syncHash: true }`. */
export function hashMap<K extends string>(rows: Array<Record<K, string> & { syncHash: string | null }>, key: K): Map<string, string | null> {
  return new Map(rows.map(r => [r[key], r.syncHash]))
}

/** True when any of `fields` differs between the stored row and the new values. */
export function differs<T extends Record<string, unknown>>(stored: Partial<T> | undefined, next: T): boolean {
  if (!stored) return true
  return Object.keys(next).some(k => stableHash({ v: stored[k] ?? null }) !== stableHash({ v: next[k] ?? null }))
}
