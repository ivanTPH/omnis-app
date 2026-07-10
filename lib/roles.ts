/**
 * Single source of truth for the staff role list.
 * Edge-runtime safe — no Prisma, bcrypt, or Node-only imports.
 * Used by auth.config.ts (DPA/Terms gates), lib/auth.ts (MFA check),
 * and app/actions/mfa.ts (MFA request action).
 */
export const STAFF_ROLES = [
  'TEACHER',
  'HEAD_OF_DEPT',
  'HEAD_OF_YEAR',
  'SENCO',
  'SLT',
  'SCHOOL_ADMIN',
  'TEACHING_ASSISTANT',
  'COVER_MANAGER',
  'PLATFORM_ADMIN',
  'ACADEMY_ADMIN',
  'SUPER_ADMIN',
] as const
