/** Tenant profile from GET/PATCH /api/tenants/me (id = Clerk org, read-only). */
export interface Tenant {
  id: string
  name: string
  slug: string | null
  industry_type: string
  service_types: string[]
  required_fields: string[]
  optional_fields: string[]
  emergency_keywords: string[]
  service_areas: string[]
  service_area_zips: string[]
  supported_regions: string[]
  /** When industry is field_service: subset of hvac | plumbing | electrical. Empty = all three. */
  offered_trades?: string[]
  working_hours: Record<string, unknown>
  booking_buffers: Record<string, unknown>
  escalation_rules: Record<string, unknown>
  calendar_type: string
  calendar_credential_ref: string
  calendar_settings: Record<string, unknown>
  crm_type: string
  crm_credential_ref: string
  prices: Record<string, unknown>
  emergency_surcharge: string
  overtime_surcharge: string
  /** Accepted payment methods (e.g. "Cash", "Bank transfer"). */
  payment_methods: string[]
  technical_playbooks: unknown[]
  intent_keywords: Record<string, unknown>
  tone_keywords: Record<string, unknown>
  confidence_threshold: number
  max_turns: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TenantStats {
  total_bookings: number
  confirmed_bookings: number
  completed_bookings: number
  cancelled_bookings: number
  upcoming_bookings: number
  active_conversations: number
  total_channel_accounts: number
}

export interface ChannelAccount {
  tenant_id: string
  channel: 'whatsapp' | 'facebook' | 'instagram' | 'web'
  account_id: string
  label: string
  is_active: boolean
  verify_token: string
  /** True when a Page token is stored server-side; raw token is never returned. */
  has_access_token?: boolean
  connection_status: 'verified' | 'pending' | 'error' | string
  connection_message: string | null
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

/** Matches GET/PATCH /api/bookings (selected_slot = appointment start). */
export interface Booking {
  id: string
  tenant_id: string
  conversation_id: string | null
  customer_name: string
  customer_phone: string
  customer_address: string | null
  service_type: string
  selected_slot: string | null
  notes: string | null
  calendar_event_id: string | null
  confirmation_url: string | null
  crm_job_id: string | null
  crm_contact_id: string | null
  status: 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'no_show' | string
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  tenant_id: string
  channel: string
  /** Same as channel_account_id from API */
  account_id: string
  channel_account_id?: string
  customer_id: string
  /** Resolved display title (API: WhatsApp prefers profile/phone; Messenger/IG prefers label then profile) */
  customer_name: string | null
  /** WhatsApp / web profile-style name from webhook */
  customer_display_name?: string | null
  /** Messenger / Instagram name from Graph or webhook sender */
  customer_label_name?: string | null
  customer_phone: string | null
  /** Profile image from Meta / WhatsApp when available */
  customer_avatar_url?: string | null
  /** Page name, IG handle label, or WhatsApp number label from channel setup */
  channel_account_label?: string | null
  intent: string | null
  status: 'active' | 'closed' | 'archived'
  current_node: string | null
  booking_id: string | null
  created_at: string
  updated_at: string
  /** Latest message snippet for inbox list (from API) */
  last_message_preview?: string | null
  last_message_role?: string | null
  last_message_at?: string | null
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  channel_message_id: string | null
  created_at: string
}

export interface ConversationsPage {
  items: Conversation[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  next_offset: number | null
}

export interface MessagesPage {
  items: Message[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  next_offset: number | null
}

export interface Credential {
  ref: string
  integration_type: string
  created_at: string
  updated_at: string
  /** True when encrypted credentials exist in the store (API field: exists). */
  exists: boolean
}

/** Per-tenant LLM prompt configuration. */
export interface PromptConfig {
  node_key: string
  label: string
  description: string
  prompt_text: string
  is_custom: boolean
  updated_at: string | null
}

/** Knowledge base doc category (Pinecone doc_type). */
export interface KnowledgeDocTypeInfo {
  id: string
  title: string
  short: string
  used_in: string
  why_upload: string
}

export interface KnowledgeStatus {
  rag_configured: boolean
  index_name: string
}

export interface RagDocument {
  id: string
  doc_type: string
  title: string
  original_filename: string
  chunk_count: number
  created_at: string
  updated_at: string
}

export interface RagDocumentIngestResult extends RagDocument {
  message?: string
}

/** Compact call record for the call list view (GET /api/calls). */
export interface CallLogSummary {
  id: string
  vapi_call_id: string
  direction: 'inbound' | 'outbound' | 'web' | string
  status: string
  ended_reason: string | null
  phone_number: string
  assistant_id: string
  duration_seconds: number | null
  cost: number | null
  has_recording: boolean
  has_transcript: boolean
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

/** Full call record (GET /api/calls/{id}). */
export interface CallLogDetail extends CallLogSummary {
  recording_url: string | null
  transcript: string | null
  summary: string | null
  metadata: Record<string, unknown>
}

/** Paged call list response from /api/calls/paged. */
export interface CallLogsPage {
  items: CallLogSummary[]
  total: number
  limit: number
  offset: number
  has_more: boolean
  next_offset: number | null
}

/** Editable voice settings stored locally in tenants.voice_settings. */
export interface VoiceSettings {
  system_prompt: string
  first_message: string
  model_provider: string
  model_name: string
  voice: Record<string, unknown>
  transcriber: Record<string, unknown>
  end_call_phrases: string[]
}

/** GET /api/voice — full voice config + connection status. API key never returned. */
export interface VoiceConfig {
  enabled: boolean
  /** Backend has VAPI_PLATFORM_API_KEY set — voice features are available. */
  platform_configured: boolean
  /** @deprecated alias for platform_configured (kept for legacy frontend builds). */
  has_api_key: boolean
  assistant_id: string
  phone_number_id: string
  webhook_url: string
  has_webhook_secret: boolean
  last_synced_at: string | null
  settings: VoiceSettings
  defaults: { system_prompt: string; first_message: string }
}

export interface VoicePhoneNumber {
  id: string
  number: string
  name: string
  provider: string
  assistant_id: string | null
}

export interface VoiceSyncResponse {
  assistant_id: string
  webhook_url: string
  last_synced_at: string
  message: string
  tools_created: string[]
  tools_updated: string[]
  tools_skipped: string[]
  tools_failed: string[]
}

/**
 * One catalogue tool the Vapi assistant can call. The backend exposes these
 * via `GET /api/voice/tools`; the Voice Setup page renders them so customers
 * can see exactly which capabilities the assistant has been wired with.
 *
 * `bound = true` means the tool already exists on the tenant's Vapi account
 * (i.e. it has been pushed via `POST /api/voice/sync`) and `vapi_tool_id`
 * carries its registry id. `bound = false` rows still appear in the list —
 * they describe the tool the next sync will create.
 */
export interface VoiceTool {
  name: string
  description: string
  is_async: boolean
  request_start: string
  vapi_tool_id: string | null
  bound: boolean
}

export interface VoiceToolsResponse {
  items: VoiceTool[]
  total: number
  bound_count: number
}
