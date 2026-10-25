import Image from 'next/image'
import clsx from 'clsx'

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
        <BrandLogo src={logoUrl} alt={name || 'Logo'} height={height} className="max-w-28 shrink-0" />
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
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || 'Logo'}
        className={clsx('w-auto object-contain object-left', className)}
        style={{ height, width: 'auto', maxWidth: '100%' }}
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
