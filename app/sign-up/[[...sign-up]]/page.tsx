import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <SignUp />
    </div>
  )
}
