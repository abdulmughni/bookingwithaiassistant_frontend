/**
 * IANA timezones for tenant scheduling, DB (TIMESTAMPTZ) interpretation, and Google Calendar.
 * Curated for United States, Canada, plus a few common “other” zones; any valid IANA string
 * is accepted via the custom field in the UI.
 */
export type IanaGroup = { group: string; options: { label: string; value: string }[] }

/** @internal dedupe and index */
function flattenGroups(groups: IanaGroup[]): { label: string; value: string }[] {
  const seen = new Set<string>()
  const out: { label: string; value: string }[] = []
  for (const g of groups) {
    for (const o of g.options) {
      if (seen.has(o.value)) continue
      seen.add(o.value)
      out.push(o)
    }
  }
  return out
}

/**
 * Grouped IANA zones (USA, Canada, a few other AM regions).
 * The UI renders these as <optgroup>; users can still paste any IANA name not listed.
 */
export const IANA_TIMEZONE_GROUPS: IanaGroup[] = [
  {
    group: 'Quick picks (US & Canada)',
    options: [
      { label: 'Eastern (NY, FL, GA) — America/New_York', value: 'America/New_York' },
      { label: 'Central (TX, IL, MO) — America/Chicago', value: 'America/Chicago' },
      { label: 'Mountain (CO, UT) — America/Denver', value: 'America/Denver' },
      { label: 'Arizona (no DST) — America/Phoenix', value: 'America/Phoenix' },
      { label: 'Pacific (CA, WA) — America/Los_Angeles', value: 'America/Los_Angeles' },
      { label: 'Alaska — America/Anchorage', value: 'America/Anchorage' },
      { label: 'Hawaii — Pacific/Honolulu', value: 'Pacific/Honolulu' },
      { label: 'Eastern (ON, QC) — America/Toronto', value: 'America/Toronto' },
      { label: 'Mountain (AB) — America/Edmonton', value: 'America/Edmonton' },
      { label: 'Pacific (BC) — America/Vancouver', value: 'America/Vancouver' },
    ],
  },
  {
    group: 'United States — additional',
    options: [
      { label: 'America/Adak', value: 'America/Adak' },
      { label: 'America/Boise', value: 'America/Boise' },
      { label: 'America/Detroit', value: 'America/Detroit' },
      { label: 'America/Indiana/Indianapolis', value: 'America/Indiana/Indianapolis' },
      { label: 'America/Indiana/Knox', value: 'America/Indiana/Knox' },
      { label: 'America/Indiana/Marengo', value: 'America/Indiana/Marengo' },
      { label: 'America/Indiana/Petersburg', value: 'America/Indiana/Petersburg' },
      { label: 'America/Indiana/Tell_City', value: 'America/Indiana/Tell_City' },
      { label: 'America/Indiana/Vevay', value: 'America/Indiana/Vevay' },
      { label: 'America/Indiana/Vincennes', value: 'America/Indiana/Vincennes' },
      { label: 'America/Indiana/Winamac', value: 'America/Indiana/Winamac' },
      { label: 'America/Juneau', value: 'America/Juneau' },
      { label: 'America/Kentucky/Louisville', value: 'America/Kentucky/Louisville' },
      { label: 'America/Kentucky/Monticello', value: 'America/Kentucky/Monticello' },
      { label: 'America/Metlakatla', value: 'America/Metlakatla' },
      { label: 'America/Menominee', value: 'America/Menominee' },
      { label: 'America/Nome', value: 'America/Nome' },
      { label: 'America/North_Dakota/Beulah', value: 'America/North_Dakota/Beulah' },
      { label: 'America/North_Dakota/Center', value: 'America/North_Dakota/Center' },
      { label: 'America/North_Dakota/New_Salem', value: 'America/North_Dakota/New_Salem' },
      { label: 'America/Sitka', value: 'America/Sitka' },
      { label: 'America/Yakutat', value: 'America/Yakutat' },
      { label: 'America/Puerto_Rico', value: 'America/Puerto_Rico' },
      { label: 'Pacific/Midway', value: 'Pacific/Midway' },
      { label: 'Pacific/Guam', value: 'Pacific/Guam' },
    ],
  },
  {
    group: 'Canada (more cities)',
    options: [
      { label: 'Newfoundland — America/St_Johns', value: 'America/St_Johns' },
      { label: 'Atlantic — America/Halifax', value: 'America/Halifax' },
      { label: 'Atlantic — America/Moncton', value: 'America/Moncton' },
      { label: 'Atlantic — America/Glace_Bay', value: 'America/Glace_Bay' },
      { label: 'Atlantic — America/Goose_Bay', value: 'America/Goose_Bay' },
      { label: 'Atlantic (AST, no DST) — America/Blanc-Sablon', value: 'America/Blanc-Sablon' },
      { label: 'Eastern — America/Montreal', value: 'America/Montreal' },
      { label: 'Eastern — America/Nipigon', value: 'America/Nipigon' },
      { label: 'Eastern — America/Thunder_Bay', value: 'America/Thunder_Bay' },
      { label: 'Eastern — America/Atikokan', value: 'America/Atikokan' },
      { label: 'Eastern (no DST) — America/Coral_Harbour', value: 'America/Coral_Harbour' },
      { label: 'Central — America/Winnipeg', value: 'America/Winnipeg' },
      { label: 'Central — America/Rainy_River', value: 'America/Rainy_River' },
      { label: 'Saskatchewan (no DST) — America/Regina', value: 'America/Regina' },
      { label: 'Saskatchewan (no DST) — America/Swift_Current', value: 'America/Swift_Current' },
      { label: 'Mountain (no DST) — America/Creston', value: 'America/Creston' },
      { label: 'Mountain — America/Dawson_Creek', value: 'America/Dawson_Creek' },
      { label: 'Mountain — America/Fort_Nelson', value: 'America/Fort_Nelson' },
      { label: 'Pacific — America/Whitehorse', value: 'America/Whitehorse' },
      { label: 'Pacific — America/Dawson', value: 'America/Dawson' },
      { label: 'Arctic (ET) — America/Iqaluit', value: 'America/Iqaluit' },
      { label: 'Arctic (CT) — America/Rankin_Inlet', value: 'America/Rankin_Inlet' },
      { label: 'Arctic (CT) — America/Resolute', value: 'America/Resolute' },
      { label: 'Arctic (MT) — America/Cambridge_Bay', value: 'America/Cambridge_Bay' },
      { label: 'Arctic (MT) — America/Yellowknife', value: 'America/Yellowknife' },
      { label: 'Arctic (MT) — America/Inuvik', value: 'America/Inuvik' },
    ],
  },
  {
    group: 'Other (common)',
    options: [
      { label: 'UTC — UTC', value: 'UTC' },
      { label: 'Ireland / UK (example) — Europe/London', value: 'Europe/London' },
      { label: 'Central Europe — Europe/Berlin', value: 'Europe/Berlin' },
      { label: 'Mexico City — America/Mexico_City', value: 'America/Mexico_City' },
      { label: 'São Paulo — America/Sao_Paulo', value: 'America/Sao_Paulo' },
    ],
  },
]

const _flat = flattenGroups(IANA_TIMEZONE_GROUPS)
export const IANA_PRESET_VALUE_SET: ReadonlySet<string> = new Set(_flat.map((o) => o.value))

export const IANA_TIMEZONE_CUSTOM = '__custom_iana__'

export function isPresetIana(value: string): boolean {
  return IANA_PRESET_VALUE_SET.has(value.trim())
}
