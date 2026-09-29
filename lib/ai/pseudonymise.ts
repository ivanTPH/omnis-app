/**
 * Pseudonymisation for outgoing AI requests.
 *
 * Before any prompt leaves Omnis for the AI provider, every known person name
 * (pupils, parents/carers, staff) is swapped for a short code such as [N3].
 * The code-to-name key lives only in memory for the length of one request and
 * is never sent or stored. When the response comes back the codes are
 * swapped back, so callers and users see real names as before.
 *
 * Also removed (and not restored): email addresses and UK phone numbers.
 *
 * This file is pure (no database access) so it can be unit-tested; the name
 * list is supplied by lib/ai/name-directory.ts.
 */

export interface NameDirectory {
  /** Full "First Last" strings, e.g. "Sophia Ahmed". */
  fullNames: Set<string>
  /** First names that may be redacted on their own. */
  firstNames: Set<string>
  /** Surnames — only redacted on their own after a title (Mr/Ms/…). */
  lastNames: Set<string>
}

/**
 * Names that are also everyday English words (or common in curriculum text).
 * These are only ever redacted as part of a full name, never on their own,
 * so prompts like "Mark scheme" or "Will you…" are left intact.
 */
export const COMMON_WORD_NAMES = new Set([
  'Mark', 'Will', 'May', 'June', 'April', 'August', 'Grace', 'Hope', 'Faith', 'Joy',
  'Summer', 'Autumn', 'Winter', 'Rose', 'Lily', 'Daisy', 'Holly', 'Ivy', 'Iris', 'Poppy',
  'Ruby', 'Amber', 'Pearl', 'Jade', 'Crystal', 'Dawn', 'Eve', 'Sky', 'River', 'Storm',
  'Ray', 'Miles', 'Chase', 'Hunter', 'Guy', 'Frank', 'Earl', 'Rich', 'Bill', 'Art',
  'Sunny', 'Honey', 'Star', 'Angel', 'Hero', 'Reign', 'Royal', 'Noble', 'Justice',
  'Harmony', 'Melody', 'Liberty', 'Bliss', 'Cherry', 'Olive', 'Sage', 'Rowan', 'Ash',
  'Clay', 'Reed', 'Rock', 'Stone', 'Brook', 'Heath', 'Dale', 'Glen', 'Grant', 'Pat',
  'Sue', 'Don', 'Drew', 'Wade', 'Lane', 'Page', 'Price', 'Rice', 'Young', 'Long', 'Short',
  'English', 'French', 'Welsh', 'Scott', 'Irish', 'German', 'Maths', 'Science', 'History',
  'Art', 'Music', 'Drama', 'Year', 'Term', 'Unit', 'Lesson', 'Class', 'Student', 'Teacher',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'September', 'October', 'November', 'December',
  'The', 'A', 'An', 'I', 'Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Mx', 'Sir',
])

const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Mx', 'Dr', 'Sir']

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// UK numbers: 07xxx xxxxxx, 01xxx/02xxx landlines, +44 forms. Deliberately
// requires 10–11 digits so years, scores and IDs are left alone.
const PHONE_RE = /(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s-]?){9,10}\b/g

