/**
 * Matching MIS (Wonde) pupils to Omnis student accounts.
 *
 * Pupils are matched ONLY by their Wonde ID (User.wondeId). Matching by name
 * is unsafe: two pupils with the same name would have their SEND,
 * attendance and behaviour data mixed up, and an invitation could reach the
 * wrong child.
 *
 * The one exception is claiming a legacy account (created before wondeId
 * existed, e.g. demo data or a CSV import): an account with no wondeId is
 * linked to a Wonde pupil only when exactly one pupil and exactly one
 * unlinked account share that name in the school. Ambiguous names are left
 * unmatched and reported, so a person can sort them out.
 *
 * Pure function — no database access — so it can be unit tested.
 */

export interface MisPupil { id: string; firstName: string; lastName: string }
export interface StudentAccount { id: string; firstName: string; lastName: string; wondeId: string | null }

export interface MatchResult {
  /** Wonde pupil ID → Omnis user ID, for every pupil with an account. */
  byWondeId: Map<string, string>
  /** Legacy accounts to link: set User.wondeId = wondeId. */
  claims: Array<{ userId: string; wondeId: string }>
  /** Pupils with no account yet (create one). */
  unmatched: MisPupil[]
  /** Pupils whose name matched more than one pupil or account — not linked, needs a person. */
  ambiguous: MisPupil[]
}

export function nameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`
}

export function matchPupilsToAccounts(pupils: MisPupil[], accounts: StudentAccount[]): MatchResult {
  const byWondeId = new Map<string, string>()
  const claims: MatchResult['claims'] = []
  const unmatched: MisPupil[] = []
  const ambiguous: MisPupil[] = []

  const linked = new Map<string, string>()
  for (const a of accounts) if (a.wondeId) linked.set(a.wondeId, a.id)

  // Legacy (unlinked) accounts grouped by name
  const legacyByName = new Map<string, StudentAccount[]>()
  for (const a of accounts) {
    if (a.wondeId) continue
    const k = nameKey(a.firstName, a.lastName)
    legacyByName.set(k, [...(legacyByName.get(k) ?? []), a])
  }
  // Pupils still needing a match, grouped by name
  const pupilsByName = new Map<string, number>()
  for (const p of pupils) {
    if (linked.has(p.id)) continue
    const k = nameKey(p.firstName, p.lastName)
    pupilsByName.set(k, (pupilsByName.get(k) ?? 0) + 1)
  }

  for (const p of pupils) {
    const existing = linked.get(p.id)
    if (existing) { byWondeId.set(p.id, existing); continue }

    const k = nameKey(p.firstName, p.lastName)
    const candidates = legacyByName.get(k) ?? []
    if (candidates.length === 0) { unmatched.push(p); continue }
    if (candidates.length === 1 && pupilsByName.get(k) === 1) {
      claims.push({ userId: candidates[0].id, wondeId: p.id })
      byWondeId.set(p.id, candidates[0].id)
      continue
    }
    ambiguous.push(p)
  }

  return { byWondeId, claims, unmatched, ambiguous }
}
