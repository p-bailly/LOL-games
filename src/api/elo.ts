import { applySeries, DEFAULTS, type EloState, type Params, type SeriesIn } from '../lib/eloCore'
import { cached, cargo, isoDate, num, q, sqlDate, str } from './cargo'

// Classement Elo mondial. Le calcul sur tout l'historique (depuis 2011, plus de 55 000 séries) est fait une fois
// par scripts/build-elo.mjs et rangé dans public/elo.json ; l'appli n'y ajoute que les séries jouées depuis.

type Row = [r: number, n: number, last: number, lg: string, peak: number, w: number, l: number]

interface Snapshot {
  v: number
  builtAt: string
  /** Date de la dernière série prise en compte, en millisecondes. */
  until: number
  params: Params
  teams: Record<string, Row>
  /** Pour chaque équipe, ses notes mois par mois : [mois depuis janvier 2011, note]. */
  history: Record<string, [number, number][]>
  /** Ligue → [région, niveau : P = ligue majeure, S = secondaire]. */
  leagues: Record<string, [string, string]>
  alias: Record<string, string>
  /** Variation d'Elo des deux équipes pour les séries des derniers mois : identifiant de la série → [A, B]. */
  recent?: Record<string, [number, number]>
  quality: { logloss: number; accuracy: number; n: number; intlAccuracy: number; intlN: number }
}

export interface EloTeam {
  id: string
  rating: number
  series: number
  peak: number
  wins: number
  losses: number
  /** Dernière série jouée, en millisecondes. */
  last: number
  league: string
  region: string
  major: boolean
  /** Évolution de la note sur environ 90 jours. */
  delta?: number
  /** Place parmi toutes les équipes actives. */
  rank: number
  /** Place parmi les équipes des ligues majeures (équipes majeures seulement). */
  majorRank?: number
}

export interface Elo {
  teams: EloTeam[]
  byId: Map<string, EloTeam>
  /** Note de chaque équipe, noms d'origine et noms actuels confondus. */
  ratings: Record<string, number>
  builtAt: string
  until: number
  quality: Snapshot['quality']
  params: Params
  /** Variation d'Elo (équipe 1, équipe 2) des séries récentes, par identifiant de série. */
  recent: Map<string, [number, number]>
  /** Séries ajoutées par l'appli depuis le calcul. */
  added: number
}

const DAY = 86_400_000
const monthOf = (t: number) => {
  const d = new Date(t)
  return (d.getUTCFullYear() - 2011) * 12 + d.getUTCMonth()
}

const INTL = new Set(['World Championship', 'Mid-Season Invitational', 'First Stand', 'Esports World Cup', 'Esports Nations Cup', 'Asian Games 2018', 'International Wildcard Invitational', 'Mid-Season Cup 2020'])

type NewSeries = SeriesIn & { major: boolean }