// A name word: capital letter then letters/hyphens, optionally an internal
// apostrophe part ("O'Brien"). Unicode-aware so "Zoë" and "José" work.
const W = "\\p{Lu}[\\p{L}-]*(?:['’]\\p{Lu}[\\p{L}-]*)?"
// Unicode-aware word boundaries (\b only understands ASCII letters).
const B0 = '(?<![\\p{L}\\p{N}])'
const B1 = '(?![\\p{L}\\p{N}])'

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export class Pseudonymiser {
  private toCode = new Map<string, string>()
  private toName = new Map<string, string>()
  private n = 0

  constructor(private dir: NameDirectory) {}

  private codeFor(original: string): string {
    let code = this.toCode.get(original)
    if (!code) {
      this.n++
      code = `[N${this.n}]`
      this.toCode.set(original, code)
      this.toName.set(code, original)
    }
    return code
  }

  /** How many distinct names were replaced so far (for logging/tests). */
  get replacedCount(): number {
    return this.toCode.size
  }

  /** Replace personal data in one string. */
  redact(text: string): string {
    if (!text) return text
    let out = text.replace(EMAIL_RE, '[email removed]').replace(PHONE_RE, '[phone removed]')

    // 1. Full names ("First Last"), longest first so "Mary Anne Smith"-style
    //    overlaps are handled before shorter matches. Only names that actually
    //    appear are considered, found via capitalised word pairs.
    const found = new Set<string>()
    // Apostrophes are deliberately not part of a name, so "Sophia's" matches "Sophia".
    const pairRe = new RegExp(`(?=${B0}(${W})\\s+(${W})${B1})`, 'gu')
    for (const m of out.matchAll(pairRe)) {
      const full = `${m[1]} ${m[2]}`
      if (this.dir.fullNames.has(full)) found.add(full)
    }
    // Three-word names ("Mary Anne Smith").
    const tripleRe = new RegExp(`(?=${B0}(${W})\\s+(${W})\\s+(${W})${B1})`, 'gu')
    for (const m of out.matchAll(tripleRe)) {
      const full = `${m[1]} ${m[2]} ${m[3]}`
      if (this.dir.fullNames.has(full)) found.add(full)
    }
    for (const full of [...found].sort((a, b) => b.length - a.length)) {
      out = out.replace(new RegExp(`${B0}${escapeRe(full)}${B1}`, 'gu'), this.codeFor(full))
    }

    // 2. Title + surname ("Mr Patel", "Ms. Patel").
    out = out.replace(
      new RegExp(`${B0}(${TITLES.join('|')})\\.?\\s+(${W})${B1}`, 'gu'),
      (whole, _title: string, last: string) =>
        this.dir.lastNames.has(last) ? this.codeFor(whole) : whole,
    )

    // 3. First names on their own (not everyday words).
    out = out.replace(new RegExp(`${B0}\\p{Lu}[\\p{Ll}-]+${B1}`, 'gu'), (word) =>
      this.dir.firstNames.has(word) && !COMMON_WORD_NAMES.has(word) ? this.codeFor(word) : word,
    )

    return out
  }

  /** Swap codes back to the original names. */
  restore(text: string): string {
    if (!text || this.toName.size === 0) return text
    return text
      .replace(/\[N(\d+)\]/g, (code) => this.toName.get(code) ?? code)
      // Tolerate the model dropping the brackets ("N3"), only for codes we issued.
      .replace(/\bN(\d+)\b/g, (whole, d: string) => this.toName.get(`[N${d}]`) ?? whole)
  }

  /** Longest code issued, used by the streaming restorer's hold-back. */
  get maxCodeLength(): number {
    return `[N${this.n}]`.length
  }
}

/**
 * Restores codes in streamed text chunks. A code can be split across two
 * chunks ("[N" + "3]"), so the tail of each chunk that could be the start of
 * a code is held back until the next chunk (or flush()).
 */
export class StreamRestorer {
  private pending = ''
  constructor(private p: Pseudonymiser) {}

  push(chunk: string): string {
    this.pending += chunk
    // Hold back from the last "[" or trailing "N<digits>" that might be unfinished.
    let cut = this.pending.length
    const lastBracket = this.pending.lastIndexOf('[')
    if (lastBracket !== -1 && this.pending.indexOf(']', lastBracket) === -1 &&
        this.pending.length - lastBracket <= this.p.maxCodeLength) {
      cut = lastBracket
    } else {
      const tail = /N\d*$/.exec(this.pending)
      if (tail) cut = tail.index
    }
    const ready = this.pending.slice(0, cut)
    this.pending = this.pending.slice(cut)
    return this.p.restore(ready)
  }

  flush(): string {
    const rest = this.p.restore(this.pending)
    this.pending = ''
    return rest
  }
}
