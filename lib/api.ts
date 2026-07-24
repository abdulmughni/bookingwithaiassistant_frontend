const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

/** Sent on every backend fetch so ngrok does not inject its HTML interstitial. */
const NGROK_BROWSER_HEADER: Record<string, string> = {
  'ngrok-skip-browser-warning': 'true',
}

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
    ...NGROK_BROWSER_HEADER,
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
    headers: {
      ...NGROK_BROWSER_HEADER,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
    headers: {
      ...NGROK_BROWSER_HEADER,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
    timezones: (token: string) =>
      request<import('./types').TimezoneChoice[]>('/api/tenants/timezones', { token }),
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
    details: (token: string, id: string) =>
      request<import('./types').BookingDetails>(`/api/bookings/${id}/details`, { token }),
    update: (token: string, id: string, data: Record<string, unknown>) =>
      request<import('./types').Booking>(`/api/bookings/${id}`, { token, method: 'PATCH', body: JSON.stringify(data) }),
    cancel: (token: string, id: string, note?: string) =>
      request<import('./types').Booking>(`/api/bookings/${id}/cancel`, {
        token,
        method: 'POST',
        body: JSON.stringify({ note: note ?? null }),
      }),
    complete: (token: string, id: string, note?: string) =>
      request<import('./types').Booking>(`/api/bookings/${id}/complete`, {
        token,
        method: 'POST',
        body: JSON.stringify({ note: note ?? null }),
      }),
    noShow: (token: string, id: string, note?: string) =>
      request<import('./types').Booking>(`/api/bookings/${id}/no-show`, {
        token,
        method: 'POST',
        body: JSON.stringify({ note: note ?? null }),
      }),
    searchByPhone: (token: string, phone: string) =>
      request<import('./types').Booking[]>(`/api/bookings/search/phone/${encodeURIComponent(phone)}`, { token }),
    searchByConversation: (token: string, conversationId: string) =>
      request<import('./types').Booking[]>(
        `/api/bookings/search/conversation/${encodeURIComponent(conversationId)}`,
        { token },
      ),
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
    listPaged: (
      token: string,
      params?: { limit?: number; offset?: number; channel?: string; q?: string },
    ) => {
      const qs = new URLSearchParams()
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.offset) qs.set('offset', String(params.offset))
      if (params?.channel) qs.set('channel', params.channel)
      if (params?.q) qs.set('q', params.q)
      const q = qs.toString()
      return request<import('./types').ConversationsPage>(
        `/api/conversations/paged${q ? `?${q}` : ''}`,
        { token },
      )
    },
    messagesPaged: (
      token: string,
      id: string,
      params?: { limit?: number; offset?: number; order?: 'asc' | 'desc' },
    ) => {
      const qs = new URLSearchParams()
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.offset) qs.set('offset', String(params.offset))
      if (params?.order) qs.set('order', params.order)
      const q = qs.toString()
      return request<import('./types').MessagesPage>(
        `/api/conversations/${id}/messages/paged${q ? `?${q}` : ''}`,
        { token },
      )
    },
    send: (token: string, conversationId: string, content: string) =>
      request<import('./types').Message>(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        body: JSON.stringify({ content }),
      }),
    remove: (token: string, conversationId: string) =>
      requestDelete(token, `/api/conversations/${encodeURIComponent(conversationId)}`),
  },

  notifications: {
    list: (
      token: string,
      params?: { limit?: number; unreadOnly?: boolean },
    ) => {
      const qs = new URLSearchParams()
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.unreadOnly) qs.set('unread_only', 'true')
      const q = qs.toString()
      return request<import('./types').NotificationList>(
        `/api/notifications${q ? `?${q}` : ''}`,
        { token },
      )
    },
    markRead: (token: string, id: string) =>
      request<null>(`/api/notifications/${id}/read`, { method: 'POST', token }),
    markAllRead: (token: string) =>
      request<null>('/api/notifications/read-all', { method: 'POST', token }),
  },

  customers: {
    list: (token: string, params?: { q?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams()
      if (params?.q) qs.set('q', params.q)
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.offset) qs.set('offset', String(params.offset))
      const q = qs.toString()
      return request<import('./types').Customer[]>(`/api/customers${q ? `?${q}` : ''}`, { token })
    },
    count: (token: string, q?: string) => {
      const qs = q ? `?q=${encodeURIComponent(q)}` : ''
      return request<{ count: number }>(`/api/customers/count${qs}`, { token })
    },
    get: (token: string, id: string) =>
      request<import('./types').CustomerDetail>(`/api/customers/${encodeURIComponent(id)}`, {
        token,
      }),
    update: (
      token: string,
      id: string,
      body: Partial<
        Pick<
          import('./types').Customer,
          'display_name' | 'email' | 'primary_address' | 'notes'
        > & { phone: string | null }
      >,
    ) =>
      request<import('./types').Customer>(`/api/customers/${encodeURIComponent(id)}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
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
    jobberStart: (token: string) =>
      request<{ authorization_url: string }>('/api/oauth/jobber/start', {
        token,
        method: 'POST',
        body: JSON.stringify({}),
      }),
    jobberDisconnect: (token: string) =>
      request<null>('/api/oauth/jobber/disconnect', {
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

  calls: {
    list: (token: string, params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams()
      if (params?.limit) qs.set('limit', String(params.limit))
      if (params?.offset) qs.set('offset', String(params.offset))
      const q = qs.toString()
      return request<import('./types').CallLogSummary[]>(`/api/calls${q ? `?${q}` : ''}`, { token })
    },
    listPaged: (
      token: string,
      params: {
        limit?: number
        offset?: number
        direction?: string
        status?: string
        q?: string
        /** YYYY-MM-DD — inclusive; filters by call day (started_at, else created_at). */
        started_from?: string
        started_to?: string
      } = {},
    ) => {
      const qs = new URLSearchParams()
      if (params.limit) qs.set('limit', String(params.limit))
      if (params.offset) qs.set('offset', String(params.offset))
      if (params.direction) qs.set('direction', params.direction)
      if (params.status) qs.set('status', params.status)
      if (params.q) qs.set('q', params.q)
      if (params.started_from) qs.set('started_from', params.started_from)
      if (params.started_to) qs.set('started_to', params.started_to)
      const q = qs.toString()
      return request<import('./types').CallLogsPage>(
        `/api/calls/paged${q ? `?${q}` : ''}`,
        { token },
      )
    },
    get: (token: string, id: string) =>
      request<import('./types').CallLogDetail>(`/api/calls/${encodeURIComponent(id)}`, { token }),
    remove: (token: string, id: string) =>
      requestDelete(token, `/api/calls/${encodeURIComponent(id)}`),
    stats: (token: string, period: 'week' | 'month' = 'week') =>
      request<import('./types').CallStats>(
        `/api/calls/stats?period=${encodeURIComponent(period)}`,
        { token },
      ),
  },

  voice: {
    get: (token: string) => request<import('./types').VoiceConfig>('/api/voice', { token }),
    update: (token: string, data: Partial<import('./types').VoiceSettings>) =>
      request<import('./types').VoiceConfig>('/api/voice', {
        token,
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    sync: (token: string) =>
      request<import('./types').VoiceSyncResponse>('/api/voice/sync', { token, method: 'POST' }),
    deleteAssistant: (token: string) =>
      request<import('./types').VoiceConfig>('/api/voice/assistant', { token, method: 'DELETE' }),
    listPhoneNumbers: (token: string) =>
      request<import('./types').VoicePhoneNumber[]>('/api/voice/phone-numbers', { token }),
    createFreeNumber: (token: string, areaCode: string, name?: string) =>
      request<import('./types').VoiceConfig>('/api/voice/phone-numbers/free', {
        token,
        method: 'POST',
        body: JSON.stringify({ area_code: areaCode, name: name ?? '' }),
      }),
    importTwilioNumber: (
      token: string,
      data: {
        number: string
        twilio_account_sid: string
        twilio_auth_token: string
        name?: string
      },
    ) =>
      request<import('./types').VoiceConfig>('/api/voice/phone-numbers/twilio', {
        token,
        method: 'POST',
        body: JSON.stringify({
          number: data.number,
          twilio_account_sid: data.twilio_account_sid,
          twilio_auth_token: data.twilio_auth_token,
          name: data.name ?? '',
        }),
      }),
    attachPhoneNumber: (token: string, phoneId: string) =>
      request<import('./types').VoiceConfig>(
        `/api/voice/phone-numbers/${encodeURIComponent(phoneId)}/attach`,
        { token, method: 'POST' },
      ),
    detachPhoneNumber: (token: string, phoneId: string) =>
      request<import('./types').VoiceConfig>(
        `/api/voice/phone-numbers/${encodeURIComponent(phoneId)}/detach`,
        { token, method: 'POST' },
      ),
    listTools: (token: string) =>
      request<import('./types').VoiceToolsResponse>('/api/voice/tools', { token }),
  },

  plans: {
    list: (token: string) => request<import('./types').Plan[]>('/api/plans', { token }),
    mySubscription: (token: string) =>
      request<import('./types').Subscription>('/api/tenants/me/subscription', { token }),
    requestChange: (
      token: string,
      data: { requested_plan_id?: string | null; message?: string },
    ) =>
      request<import('./types').PlanChangeRequestResult>(
        '/api/tenants/me/plan-change-request',
        {
          token,
          method: 'POST',
          body: JSON.stringify({
            requested_plan_id: data.requested_plan_id ?? null,
            message: data.message ?? '',
          }),
        },
      ),
  },

  admin: {
    me: (token: string) => request<import('./types').AdminMe>('/api/admin/me', { token }),
    overview: (token: string) =>
      request<import('./types').AdminOverview>('/api/admin/overview', { token }),
    listTenants: (token: string) =>
      request<import('./types').AdminTenant[]>('/api/admin/tenants', { token }),
    getTenant: (token: string, tenantId: string) =>
      request<import('./types').AdminTenantDetail>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}`,
        { token },
      ),
    getTenantFunnel: (
      token: string,
      tenantId: string,
      period: 'week' | 'month' | 'all' = 'month',
    ) =>
      request<import('./types').AdminFunnel>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/funnel?period=${period}`,
        { token },
      ),
    listTenantBookings: (token: string, tenantId: string) =>
      request<import('./types').AdminBookingRow[]>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/bookings`,
        { token },
      ),
    updateTenantBooking: (
      token: string,
      tenantId: string,
      bookingId: string,
      data: { status?: string; estimated_value?: number | null },
    ) =>
      request<{ id: string; status: string; estimated_value: number | null }>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/bookings/${encodeURIComponent(bookingId)}`,
        { token, method: 'PATCH', body: JSON.stringify(data) },
      ),
    listTenantConversations: (
      token: string,
      tenantId: string,
      params?: { flagged_only?: boolean },
    ) => {
      const qs = params?.flagged_only ? '?flagged_only=true' : ''
      return request<import('./types').AdminConversationRow[]>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/conversations${qs}`,
        { token },
      )
    },
    flagTenantConversation: (
      token: string,
      tenantId: string,
      conversationId: string,
      flagged: boolean,
    ) =>
      request<{ id: string; flagged: boolean }>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/conversations/${encodeURIComponent(conversationId)}/flag`,
        { token, method: 'PATCH', body: JSON.stringify({ flagged }) },
      ),
    setTenantChannelAi: (
      token: string,
      tenantId: string,
      data: { channel: string; account_id: string; ai_enabled: boolean },
    ) =>
      request<{ channel: string; account_id: string; ai_enabled: boolean }>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/channels/ai`,
        { token, method: 'PATCH', body: JSON.stringify(data) },
      ),
    verifyIdentity: (token: string, password: string) =>
      request<import('./types').VerifyIdentityResult>('/api/admin/verify-identity', {
        token,
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    tenantProfile: (token: string, tenantId: string) =>
      request<import('./types').AdminTenantProfile>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/profile`,
        { token },
      ),
    getClientLogin: (token: string, tenantId: string, verificationToken: string) =>
      request<import('./types').ClientLoginCredentials>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/client-login`,
        {
          token,
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'X-Admin-Verification': verificationToken },
        },
      ),
    deleteTenant: (token: string, tenantId: string, verificationToken: string) =>
      request<import('./types').DeleteTenantResult>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}`,
        {
          token,
          method: 'DELETE',
          headers: { 'X-Admin-Verification': verificationToken },
        },
      ),
    activate: (token: string, tenantId: string) =>
      request<import('./types').AdminTenant>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/activate`,
        { token, method: 'POST', body: JSON.stringify({}) },
      ),
    suspend: (token: string, tenantId: string) =>
      request<import('./types').AdminTenant>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/suspend`,
        { token, method: 'POST', body: JSON.stringify({}) },
      ),
    assignPlan: (token: string, tenantId: string, planId: string) =>
      request<import('./types').AdminTenant>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/plan`,
        { token, method: 'POST', body: JSON.stringify({ plan_id: planId }) },
      ),
    addCredits: (
      token: string,
      tenantId: string,
      data: import('./types').AddCreditsBody,
    ) =>
      request<import('./types').AdminTenantDetail>(
        `/api/admin/tenants/${encodeURIComponent(tenantId)}/credits`,
        { token, method: 'POST', body: JSON.stringify(data) },
      ),
    listPlans: (token: string) =>
      request<import('./types').AdminPlan[]>('/api/admin/plans', { token }),
    createPlan: (token: string, data: import('./types').PlanWriteBody) =>
      request<import('./types').AdminPlan>('/api/admin/plans', {
        token,
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updatePlan: (token: string, planId: string, data: import('./types').PlanUpdateBody) =>
      request<import('./types').AdminPlan>(
        `/api/admin/plans/${encodeURIComponent(planId)}`,
        { token, method: 'PATCH', body: JSON.stringify(data) },
      ),
    deletePlan: (token: string, planId: string) =>
      request<import('./types').DeletePlanResult>(
        `/api/admin/plans/${encodeURIComponent(planId)}`,
        { token, method: 'DELETE' },
      ),
    listRequests: (token: string, status?: string) => {
      const qs = status ? `?status=${encodeURIComponent(status)}` : ''
      return request<import('./types').AdminPlanChangeRequest[]>(
        `/api/admin/plan-change-requests${qs}`,
        { token },
      )
    },
    resolveRequest: (token: string, requestId: string, status: 'resolved' | 'dismissed' = 'resolved') =>
      request<import('./types').AdminPlanChangeRequest>(
        `/api/admin/plan-change-requests/${encodeURIComponent(requestId)}/resolve`,
        { token, method: 'POST', body: JSON.stringify({ status }) },
      ),
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
