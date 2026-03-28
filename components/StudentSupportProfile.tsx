'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import type { SupportProfile } from '@/app/actions/analytics'

const SEND_LABEL: Record<string, string> = {
  SEN_SUPPORT: 'SEN Support',
  EHCP:        'EHCP',
}
const SEND_BADGE: Record<string, string> = {
  SEN_SUPPORT: 'bg-blue-100 text-blue-800',
  EHCP:        'bg-purple-100 text-purple-800',
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
      {children}
    </div>
  )
}

export default function StudentSupportProfile({ profile }: { profile: SupportProfile }) {
  const [showAllTargets, setShowAllTargets] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const { sendStatus, needArea, ilp, latestTeacherNote } = profile
  const noSend       = !sendStatus
  const allTargets   = ilp?.targets ?? []
  const visibleTargets = showAllTargets ? allTargets : allTargets.slice(0, 3)

  // Primary need: prefer SendStatus.needArea, fall back to ILP sendCategory
  const primaryNeed = needArea ?? ilp?.sendCategory ?? null

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

      {/* Header — always visible; collapse toggle shown on mobile only */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100 text-left lg:pointer-events-none"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2">
          <Icon name="favorite" size="sm" className={noSend ? 'text-gray-300' : 'text-amber-500'} />
          <span className="text-sm font-semibold text-gray-800">Support Profile</span>
          {!noSend && sendStatus && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${SEND_BADGE[sendStatus] ?? 'bg-amber-100 text-amber-800'}`}>
              {SEND_LABEL[sendStatus] ?? sendStatus}
            </span>
          )}
        </div>
        <Icon
          name="expand_more"
          size="sm"
          className={`text-gray-400 transition-transform duration-200 lg:hidden ${collapsed ? '' : 'rotate-180'}`}
        />
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-5 py-4 space-y-5">

          {noSend ? (
            <p className="text-sm text-gray-400 italic">No SEND support recorded for this student.</p>
          ) : (
            <>
              {/* SEND status */}
              <Section label="SEND Status">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${SEND_BADGE[sendStatus!] ?? 'bg-amber-100 text-amber-800'}`}>
                  <Icon name="favorite" size="sm" />
                  {SEND_LABEL[sendStatus!] ?? sendStatus}
                </span>
              </Section>

              {/* Primary need */}
              {primaryNeed && (
                <Section label="Primary Need">
                  <p className="text-sm text-gray-700">{primaryNeed}</p>
                </Section>
              )}

              {/* Areas of need */}
              {ilp?.areasOfNeed && (
                <Section label="Areas of Need">
                  <p className="text-[13px] text-gray-600 leading-relaxed">{ilp.areasOfNeed}</p>
                </Section>
              )}
            </>
          )}

          {/* Active ILP goals */}
          <Section label={`Active ILP Goals${allTargets.length > 0 ? ` (${allTargets.length})` : ''}`}>
            {allTargets.length === 0 ? (
              <p className="text-[13px] text-gray-400 italic">No active goals recorded.</p>
            ) : (
              <>
                <ul className="space-y-2.5">
                  {visibleTargets.map(t => (
                    <li key={t.id} className="flex items-start gap-2">
                      <Icon name="track_changes" size="sm" className="text-blue-400 mt-1 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[13px] text-gray-700 leading-snug">{t.target}</p>
                        {t.progressNotes && (
                          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{t.progressNotes}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                {allTargets.length > 3 && (
                  <button
                    onClick={() => setShowAllTargets(s => !s)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {showAllTargets
                      ? <><Icon name="expand_less" size="sm" />Show fewer</>
                      : <><Icon name="expand_more" size="sm" />Show all {allTargets.length} goals</>}
                  </button>
                )}
              </>
            )}
          </Section>

          {/* Latest teacher note */}
          <Section label="Last Teacher Note">
            {latestTeacherNote ? (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 space-y-1.5">
                <div className="flex items-start gap-2">
                  <Icon name="chat" size="sm" className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-[13px] text-gray-700 leading-relaxed">{latestTeacherNote.notes}</p>
                </div>
                <p className="text-[10px] text-gray-400 pl-5">
                  {latestTeacherNote.subject} · {latestTeacherNote.termLabel} ·{' '}
                  {new Date(latestTeacherNote.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-gray-400 italic">No teacher notes recorded.</p>
            )}
          </Section>

          {/* Last ILP evidence — placeholder (no ILPEvidenceEntry model yet) */}
          <Section label="Last ILP Evidence">
            <div className="flex items-center gap-2 text-[13px] text-gray-400 italic">
              <Icon name="description" size="sm" className="text-gray-300 shrink-0" />
              No evidence entries linked yet.
            </div>
          </Section>

        </div>
      )}
    </div>
  )
}
