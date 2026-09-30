import Link from 'next/link'
import ParentRegisterForm from './ParentRegisterForm'

export const metadata = {
  title: 'Parent and carer registration — Omnis Education',
  description: 'Create your Omnis parent or carer account using the email address your child’s school holds for you.',
}

export default function ParentsPage() {
  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <p className="text-sm font-medium text-blue-700 uppercase tracking-wide mb-2">Parents and carers</p>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Create your parent account</h1>
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed mb-8">
        <p>
          Enter the email address your child’s school holds for you. If it matches the school’s records, we’ll email you
          a link to choose a password. Your account will show every child you have parental responsibility for at that school.
        </p>
        <p>
          You can only register once your school has opened parent accounts. If nothing arrives within 15 minutes, check
          your junk folder, then ask the school office to check the email address they hold for you.
        </p>
      </div>
      <ParentRegisterForm />
      <p className="text-sm text-gray-500 mt-6">
        Already registered? <Link href="/login" className="text-blue-700 hover:underline">Sign in</Link>
        {' · '}
        <Link href="/marketing/help#common-problems" className="text-blue-700 hover:underline">Help</Link>
      </p>
    </main>
  )
}
