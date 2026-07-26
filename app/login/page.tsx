import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>
}) {
  const sp = await searchParams
  // Show demo panel when ?demo=1 is in the URL, or always in non-production.
  const showDemo = process.env.NODE_ENV !== 'production' || sp.demo === '1'
  return <LoginForm showDemo={showDemo} />
}
