import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>
}) {
  // Show demo credentials panel when ?demo=1 is in the URL.
  // Use https://omnis.education/login?demo=1 to reveal the role switcher.
  const sp = await searchParams
  return <LoginForm showDemo={sp.demo === '1'} />
}
