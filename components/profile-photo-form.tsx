'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'

import { Subheading } from '@/components/heading'
import { Input } from '@/components/input'
import { dashCardClass } from '@/components/dashboard-ui'

export function ProfilePhotoForm() {
  const { user } = useUser()
  const [saving, setSaving] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file || !user) return
    setSaving(true)
    try {
      await user.setProfileImage({ file })
      toast.success('Profile photo saved')
    } catch {
      toast.error('Could not save the profile photo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`${dashCardClass} p-5`}>
      <Subheading>Profile photo</Subheading>
      <p className="mt-1 text-sm text-zinc-500">
        This picture is yours. It is not the company logo.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="size-14 rounded-full object-cover" />
        ) : (
          <div className="size-14 rounded-full bg-zinc-100 dark:bg-zinc-800" />
        )}
        <div>
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={saving || !user}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {saving ? <p className="mt-1 text-xs text-zinc-500">Uploading…</p> : null}
        </div>
      </div>
    </section>
  )
}
