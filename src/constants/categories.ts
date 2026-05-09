// ─── Shared Category Constants ───────────────────────────────────
// Single source of truth for category colors, emoji, and definitions.

import type { ActivityCategory } from "../types"

export const CAT_COLORS: Record<string, string> = {
  drink: 'var(--amber)',
  snack: 'var(--coral)',
  cigarette: 'var(--sage)',
  gym: 'var(--indigo)',
  detox: 'var(--sage)',
  water: 'var(--blue)',
}

export const CAT_EMOJI: Record<string, string> = {
  drink: '🍻',
  snack: '🍟',
  cigarette: '🚬',
  gym: '💪',
  detox: '🧘',
  water: '💧',
}

export interface CategoryDef {
  id: ActivityCategory
  label: string
  icon: string
  color: string
  bg: string
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'drink',     label: 'Drink',  icon: '🍻', color: 'var(--amber)',  bg: 'var(--amber-dim)' },
  { id: 'water',     label: 'Water',  icon: '💧', color: 'var(--blue)',   bg: 'var(--indigo-dim)' },
  { id: 'snack',     label: 'Snack',  icon: '🍟', color: 'var(--coral)',  bg: 'var(--coral-dim)' },
  { id: 'cigarette', label: 'Smoke',  icon: '🚬', color: 'var(--sage)',   bg: 'var(--sage-dim)' },
  { id: 'gym',       label: 'Gym',    icon: '💪', color: 'var(--indigo)', bg: 'var(--indigo-dim)' },
  { id: 'detox',     label: 'Detox',  icon: '🧘', color: 'var(--sage)',   bg: 'var(--sage-dim)' },
]

export const MOOD_TAGS = [
  { emoji: '😄', label: 'Social' },
  { emoji: '😌', label: 'Chill' },
  { emoji: '😤', label: 'Stress' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '😴', label: 'Tired' },
]

// ─── Drink Calorie Estimates ─────────────────────────────────────
export const DRINK_CALORIES: Record<string, number> = {
  beer: 150, lager: 150, ale: 160, ipa: 200, stout: 210,
  wine: 120, champagne: 110, prosecco: 80,
  vodka: 100, whiskey: 110, rum: 100, tequila: 100, gin: 110,
  cocktail: 180, margarita: 200, mojito: 175, "long island": 250,
  shot: 100, sake: 130, soju: 65,
  default: 130,
}

export function estimateCalories(itemName: string, qty: number): number {
  const lower = itemName.toLowerCase()
  for (const [key, cal] of Object.entries(DRINK_CALORIES)) {
    if (lower.includes(key)) return cal * qty
  }
  return DRINK_CALORIES.default * qty
}

// ─── Country Flags ───────────────────────────────────────────────
export const COUNTRY_FLAGS: Record<string, string> = {
  'india': '🇮🇳', 'usa': '🇺🇸', 'united states': '🇺🇸', 'uk': '🇬🇧', 'united kingdom': '🇬🇧',
  'canada': '🇨🇦', 'australia': '🇦🇺', 'germany': '🇩🇪', 'france': '🇫🇷', 'japan': '🇯🇵',
  'brazil': '🇧🇷', 'mexico': '🇲🇽', 'spain': '🇪🇸', 'italy': '🇮🇹', 'south korea': '🇰🇷',
  'china': '🇨🇳', 'russia': '🇷🇺', 'netherlands': '🇳🇱', 'sweden': '🇸🇪', 'norway': '🇳🇴',
  'denmark': '🇩🇰', 'finland': '🇫🇮', 'switzerland': '🇨🇭', 'portugal': '🇵🇹', 'ireland': '🇮🇪',
  'new zealand': '🇳🇿', 'singapore': '🇸🇬', 'thailand': '🇹🇭', 'philippines': '🇵🇭',
  'indonesia': '🇮🇩', 'malaysia': '🇲🇾', 'vietnam': '🇻🇳', 'argentina': '🇦🇷', 'colombia': '🇨🇴',
  'chile': '🇨🇱', 'peru': '🇵🇪', 'egypt': '🇪🇬', 'nigeria': '🇳🇬', 'south africa': '🇿🇦',
  'turkey': '🇹🇷', 'pakistan': '🇵🇰', 'bangladesh': '🇧🇩', 'sri lanka': '🇱🇰', 'nepal': '🇳🇵',
  'uae': '🇦🇪', 'saudi arabia': '🇸🇦', 'poland': '🇵🇱', 'austria': '🇦🇹', 'belgium': '🇧🇪',
  'czech republic': '🇨🇿', 'greece': '🇬🇷', 'romania': '🇷🇴', 'hungary': '🇭🇺', 'ukraine': '🇺🇦',
}

export function getFlag(country?: string): string {
  if (!country) return '🌍'
  return COUNTRY_FLAGS[country.toLowerCase().trim()] || '🌍'
}
