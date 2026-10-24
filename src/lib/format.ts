import type { Match } from '../api/types'

const LOCALE = 'fr-FR'

/** "2026-10-20" → Date locale à minuit (sans décalage de fuseau). */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date locale → "2026-10-20" (jour dans le fuseau de l'utilisateur). */
export function toDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export const today = () => toDay(new Date())

export function shiftDay(day: string, delta: number): string {
  const d = dayToDate(day)
  d.setDate(d.getDate() + delta)
  return toDay(d)
}

export function dayLabel(day: string): { weekday: string; date: string } {
  const d = dayToDate(day)
  return {
    weekday: d.toLocaleDateString(LOCALE, { weekday: 'short' }).replace('.', ''),
    date: d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }).replace('.', ''),
  }
}

export function longDay(day: string): string {
  const s = dayToDate(day).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "à l'instant"
  const m = Math.round(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'hier' : `il y a ${d} j`
}

// ---------- Séries ----------

export const bestOfLabel = (m: Pick<Match, 'bestOf'>) => `BO${m.bestOf}`

/** Libellé de statut court affiché sur les cartes. */
export function statusLabel(m: Match): string {
  if (m.state === 'pre') return timeOf(m.date)
  if (m.state === 'in') return m.live ? `Game ${m.live.game}` : m.estimated ? 'En cours (estimé)' : 'En cours'
  return m.winner ? 'Terminé' : 'Résultat à venir'
}

/** Score décisif : une équipe à une victoire de la série et l'autre aussi (ex. 2-2 en BO5, 1-1 en BO3). */
export function isDecider(m: Match): boolean {
  if (m.state !== 'in' || m.bestOf < 3) return false
  const need = Math.ceil(m.bestOf / 2)
  return (m.a.score ?? 0) === need - 1 && (m.b.score ?? 0) === need - 1
}

// ---------- Stats ----------

/** (K + A) / D, "Parfait" quand le joueur n'est jamais mort. */
export function kda(k: number, d: number, a: number): string {
  if (d === 0) return k + a > 0 ? 'Parfait' : '0,0'
  return ((k + a) / d).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export const kdaNum = (k: number, d: number, a: number) => (d === 0 ? k + a : (k + a) / d)

export const fixed = (n: number, digits = 1) =>
  n.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** 23 456 → "23,5k" */
export const kilo = (n: number) => (Math.abs(n) >= 1000 ? `${fixed(n / 1000)}k` : String(Math.round(n)))

export const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)} %` : '–')

/** Écart d'or signé : +1 234 → "+1,2k". */
export const goldDiff = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${kilo(Math.abs(n))}`

/** 31,4 minutes → « 31:24 ». */
export function clock(minutes: number): string {
  const s = Math.round(minutes * 60)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** "26:01" ou 26.02 minutes → minutes décimales. */
export const minutesOf = (len: string): number => {
  const [m, s] = len.split(':').map(Number)
  return (m || 0) + (s || 0) / 60
}

/** Pays → drapeau (emoji), pour les pays les plus courants du circuit. */
const FLAGS: Record<string, string> = {
  France: '🇫🇷',
  Germany: '🇩🇪',
  Spain: '🇪🇸',
  Denmark: '🇩🇰',
  Sweden: '🇸🇪',
  Poland: '🇵🇱',
  Slovenia: '🇸🇮',
  Bulgaria: '🇧🇬',
  Greece: '🇬🇷',
  Belgium: '🇧🇪',
  Netherlands: '🇳🇱',
  Turkey: '🇹🇷',
  Estonia: '🇪🇪',
  Ukraine: '🇺🇦',
  Italy: '🇮🇹',
  'United Kingdom': '🇬🇧',
  'South Korea': '🇰🇷',
  China: '🇨🇳',
  Taiwan: '🇹🇼',
  Japan: '🇯🇵',
  Vietnam: '🇻🇳',
  Canada: '🇨🇦',
  'United States': '🇺🇸',
  Brazil: '🇧🇷',
  Australia: '🇦🇺',
  Mexico: '🇲🇽',
  Argentina: '🇦🇷',
  Chile: '🇨🇱',
  Peru: '🇵🇪',
  'Hong Kong': '🇭🇰',
  Singapore: '🇸🇬',
  Thailand: '🇹🇭',
  Philippines: '🇵🇭',
  Indonesia: '🇮🇩',
  Malaysia: '🇲🇾',
  Russia: '🇷🇺',
  Czechia: '🇨🇿',
  'Czech Republic': '🇨🇿',
  Romania: '🇷🇴',
  Latvia: '🇱🇻',
  Lithuania: '🇱🇹',
  Norway: '🇳🇴',
  Finland: '🇫🇮',
  Portugal: '🇵🇹',
  Switzerland: '🇨🇭',
  Austria: '🇦🇹',
  Ireland: '🇮🇪',
  Croatia: '🇭🇷',
  Serbia: '🇷🇸',
  Hungary: '🇭🇺',
  Israel: '🇮🇱',
  Morocco: '🇲🇦',
}
export const flag = (country?: string) => (country && FLAGS[country]) || ''
