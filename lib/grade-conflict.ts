/**
 * Shared between app/actions/homework.ts (a "use server" file, which may only
 * export async functions — a plain const export there breaks the Turbopack
 * build) and the marking UI components that need to detect this specific
 * error message.
 *
 * Thrown by markSubmission() when the submission was graded by someone else
 * between the caller loading it and saving — the caller's `expectedMarkedAt`
 * no longer matches what's in the database. Callers should catch this
 * specifically (message starts with this prefix) and prompt a refresh
 * instead of retrying blindly. See evidence/phase6-load-resilience/failure-tests.md
 * Scenario 4.
 */
export const GRADE_CONFLICT_PREFIX = 'CONFLICT_ALREADY_GRADED:'
