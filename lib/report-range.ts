/** Short weekly-report link token. Matches the backend encoder. */

export interface ReportRange {
  start: string
  end: string
  tenantId: string
}

function padBase64(value: string): string {
  const rest = value.length % 4
  return rest === 0 ? value : value + '='.repeat(4 - rest)
}

export function encodeReportRange(start: string, end: string, tenantId: string): string {
  const raw = `${start.replaceAll('-', '')}${end.replaceAll('-', '')}.${tenantId}`
  const bytes = new TextEncoder().encode(raw)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function decodeReportRange(token: string): ReportRange | null {
  const cleaned = token.trim()
  if (!cleaned) return null
  try {
    const binary = atob(padBase64(cleaned).replaceAll('-', '+').replaceAll('_', '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const raw = new TextDecoder().decode(bytes)
    const dot = raw.indexOf('.')
    if (dot !== 16) return null
    const start = toIsoDate(raw.slice(0, 8))
    const end = toIsoDate(raw.slice(8, 16))
    const tenantId = raw.slice(17)
    if (!start || !end || end < start || !tenantId) return null
    return { start, end, tenantId }
  } catch {
    return null
  }
}

function toIsoDate(compact: string): string | null {
  if (!/^\d{8}$/.test(compact)) return null
  const iso = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
  const parsed = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  const check = parsed.toISOString().slice(0, 10)
  return check === iso ? iso : null
}

export function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day))
  next.setUTCDate(next.getUTCDate() + days)
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function presetRange(
  kind: 'week' | 'month' | 'year',
  today: string,
): { start: string; end: string } {
  if (kind === 'week') return { start: shiftDateKey(today, -7), end: today }
  const [year, month] = today.split('-')
  if (kind === 'month') return { start: `${year}-${month}-01`, end: today }
  return { start: `${year}-01-01`, end: today }
}

export function formatRangeLabel(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  return `${fmt(start)} – ${fmt(end)}`
}

export function rangeDayCount(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00Z`).getTime()
  const b = new Date(`${end}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}