async function newSeries(since: number, alias: Record<string, string>, leagues: Snapshot['leagues']): Promise<NewSeries[]> {
  const out: NewSeries[] = []
  for (let page = 0; page < 6; page++) {
    const rows = await cargo({
      tables: 'MatchSchedule=MS,Tournaments=T',
      join_on: 'MS.OverviewPage=T.OverviewPage',
      fields: 'MS.MatchId,MS.Team1,MS.Team2,MS.Team1Score,MS.Team2Score,MS.Winner,MS.DateTime_UTC,MS.BestOf,T.League,T.Region,T.TournamentLevel,T.IsPlayoffs',
      where: `MS.Winner IN (1,2) AND T.IsOfficial='1' AND T.TournamentLevel IN ('Primary','Secondary') AND MS.DateTime_UTC > ${q(sqlDate(new Date(since)))}`,
      order_by: 'MS.DateTime_UTC,MS.MatchId',
      limit: 500,
      offset: page * 500,
    })
    const canon = (n: string) => {
      const seen = new Set<string>()
      while (alias[n] && !seen.has(n)) {
        seen.add(n)
        n = alias[n]
      }
      return n
    }
    for (const r of rows) {
      const a = canon(str(r.Team1))
      const b = canon(str(r.Team2))
      if (!a || !b || a === 'TBD' || b === 'TBD' || a === b) continue
      const winner = num(r.Winner)
      let sa = num(r.Team1Score) ?? 0
      let sb = num(r.Team2Score) ?? 0
      if (sa + sb === 0 || (winner === 1 && sa <= sb) || (winner === 2 && sb <= sa)) [sa, sb] = winner === 1 ? [1, 0] : [0, 1]
      const league = str(r.League) || '?'
      if (r.League && !leagues[league]) leagues[league] = [str(r.Region), str(r.TournamentLevel) === 'Primary' ? 'P' : 'S']
      out.push({
        id: str(r.MatchId),
        major: str(r.TournamentLevel) === 'Primary',
        t: new Date(isoDate(str(r.DateTime_UTC))).getTime(),
        a,
        b,
        sa,
        sb,
        bo: num(r.BestOf) ?? Math.max(1, sa + sb),
        league,
        intl: str(r.Region) === 'International' || INTL.has(league) || /^Rift Rivals/.test(league),
        playoffs: num(r.IsPlayoffs) === 1,
      })
    }
    if (rows.length < 500) break
  }
  return out
}

async function build(): Promise<Elo> {
  const res = await fetch(`${import.meta.env.BASE_URL}elo.json`)
  if (!res.ok) throw new Error('Classement Elo indisponible.')
  const snap = (await res.json()) as Snapshot
  const state: EloState = {}
  for (const [id, [r, n, last, lg, peak, w, l]] of Object.entries(snap.teams)) state[id] = { r, n, last, lg, peak, w, l }
  const leagues = { ...snap.leagues }
  let added: NewSeries[] = []
  try {
    added = await newSeries(snap.until, snap.alias, leagues)
  } catch {
    /* hors-ligne ou quota : on garde le calcul du jour de la construction */
  }
  const recent = new Map<string, [number, number]>(Object.entries(snap.recent ?? {}))
  for (const s of added) {
    const { da, db } = applySeries(state, s, snap.params ?? DEFAULTS)
    if (s.major && s.id) recent.set(s.id, [Math.round(da * 10) / 10, Math.round(db * 10) / 10])
  }

  const now = Date.now()
  const nowMonth = monthOf(snap.until)
  const teams: EloTeam[] = []
  for (const [id, s] of Object.entries(state)) {
    if (now / DAY - s.last > 548) continue
    const lg = leagues[s.lg]
    const hist = snap.history[id]
    const before = hist?.filter(([m]) => m <= nowMonth - 3).at(-1)
    teams.push({
      id,
      rating: s.r,
      series: s.n,
      peak: s.peak,
      wins: s.w,
      losses: s.l,
      last: s.last * DAY,
      league: s.lg,
      region: lg?.[0] ?? '',
      major: lg?.[1] === 'P',
      delta: before ? s.r - before[1] : undefined,
      rank: 0,
    })
  }
  teams.sort((x, y) => y.rating - x.rating)
  teams.forEach((t, i) => (t.rank = i + 1))
  teams.filter((t) => t.major && t.last >= now - 365 * DAY).forEach((t, i) => (t.majorRank = i + 1))
  const byId = new Map(teams.map((t) => [t.id, t]))
  const ratings: Record<string, number> = {}
  for (const t of teams) ratings[t.id] = t.rating
  for (const [from, to] of Object.entries(snap.alias)) if (ratings[to] !== undefined && ratings[from] === undefined) ratings[from] = ratings[to]
  return { teams, byId, ratings, builtAt: snap.builtAt, until: snap.until, quality: snap.quality, params: snap.params, recent, added: added.length }
}

/** Classement Elo mondial à jour (gardé 30 minutes en mémoire). */
export const fetchElo = (): Promise<Elo> => cached('elo', 30 * 60_000, build)


