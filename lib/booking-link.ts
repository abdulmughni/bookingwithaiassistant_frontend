/** Decode the short booking token used in notification emails. */

function padBase64(value: string): string {
  const rest = value.length % 4
  return rest === 0 ? value : value + '='.repeat(4 - rest)
}

export function decodeBookingId(token: string): string | null {
  const cleaned = token.trim()
  if (!cleaned || cleaned.length > 120) return null
  try {
    const binary = atob(padBase64(cleaned).replaceAll('-', '+').replaceAll('_', '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const id = new TextDecoder().decode(bytes).trim()
    if (!id || id.length > 80 || !/^[\w-]+$/.test(id)) return null
    return id
  } catch {
    return null
  }
}
