import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <SignIn />
    </div>
  )
}
