const TYPE_LABEL: Record<string, string> = {
  end_of_unit:  'End of Unit',
  mid_term:     'Mid Term',
  mock_exam:    'Mock Exam',
  formal_exam:  'Formal Exam',
  other:        'Other',
}

export const ASSESSMENT_TYPES = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))
