export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function statusColor(
  status: string,
): 'lime' | 'amber' | 'zinc' | 'red' | 'sky' | 'green' {
  switch (status) {
    case 'confirmed':
      return 'lime'
    case 'rescheduled':
      return 'sky'
    case 'pending':
      return 'amber'
    case 'completed':
      return 'green'
    case 'cancelled':
      return 'red'
    case 'no_show':
      return 'zinc'
    case 'active':
      return 'sky'
    case 'closed':
      return 'zinc'
    default:
      return 'zinc'
  }
}

export function channelColor(
  channel: string,
): 'lime' | 'sky' | 'amber' | 'zinc' {
  switch (channel) {
    case 'whatsapp':
      return 'lime'
    case 'facebook':
      return 'sky'
    case 'instagram':
      return 'amber'
    default:
      return 'zinc'
  }
}
