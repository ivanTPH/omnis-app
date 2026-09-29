'use client'

import { useState, useTransition } from 'react'
import { updateRetentionSettings } from '@/app/actions/gdpr'
import type { SchoolRetention } from '@/lib/retention'

type Props = {
  initial: SchoolRetention
  canEdit: boolean
}

const FIELDS: { key: 'sendYears' | 'pupilRecordYears' | 'safeguardingYears'; label: string; help: string; def: number }[] = [
  { key: 'sendYears',         label: 'SEND files',            def: 31, help: 'ILP, EHCP, APDR and SEND status. IRMS guidance: date of birth + 31 years.' },
  { key: 'pupilRecordYears',  label: 'Pupil record',          def: 25, help: 'Including behaviour, detentions and exclusions. IRMS guidance: date of birth + 25 years.' },
  { key: 'safeguardingYears', label: 'Safeguarding files',    def: 25, help: 'Child protection records. IRMS / DfE guidance: date of birth + 25 years, then review.' },
]

export default function RetentionSettings({ initial, canEdit }: Props) {
  const [values, setValues] = useState<SchoolRetention>(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    setMsg(null)
    start(async () => {
      try {
        await updateRetentionSettings(values)
        setMsg('Saved.')
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-[15px] font-semibold text-gray-900">Retention schedule</h2>
        <p className="text-[12px] text-gray-500 mt-1">
          Your school is the data controller and decides how long pupil records are kept; Omnis follows these settings.
          The defaults follow the IRMS Academies Toolkit, which the DfE Data Protection Toolkit for Schools relies on.
          Attendance registers (6 years from each entry) are kept in your MIS, not in Omnis.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="block text-[12px] font-semibold text-gray-700">{f.label}</span>
              <span className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-gray-500">Date of birth +</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  disabled={!canEdit}
                  value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: Number(e.target.value) }))}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] disabled:bg-gray-50"
                />
                <span className="text-[12px] text-gray-500">years</span>
              </span>
              <span className="block text-[11px] text-gray-400 mt-1">{f.help} Default {f.def}.</span>
            </label>
          ))}
        </div>

        <fieldset className="mt-6">
          <legend className="text-[12px] font-semibold text-gray-700">When a leaver&apos;s data is erased</legend>
          <label className="flex items-start gap-2 mt-2 text-[12px] text-gray-700">
            <input
              type="radio"
              name="leaver"
              disabled={!canEdit}
              checked={values.leaverRecordHandling === 'EXPORT_THEN_DELETE'}
              onChange={() => setValues(v => ({ ...v, leaverRecordHandling: 'EXPORT_THEN_DELETE' }))}
            />
            <span>
              <strong>Export then delete (recommended).</strong> The school downloads the pupil&apos;s SEND,
              safeguarding and behaviour file and keeps it under its own procedures; Omnis then deletes it.
            </span>
          </label>
          <label className="flex items-start gap-2 mt-2 text-[12px] text-gray-700">
            <input
              type="radio"
              name="leaver"
              disabled={!canEdit}
              checked={values.leaverRecordHandling === 'RETAIN_IN_OMNIS'}
              onChange={() => setValues(v => ({ ...v, leaverRecordHandling: 'RETAIN_IN_OMNIS' }))}
            />
            <span>
              <strong>Keep in Omnis.</strong> Omnis keeps the file on the school&apos;s behalf until the retention
              period above ends.
            </span>
          </label>
        </fieldset>

        <div className="mt-5 flex items-center gap-3">
          {canEdit ? (
            <button
              onClick={save}
              disabled={pending}
              className="px-4 py-2 text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save retention schedule'}
            </button>
          ) : (
            <p className="text-[12px] text-gray-500">Only a school administrator can change these settings.</p>
          )}
          {msg && <p className="text-[12px] text-gray-600">{msg}</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 text-[12px] text-gray-600">
        <h3 className="text-[13px] font-semibold text-gray-900 mb-1">When the contract ends</h3>
        Omnis returns all of the school&apos;s data in a usable format and then deletes it, including backups,
        within the period agreed in the Data Processing Agreement.
      </div>
    </div>
  )
}
