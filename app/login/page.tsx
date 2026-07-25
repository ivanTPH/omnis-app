import LoginForm from './LoginForm'

export default async function LoginPage() {
  // Demo panel is always open — visible by default on the login page.
  return <LoginForm showDemo={true} />
}
