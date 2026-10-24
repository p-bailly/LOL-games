import { applyGame, PLAYER_DEFAULTS, type GameIn, type PlayerEloState, type PlayerParams } from '../lib/playerEloCore'
import { cached, cargo, isoDate, list, num, q, sqlDate, str } from './cargo'

// Classement Elo des joueurs. Même principe que api/elo.ts : le calcul sur toutes les games depuis 2011 (89 000) est
// fait par scripts/build-player-elo.mjs et rangé dans public/elo-players.json ; l'appli y ajoute les games jouées depuis.

type Row = [r: number, n: number, last: number, lg: string, team: string, role: number, peak: number, w: number, l: number]

interface Snapshot {
  v: number
  builtAt: string
  until: number
  params: PlayerParams
  players: Record<string, Row>
  history: Record<string, [number, number][]>
  leagues: Record<string, [string, string]>
  quality: { logloss: number; accuracy: number; n: number; intlAccuracy: number; intlN: number }
}

export const ROLE_NAMES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'] as const

export interface EloPlayer {
  /** Identifiant Leaguepedia (« Bin (Chen Ze-Bin) ») : sert d'adresse de la fiche joueur. */
  id: string
  /** Nom affiché (« Bin »). */
  name: string
  rating: number
  games: number
  peak: number
  wins: number
  losses: number
  last: number
  team: string
  role: number
  league: string
  region: string
  major: boolean
  delta?: number
  rank: number
  /** Place parmi les joueurs de ligues majeures du même rôle. */
  roleRank?: number
  /** Place parmi tous les joueurs de ligues majeures. */
  majorRank?: number
}

export interface PlayerElo {
  players: EloPlayer[]
  byId: Map<string, EloPlayer>
  builtAt: string
  until: number
  quality: Snapshot['quality']
  params: PlayerParams
  added: number
}

const DAY = 86_400_000
const INTL = new Set(['World Championship', 'Mid-Season Invitational', 'First Stand', 'Esports World Cup', 'Esports Nations Cup', 'Asian Games 2018', 'International Wildcard Invitational', 'Mid-Season Cup 2020'])
const monthOf = (t: number) => {
  const d = new Date(t)
  return (d.getUTCFullYear() - 2011) * 12 + d.getUTCMonth()
}
export const plainName = (id: string) => id.replace(/\s*\([^)]*\)\s*$/, '') || id

async function newGames(since: number, leagues: Snapshot['leagues']): Promise<GameIn[]> {
  const out: GameIn[] = []
  for (let page = 0; page < 6; page++) {
    const rows = await cargo({
      tables: 'ScoreboardGames=SG,Tournaments=T',
      join_on: 'SG.OverviewPage=T.OverviewPage',
      fields: 'SG.Team1,SG.Team2,SG.Team1Players,SG.Team2Players,SG.Winner,SG.DateTime_UTC,T.League,T.Region,T.TournamentLevel,T.IsPlayoffs',
      where: `SG.Winner IN (1,2) AND T.IsOfficial='1' AND T.TournamentLevel IN ('Primary','Secondary') AND SG.DateTime_UTC > ${q(sqlDate(new Date(since)))}`,
      order_by: 'SG.DateTime_UTC,SG.GameId',
      limit: 500,
      offset: page * 500,
    })
    for (const r of rows) {
      const a = list(r.Team1Players)
      const b = list(r.Team2Players)
      const winner = num(r.Winner)
      if (a.length !== 5 || b.length !== 5 || a.some((x) => !x) || b.some((x) => !x)) continue
      const league = str(r.League) || '?'
      if (r.League && !leagues[league]) leagues[league] = [str(r.Region), str(r.TournamentLevel) === 'Primary' ? 'P' : 'S']
      out.push({
        t: new Date(isoDate(str(r.DateTime_UTC))).getTime(),
        a,
        b,
        ta: str(r.Team1),
        tb: str(r.Team2),
        aWon: winner === 1,
        league,
        intl: str(r.Region) === 'International' || INTL.has(league) || /^Rift Rivals/.test(league),
        playoffs: num(r.IsPlayoffs) === 1,
      })
    }
    if (rows.length < 500) break
  }
  return out
}

async function build(): Promise<PlayerElo> {
  const res = await fetch(`${import.meta.env.BASE_URL}elo-players.json`)
  if (!res.ok) throw new Error('Classement Elo des joueurs indisponible.')
  const snap = (await res.json()) as Snapshot
  const state: PlayerEloState = {}
  for (const [id, [r, n, last, lg, team, role, peak, w, l]] of Object.entries(snap.players)) state[id] = { r, n, last, lg, team, role, peak, w, l }
  const leagues = { ...snap.leagues }
  let added: GameIn[] = []
  try {
    added = await newGames(snap.until, leagues)
  } catch {
    /* hors-ligne ou quota : on garde le calcul du jour de la construction */
  }
  const params = snap.params ?? PLAYER_DEFAULTS
  for (const g of added) applyGame(state, g, params)

  const now = Date.now()
  const nowMonth = monthOf(snap.until)
  const players: EloPlayer[] = []
  for (const [id, s] of Object.entries(state)) {
    if (now / DAY - s.last > 548 || s.n < 5) continue
    const lg = leagues[s.lg]
    const before = snap.history[id]?.filter(([m]) => m <= nowMonth - 3).at(-1)
    players.push({
      id,
      name: plainName(id),
      rating: s.r,
      games: s.n,
      peak: s.peak,
      wins: s.w,
      losses: s.l,
      last: s.last * DAY,
      team: s.team,
      role: s.role,
      league: s.lg,
      region: lg?.[0] ?? '',
      major: lg?.[1] === 'P',
      delta: before ? s.r - before[1] : undefined,
      rank: 0,
    })
  }
  players.sort((x, y) => y.rating - x.rating)
  players.forEach((p, i) => (p.rank = i + 1))
  const roleCount = [0, 0, 0, 0, 0]
  let major = 0
  for (const p of players) {
    if (!p.major || p.last < now - 365 * DAY) continue
    p.majorRank = ++major
    p.roleRank = ++roleCount[p.role]
  }
  return { players, byId: new Map(players.map((p) => [p.id, p])), builtAt: snap.builtAt, until: snap.until, quality: snap.quality, params, added: added.length }
}

/** Classement Elo des joueurs à jour (gardé 30 minutes en mémoire). */
export const fetchPlayerElo = (): Promise<PlayerElo> => cached('elo-players', 30 * 60_000, build)
