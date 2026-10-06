import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from "date-fns"

// ──────────────────────────────────────────────
// Date Formatters
// ──────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMM d, yyyy")
}

export function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), "h:mm a")
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), "MMM d, yyyy · h:mm a")
}

export function formatRelative(dateStr: string): string {
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
}

export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), "MMM d")
}

export function formatDayOfWeek(dateStr: string): string {
  return format(parseISO(dateStr), "EEE")
}

// ──────────────────────────────────────────────
// Number Formatters
// ──────────────────────────────────────────────

export function formatScore(score: number, max: number = 10): string {
  return `${score}/${max}`
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatSentimentScore(score: number): string {
  const sign = score >= 0 ? "+" : ""
  return `${sign}${score.toFixed(2)}`
}

// ──────────────────────────────────────────────
// String Formatters
// ──────────────────────────────────────────────

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + "..."
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ──────────────────────────────────────────────
// Color Interpolation
// ──────────────────────────────────────────────

export function scoreToColor(score: number, max: number = 10): string {
  const ratio = score / max
  if (ratio >= 0.8) return "text-emerald-400"
  if (ratio >= 0.6) return "text-green-400"
  if (ratio >= 0.4) return "text-amber-400"
  if (ratio >= 0.2) return "text-orange-400"
  return "text-red-400"
}

export function sentimentToGradient(score: number): string {
  if (score >= 0.3)  return "from-emerald-500 to-cyan-500"
  if (score >= 0)    return "from-blue-500 to-cyan-500"
  if (score >= -0.3) return "from-amber-500 to-orange-500"
  return "from-red-500 to-pink-500"
}
