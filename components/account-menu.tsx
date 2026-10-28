'use client'

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { useClerk, useUser } from '@clerk/nextjs'
import { ArrowRightStartOnRectangleIcon, Cog6ToothIcon } from '@heroicons/react/20/solid'

function initials(name: string, email: string) {
  const source = name.trim() || email
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function Avatar({ name, email, imageUrl }: { name: string; email: string; imageUrl?: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 text-xs font-semibold text-zinc-600">
      {imageUrl ? (
        // Clerk profile photos are remote and already sized for a small avatar.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        initials(name, email)
      )}
    </span>
  )
}

export function AccountMenu({
  portalName,
  compact = false,
}: {
  portalName: string
  compact?: boolean
}) {
  const { user } = useUser()
  const { openUserProfile, signOut } = useClerk()
  if (!user) return null

  const email = user.primaryEmailAddress?.emailAddress ?? ''
  const name = portalName.trim() || 'Account'

  return (
    <Menu as="div" className="relative">
      <MenuButton className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-zinc-950/5 focus:outline-none data-open:bg-zinc-950/5 dark:hover:bg-white/5 dark:data-open:bg-white/5">
        <Avatar name={name} email={email} imageUrl={user.imageUrl} />
        {compact ? null : (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-950 dark:text-white">{name}</span>
            <span className="block truncate text-xs text-zinc-500">{email}</span>
          </span>
        )}
      </MenuButton>
      <MenuItems
        anchor="top start"
        className="z-50 w-72 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-zinc-200 [--anchor-gap:8px] focus:outline-none dark:bg-zinc-900 dark:ring-zinc-700"
      >
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar name={name} email={email} imageUrl={user.imageUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{name}</p>
            <p className="truncate text-xs text-zinc-500">{email}</p>
          </div>
        </div>
        <div className="mx-2 my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
        <MenuItem>
          <button
            type="button"
            onClick={() => openUserProfile()}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 data-focus:bg-zinc-50 dark:text-zinc-200 dark:data-focus:bg-zinc-800"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              <Cog6ToothIcon className="size-4" />
            </span>
            Manage account
          </button>
        </MenuItem>
        <MenuItem>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 data-focus:bg-zinc-50 dark:text-zinc-200 dark:data-focus:bg-zinc-800"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              <ArrowRightStartOnRectangleIcon className="size-4" />
            </span>
            Sign out
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  )
}
