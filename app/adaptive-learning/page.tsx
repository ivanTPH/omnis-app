import { redirect } from 'next/navigation'

/** Legacy URL — /adaptive-learning → /analytics/adaptive */
export default function AdaptiveLearningRedirect() {
  redirect('/analytics/adaptive')
}
