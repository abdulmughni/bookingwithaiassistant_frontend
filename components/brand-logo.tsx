'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import clsx from 'clsx'

/**
 * A plain <img> does not send the header that skips the ngrok warning page,
 * so the logo URL comes back as HTML and the browser draws a broken image.
 * Fetch it the same way API calls do, then show the bytes.
 */
async function looksLikeImage(blob: Blob) {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
  const png = head[0] === 0x89 && head[1] === 0x50
  const jpg = head[0] === 0xff && head[1] === 0xd8
  const webp = head[0] === 0x52 && head[1] === 0x49 && head[8] === 0x57
  return png || jpg || webp
}

function useBrandImage(src?: string | null) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!src) {
      setUrl(null)
      return
    }
    if (src.startsWith('/') || src.startsWith('blob:') || src.startsWith('data:')) {
      setUrl(src)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    ;(async () => {
      try {
        const res = await fetch(src, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        })
        if (!res.ok) return
        const blob = await res.blob()
        const kind = blob.type || res.headers.get('content-type') || ''
        if (!kind.startsWith('image/') && !(await looksLikeImage(blob))) return
        objectUrl = URL.createObjectURL(blob)
        if (!cancelled) setUrl(objectUrl)
      } catch {
        /* Leave the slot empty instead of a broken image. */
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  return url
}

type BrandLogoProps = {
  className?: string
  /** Image height in px — width scales to preserve aspect ratio. */
  height?: number
  priority?: boolean
  /** Agency logo. When set, this replaces the Beyonds Logic wordmark. */
  src?: string | null
  alt?: string
}

/** Agency or client corner: logo plus agency name. Never falls back to the admin wordmark. */
export function ShellBrand({
  loading,
  logoUrl,
  name,
  height = 31,
}: {
  loading: boolean
  logoUrl?: string | null
  name?: string | null
  height?: number
}) {
  if (loading) {
    return <div aria-hidden className="w-36" style={{ height }} />
  }
  if (!logoUrl && !name) {
    return <div aria-hidden className="w-36" style={{ height }} />
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      {logoUrl ? (
        <BrandLogo src={logoUrl} alt="" height={height} className="max-w-28 shrink-0" />
      ) : null}
      {name ? (
        <span className="truncate text-sm font-semibold leading-tight text-zinc-950 dark:text-white">
          {name}
        </span>
      ) : null}
    </span>
  )
}

/** Full Beyonds Logic wordmark logo (icon + text in one PNG). */
export function BrandLogo({ className, height = 28, priority = false, src, alt }: BrandLogoProps) {
  const image = useBrandImage(src && !src.startsWith('http') ? src : null)
  if (src) {
    const shown = src.startsWith('http') ? src : image
    if (!shown) return null
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={shown}
        alt={alt || ''}
        className={clsx('w-auto object-contain object-left', className)}
        style={{ height, width: 'auto' }}
        onError={(event) => {
          event.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  // Source asset is wide; keep a generous width so Next Image doesn't crop.
  const width = Math.round(height * 4.2)

  return (
    <Image
      src="/beyondslogic-logo.png"
      alt="Beyonds Logic"
      width={width}
      height={height}
      priority={priority}
      className={clsx('h-auto w-auto object-contain object-left', className)}
      style={{ height, width: 'auto' }}
    />
  )
}
