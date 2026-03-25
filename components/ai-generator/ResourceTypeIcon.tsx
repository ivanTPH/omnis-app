import { FileText, HelpCircle, BookOpen, List, Grid, Presentation } from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  worksheet:           FileText,
  quiz:                HelpCircle,
  powerpoint_outline:  Presentation,
  reading_passage:     BookOpen,
  vocabulary_list:     List,
  knowledge_organiser: Grid,
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  worksheet:           'Worksheet',
  quiz:                'Quiz',
  powerpoint_outline:  'PowerPoint Outline',
  reading_passage:     'Reading Passage',
  vocabulary_list:     'Vocabulary List',
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
