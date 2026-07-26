'use server'
import { auth } from '@/lib/auth'

/** Returns the current signed-in user's email — used by DemoRoleSwitcher. */
export async function getDemoSessionEmail(): Promise<string | null> {
  try {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (session?.user as any)?.email ?? null
  } catch {
    return null
  }
}
