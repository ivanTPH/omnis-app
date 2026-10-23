/**
 * SEND register counts — one function for "on register / SEN Support / EHCP
 * / active ILP / no active ILP", so every screen that shows these counts
 * agrees on what counts as "active".
 *
 * This does NOT attempt to reconcile which underlying Prisma query each
 * screen uses to decide "active ILP" (some include `under_review`, some
 * require `approvedBySenco`, some don't) — that's a product decision about
 * what "active" should mean, not a pure-arithmetic bug, and changing it
 * everywhere risks shifting real SEND figures without sign-off. This
 * function takes the already-decided "does this student have an active
 * ILP" set as an input, so call sites stay free to apply their own
 * filtering rule — it only guarantees the five counts below are derived
 * from that one set consistently, with no separate arithmetic per screen.
 */

export interface SendRegisterStudent {
  studentId: string
  activeStatus: 'NONE' | 'SEN_SUPPORT' | 'EHCP'
}

export interface SendCounts {
  onRegister:  number  // SEN_SUPPORT + EHCP
  senSupport:  number
  ehcp:        number
  activeIlp:   number  // on register AND has an active ILP
  noActiveIlp: number  // on register AND has NO active ILP
}

/**
 * @param students        Every student's current SEND status (one row each).
 * @param activeIlpStudentIds  Student IDs with an active ILP, by the caller's own definition.
 */
export function getSendCounts(
  students: SendRegisterStudent[],
  activeIlpStudentIds: Iterable<string>,
): SendCounts {
  const onRegisterStudents = students.filter(s => s.activeStatus !== 'NONE')
  const ilpSet = new Set(activeIlpStudentIds)
  const onRegisterWithIlp = onRegisterStudents.filter(s => ilpSet.has(s.studentId)).length

  return {
    onRegister:  onRegisterStudents.length,
    senSupport:  onRegisterStudents.filter(s => s.activeStatus === 'SEN_SUPPORT').length,
    ehcp:        onRegisterStudents.filter(s => s.activeStatus === 'EHCP').length,
    activeIlp:   onRegisterWithIlp,
    noActiveIlp: onRegisterStudents.length - onRegisterWithIlp,
  }
}
