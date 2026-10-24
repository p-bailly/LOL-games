import type { IntlSeries } from '../api/games'

// Les régions entre elles : bilan des compétitions internationales et niveau moyen de chaque région.
// Les régions sont celles de Leaguepedia, telles que l'Elo les connaît (région de la dernière ligue d'une équipe).

export interface RegionLabel {
  code: string
  name: string
}

const LABELS: Record<string, RegionLabel> = {
  Korea: { code: 'LCK', name: 'Corée du Sud' },
  China: { code: 'LPL', name: 'Chine' },
  Europe: { code: 'LEC', name: 'Europe' },
  'North America': { code: 'LCS', name: 'Amérique du Nord' },
  'Asia Pacific': { code: 'LCP', name: 'Asie-Pacifique' },
  Brazil: { code: 'CBLOL', name: 'Brésil' },
  Vietnam: { code: 'VCS', name: 'Vietnam' },
  Japan: { code: 'LJL', name: 'Japon' },
  Turkey: { code: 'TCL', name: 'Turquie' },
  'Latin America': { code: 'LLA', name: 'Amérique latine' },
  Americas: { code: 'LTA', name: 'Amériques' },
  EMEA: { code: 'EMEA', name: 'Europe, Moyen-Orient, Afrique' },
}

export const regionLabel = (region: string): RegionLabel => LABELS[region] ?? { code: region, name: region }

/** Régions tracées sur la courbe, dans l'ordre des couleurs : une région garde sa couleur quelle que soit sa place. */
export const CHART_REGIONS = ['Korea', 'China', 'Europe', 'North America', 'Asia Pacific', 'Brazil']

// ---------- Bilan des compétitions internationales ----------

export interface RegionRow {
  region: string
  winSeries: number
  lossSeries: number
  winGames: number
  lossGames: number
}

export interface RegionBilan {
  rows: RegionRow[]
  /** Séries gagnées et perdues par la première région contre la seconde. */
  vs: Map<string, Map<string, [wins: number, losses: number]>>
  /** Séries entre deux régions, comptées. */
  counted: number
  /** Séries entre équipes de la même région, non comptées. */
  sameRegion: number
  /** Séries dont une équipe n'a pas de région connue, non comptées. */
  unknown: number
}

export function regionBilan(series: IntlSeries[], regionOf: (team: string) => string | undefined): RegionBilan {
  const rows = new Map<string, RegionRow>()
  const vs = new Map<string, Map<string, [number, number]>>()
  const row = (region: string) => {
    let r = rows.get(region)
    if (!r) rows.set(region, (r = { region, winSeries: 0, lossSeries: 0, winGames: 0, lossGames: 0 }))
    return r
  }
  const face = (a: string, b: string, win: boolean) => {
    const m = vs.get(a) ?? new Map<string, [number, number]>()
    vs.set(a, m)
    const c = m.get(b) ?? [0, 0]
    m.set(b, c)
    c[win ? 0 : 1]++
  }
  let counted = 0
  let sameRegion = 0
  let unknown = 0
  for (const s of series) {
    const ra = regionOf(s.a)
    const rb = regionOf(s.b)
    if (!ra || !rb) {
      unknown++
      continue
    }
    if (ra === rb) {
      sameRegion++
      continue
    }
    counted++
    const a = row(ra)
    const b = row(rb)
    a.winGames += s.sa
    a.lossGames += s.sb
    b.winGames += s.sb
    b.lossGames += s.sa
    if (s.winner === 1) {
      a.winSeries++
      b.lossSeries++
    } else {
      b.winSeries++
      a.lossSeries++
    }
    face(ra, rb, s.winner === 1)
    face(rb, ra, s.winner === 2)
  }
  const rate = (r: RegionRow) => r.winSeries / ((r.winSeries + r.lossSeries) || 1)
  return {
    rows: [...rows.values()].sort((x, y) => rate(y) - rate(x) || y.winSeries + y.lossSeries - (x.winSeries + x.lossSeries) || x.region.localeCompare(y.region)),
    vs,
    counted,
    sameRegion,
    unknown,
  }
}

// ---------- Niveau moyen de chaque région ----------

export interface TeamRegion {
  region: string
  /** Équipe d'une ligue majeure. */
  major: boolean
}

/** Une équipe sans série depuis plus de 6 mois n'entre plus dans la moyenne. */
const ACTIVE_MONTHS = 6
/** Il faut au moins 3 équipes pour parler du niveau d'une région. */
const MIN_TEAMS = 3

/**
 * Pour chaque région, la moyenne de l'Elo de ses `best` meilleures équipes actives (ligues majeures), mois par mois.
 * `history` : pour chaque équipe, [mois depuis janvier 2011, note] aux mois où elle a joué.
 */
export function regionHistory(history: Record<string, [number, number][]>, teams: Record<string, TeamRegion>, regions: string[], best = 5): Record<string, [number, number][]> {
  const ids = Object.keys(history).filter((id) => history[id].length && teams[id]?.major && regions.includes(teams[id].region))
  const out: Record<string, [number, number][]> = Object.fromEntries(regions.map((r) => [r, []]))
  if (!ids.length) return out
  const first = Math.min(...ids.map((id) => history[id][0][0]))
  const last = Math.max(...ids.map((id) => history[id][history[id].length - 1][0]))
  const cursor = new Map<string, number>()
  for (let m = first; m <= last; m++) {
    const by = new Map<string, number[]>()
    for (const id of ids) {
      const h = history[id]
      let c = cursor.get(id) ?? -1
      while (c + 1 < h.length && h[c + 1][0] <= m) c++
      cursor.set(id, c)
      if (c < 0 || m - h[c][0] > ACTIVE_MONTHS) continue
      const region = teams[id].region
      by.set(region, [...(by.get(region) ?? []), h[c][1]])
    }
    for (const region of regions) {
      const v = (by.get(region) ?? []).sort((a, b) => b - a)
      if (v.length < MIN_TEAMS) continue
      const n = Math.min(best, v.length)
      out[region].push([m, Math.round(v.slice(0, n).reduce((s, x) => s + x, 0) / n)])
    }
  }
  return out
}
