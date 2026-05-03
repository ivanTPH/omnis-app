import { redirect } from 'next/navigation'

// /revision is an alias — canonical URL is /student/revision
export default function RevisionPage() {
  redirect('/student/revision')
}
