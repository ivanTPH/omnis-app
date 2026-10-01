/**
 * Which MIS classes Omnis brings in.
 *
 * A school's MIS holds every kind of group: teaching sets, form (registration
 * or tutor) groups, clubs, intervention groups and more. Omnis only needs:
 *   - teaching classes (always), minus any subjects the school leaves out;
 *   - form groups (optional, on by default), because tutors are often
 *     involved in SEND support and interventions.
 *
 * The school admin chooses on /admin/mis-review. The choice is stored on
 * School.misClassImport and applied at the next sync. Pure functions, no
 * database access, so they can be unit tested.
 */
import type { MisClass } from '@/lib/accounts/class-provisioning'

export type ClassImportSettings = {
  formGroups: boolean          // bring in form / registration / tutor groups
  excludedSubjects: string[]   // teaching subjects to leave out (lower case)
}

export const DEFAULT_CLASS_IMPORT: ClassImportSettings = { formGroups: true, excludedSubjects: [] }

export const FORM_SUBJECT = 'Form group'

const FORM_SUBJECT_RE = /^(reg|registration|form|form group|tutor|tutor group|tutorial|tutor time|pastoral|vertical tutor)\b/i

export function parseClassImport(raw: unknown): ClassImportSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    formGroups: typeof r.formGroups === 'boolean' ? r.formGroups : DEFAULT_CLASS_IMPORT.formGroups,
    excludedSubjects: Array.isArray(r.excludedSubjects)
      ? [...new Set(r.excludedSubjects.filter((s): s is string => typeof s === 'string').map(s => s.trim().toLowerCase()).filter(Boolean))]
      : [],
  }
}

export function subjectKey(subject: string | null | undefined): string {
  return (subject ?? '').trim().toLowerCase() || 'general'
}

/** A class is a form group if its subject says so, or its name is a pupil's form group. */
export function isFormClass(c: Pick<MisClass, 'name' | 'subject'>, formNames: Set<string>): boolean {
  if (c.subject && FORM_SUBJECT_RE.test(c.subject.trim())) return true
  return formNames.has(c.name.trim().toLowerCase())
}

/**
 * Form groups taken from pupils' MIS form group, for any form the MIS doesn't
 * already hold as a class. They have no teacher in the MIS; the admin assigns
 * the tutor on the Check MIS data page.
 */
export function formClassesFromPupils(
  schoolId: string,
  pupils: Array<{ id: string; formGroup: string | null; yearGroup: number | null }>,
  existingFormNames: Set<string>,
): MisClass[] {
  const byForm = new Map<string, { name: string; pupilIds: string[]; years: Array<number | null> }>()
  for (const p of pupils) {
    const name = p.formGroup?.trim()
    if (!name) continue
    const k = name.toLowerCase()
    if (existingFormNames.has(k)) continue
    if (!byForm.has(k)) byForm.set(k, { name, pupilIds: [], years: [] })
    const f = byForm.get(k)!
    f.pupilIds.push(p.id)
    f.years.push(p.yearGroup)
  }
  return [...byForm.entries()].map(([k, f]) => ({
    id: `form:${schoolId}:${k}`,
    name: f.name,
    subject: FORM_SUBJECT,
    yearGroup: null,
    pupilIds: f.pupilIds,
  }))
}

export type FilterResult = { included: MisClass[]; excludedSubjects: number; excludedForms: number }

/** Apply the school's choice to the MIS classes (form classes are labelled with FORM_SUBJECT). */
export function filterMisClasses(classes: MisClass[], settings: ClassImportSettings, formNames: Set<string>): FilterResult {
  const excluded = new Set(settings.excludedSubjects)
  const out: FilterResult = { included: [], excludedSubjects: 0, excludedForms: 0 }
  for (const c of classes) {
    if (isFormClass(c, formNames)) {
      if (!settings.formGroups) { out.excludedForms++; continue }
      out.included.push({ ...c, subject: FORM_SUBJECT })
      continue
    }
    if (excluded.has(subjectKey(c.subject))) { out.excludedSubjects++; continue }
    out.included.push(c)
  }
  return out
}
