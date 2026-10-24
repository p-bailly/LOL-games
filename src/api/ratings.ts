import { fetchElo } from './elo'
import { allLeagueNames, leagueOfName } from './leagues'
import { cargo, num, persisted, q, qList, sqlDate, str } from './cargo'

// Force des équipes : un classement de type Elo calculé sur leurs séries des 18 derniers mois (toutes les ligues
// suivies et les compétitions internationales). Les équipes d'une ligue partent d'un niveau propre à leur région, car
// les rencontres entre régions sont trop rares pour les situer les unes par rapport aux autres : c'est un parti pris,
// pas une mesure.

const BASE = 1500
/** Niveau de départ par ligue d'origine. */
const REGION_START: Record<string, number> = { lck: 1560, lpl: 1555, lec: 1520, lcs: 1470, lcp: 1460, cblol: 1430, lfl: 1380 }
const K_LEAGUE = 24
const K_INTL = 40

/** Chance de gagner une game d'après l'écart de force. */
export const gameProb = (ra: number, rb: number) => 1 / (1 + 10 ** ((rb - ra) / 400))

const choose = (n: number, k: number) => {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/** Chance de gagner une série au meilleur des `bestOf` games, sachant la chance `p` de gagner une game. */
export function seriesProb(p: number, bestOf: number): number {
  const need = Math.floor(bestOf / 2) + 1
  let total = 0
  for (let k = 0; k < need; k++) total += choose(need - 1 + k, k) * p ** need * (1 - p) ** k
  return total
}

export type Ratings = Record<string, number>

interface Row {
  a: string
  b: string
  sa: number
  sb: number
  intl: boolean
  league: string
}

async function loadSeries(): Promise<Row[]> {
  const since = new Date(Date.now() - 540 * 86_400_000)
  const out: Row[] = []
  for (let page = 0; page < 6; page++) {
    const rows = await cargo({
      tables: 'MatchSchedule=MS,Tournaments=T',
      join_on: 'MS.OverviewPage=T.OverviewPage',
      fields: 'MS.Team1,MS.Team2,MS.Team1Score,MS.Team2Score,MS.Winner,T.League',
      where: `T.League IN (${qList(allLeagueNames())}) AND MS.Winner IN (1,2) AND MS.DateTime_UTC >= ${q(sqlDate(since))}`,
      order_by: 'MS.DateTime_UTC',
      limit: 500,
      offset: page * 500,
    })
    for (const r of rows) {
      const league = leagueOfName(str(r.League))
      const winner = num(r.Winner)
      let sa = num(r.Team1Score) ?? (winner === 1 ? 1 : 0)
      let sb = num(r.Team2Score) ?? (winner === 2 ? 1 : 0)
      if (sa + sb === 0) [sa, sb] = winner === 1 ? [1, 0] : [0, 1]
      out.push({ a: str(r.Team1), b: str(r.Team2), sa, sb, intl: league?.key === 'intl', league: league?.key ?? '' })
    }
    if (rows.length < 500) break
  }
  return out
}

/** Calcule les forces à partir des séries, dans l'ordre chronologique. */
export function computeRatings(series: Row[]): Ratings {
  // Ligue d'origine : celle où l'équipe joue le plus (hors compétitions internationales).
  const count = new Map<string, Map<string, number>>()
  for (const s of series) {
    if (s.intl || !s.league) continue
    for (const t of [s.a, s.b]) {
      const m = count.get(t) ?? new Map<string, number>()
      m.set(s.league, (m.get(s.league) ?? 0) + 1)
      count.set(t, m)
    }
  }
  const home = (t: string) => [...(count.get(t) ?? [])].sort((x, y) => y[1] - x[1])[0]?.[0]
  const r: Ratings = {}
  const get = (t: string) => (r[t] ??= REGION_START[home(t) ?? ''] ?? BASE)
  for (const s of series) {
    if (s.a === 'TBD' || s.b === 'TBD') continue
    const ra = get(s.a)
    const rb = get(s.b)
    const share = s.sa / (s.sa + s.sb)
    const delta = (s.intl ? K_INTL : K_LEAGUE) * (share - gameProb(ra, rb))
    r[s.a] = ra + delta
    r[s.b] = rb - delta
  }
  return r
}

/** Chance que A gagne encore `na` games avant que B n'en gagne `nb`, chaque game étant gagnée par A avec la chance p. */
function remaining(p: number, na: number, nb: number): number {
  if (na <= 0) return 1
  if (nb <= 0) return 0
  return p * remaining(p, na - 1, nb) + (1 - p) * remaining(p, na, nb - 1)
}

/** Chance que A gagne la série, sachant les notes Elo et le score actuel de la série (0-0 avant le début). */
export function winChance(ra: number, rb: number, bestOf: number, scoreA = 0, scoreB = 0): number {
  const need = Math.floor(bestOf / 2) + 1
  return remaining(gameProb(ra, rb), need - scoreA, need - scoreB)
}

/** Forces de toutes les équipes : le classement Elo mondial ; à défaut, un calcul rapide sur les 18 derniers mois. */
export async function fetchRatings(): Promise<Ratings> {
  try {
    return (await fetchElo()).ratings
  } catch {
    return persisted('ratings:v1', 12 * 3_600_000, async () => computeRatings(await loadSeries()))
  }
}

/** Force d'une équipe ; à défaut, la moyenne. */
export const ratingOf = (r: Ratings, team: string) => r[team] ?? BASE
