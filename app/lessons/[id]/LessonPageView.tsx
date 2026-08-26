'use client'

import { useRouter } from 'next/navigation'
import LessonFolder, { type FolderTab } from '@/components/LessonFolder'

const VALID_TABS: readonly FolderTab[] = ['Overview', 'Resources', 'Homework', 'Class', 'SEND & Inclusion', 'Insights']

export default function LessonPageView({ lessonId, defaultTab }: { lessonId: string; defaultTab?: string }) {
  const router = useRouter()
  const resolvedTab = (VALID_TABS as readonly string[]).includes(defaultTab ?? '')
    ? (defaultTab as FolderTab)
    : undefined
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <LessonFolder
        lessonId={lessonId}
        defaultTab={resolvedTab}
        onClose={() => router.push('/dashboard')}
        inline
        origin="page"
      />
    </div>
  )
}
