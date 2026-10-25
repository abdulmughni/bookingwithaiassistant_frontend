export type BrandThemeColors = {
  page_background: string
  card_background: string
  soft_background: string
  primary: string
  accent: string
  main_text: string
  subtext: string
  button_text: string
  border: string
}

/** Today's Beyonds Logic shell. Agencies that have not saved colors keep this. */
export const CURRENT_THEME: BrandThemeColors = {
  page_background: '#fafafa',
  card_background: '#ffffff',
  soft_background: '#f4f4f5',
  primary: '#3b59ff',
  accent: '#2438e6',
  main_text: '#18181b',
  subtext: '#71717a',
  button_text: '#ffffff',
  border: '#e4e4e7',
}

export const BRAND_PRESETS: { id: string; name: string; colors: BrandThemeColors }[] = [
  { id: 'current', name: 'Current', colors: CURRENT_THEME },
  {
    id: 'service-blue',
    name: 'Service blue',
    colors: {
      page_background: '#f4f7fb',
      card_background: '#ffffff',
      soft_background: '#e7eef8',
      primary: '#1d4ed8',
      accent: '#0f3a9e',
      main_text: '#0f172a',
      subtext: '#64748b',
      button_text: '#ffffff',
      border: '#d6e0ee',
    },
  },
  {
    id: 'field-green',
    name: 'Field green',
    colors: {
      page_background: '#f4f7f5',
      card_background: '#ffffff',
      soft_background: '#e6f0ea',
      primary: '#0f766e',
      accent: '#115e59',
      main_text: '#14221c',
      subtext: '#5f6f68',
      button_text: '#ffffff',
      border: '#d5e4dc',
    },
  },
  {
    id: 'navy-copper',
    name: 'Navy copper',
    colors: {
      page_background: '#f7f5f2',
      card_background: '#ffffff',
      soft_background: '#eeeae4',
      primary: '#1e3a5f',
      accent: '#b45309',
      main_text: '#1c1917',
      subtext: '#78716c',
      button_text: '#ffffff',
      border: '#e7e0d6',
    },
  },
  {
    id: 'clean-slate',
    name: 'Clean slate',
    colors: {
      page_background: '#f5f6f8',
      card_background: '#ffffff',
      soft_background: '#eceff3',
      primary: '#334155',
      accent: '#2563eb',
      main_text: '#0f172a',
      subtext: '#64748b',
      button_text: '#ffffff',
      border: '#e2e6ec',
    },
  },
]

export const THEME_ROWS: { key: keyof BrandThemeColors; label: string }[] = [
  { key: 'page_background', label: 'Page background' },
  { key: 'card_background', label: 'Card background' },
  { key: 'soft_background', label: 'Soft background' },
  { key: 'primary', label: 'Primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'main_text', label: 'Main text' },
  { key: 'subtext', label: 'Subtext' },
  { key: 'button_text', label: 'Button text' },
  { key: 'border', label: 'Border' },
]

const HEX = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim())
}

export function themesMatch(a: BrandThemeColors, b: BrandThemeColors): boolean {
  return THEME_ROWS.every((row) => a[row.key].toLowerCase() === b[row.key].toLowerCase())
}
