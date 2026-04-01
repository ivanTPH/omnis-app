import { redirect } from 'next/navigation'

// The student homework list is surfaced on the student dashboard.
export default function StudentHomeworkListPage() {
  redirect('/student/dashboard')
}
