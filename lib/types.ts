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

export interface Booking {
  id: string
  tenant_id: string
  conversation_id: string | null
  customer_name: string
  customer_phone: string
  customer_address: string | null
  service_type: string
  scheduled_start: string
  scheduled_end: string | null
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  calendar_event_id: string | null
  crm_job_id: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  tenant_id: string
  channel: string
  account_id: string
  customer_id: string
  customer_name: string | null
  customer_phone: string | null
  intent: string | null
  status: 'active' | 'closed' | 'archived'
  current_node: string | null
  booking_id: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  channel_message_id: string | null
  created_at: string
}

export interface Credential {
  ref: string
  integration_type: string
  created_at: string
  updated_at: string
  has_credentials: boolean
}
