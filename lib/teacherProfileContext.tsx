'use client'
/**
 * TeacherProfileContext
 *
 * Stores the logged-in teacher's assigned classes, subjects, and year groups.
 * Populated once in AppShell on mount via getTeacherDefaults() and shared
 * with all descendants — no per-page re-fetching needed.
 */
import { createContext, useContext } from 'react'

export type TeacherProfile = {
  /** All classes the teacher is assigned to */
  teacherClasses: { id: string; name: string; subject: string; yearGroup: number }[]
  /** Unique subjects, sorted alphabetically */
  teacherSubjects: string[]
  /** Unique year groups, sorted numerically */
  teacherYearGroups: number[]
  /** First / most common subject — use as dropdown default */
  defaultSubject: string
  /** First year group — use as dropdown default (null if no classes) */
  defaultYearGroup: number | null
  /** True once the server action has resolved */
  isLoaded: boolean
}

export const EMPTY_PROFILE: TeacherProfile = {
  teacherClasses:    [],
  teacherSubjects:   [],
  teacherYearGroups: [],
  defaultSubject:    '',
  defaultYearGroup:  null,
  isLoaded:          false,
}

export const TeacherProfileContext = createContext<TeacherProfile>(EMPTY_PROFILE)

/** Read the teacher profile from anywhere inside AppShell */
export function useTeacherProfile(): TeacherProfile {
  return useContext(TeacherProfileContext)
}
