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
  /** IANA timezone (e.g. "America/New_York"). Authoritative source for booking conversions. */
  timezone: string
  working_hours: Record<string, unknown>
  booking_buffers: Record<string, unknown>
  escalation_rules: Record<string, unknown>
  crm_type: string
  crm_credential_ref: string
  /** Jobber OAuth health fields (read-only in Settings). */
  crm_settings?: CrmSettings
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
  /** Admin-managed lifecycle: 'pending' (awaiting activation), 'active', 'suspended'. */
  account_status: AccountStatus
  created_at: string
  updated_at: string
}

/** Tenant lifecycle controlled by platform admins. */
export type AccountStatus = 'pending' | 'active' | 'suspended'

export interface CrmSettings {
  /** True when Jobber OAuth refresh failed — owner should reconnect. */
  jobber_needs_reconnect?: boolean
  jobber_last_error?: string
  jobber_last_refresh_at?: string
  jobber_last_refresh_ok_at?: string
}

export interface TimezoneChoice {
  /** IANA name saved on the tenant, e.g. "America/New_York". */
  value: string
  /** Friendly label shown to the user in the dropdown. */
  label: string
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
  /** Profile or page image URL when the server stored one (OAuth). */
  picture_url?: string | null
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
  source_channel: 'whatsapp' | 'facebook' | 'instagram' | 'web' | 'call' | 'api' | string
  source_contact: string | null
  customer_name: string
  customer_phone: string
  customer_address: string | null
  service_type: string
  selected_slot: string | null
  notes: string | null
  crm_job_id: string | null
  crm_contact_id: string | null
  status: 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'no_show' | string
  status_note: string | null
  status_changed_at: string | null
  chat_summary: string | null
  created_at: string
  updated_at: string
}

/** Lightweight message preview returned by the booking-details endpoint. */
export interface BookingMessagePreview {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool' | string
  content: string
  created_at: string
}

/** Vapi call snapshot returned alongside booking details (when applicable). */
export interface BookingCallPreview {
  id: string
  direction: string
  status: string
  duration_seconds: number | null
  summary: string | null
  transcript: string | null
  recording_url: string | null
  started_at: string | null
  ended_at: string | null
}

