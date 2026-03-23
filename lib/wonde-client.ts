/**
 * Wonde API client
 * Docs: https://docs.wonde.com/
 * Base URL: https://api.wonde.com/v1.0
 */

const WONDE_BASE = 'https://api.wonde.com/v1.0'

export interface WondePageMeta {
  pagination: {
    total: number
    count: number
    per_page: number
    current_page: number
    links: { next?: string; previous?: string }
  }
}

export interface WondePage<T> {
  data: T[]
  meta: WondePageMeta
}

export interface WondeSchoolInfo {
  id: string
  name: string
  urn: number | null
  la_code: string | null
  establishment_number: string | null
  phase_of_education: { name: string } | null
  mis_provider: { name: string } | null
  has_timetables: boolean
  has_lesson_attendance: boolean
}

export interface WondeEmployee {
  id: string
  mis_id: string | null
  forename: string
  legal_forename: string | null
  surname: string
  legal_surname: string | null
  title: string | null
  email: string | null
  is_teacher: boolean
  updated_at: { date: string } | null
  subjects?: { data: Array<{ id: string; name: string }> }
}

export interface WondeStudent {
  id: string
  mis_id: string | null
  forename: string
  legal_forename: string | null
  surname: string
  legal_surname: string | null
  upn: string | null
  date_of_birth: { date: string } | null
  year: { data: { code: string; name: string } } | null
  form_group: { data: { id: string; name: string } | null } | null
  is_leaver: boolean
  updated_at: { date: string } | null
  contacts?: { data: WondeContact[] }
  photo?: { data: { viewed: string } | null }
}

export interface WondeContactRelationship {
  relationship: string | null
  parental_responsibility: boolean | null
  priority: number | null
  lives_with_pupil: boolean | null
  [key: string]: unknown
}

export interface WondeContact {
  id: string
  forename: string
  legal_forename: string | null
  surname: string
  legal_surname: string | null
  email: string | null
  telephone: string | null
  mobile: string | null
  /** API returns a nested object, not a plain string */
  relationship: WondeContactRelationship | string | null
}

export interface WondeGroup {
  id: string
  mis_id: string | null
  name: string
  description: string | null
  type: string | null
  updated_at: { date: string } | null
}

export interface WondeClass {
  id: string
  mis_id: string | null
  name: string
  subject?: { data: { id: string; name: string } | null }
  year?: { data: { code: string; name: string } | null }
  employee?: { data: WondeEmployee | null }
  group?: { data: WondeGroup | null }
  students?: { data: WondeStudent[] }
  updated_at: { date: string } | null
}

export interface WondePeriod {
  id: string
  name: string
  start_time: string | null
  end_time: string | null
  /** API returns a string like "monday" */
  day: string | null
  /** API returns a numeric day number (1=Mon…5=Fri) if available */
  day_number: number | null
}

export interface WondeTimetableEntry {
  id: string
  /** Flat string room name (not nested) */
  room: string | null
  effective_date: { date: string } | null
  /** Nested object only when include=class */
  class?: { data: WondeClass | null }
  /** Flat string employee ID (not nested) */
  employee: string | null
  /** Flat string period ID (not nested) */
  period: string | null
}

export interface WondeAssessmentResult {
  id: string
  subject?: { data: { name: string } | null }
  result_set?: { data: { name: string } | null }
  aspect?: { data: { name: string } | null }
  result: string | null
  grade?: { data: { value: string } | null }
  collection_date: { date: string } | null
  student?: { data: { id: string } | null }
}

// ── Core fetch with auth ──────────────────────────────────────────────────────

async function wondeFetch<T>(path: string, token: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${WONDE_BASE}${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    // Wonde calls can be slow on large datasets
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Wonde API ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

// ── Paginated fetch — collects all pages ──────────────────────────────────────

export async function wondeAll<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const queryString = new URLSearchParams(params).toString()
  const initialUrl = `${path}${queryString ? `?${queryString}` : ''}`

  const results: T[] = []
  let nextUrl: string | null = initialUrl

  while (nextUrl) {
    const page: WondePage<T> = await wondeFetch<WondePage<T>>(nextUrl, token)
    results.push(...page.data)

    const next: string | undefined = page.meta?.pagination?.links?.next
    nextUrl = next && next !== nextUrl ? next : null
  }

  return results
}

// ── Typed resource fetchers ───────────────────────────────────────────────────

export async function fetchWondeSchool(schoolId: string, token: string): Promise<WondeSchoolInfo> {
  const resp = await wondeFetch<{ data: WondeSchoolInfo }>(`/schools/${schoolId}`, token)
  return resp.data
}

export async function fetchWondeEmployees(schoolId: string, token: string): Promise<WondeEmployee[]> {
  return wondeAll<WondeEmployee>(`/schools/${schoolId}/employees`, token, {
    per_page: '200',
  })
}

export async function fetchWondeStudents(schoolId: string, token: string): Promise<WondeStudent[]> {
  return wondeAll<WondeStudent>(`/schools/${schoolId}/students`, token, {
    include: 'contacts,year,photo',
    per_page: '200',
  })
}

export async function fetchWondeGroups(schoolId: string, token: string): Promise<WondeGroup[]> {
  return wondeAll<WondeGroup>(`/schools/${schoolId}/groups`, token, {
    per_page: '200',
  })
}

export async function fetchWondeClasses(schoolId: string, token: string): Promise<WondeClass[]> {
  return wondeAll<WondeClass>(`/schools/${schoolId}/classes`, token, {
    include: 'students,subject',
    per_page: '100',
  })
}

export async function fetchWondePeriods(schoolId: string, token: string): Promise<WondePeriod[]> {
  return wondeAll<WondePeriod>(`/schools/${schoolId}/periods`, token, {
    per_page: '200',
  })
}

export async function fetchWondeTimetableEntries(schoolId: string, token: string): Promise<WondeTimetableEntry[]> {
  return wondeAll<WondeTimetableEntry>(`/schools/${schoolId}/lessons`, token, {
    include: 'class',
    per_page: '100',
  })
}
