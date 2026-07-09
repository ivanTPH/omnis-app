'use server'

import { requireAuth } from '@/lib/session'
import { getAllPlatformInsights, type AttainmentBenchmarkPayload, type BloomsPayload, type SendTaskTypePayload, type StrategyFrequencyPayload, type NeedAreaPrevalencePayload } from '@/lib/platform-insight'

export type PlatformInsightDashboardData = {
  lastGeneratedAt: Date | null
  schoolCount:     number
  studentCount:    number
  attainment:      AttainmentBenchmarkPayload | null
  blooms:          BloomsPayload | null
  sendTaskTypes:   SendTaskTypePayload | null
  strategies:      StrategyFrequencyPayload | null
  needAreas:       NeedAreaPrevalencePayload | null
}

export async function getPlatformInsightDashboardData(): Promise<PlatformInsightDashboardData> {
  const { role } = await requireAuth()
  if (role !== 'PLATFORM_ADMIN') {
    return { lastGeneratedAt: null, schoolCount: 0, studentCount: 0, attainment: null, blooms: null, sendTaskTypes: null, strategies: null, needAreas: null }
  }

  const rows = await getAllPlatformInsights()

  // Use cross-year (yearGroup=null) rows as the headline figures
  const crossYear = rows.filter(r => r.yearGroup === null)
  const attainmentRow = crossYear.find(r => r.insightType === 'ATTAINMENT_BENCHMARK')

  return {
    lastGeneratedAt: attainmentRow?.generatedAt ?? null,
    schoolCount:     attainmentRow?.schoolCount ?? 0,
    studentCount:    attainmentRow?.studentCount ?? 0,
    attainment:      (attainmentRow?.payload  ?? null) as AttainmentBenchmarkPayload | null,
    blooms:          (crossYear.find(r => r.insightType === 'BLOOMS_DISTRIBUTION')?.payload   ?? null) as BloomsPayload | null,
    sendTaskTypes:   (crossYear.find(r => r.insightType === 'SEND_TASK_TYPE')?.payload         ?? null) as SendTaskTypePayload | null,
    strategies:      (crossYear.find(r => r.insightType === 'STRATEGY_FREQUENCY')?.payload     ?? null) as StrategyFrequencyPayload | null,
    needAreas:       (crossYear.find(r => r.insightType === 'NEED_AREA_PREVALENCE')?.payload   ?? null) as NeedAreaPrevalencePayload | null,
  }
}
