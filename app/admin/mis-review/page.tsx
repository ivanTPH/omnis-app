import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/session'
import AppShell from '@/components/AppShell'
import { getMisReview } from '@/lib/mis-review'
import { ClassTeacherAssigner, StaffRoleEditor } from '@/components/admin/MisReviewControls'

export const dynamic = 'force-dynamic'

export default async function MisReviewPage() {
  const { role, firstName, lastName, schoolName, schoolId } = await requireAuth()
  if (!['SCHOOL_ADMIN', 'SLT'].includes(role)) redirect('/dashboard')
  const r = await getMisReview(schoolId)
  const teachers = r.staff.map(s => ({ id: s.id, name: s.name }))

  return (
    <AppShell role={role} firstName={firstName} lastName={lastName} schoolName={schoolName}>
      <div className="p-6 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Check your MIS data</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            What Omnis set up from your MIS, and the gaps to fix before you invite pupils and parents.
            Back to the <Link href="/admin/go-live" className="underline">go-live checklist</Link>.
          </p>
        </div>

        <section id="sync" className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-2">Last MIS sync</h2>
          {r.sync ? (
            <>
              <p className="text-[12px] text-gray-500 mb-3">
                {r.sync.at ? r.sync.at.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''} ·{' '}
                {r.sync.status === 'success' ? 'Completed' : r.sync.status === 'partial' ? 'Completed with some problems' : 'Failed'}
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[13px] text-gray-700">
                {r.sync.lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              {r.sync.problems.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-[12px] font-semibold text-amber-900 mb-1">Things to check</p>
                  <ul className="list-disc pl-5 space-y-1 text-[12px] text-amber-900">
                    {r.sync.problems.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-[12px] text-gray-500 mt-3">Run a new sync from <Link href="/admin/wonde" className="underline">MIS Sync</Link>.</p>
            </>
          ) : (
            <p className="text-[13px] text-gray-600">No sync yet. Connect Wonde and run a sync from <Link href="/admin/wonde" className="underline">MIS Sync</Link>.</p>
          )}
        </section>

        <section id="classes" className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Classes without a teacher</h2>
          <p className="text-[12px] text-gray-500 mb-3">
            {r.classesNoTeacher.length} of {r.classesTotal} classes have no teacher. Teachers only see the classes they are linked to.
            If many are missing, ask your MIS lead to grant &ldquo;staff classes&rdquo; or the timetable in Wonde, then sync again.
          </p>
          {r.classesNoTeacher.length === 0
            ? <p className="text-[13px] text-green-800">Every class has a teacher.</p>
            : <ClassTeacherAssigner classes={r.classesNoTeacher} teachers={teachers} />}
        </section>

        <section id="staff" className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Staff roles</h2>
          <p className="text-[12px] text-gray-500 mb-3">
            Staff from the MIS start as teachers. Set the SENCO, heads of department and heads of year so they see the right pages.
          </p>
          <StaffRoleEditor staff={r.staff} />
        </section>

        <section id="pupil-emails" className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Pupil email addresses</h2>
          <p className="text-[13px] text-gray-700">
            {r.pupilsMissingEmail === 0
              ? `All ${r.pupils} pupils have a school email address.`
              : `${r.pupilsMissingEmail} of ${r.pupils} pupils have no school email address, so they can't be invited yet.`}
          </p>
          {r.pupilsMissingEmail > 0 && (
            <ol className="list-decimal pl-5 mt-2 space-y-1 text-[12px] text-gray-600">
              <li>Best: ask your MIS lead to grant &ldquo;student contact details&rdquo; in Wonde, then sync again.</li>
              <li>Or <a href="/api/admin/pupils-missing-email" className="underline">download the list of pupils without an email</a>, fill in the email column for the pupils you know, and upload it with &ldquo;Import students (CSV)&rdquo; on the <Link href="/admin/users" className="underline">User Management</Link> page. Rows left blank are skipped. No emails are sent.</li>
            </ol>
          )}
        </section>

        <section id="parent-emails" className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Parent and carer email addresses</h2>
          <p className="text-[13px] text-gray-700">
            {r.pupilsNoParentEmail === 0
              ? 'Every pupil has at least one parent or carer with parental responsibility and an email address on the MIS.'
              : `${r.pupilsNoParentEmail} pupil(s) have no parent or carer with parental responsibility and an email address on the MIS. Their families won't be able to register until the school office adds one to the MIS.`}
          </p>
        </section>
      </div>
    </AppShell>
  )
}
