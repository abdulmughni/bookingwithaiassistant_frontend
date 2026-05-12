/**
 * Brand-accurate inline SVGs for the channels that produce bookings/conversations.
 *
 * Why inline SVG and not an icon-font / external package?
 *  - Brand marks rarely change but their colours need to render correctly on
 *    both light and dark backgrounds, including inside a badge tint.
 *  - Inline SVG gives us full control over `fill`/`stroke` and avoids extra
 *    network requests + font-loading FOUC.
 *
 * Each icon picks `currentColor` by default so callers can recolour it (for
 * monochrome contexts) but the `colored` prop opts in to brand colours, which
 * is what the dashboard uses everywhere.
 */
import { useId } from 'react'
import clsx from 'clsx'
import {
  ComputerDesktopIcon,
  GlobeAltIcon,
  PhoneIcon,
} from '@heroicons/react/24/solid'
import { Badge } from './badge'

export type SourceChannel =
  | 'facebook'
  | 'instagram'
  | 'whatsapp'
  | 'web'
  | 'call'
  | 'api'
  | (string & {})

interface ChannelIconProps {
  channel: SourceChannel
  className?: string
  /** Apply brand colour. When false, the icon inherits `currentColor`. */
  colored?: boolean
}

/* ------------------------------------------------------------------------- */
/* Brand SVGs                                                                */
/* ------------------------------------------------------------------------- */

function FacebookGlyph({ className }: { className?: string }) {
  // Solid Facebook "f" mark (Meta brand book, simplified single-path version).
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramGlyph({ className, gradientId }: { className?: string; gradientId: string }) {
  // Camera-square mark in Instagram brand gradient.
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id={gradientId} cx="0.3" cy="1" r="1">
          <stop offset="0%" stopColor="#FED373" />
          <stop offset="25%" stopColor="#F15245" />
          <stop offset="60%" stopColor="#D92E7F" />
          <stop offset="90%" stopColor="#9B36B7" />
          <stop offset="100%" stopColor="#515ECF" />
        </radialGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849C2.381 3.924 3.896 2.38 7.151 2.233 8.417 2.175 8.796 2.163 12 2.163zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
      />
    </svg>
  )
}

function WhatsAppGlyph({ className }: { className?: string }) {
  // Official WhatsApp speech-bubble glyph (single path).
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  )
}

/* ------------------------------------------------------------------------- */
/* Public components                                                         */
/* ------------------------------------------------------------------------- */

export function ChannelIcon({ channel, className, colored = true }: ChannelIconProps) {
  // Each instance gets a stable, SSR-safe id so multiple Instagram icons on the
  // same page don't collide on the gradient `<defs>`.
  const reactId = useId()
  const c = (channel || '').toLowerCase()
  const base = clsx('h-3.5 w-3.5 shrink-0', className)

  if (c === 'facebook') {
    return (
      <FacebookGlyph
        className={clsx(base, colored && 'text-[#1877F2] dark:text-[#3b82f6]')}
      />
    )
  }
  if (c === 'instagram') {
    const gradientId = `ig-grad-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
    if (colored) {
      return <InstagramGlyph className={base} gradientId={gradientId} />
    }
    return (
      <InstagramGlyph
        className={clsx(base, 'text-current opacity-90')}
        gradientId={gradientId}
      />
    )
  }
  if (c === 'whatsapp') {
    return (
      <WhatsAppGlyph
        className={clsx(base, colored && 'text-[#25D366] dark:text-[#22c55e]')}
      />
    )
  }
  if (c === 'call') {
    return (
      <PhoneIcon
        aria-hidden="true"
        className={clsx(base, colored && 'text-purple-600 dark:text-purple-400')}
      />
    )
  }
  if (c === 'web') {
    return (
      <GlobeAltIcon
        aria-hidden="true"
        className={clsx(base, colored && 'text-sky-600 dark:text-sky-400')}
      />
    )
  }
  // 'api' and unknown channels fall through to a neutral monitor glyph so the
  // operator still gets a hint that the booking originated from the dashboard.
  return (
    <ComputerDesktopIcon
      aria-hidden="true"
      className={clsx(base, colored && 'text-zinc-500 dark:text-zinc-400')}
    />
  )
}

/* ------------------------------------------------------------------------- */
/* Friendly labels                                                           */
/* ------------------------------------------------------------------------- */

/** Long-form name shown next to the icon. */
export function channelLabel(channel: SourceChannel): string {
  const c = (channel || '').toLowerCase()
  if (c === 'facebook') return 'Messenger'
  if (c === 'instagram') return 'Instagram'
  if (c === 'whatsapp') return 'WhatsApp'
  if (c === 'call') return 'Voice call'
  if (c === 'api') return 'Dashboard'
  if (c === 'web') return 'Web chat'
  return c ? `${c.charAt(0).toUpperCase()}${c.slice(1)}` : 'Unknown'
}

/** Soft badge tint to pair with the brand glyph. */
export function channelBadgeColor(
  channel: SourceChannel,
):
  | 'blue'
  | 'pink'
  | 'lime'
  | 'purple'
  | 'sky'
  | 'zinc' {
  const c = (channel || '').toLowerCase()
  if (c === 'facebook') return 'blue'
  if (c === 'instagram') return 'pink'
  if (c === 'whatsapp') return 'lime'
  if (c === 'call') return 'purple'
  if (c === 'web') return 'sky'
  return 'zinc'
}

/**
 * Drop-in replacement for the old `<Badge color={...}>{prettySource(...)}</Badge>`.
 * Renders the brand glyph + the channel name in a tinted pill.
 */
export function SourceBadge({
  channel,
  className,
}: {
  channel: SourceChannel
  className?: string
}) {
  return (
    <Badge color={channelBadgeColor(channel)} className={className}>
      <ChannelIcon channel={channel} />
      <span>{channelLabel(channel)}</span>
    </Badge>
  )
}
