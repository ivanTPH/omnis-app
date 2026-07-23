import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  // Demo panel is only available in local development builds.
  // NODE_ENV is 'production' in any built deployment (Coolify, Vercel, etc.)
  // regardless of what NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS is set to.
  const showDemo =
    process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true' &&
    process.env.NODE_ENV !== 'production'

  return (
    <Suspense>
      <LoginForm showDemo={showDemo} />
    </Suspense>
  )
}
