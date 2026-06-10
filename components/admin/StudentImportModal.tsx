'use client'

import { useState, useRef, useTransition } from 'react'
import Icon from '@/components/ui/Icon'
import { importStudents } from '@/app/actions/admin'
import type { ImportStudentRow, ImportResult } from '@/app/actions/admin'

// ─── Simple CSV parser (no deps) ─────────────────────────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { cells.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    cells.push(cur.trim())
    rows.push(cells)
  }
  return rows
}

function parseRows(csv: string): { rows: ImportStudentRow[]; errors: string[] } {
  const lines = parseCsv(csv)
  if (lines.length === 0) return { rows: [], errors: ['File is empty'] }

  // Detect header row
  const header = lines[0].map(h => h.toLowerCase().replace(/\s+/g, ''))
  const colIdx = {
    firstName: header.findIndex(h => ['firstname','first_name','forename'].includes(h)),
    lastName:  header.findIndex(h => ['lastname','last_name','surname'].includes(h)),
    email:     header.findIndex(h => h === 'email'),
    yearGroup: header.findIndex(h => ['yeargroup','year_group','year'].includes(h)),
    className: header.findIndex(h => ['class','classname','class_name','group'].includes(h)),
  }

  if (colIdx.firstName === -1 || colIdx.lastName === -1 || colIdx.email === -1) {
    return { rows: [], errors: ['CSV must have columns: firstName, lastName, email (and optionally yearGroup, class)'] }
  }

  const dataLines = lines.slice(1)
  const rows: ImportStudentRow[] = []
  const errors: string[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const cells = dataLines[i]
    const firstName = cells[colIdx.firstName]?.trim() ?? ''
    const lastName  = cells[colIdx.lastName]?.trim()  ?? ''
    const email     = cells[colIdx.email]?.trim()     ?? ''

    if (!firstName || !lastName || !email) {
      errors.push(`Row ${i + 2}: missing required field (firstName, lastName, email)`)
      continue
    }

    const ygRaw   = colIdx.yearGroup >= 0 ? cells[colIdx.yearGroup]?.trim() : ''
    const yg      = ygRaw ? parseInt(ygRaw.replace(/\D/g, ''), 10) : NaN
    const className = colIdx.className >= 0 ? (cells[colIdx.className]?.trim() || null) : null

    rows.push({
      firstName,
      lastName,
      email,
      yearGroup: isNaN(yg) ? null : yg,
      className,
    })
  }

  return { rows, errors }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentImportModal({ onClose, onImported }: {
  onClose: () => void
  onImported: (count: number) => void
}) {
  const fileRef                       = useRef<HTMLInputElement>(null)
  const [rows,    setRows]            = useState<ImportStudentRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [result,  setResult]          = useState<ImportResult | null>(null)
  const [pending, startT]             = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { rows: parsed, errors } = parseRows(text)
      setRows(parsed)
      setParseErrors(errors)
      setResult(null)
    }
    reader.readAsText(file)
  }

  function handleImport() {
    startT(async () => {
      const r = await importStudents(rows)
      setResult(r)
      if (r.created > 0) onImported(r.created)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Import students from CSV</h2>
            <p className="text-[12px] text-gray-400 mt-0.5">
              Upload a CSV file to create student accounts and send activation emails
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <Icon name="close" size="sm" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Instructions */}
          {!result && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-[12px] text-blue-800 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <Icon name="info" size="sm" className="text-blue-600" />
                Required CSV columns
              </p>
              <p>
                <span className="font-mono bg-blue-100 px-1 rounded">firstName</span>,{' '}
                <span className="font-mono bg-blue-100 px-1 rounded">lastName</span>,{' '}
                <span className="font-mono bg-blue-100 px-1 rounded">email</span>
              </p>
              <p className="text-blue-600">
                Optional:{' '}
                <span className="font-mono bg-blue-100 px-1 rounded">yearGroup</span>,{' '}
                <span className="font-mono bg-blue-100 px-1 rounded">class</span>
              </p>
              <p className="text-blue-600 text-[11px]">
                Export your school MIS or student information as CSV. Students already in the system (matched by email) will be skipped.
              </p>
            </div>
          )}

          {/* File picker */}
          {!result && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-[13px] text-gray-600 hover:border-blue-300 hover:text-blue-600 transition w-full justify-center"
              >
                <Icon name="upload_file" size="md" />
                {rows.length > 0 ? `${rows.length} students loaded — click to change file` : 'Choose CSV file'}
              </button>
            </div>
          )}

          {/* Parse errors */}
          {parseErrors.length > 0 && !result && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-[12px] text-red-700 space-y-1">
              <p className="font-semibold">CSV issues</p>
              {parseErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !result && (
            <div>
              <p className="text-[12px] font-semibold text-gray-700 mb-2">
                Preview — {rows.length} student{rows.length !== 1 ? 's' : ''} to import
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Name</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Email</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Year</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Class</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-900 font-medium whitespace-nowrap">
                          {r.firstName} {r.lastName}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500 max-w-[180px] truncate">{r.email}</td>
                        <td className="px-3 py-1.5 text-gray-500">
                          {r.yearGroup != null ? `Y${r.yearGroup}` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">{r.className ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result summary */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-50 rounded-xl">
                  <Icon name="check_circle" size="lg" className="text-green-600" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">Import complete</p>
                  <p className="text-[12px] text-gray-500">
                    {result.created} account{result.created !== 1 ? 's' : ''} created
                    {result.skipped > 0 ? `, ${result.skipped} already existed (skipped)` : ''}
                  </p>
                </div>
              </div>
              {result.created > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-[12px] text-green-800">
                  Activation emails sent to all new students. They have 7 days to set their password.
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[12px] text-red-700 space-y-1">
                  <p className="font-semibold">{result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</p>
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5">
          {result ? (
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[13px] font-medium transition"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={pending || rows.length === 0}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-medium transition"
              >
                {pending
                  ? 'Importing…'
                  : rows.length > 0
                    ? `Import ${rows.length} student${rows.length !== 1 ? 's' : ''}`
                    : 'Select a file first'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
