'use client'

import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { getClassSummaries, getHomeworkAdaptiveAnalytics } from '@/app/actions/analytics'
import type { ClassSummary, HomeworkAdaptiveAnalytics } from '@/app/actions/analytics'
import AdaptiveInfoPanel from './AdaptiveInfoPanel'
import AdaptiveHeatmapView from './AdaptiveHeatmapView'
import AdaptiveStudentView from './AdaptiveStudentView'
import { gradeLabel, percentToGcseGrade } from '@/lib/grading'

const BLOOMS_COLOURS: Record<string, string> = {
  remember:   '#6366f1',
  understand: '#8b5cf6',
  apply:      '#a855f7',
  analyse:    '#d946ef',
  evaluate:   '#ec4899',
  create:     '#f43f5e',
}

type View =
  | { mode: 'overview' }
  | { mode: 'heatmap'; classId: string; className: string; subject: string; yearGroup: number }
  | { mode: 'student'; classId: string; className: string; subject: string; yearGroup: number; studentId: string; studentName: string }

export default function AdaptiveAnalyticsDashboard() {
  const [view,     setView]     = useState<View>({ mode: 'overview' })
  const [classes,  setClasses]  = useState<ClassSummary[]>([])
  const [loadingC, setLoadingC] = useState(true)
  const [analytics, setAnalytics] = useState<HomeworkAdaptiveAnalytics | null>(null)
  const [showCharts, setShowCharts] = useState(false)

  useEffect(() => {
    getClassSummaries().then(setClasses).catch(() => {}).finally(() => setLoadingC(false))
    getHomeworkAdaptiveAnalytics().then(setAnalytics).catch(() => {})
  }, [])

  // ── Breadcrumb ────────────────────────────────────────────────────────────

  function Breadcrumb() {
    if (view.mode === 'overview') {
      return (
        <nav className="flex items-center gap-1 text-[12px] mb-5">
          <span className="font-semibold text-gray-900">Adaptive Learning</span>
        </nav>
      )
    }
    if (view.mode === 'heatmap') {
      return (
        <nav className="flex items-center gap-1 text-[12px] mb-5">
          <button
            onClick={() => setView({ mode: 'overview' })}
            className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Icon name="arrow_back" size="sm" />
            Adaptive Learning
          </button>
          <Icon name="chevron_right" size="sm" className="text-gray-300" />
          <span className="font-semibold text-gray-900">{view.className}</span>
        </nav>
      )
    }
    // student
    return (
      <nav className="flex items-center gap-1 text-[12px] mb-5 flex-wrap">
        <button
          onClick={() => setView({ mode: 'overview' })}
          className="flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors"
        >
          <Icon name="arrow_back" size="sm" />
          Adaptive Learning
        </button>
        <Icon name="chevron_right" size="sm" className="text-gray-300" />
        <button
          onClick={() => setView({ mode: 'heatmap', classId: view.classId, className: view.className, subject: view.subject, yearGroup: view.yearGroup })}
          className="text-gray-500 hover:text-blue-600 transition-colors"
        >
          {view.className}
        </button>
        <Icon name="chevron_right" size="sm" className="text-gray-300" />
        <span className="font-semibold text-gray-900">{view.studentName}</span>
      </nav>
    )
  }

  // ── Overview ──────────────────────────────────────────────────────────────

  if (view.mode === 'overview') {
    return (
      <div className="space-y-6">
        <Breadcrumb />
        <AdaptiveInfoPanel />

        {/* Class cards */}
        <div>
          <h2 className="text-[13px] font-semibold text-gray-700 mb-3">Your Classes — Topic Heatmap</h2>
          {loadingC ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <p className="text-sm text-gray-400">No classes found. Publish homework to see topic data here.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {classes.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => setView({ mode: 'heatmap', classId: cls.id, className: cls.name, subject: cls.subject, yearGroup: cls.yearGroup })}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left group"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                      {cls.name}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {cls.subject} · Year {cls.yearGroup} · {cls.studentCount} students
                    </p>
                    {cls.hwCount > 0 && (
                      <p className="text-[11px] text-gray-400">
                        {cls.hwCount} homework{cls.hwCount !== 1 ? 's' : ''}
                        {cls.avgScore != null ? ` · Avg ${gradeLabel(percentToGcseGrade(cls.avgScore))}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {cls.sendCount > 0 && (
                      <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full font-medium">
                        {cls.sendCount} SEND
                      </span>
                    )}
                    <Icon name="chevron_right" size="sm" className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* School-wide insights (collapsible) */}
        {analytics && (analytics.typeBreakdown.length > 0 || analytics.bloomsDistribution.length > 0) && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowCharts(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon name="bar_chart" size="sm" className="text-gray-500" />
                <span className="text-[13px] font-semibold text-gray-700">School-wide Insights</span>
              </div>
              {showCharts ? <Icon name="expand_less" size="sm" className="text-gray-400" /> : <Icon name="expand_more" size="sm" className="text-gray-400" />}
            </button>

            {showCharts && (
              <div className="p-5 space-y-6 bg-white">
                {/* Evidence rates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="task_alt" size="sm" className="text-green-600" />
                      <h3 className="text-[12px] font-medium text-gray-900">ILP Evidence Rate</h3>
                    </div>
                    <div className="text-3xl font-bold text-green-700 mb-1">{Math.round(analytics.ilpEvidenceRate * 100)}%</div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round(analytics.ilpEvidenceRate * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">of homework linked to an ILP target</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="psychology" size="sm" className="text-purple-600" />
                      <h3 className="text-[12px] font-medium text-gray-900">EHCP Evidence Rate</h3>
                    </div>
                    <div className="text-3xl font-bold text-purple-700 mb-1">{Math.round(analytics.ehcpEvidenceRate * 100)}%</div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.round(analytics.ehcpEvidenceRate * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">of homework linked to an EHCP outcome</p>
                  </div>
                </div>

                {/* Bloom's distribution */}
                {analytics.bloomsDistribution.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="trending_up" size="sm" className="text-indigo-600" />
                      <h3 className="text-[12px] font-medium text-gray-900">Bloom&apos;s Taxonomy Distribution</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.bloomsDistribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: unknown, n: unknown) => [v as number, n === 'count' ? 'Tasks' : 'Avg score']} />
                        <Bar dataKey="count" name="count" radius={[3, 3, 0, 0]}>
                          {analytics.bloomsDistribution.map(e => (
                            <Cell key={e.level} fill={BLOOMS_COLOURS[e.level] ?? '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Type performance */}
                {analytics.typeBreakdown.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="menu_book" size="sm" className="text-blue-600" />
                      <h3 className="text-[12px] font-medium text-gray-900">Performance by Homework Type</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={analytics.typeBreakdown.map(t => ({ ...t, type: t.type.replace(/_/g, ' ') }))}
                        margin={{ top: 0, right: 0, left: -20, bottom: 36 }}
                      >
                        <XAxis dataKey="type" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip formatter={(v: unknown, n: unknown) => [n === 'avgScore' ? `${Math.round(v as number)}%` : v as number, n === 'avgScore' ? 'Avg score' : 'Tasks']} />
                        <Bar dataKey="avgScore" name="avgScore" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Completion by type */}
                {analytics.completionByType.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h3 className="text-[12px] font-medium text-gray-900 mb-3">Completion Rate by Type</h3>
                    <div className="space-y-2.5">
                      {analytics.completionByType.sort((a, b) => b.completionRate - a.completionRate).map(t => (
                        <div key={t.type} className="flex items-center gap-3">
                          <span className="text-[11px] text-gray-600 w-32 shrink-0 capitalize">{t.type.replace(/_/g, ' ')}</span>
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round(t.completionRate * 100)}%` }} />
                          </div>
                          <span className="text-[11px] text-gray-700 w-10 text-right">{Math.round(t.completionRate * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Heatmap view ──────────────────────────────────────────────────────────

  if (view.mode === 'heatmap') {
    return (
      <div className="space-y-4">
        <Breadcrumb />
        <div>
          <h2 className="text-[15px] font-bold text-gray-900">{view.className}</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">{view.subject} · Year {view.yearGroup} — last term topic performance</p>
        </div>
        <AdaptiveHeatmapView
          classId={view.classId}
          onSelectStudent={(studentId, studentName) =>
            setView({ mode: 'student', classId: view.classId, className: view.className, subject: view.subject, yearGroup: view.yearGroup, studentId, studentName })
          }
        />
      </div>
    )
  }

  // ── Student view ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Breadcrumb />
      <AdaptiveStudentView studentId={view.studentId} classId={view.classId} />
    </div>
  )
}
