import Image from 'next/image'
import clsx from 'clsx'

type BrandLogoProps = {
  className?: string
  /** Image height in px — width scales to preserve aspect ratio. */
  height?: number
  priority?: boolean
}

/** Full Beyonds Logic wordmark logo (icon + text in one PNG). */
export function BrandLogo({ className, height = 28, priority = false }: BrandLogoProps) {
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
