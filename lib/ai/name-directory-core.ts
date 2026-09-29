/** Pure helper: turns a list of people into the name sets used by the pseudonymiser. */
import type { NameDirectory } from './pseudonymise'

export type Person = { firstName: string | null; lastName: string | null }

function clean(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ')
}

export function buildDirectory(people: Person[]): NameDirectory {
  const fullNames = new Set<string>()
  const firstNames = new Set<string>()
  const lastNames = new Set<string>()
  for (const p of people) {
    const first = clean(p.firstName)
    const last = clean(p.lastName)
    // Only names starting with a capital letter can be matched safely.
    if (first.length >= 2 && /^\p{Lu}/u.test(first)) {
      // A multi-word first name ("Mary Anne") is covered via the full name;
      // its first word is still treated as a first name on its own.
      firstNames.add(first.split(' ')[0])
    }
    if (last.length >= 2 && /^\p{Lu}/u.test(last)) lastNames.add(last.split(' ').pop()!)
    if (first && last) {
      fullNames.add(`${first} ${last}`)
      // Also the two-word form used by the matcher for multi-word names.
      fullNames.add(`${first.split(' ')[0]} ${last.split(' ').pop()}`)
    }
  }
  return { fullNames, firstNames, lastNames }
}

