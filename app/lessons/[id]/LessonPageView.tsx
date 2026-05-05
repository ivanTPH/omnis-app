'use client'

import { useRouter } from 'next/navigation'
import LessonFolder from '@/components/LessonFolder'

export default function LessonPageView({ lessonId }: { lessonId: string }) {
  const router = useRouter()
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <LessonFolder
        lessonId={lessonId}
        onClose={() => router.back()}
        inline
      />
    </div>
  )
}
