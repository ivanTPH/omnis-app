import LoginForm from './LoginForm'

export default function LoginPage() {
  const showDemo =
    process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS === 'true' &&
    process.env.VERCEL_ENV !== 'production'

  return <LoginForm showDemo={showDemo} />
}
