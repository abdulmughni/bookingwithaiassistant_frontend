/** Canonical tenant pricing stored in ``tenants.prices`` (JSONB). */
export interface TenantPrices {
  defaults: {
    diagnostic_visit: number
    standard_hourly_rate: number
    default_visit: number
  }
  services: Record<string, number>
}

export const DEFAULT_TENANT_PRICES: TenantPrices = {
  defaults: {
    diagnostic_visit: 89,
    standard_hourly_rate: 120,
    default_visit: 89,
  },
  services: {},
}

function parsePriceAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || typeof raw === 'boolean') return null
  if (typeof raw === 'number' && !Number.isNaN(raw) && raw > 0) return raw
  const text = String(raw).trim()
  if (!text) return null
  const cleaned = text.replace(/,/g, '').replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const val = Number.parseFloat(cleaned)
  return Number.isFinite(val) && val > 0 ? val : null
}

export function normalizeTenantPrices(raw: unknown): TenantPrices {
  if (!raw || typeof raw !== 'object') {
    return {
      defaults: { ...DEFAULT_TENANT_PRICES.defaults },
      services: {},
    }
  }

  const obj = raw as Record<string, unknown>
  if (obj.defaults || obj.services) {
    const defaultsSrc =
      obj.defaults && typeof obj.defaults === 'object'
        ? (obj.defaults as Record<string, unknown>)
        : {}
    const servicesSrc =
      obj.services && typeof obj.services === 'object'
        ? (obj.services as Record<string, unknown>)
        : {}

    const defaults = { ...DEFAULT_TENANT_PRICES.defaults }
    for (const key of Object.keys(defaults) as (keyof TenantPrices['defaults'])[]) {
      const parsed = parsePriceAmount(defaultsSrc[key])
      if (parsed !== null) defaults[key] = parsed
    }

    const services: Record<string, number> = {}
    for (const [name, amount] of Object.entries(servicesSrc)) {
      const key = String(name || '').trim()
      const parsed = parsePriceAmount(amount)
      if (key && parsed !== null) services[key] = parsed
    }

    return { defaults, services }
  }

  const services: Record<string, number> = {}
  for (const [name, amount] of Object.entries(obj)) {
    const key = String(name || '').trim()
    const parsed = parsePriceAmount(amount)
    if (key && parsed !== null) services[key] = parsed
  }

  return {
    defaults: { ...DEFAULT_TENANT_PRICES.defaults },
    services,
  }
}

export function buildTenantPricesPayload(
  defaults: TenantPrices['defaults'],
  services: Record<string, string>,
): TenantPrices {
  const outServices: Record<string, number> = {}
  for (const [name, raw] of Object.entries(services)) {
    const key = String(name || '').trim()
    const parsed = parsePriceAmount(raw)
    if (key && parsed !== null) outServices[key] = parsed
  }

  return {
    defaults: {
      diagnostic_visit: parsePriceAmount(defaults.diagnostic_visit) ?? DEFAULT_TENANT_PRICES.defaults.diagnostic_visit,
      standard_hourly_rate:
        parsePriceAmount(defaults.standard_hourly_rate) ?? DEFAULT_TENANT_PRICES.defaults.standard_hourly_rate,
      default_visit: parsePriceAmount(defaults.default_visit) ?? DEFAULT_TENANT_PRICES.defaults.default_visit,
    },
    services: outServices,
  }
}
