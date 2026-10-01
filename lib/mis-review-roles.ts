/** Roles a school admin can give staff on the "Check MIS data" page. */
export const ASSIGNABLE_STAFF_ROLES = [
  'TEACHER', 'TEACHING_ASSISTANT', 'SENCO', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SLT', 'SCHOOL_ADMIN', 'COVER_MANAGER',
] as const

export const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Teacher', TEACHING_ASSISTANT: 'Teaching assistant', SENCO: 'SENCO',
  HEAD_OF_DEPT: 'Head of department', HEAD_OF_YEAR: 'Head of year', SLT: 'Senior leader',
  SCHOOL_ADMIN: 'School admin', COVER_MANAGER: 'Cover manager',
}
