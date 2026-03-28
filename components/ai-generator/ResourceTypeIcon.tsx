import Icon from '@/components/ui/Icon'

const ICON_MAP: Record<string, string> = {
  worksheet:           'description',
  quiz:                'help_outline',
  powerpoint_outline:  'slideshow',
  reading_passage:     'menu_book',
  vocabulary_list:     'list',
  knowledge_organiser: 'grid_view',
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
  size,
  className = '',
}: {
  type: string
  size?: number
  className?: string
}) {
  const iconName = ICON_MAP[type] ?? 'description'
  return <Icon name={iconName} size="sm" className={className} />
}
