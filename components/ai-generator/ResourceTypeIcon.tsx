import { FileText, HelpCircle, BookOpen, CheckSquare, Grid } from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  worksheet:           FileText,
  quiz:                HelpCircle,
  lesson_plan:         BookOpen,
  exit_ticket:         CheckSquare,
  knowledge_organiser: Grid,
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  worksheet:           'Worksheet',
  quiz:                'Quiz',
  lesson_plan:         'Lesson Plan',
  exit_ticket:         'Exit Ticket',
  knowledge_organiser: 'Knowledge Organiser',
}

export default function ResourceTypeIcon({
  type,
  size = 14,
  className = '',
}: {
  type: string
  size?: number
  className?: string
}) {
  const Icon = ICON_MAP[type] ?? FileText
  return <Icon size={size} className={className} />
}
