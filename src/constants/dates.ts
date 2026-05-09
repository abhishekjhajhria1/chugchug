// ─── Shared Date Constants & Utilities ───────────────────────────

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

export function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function getStartDayOfMonth(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1 // Monday = 0
}

export function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}
