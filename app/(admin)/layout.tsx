'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import clsx from 'clsx'
import { useAuth, UserButton } from '@clerk/nextjs'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'

import { useIsAdmin } from '@/lib/hooks'
import { APP_BRAND_NAME, brandLogoClass } from '@/lib/brand'

const adminNav = [
  { label: 'Tenants', href: '/admin' },
  { label: 'Plan requests', href: '/admin/requests' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId } = useAuth()
  const { isAdmin, loading } = useIsAdmin()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoaded && !userId) {
      router.replace('/')
      return
    }
    if (isLoaded && userId && !loading && !isAdmin) {
      router.replace('/')
    }
  }, [isLoaded, userId, loading, isAdmin, router])

  if (!isLoaded || loading || !isAdmin) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                'flex size-7 items-center justify-center rounded-lg text-xs font-bold',
                brandLogoClass,
              )}
            >
              B
            </span>
            <span className="text-sm font-semibold text-zinc-950 dark:text-white">
              {APP_BRAND_NAME} <span className="text-zinc-400">/ Admin</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              <ArrowLeftIcon className="size-4" />
              Back to dashboard
            </Link>
            <UserButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-6 px-4 sm:px-6 lg:px-8">
          {adminNav.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'border-b-2 pb-3 text-sm font-medium transition-colors',
                  active
                    ? 'border-brand-600 text-brand-700 dark:border-brand-500 dark:text-brand-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
