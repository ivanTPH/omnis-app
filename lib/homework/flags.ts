/**
 * The staged homework pipeline (planner → writer → checker) is off by default.
 * Turn it on per school with the `homework_pipeline` feature flag
 * (Platform admin → Schools → Feature flags), or everywhere with
 * HOMEWORK_PIPELINE=on. HOMEWORK_PIPELINE=off forces it off.
 *
 * It costs roughly 30–40% more per generation than single pass (a Haiku
 * planning call, ten small Haiku checks, and a rewrite only when needed).
 */
import { prisma } from '@/lib/prisma'

export const HOMEWORK_PIPELINE_FLAG = 'homework_pipeline'

export async function homeworkPipelineEnabled(schoolId: string): Promise<boolean> {
  const env = process.env.HOMEWORK_PIPELINE
  if (env === 'off') return false
  if (env === 'on') return true
  try {
    const flag = await prisma.schoolFeatureFlag.findUnique({
      where:  { schoolId_flag: { schoolId, flag: HOMEWORK_PIPELINE_FLAG } },
      select: { enabled: true },
    })
    return !!flag?.enabled
  } catch {
    return false
  }
}
