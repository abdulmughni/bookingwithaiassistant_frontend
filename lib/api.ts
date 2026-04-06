const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Parse FastAPI / JSON error bodies into a short user-facing string. */
export function parseApiErrorMessage(body: string): string {
  try {
    const j = JSON.parse(body) as { detail?: unknown }
    const d = j.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) {
      return d
        .map((item) =>
          typeof item === 'object' && item !== null && 'msg' in item
            ? String((item as { msg: string }).msg)
            : JSON.stringify(item),
        )
        .join('; ')
    }
  } catch {
    /* not JSON */
  }
  const t = body.trim()
  return t.length > 280 ? `${t.slice(0, 280)}…` : t
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(fetchOptions.headers as Record<string, string> || {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, parseApiErrorMessage(body))
  }

  if (res.status === 204) return null as T
  return res.json()
}

async function requestFormData<T>(
  path: string,
  token: string,
  formData: FormData,
  method: 'POST' | 'PUT',
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, parseApiErrorMessage(body))
  }
  return res.json() as Promise<T>
}

async function requestDelete(token: string, path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const body = await res.text()
    throw new ApiError(res.status, parseApiErrorMessage(body))
  }
}

export const api = {
  tenants: {
    me: (token: string) => request<import('./types').Tenant>('/api/tenants/me', { token }),
    update: (token: string, data: Record<string, unknown>) =>
      request<import('./types').Tenant>('/api/tenants/me', { token, method: 'PATCH', body: JSON.stringify(data) }),
    stats: (token: string) => request<import('./types').TenantStats>('/api/tenants/me/stats', { token }),
  },

  channels: {
    list: (token: string) => request<import('./types').ChannelAccount[]>('/api/channels', { token }),
    create: (token: string, data: Record<string, unknown>) =>
      request<import('./types').ChannelAccount>('/api/channels', { token, method: 'POST', body: JSON.stringify(data) }),
    get: (token: string, channel: string, accountId: string) =>
      request<import('./types').ChannelAccount>(`/api/channels/${channel}/${accountId}`, { token }),
    update: (token: string, channel: string, accountId: string, data: Record<string, unknown>) =>
      request<import('./types').ChannelAccount>(`/api/channels/${channel}/${accountId}`, { token, method: 'PATCH', body: JSON.stringify(data) }),
    remove: (token: string, channel: string, accountId: string) =>
      request<void>(`/api/channels/${channel}/${accountId}`, { token, method: 'DELETE' }),
    activate: (token: string, channel: string, accountId: string) =>
      request<import('./types').ChannelAccount>(`/api/channels/${channel}/${accountId}/activate`, { token, method: 'PATCH' }),
    deactivate: (token: string, channel: string, accountId: string) =>
      request<import('./types').ChannelAccount>(`/api/channels/${channel}/${accountId}/deactivate`, { token, method: 'PATCH' }),
    verify: (token: string, channel: string, accountId: string) =>
      request<{ connection_status: string; connection_message: string; last_verified_at: string }>(
        `/api/channels/${channel}/${accountId}/verify`,
        { token, method: 'POST' },
      ),
  },

  bookings: {
    list: (token: string, params?: { status?: string; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.status) qs.set('status', params.status)
      if (params?.limit) qs.set('limit', String(params.limit))
      const q = qs.toString()
      return request<import('./types').Booking[]>(`/api/bookings${q ? `?${q}` : ''}`, { token })
    },
    create: (token: string, data: Record<string, unknown>) =>
      request<import('./types').Booking>('/api/bookings', { token, method: 'POST', body: JSON.stringify(data) }),
    upcoming: (token: string) => request<import('./types').Booking[]>('/api/bookings/upcoming', { token }),
    get: (token: string, id: string) => request<import('./types').Booking>(`/api/bookings/${id}`, { token }),
    update: (token: string, id: string, data: Record<string, unknown>) =>
      request<import('./types').Booking>(`/api/bookings/${id}`, { token, method: 'PATCH', body: JSON.stringify(data) }),
    cancel: (token: string, id: string) =>
      request<import('./types').Booking>(`/api/bookings/${id}/cancel`, { token, method: 'POST' }),
    complete: (token: string, id: string) =>
      request<import('./types').Booking>(`/api/bookings/${id}/complete`, { token, method: 'POST' }),
    noShow: (token: string, id: string) =>
      request<import('./types').Booking>(`/api/bookings/${id}/no-show`, { token, method: 'POST' }),
    searchByPhone: (token: string, phone: string) =>
      request<import('./types').Booking[]>(`/api/bookings/search/phone/${encodeURIComponent(phone)}`, { token }),
  },

  conversations: {
    list: (token: string, params?: { limit?: number }) => {
      const n = params?.limit ?? 200
      return request<import('./types').Conversation[]>(`/api/conversations?limit=${n}`, { token })
    },
    active: (token: string) => request<import('./types').Conversation[]>('/api/conversations/active', { token }),
    get: (token: string, id: string) =>
      request<import('./types').Conversation & { messages: import('./types').Message[] }>(`/api/conversations/${id}`, { token }),
    messages: (token: string, id: string) =>
      request<import('./types').Message[]>(`/api/conversations/${id}/messages`, { token }),
  },

  oauth: {
    facebookStart: (token: string) =>
      request<{ authorization_url: string }>('/api/oauth/facebook/start', {
        token,
        method: 'POST',
        body: JSON.stringify({}),
      }),
    whatsappStart: (token: string) =>
      request<{ authorization_url: string }>('/api/oauth/whatsapp/start', {
        token,
        method: 'POST',
        body: JSON.stringify({}),
      }),
    instagramStart: (token: string) =>
      request<{ authorization_url: string }>('/api/oauth/instagram/start', {
        token,
        method: 'POST',
        body: JSON.stringify({}),
      }),
    googleCalendarStart: (token: string) =>
      request<{ authorization_url: string }>('/api/oauth/google/start', {
        token,
        method: 'POST',
        body: JSON.stringify({}),
      }),
  },

  knowledge: {
    docTypes: (token: string) =>
      request<import('./types').KnowledgeDocTypeInfo[]>('/api/knowledge/doc-types', { token }),
    status: (token: string) =>
      request<import('./types').KnowledgeStatus>('/api/knowledge/status', { token }),
    listDocuments: (token: string) =>
      request<import('./types').RagDocument[]>('/api/knowledge/documents', { token }),
    uploadDocument: (token: string, formData: FormData) =>
      requestFormData<import('./types').RagDocumentIngestResult>(
        '/api/knowledge/documents',
        token,
        formData,
        'POST',
      ),
    replaceDocument: (token: string, documentId: string, formData: FormData) =>
      requestFormData<import('./types').RagDocumentIngestResult>(
        `/api/knowledge/documents/${encodeURIComponent(documentId)}`,
        token,
        formData,
        'PUT',
      ),
    deleteDocument: (token: string, documentId: string) =>
      requestDelete(token, `/api/knowledge/documents/${encodeURIComponent(documentId)}`),
  },

  prompts: {
    list: (token: string) => request<import('./types').PromptConfig[]>('/api/prompts', { token }),
    update: (token: string, nodeKey: string, promptText: string) =>
      request<import('./types').PromptConfig>(`/api/prompts/${nodeKey}`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ prompt_text: promptText }),
      }),
    reset: (token: string, nodeKey: string) =>
      request<import('./types').PromptConfig>(`/api/prompts/${nodeKey}/reset`, { token, method: 'POST' }),
    resetAll: (token: string) =>
      request<{ reset_count: number; status: string }>('/api/prompts/reset-all', { token, method: 'POST' }),
  },

  credentials: {
    list: (token: string) => request<import('./types').Credential[]>('/api/credentials', { token }),
    store: (token: string, data: { ref: string; integration_type: string; credentials: Record<string, unknown> }) =>
      request<{ ref: string; status: string }>('/api/credentials', { token, method: 'POST', body: JSON.stringify(data) }),
    check: (token: string, ref: string) => request<{ ref: string; exists: boolean }>(`/api/credentials/${ref}`, { token }),
    rotate: (token: string, ref: string, credentials: Record<string, unknown>) =>
      request<{ ref: string; status: string }>(`/api/credentials/${ref}/rotate`, { token, method: 'PATCH', body: JSON.stringify({ credentials }) }),
    remove: (token: string, ref: string) => request<void>(`/api/credentials/${ref}`, { token, method: 'DELETE' }),
  },
}

export { ApiError }
