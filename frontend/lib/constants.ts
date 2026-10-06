// ──────────────────────────────────────────────
// Emoji & Emotion Maps
// ──────────────────────────────────────────────

export const MOOD_EMOJIS: Record<number, { emoji: string; label: string }> = {
  1:  { emoji: "😢", label: "Terrible" },
  2:  { emoji: "😞", label: "Very Bad" },
  3:  { emoji: "😔", label: "Bad" },
  4:  { emoji: "😕", label: "Down" },
  5:  { emoji: "😐", label: "Neutral" },
  6:  { emoji: "🙂", label: "Okay" },
  7:  { emoji: "😊", label: "Good" },
  8:  { emoji: "😄", label: "Great" },
  9:  { emoji: "🤩", label: "Amazing" },
  10: { emoji: "🌟", label: "Excellent" },
}

export const EMOTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Happy:   { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  Sad:     { bg: "bg-blue-500/10",    text: "text-blue-400",    border: "border-blue-500/20" },
  Anxious: { bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  Angry:   { bg: "bg-red-500/10",     text: "text-red-400",     border: "border-red-500/20" },
  Calm:    { bg: "bg-cyan-500/10",    text: "text-cyan-400",    border: "border-cyan-500/20" },
  Neutral: { bg: "bg-gray-500/10",    text: "text-gray-400",    border: "border-gray-500/20" },
}

export const EMOTION_EMOJIS: Record<string, string> = {
  Happy:   "😊",
  Sad:     "😢",
  Anxious: "😰",
  Angry:   "😠",
  Calm:    "😌",
  Neutral: "😐",
}

// ──────────────────────────────────────────────
// Cluster / Pattern Labels
// ──────────────────────────────────────────────

export const CLUSTER_LABELS: Record<string, { label: string; description: string; color: string; icon: string }> = {
  Balanced:     { label: "Balanced",      description: "Well-rounded wellness metrics across the board",            color: "emerald", icon: "⚖️" },
  "High-Stress": { label: "High-Stress",  description: "Elevated stress levels with potential impact on mood",      color: "red",     icon: "🔥" },
  "Low-Energy":  { label: "Low-Energy",   description: "Reduced energy reserves — rest and recovery may help",      color: "amber",   icon: "🔋" },
  Recovery:     { label: "Recovery",      description: "Transitioning from a difficult period toward improvement",  color: "blue",    icon: "🌱" },
}

// ──────────────────────────────────────────────
// Trend Direction
// ──────────────────────────────────────────────

export const TREND_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  Improving: { icon: "↑", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  Declining: { icon: "↓", color: "text-red-400",     bgColor: "bg-red-500/10" },
  Stable:    { icon: "→", color: "text-blue-400",    bgColor: "bg-blue-500/10" },
}

// ──────────────────────────────────────────────
// Context Tags for Check-ins
// ──────────────────────────────────────────────

export const CONTEXT_TAGS = [
  "Work", "Family", "Health", "Exercise", "Social",
  "Finance", "Creative", "Nature", "Travel", "Learning",
  "Meditation", "Relationship", "Weather", "Hobby", "Rest",
]

// ──────────────────────────────────────────────
// Activity Categories
// ──────────────────────────────────────────────

export const ACTIVITY_CATEGORIES: Record<string, { color: string; icon: string }> = {
  Mindfulness:  { color: "purple", icon: "🧘" },
  Exercise:     { color: "orange", icon: "🏃" },
  Social:       { color: "pink",   icon: "👥" },
  Creative:     { color: "cyan",   icon: "🎨" },
  Relaxation:   { color: "blue",   icon: "🌊" },
  Nutrition:    { color: "green",  icon: "🥗" },
  Sleep:        { color: "indigo", icon: "😴" },
  Learning:     { color: "amber",  icon: "📚" },
}

// ──────────────────────────────────────────────
// Weather Codes (WMO)
// ──────────────────────────────────────────────

export const WEATHER_ICONS: Record<number, string> = {
  0: "☀️",  1: "🌤️",  2: "⛅",  3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️",
  80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
}

// ──────────────────────────────────────────────
// Sentiment Score Labels
// ──────────────────────────────────────────────

export function getSentimentLabel(score: number): { label: string; color: string } {
  if (score >= 0.5)  return { label: "Very Positive", color: "emerald" }
  if (score >= 0.1)  return { label: "Positive",      color: "green" }
  if (score >= -0.1) return { label: "Neutral",       color: "gray" }
  if (score >= -0.5) return { label: "Negative",      color: "amber" }
  return { label: "Very Negative", color: "red" }
}

// ──────────────────────────────────────────────
// AQI Labels
// ──────────────────────────────────────────────

export function getAqiInfo(aqi: number): { label: string; color: string; emoji: string } {
  if (aqi <= 50)  return { label: "Good",      color: "emerald", emoji: "🟢" }
  if (aqi <= 100) return { label: "Moderate",  color: "amber",   emoji: "🟡" }
  if (aqi <= 150) return { label: "Unhealthy for Sensitive", color: "orange", emoji: "🟠" }
  if (aqi <= 200) return { label: "Unhealthy", color: "red",     emoji: "🔴" }
  return { label: "Hazardous", color: "purple", emoji: "🟣" }
}

// ──────────────────────────────────────────────
// Navigation Items
// ──────────────────────────────────────────────

export const NAV_ITEMS = [
  { name: "Dashboard",        href: "/dashboard",                  icon: "LayoutDashboard" },
  { name: "Daily Check-In",   href: "/dashboard/check-in",         icon: "Smile" },
  { name: "AI Journal",       href: "/dashboard/journal",          icon: "BookOpen" },
  { name: "Sleep Tracker",    href: "/dashboard/sleep",            icon: "Moon" },
  { name: "Insights",         href: "/dashboard/insights",         icon: "LineChart" },
  { name: "Digital Twin",     href: "/dashboard/digital-twin",     icon: "Brain" },
  { name: "Recommendations",  href: "/dashboard/recommendations",  icon: "Award" },
  { name: "AI Companion",     href: "/dashboard/companion",        icon: "MessageSquare" },
  { name: "Settings",         href: "/dashboard/settings",         icon: "Settings" },
] as const
