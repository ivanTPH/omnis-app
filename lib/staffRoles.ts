/**
 * The set of roles Sidebar.tsx treats as "staff" (shows student search, etc).
 * Lives outside Sidebar.tsx (a 'use client' component) so server components
 * can import it directly — a non-component named export re-exported from a
 * 'use client' file doesn't reliably survive the RSC module boundary.
 */
export const STAFF_ROLES = new Set([
  'TEACHER', 'HEAD_OF_DEPT', 'HEAD_OF_YEAR', 'SENCO', 'SLT', 'SCHOOL_ADMIN',
  'COVER_MANAGER', 'TEACHING_ASSISTANT',
])
