'use client'

import { useState }                from 'react'
import Link                        from 'next/link'
import Icon                        from '@/components/ui/Icon'
import type { ParentEngagementRow } from '@/app/actions/admin'

type Filter = 'all' | 'not-activated' | 'no-messages' | 'no-consent'

export default function ParentEngagementView({ rows }: { rows: ParentEngagementRow[] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const filtered = rows.filter(r => {
    if (filter === 'not-activated' && r.activatedAt) return false
    if (filter === 'no-messages' && r.messageCount > 0) return false
    if (filter === 'no-consent' && r.consentCount > 0) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      )
    }
    return true
  })

  const chips: { id: Filter; label: string }[] = [
    { id: 'all',           label: `All (${rows.length})` },
    { id: 'not-activated', label: `Not activated (${rows.filter(r => !r.activatedAt).length})` },
    { id: 'no-messages',   label: `No messages (${rows.filter(r => r.messageCount === 0).length})` },
    { id: 'no-consent',    label: `No consent (${rows.filter(r => r.consentCount === 0).length})` },
  ]

  return (
    <main className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-4 sm:px-8 sm:py-8">

        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin/dashboard" className="text-[12px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <Icon name="chevron_left" size="sm" /> Dashboard
          </Link>
        </div>
        <h1 className="text-[22px] font-bold text-gray-900 mb-1">Parent Engagement</h1>
        <p className="text-[13px] text-gray-400 mb-5">
          Track parent account activation, messaging activity, and consent status.
        </p>

        {/* Filter chips + search */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {chips.map(c => (
            <button
              key={c.id}
              onClick={() => setFilter(c.id)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                filter === c.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.label}
            </button>
          ))}
          <input
            type="text"
            placeholder="Search parents…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ml-auto px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>

        {rows.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-12 text-center">
            <Icon name="people" size="lg" color="#d1d5db" />
            <p className="text-sm text-gray-500 mt-3">No parent accounts found.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl py-8 text-center">
            <p className="text-[13px] text-gray-400">No parents match this filter.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Parent</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-500">Children</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-gray-500">Activated</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Messages</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-500">Consents</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{r.firstName} {r.lastName}</p>
                      <p className="text-gray-400">{r.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {r.childNames.length > 0
                        ? r.childNames.slice(0, 2).join(', ') + (r.childNames.length > 2 ? ` +${r.childNames.length - 2}` : '')
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {r.activatedAt ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <Icon name="check_circle" size="sm" />
                          {new Date(r.activatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                          <Icon name="pending" size="sm" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={r.messageCount > 0 ? 'text-blue-700 font-semibold' : 'text-gray-300'}>
                        {r.messageCount || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={r.consentCount > 0 ? 'text-emerald-700 font-semibold' : 'text-rose-500'}>
                        {r.consentCount > 0 ? r.consentCount : 'None'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href="/admin/users" className="text-[11px] font-semibold text-blue-600 hover:underline">
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 px-4 py-3 border-t border-gray-100">
              {filtered.length} parent{filtered.length !== 1 ? 's' : ''} shown
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