/** Full payload returned by `GET /api/bookings/{id}/details`. */
export interface BookingDetails extends Booking {
  conversation_channel: string | null
  conversation_intent: string | null
  messages: BookingMessagePreview[]
  call: BookingCallPreview | null
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

/** Photo / voice / etc. persisted from Messenger or Instagram inbound media. */
export interface MessageAttachment {
  id: string
  kind: 'image' | 'audio' | 'video' | 'document' | string
  mime_type: string | null
  duration_seconds: number | null
  ai_caption: string | null
  ai_transcript: string | null
  /** Short-lived signed URL from Cloudinary (authenticated assets). */
  delivery_url: string | null
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  channel_message_id: string | null
  created_at: string
  attachments?: MessageAttachment[]
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
  caller_name: string
  assistant_id: string
  duration_seconds: number | null
  cost: number | null
  has_recording: boolean
  has_transcript: boolean
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
  /** Bookings created during this Vapi session (requires backend linkage). */
  bookings_count: number
}

/** Full call record (GET /api/calls/{id}). */
export interface CallLogDetail extends CallLogSummary {
  recording_url: string | null
  transcript: string | null
  summary: string | null
  metadata: Record<string, unknown>
  bookings: Booking[]
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
  /** assistant-speaks-first | assistant-speaks-first-with-model-generated-message | assistant-waits-for-user */
  first_message_mode?: string
  model_provider: string
  model_name: string
  voice: Record<string, unknown>
  /** Deepgram config: { provider, model, language, smartFormat, keyterm[], keywords[], endpointing? } */
  transcriber: Record<string, unknown>
  end_call_phrases: string[]
  /** See https://docs.vapi.ai/customization/voice-pipeline-configuration */
  start_speaking_plan?: Record<string, unknown>
  stop_speaking_plan?: Record<string, unknown>
  silence_timeout_seconds?: number | null
  max_duration_seconds?: number | null
  /** "off" | "office" | URL to a custom mp3/wav. */
  background_sound?: string
  recording_enabled?: boolean | null
  voicemail_message?: string
  end_call_message?: string
  /**
   * Krisp smart denoising → Vapi ``backgroundSpeechDenoisingPlan``.
   * https://docs.vapi.ai/documentation/assistants/conversation-behavior/background-speech-denoising
   * Shape: ``{ smartDenoisingPlan: { enabled: boolean } }``
   */
  background_speech_denoising_plan?: Record<string, unknown>
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

// ---------------------------------------------------------------------------
// Plans + subscription (matches api/services/usage.py and api/routes/plans.py)
// ---------------------------------------------------------------------------

/** A prepaid credit pack shown on the standalone /plans page. */
export interface Plan {
  id: string
  name: string
  /** One-time price of the credit pack (legacy field name). */
  monthly_price_cents: number
  currency: string
  messages_quota: number
  call_minutes_quota: number
  /** How long the pack stays usable, in days. */
  validity_days: number
  features: string[]
  best_for: string
  is_featured: boolean
}

/**
 * Quota states are computed from the worst-of (messages, call minutes):
 *  - "ok"       — < 80% used
 *  - "warning"  — 80–99%   (amber bar, soft banner)
 *  - "over"     — ≥ 100%   (pack exhausted, traffic rejected by the gate)
 *  - "expired"  — validity window lapsed (traffic rejected)
 *  - "blocked"  — legacy; treated like "over"
 *  - "no_plan"  — tenant has no active subscription
 */
export type QuotaState = 'ok' | 'warning' | 'over' | 'expired' | 'blocked' | 'no_plan'

export interface SubscriptionUsage {
  messages_used: number
  messages_remaining: number
  messages_pct: number
  call_minutes_used: number
  call_minutes_remaining: number
  call_minutes_pct: number
  quota_state: QuotaState
}

export interface Subscription {
  plan: Plan | null
  /** ISO 8601 UTC; null when the tenant has no active plan yet. */
  period_start: string | null
  /** = expires_at (end of validity window); null when no plan. */
  period_end: string | null
  usage: SubscriptionUsage
  messages_allowance: number
  call_minutes_allowance: number
  is_expired: boolean
}

/** Result of POST /api/tenants/me/plan-change-request. */
export interface PlanChangeRequestResult {
  id: string
  status: string
  requested_plan_id: string | null
  message: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Admin control plane (matches api/routes/admin.py)
// ---------------------------------------------------------------------------

export interface AdminMe {
  is_admin: boolean
  user_id: string
}

export interface AdminPlanInfo {
  id: string
  name: string
  monthly_price_cents: number
  messages_quota: number
  call_minutes_quota: number
  validity_days: number
}

export interface AdminUsageInfo {
  messages_used: number
  messages_quota: number
  call_minutes_used: number
  call_minutes_quota: number
  quota_state: QuotaState
}

export interface AdminTenant {
  id: string
  name: string
  slug: string | null
  account_status: AccountStatus
  is_active: boolean
  created_at: string
  plan: AdminPlanInfo | null
  usage: AdminUsageInfo
  /** ISO 8601 UTC; end of the prepaid validity window (null when no plan). */
  subscription_expires_at: string | null
  is_expired: boolean
  bookings_count: number
  conversations_count: number
}

export interface AdminPlanChangeRequest {
  id: string
  tenant_id: string
  tenant_name: string | null
  requested_plan_id: string | null
  message: string
  status: 'open' | 'resolved' | 'dismissed'
  created_at: string
  resolved_at: string | null
}

/** Platform-wide stats for the admin console Overview page. */
export interface AdminOverview {
  tenants_total: number
  tenants_active: number
  tenants_pending: number
  tenants_suspended: number
  open_plan_requests: number
  bookings_total: number
  conversations_total: number
  calls_total: number
  messages_30d: number
  recent_tenants: AdminTenant[]
  recent_requests: AdminPlanChangeRequest[]
}

/** One manual credit top-up (audit log entry). */
export interface CreditAdjustment {
  id: string
  messages_delta: number
  call_minutes_delta: number
  reason: string
  admin_id: string
  created_at: string
}

/** Single-tenant detail (GET /api/admin/tenants/{id}). */
export interface AdminTenantDetail extends AdminTenant {
  timezone: string
  industry_type: string
  crm_type: string
  channels: string[]
  calls_count: number
  recent_adjustments: CreditAdjustment[]
  members: AdminOrgMember[]
}

/** Result of POST /api/admin/tenants/{id}/open-workspace (Clerk impersonation URL). */
export interface OpenWorkspaceResult {
  url: string
}

/** Full plan row for the admin plans manager (GET /api/admin/plans). */
export interface AdminPlan {
  id: string
  name: string
  monthly_price_cents: number
  currency: string
  messages_quota: number
  call_minutes_quota: number
  validity_days: number
  features: string[]
  best_for: string
  is_featured: boolean
  sort_order: number
  is_active: boolean
  subscriber_count: number
}

/** Body for POST /api/admin/plans (create) — id is derived server-side. */
export interface PlanWriteBody {
  name: string
  monthly_price_cents: number
  currency: string
  messages_quota: number
  call_minutes_quota: number
  validity_days: number
  features: string[]
  best_for: string
  is_featured: boolean
  sort_order: number
  is_active: boolean
}

/** Body for PATCH /api/admin/plans/{id} (all fields optional). */
export type PlanUpdateBody = Partial<PlanWriteBody>

/** Body for POST /api/admin/tenants/{id}/credits. */
export interface AddCreditsBody {
  messages_delta: number
  call_minutes_delta: number
  reason: string
}

export interface DeletePlanResult {
  deleted: boolean
  detail: string
}

/** Result of POST /api/admin/verify-identity (step-up password check). */
export interface VerifyIdentityResult {
  verification_token: string
  /** Epoch seconds. */
  expires_at: number
}

/** One member of a client's Clerk organization (profile view). */
export interface AdminOrgMember {
  user_id: string
  first_name: string
  last_name: string
  email: string
  image_url: string
  role: string
  created_at: string | null
  last_sign_in_at: string | null
}

export interface AdminTenantProfile {
  tenant_id: string
  organization_name: string
  members: AdminOrgMember[]
}

export interface DeleteTenantResult {
  deleted: boolean
  clerk_org_deleted: boolean
  detail: string
}
