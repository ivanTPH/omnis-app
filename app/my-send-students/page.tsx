import { redirect } from 'next/navigation'

/** Legacy URL — /my-send-students → /send-caseload */
export default function MySendStudentsRedirect() {
  redirect('/send-caseload')
}
