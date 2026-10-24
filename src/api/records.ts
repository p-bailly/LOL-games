import { cargo, isoDate, num, persisted, q, qList, str, type CargoQuery, type Row } from './cargo'
import { LEAGUES } from './leagues'

// Records sur de longues périodes (une année, toute l'histoire) : on ne télécharge pas les ~90 000 games, on demande à
// Leaguepedia les trois premières de chaque catégorie (tri sur une colonne, limite 3).

export interface RecordScope {
  /** Une année civile, ou toute l'histoire si absent. */
  year?: number
  /** Clé d'une ligue suivie (voir leagues.ts), ou toutes les ligues si absent. */
  league?: string
}

type Table = 'ScoreboardGames' | 'ScoreboardPlayers'

const ALIAS: Record<Table, string> = { ScoreboardGames: 'SG', ScoreboardPlayers: 'SP' }

/** Table, jointure avec Tournaments pour filtrer par ligue, et clause where de la période. */
function source(table: Table, scope: RecordScope) {
  const alias = ALIAS[table]
  const names = scope.league ? LEAGUES.find((l) => l.key === scope.league)?.names : undefined
  const joined = !!names
  const p = (f: string) => (joined ? `${alias}.${f}` : f)
  const where: string[] = []
  if (names) where.push(`T.League IN (${qList(names)})`)
  if (scope.year) where.push(`${p('DateTime_UTC')} >= ${q(`${scope.year}-01-01`)}`, `${p('DateTime_UTC')} < ${q(`${scope.year + 1}-01-01`)}`)
  return {
    p,
    where,
    query: { tables: joined ? `${table}=${alias},Tournaments=T` : table, join_on: joined ? `${alias}.OverviewPage=T.OverviewPage` : undefined } satisfies Pick<CargoQuery, 'tables' | 'join_on'>,
  }
}

/** Les `limit` premières lignes d'une catégorie ; `expr` : colonne calculée « formule=ALIAS » sur laquelle trier. */
async function topRows(table: Table, scope: RecordScope, o: { fields: string[]; where?: string[]; order: string; limit?: number; expr?: string }): Promise<Row[]> {
  const s = source(table, scope)
  const fields = [...o.fields.map(s.p), ...(o.expr ? [o.expr] : [])]
  const where = [...s.where, ...(o.where ?? []).map((w) => w.replace(/\{(\w+)\}/g, (_, f: string) => s.p(f)))]
  return cargo({ ...s.query, fields: fields.join(','), where: where.join(' AND ') || undefined, order_by: o.order, limit: o.limit ?? 3 })
}

/** Garde le résultat sur l'appareil : l'histoire ne change pas, l'année en cours très peu. */
function keep<T>(kind: string, scope: RecordScope, load: () => Promise<T>): Promise<T> {
  const current = scope.year === new Date().getFullYear()
  return persisted(`record:${kind}:${scope.year ?? 'all'}:${scope.league ?? 'all'}`, current ? 3_600_000 : 12 * 3_600_000, load)
}

/** Résultat de `primary`, ou de `fallback` si Leaguepedia refuse la colonne calculée de `primary`. */
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary()
  } catch {
    return fallback()
  }
}

// ---------- Games ----------

export type GameRecordKind = 'shortest' | 'longest' | 'kills' | 'gold'

export interface GameRecord {
  gameId: string
  matchId: string
  date: string
  teams: [blue: string, red: string]
  winner: 1 | 2
  minutes: number
  kills: [number, number]
  gold: [number, number]
}

const GAME_FIELDS = ['GameId', 'MatchId', 'DateTime_UTC', 'Team1', 'Team2', 'Winner', 'Gamelength_Number', 'Team1Kills', 'Team2Kills', 'Team1Gold', 'Team2Gold']
/** Aucune game pro ne finit avant : en dessous, c'est un forfait ou une erreur de saisie. */
const MIN_MINUTES = 12

const toGame = (r: Row): GameRecord => ({
  gameId: str(r.GameId),
  matchId: str(r.MatchId) || str(r.GameId).replace(/_\d+$/, ''),
  date: isoDate(str(r.DateTime_UTC)),
  teams: [str(r.Team1), str(r.Team2)],
  winner: num(r.Winner) === 2 ? 2 : 1,
  minutes: num(r.Gamelength_Number) ?? 0,
  kills: [num(r.Team1Kills) ?? 0, num(r.Team2Kills) ?? 0],
  gold: [num(r.Team1Gold) ?? 0, num(r.Team2Gold) ?? 0],
})

const DONE = 'Winner IN (1,2)'
export const totalKills = (g: GameRecord) => g.kills[0] + g.kills[1]
export const goldGap = (g: GameRecord) => Math.abs(g.gold[0] - g.gold[1])

/** Les trois meilleures games d'une catégorie sur la période. */
export function fetchGameRecords(kind: GameRecordKind, scope: RecordScope): Promise<GameRecord[]> {
  return keep(`game-${kind}`, scope, async () => {
    const fields = GAME_FIELDS
    const p = source('ScoreboardGames', scope).p
    switch (kind) {
      case 'shortest':
        return (await topRows('ScoreboardGames', scope, { fields, where: [DONE, `{Gamelength_Number} >= ${MIN_MINUTES}`], order: `${p('Gamelength_Number')} ASC` })).map(toGame)
      case 'longest':
        return (await topRows('ScoreboardGames', scope, { fields, where: [DONE], order: `${p('Gamelength_Number')} DESC` })).map(toGame)
      case 'kills':
        return withFallback(
          async () => (await topRows('ScoreboardGames', scope, { fields, where: [DONE], expr: `${p('Team1Kills')}+${p('Team2Kills')}=TK`, order: 'TK DESC' })).map(toGame),
          // Sans colonne calculée : les 200 plus gros scores d'une équipe de chaque côté, dont on additionne les deux camps.
          async () => {
            const sides = await Promise.all(
              ['Team1Kills', 'Team2Kills'].map((f) => topRows('ScoreboardGames', scope, { fields, where: [DONE], order: `${p(f)} DESC`, limit: 200 })),
            )
            const seen = new Map(sides.flat().map((r) => [str(r.GameId), toGame(r)]))
            return [...seen.values()].sort((a, b) => totalKills(b) - totalKills(a)).slice(0, 3)
          },
        )
      case 'gold':
        return (await topRows('ScoreboardGames', scope, { fields, where: [DONE, '{Team1Gold} > 0', '{Team2Gold} > 0'], expr: `ABS(${p('Team1Gold')}-${p('Team2Gold')})=GG`, order: 'GG DESC' })).map(toGame)
    }
  })
}

// ---------- Joueurs ----------

export type PlayerRecordKind = 'kills' | 'assists' | 'damage' | 'cs' | 'vision' | 'kda'

export interface PlayerRecord {
  gameId: string
  matchId: string
  date: string
  link: string
  name: string
  team: string
  opponent: string
  champion: string
  kills: number
  deaths: number
  assists: number
  cs: number
  damage: number
  vision: number
}

const PLAYER_FIELDS = ['GameId', 'DateTime_UTC', 'Link', 'Name', 'Team', 'TeamVs', 'Champion', 'Kills', 'Deaths', 'Assists', 'CS', 'DamageToChampions', 'VisionScore']
const PLAYER_ORDER: Record<Exclude<PlayerRecordKind, 'kda'>, string> = { kills: 'Kills', assists: 'Assists', damage: 'DamageToChampions', cs: 'CS', vision: 'VisionScore' }

const toPlayer = (r: Row): PlayerRecord => ({
  gameId: str(r.GameId),
  matchId: str(r.GameId).replace(/_\d+$/, ''),
  date: isoDate(str(r.DateTime_UTC)),
  link: str(r.Link),
  name: str(r.Name) || str(r.Link),
  team: str(r.Team),
  opponent: str(r.TeamVs),
  champion: str(r.Champion),
  kills: num(r.Kills) ?? 0,
  deaths: num(r.Deaths) ?? 0,
  assists: num(r.Assists) ?? 0,
  cs: num(r.CS) ?? 0,
  damage: num(r.DamageToChampions) ?? 0,
  vision: num(r.VisionScore) ?? 0,
})

/** Les trois meilleures performances individuelles d'une catégorie sur la période. « kda » : kills + assists sans mourir. */
export function fetchPlayerRecords(kind: PlayerRecordKind, scope: RecordScope): Promise<PlayerRecord[]> {
  return keep(`player-${kind}`, scope, async () => {
    const fields = PLAYER_FIELDS
    const p = source('ScoreboardPlayers', scope).p
    if (kind !== 'kda') return (await topRows('ScoreboardPlayers', scope, { fields, order: `${p(PLAYER_ORDER[kind])} DESC` })).map(toPlayer)
    const ka = (r: PlayerRecord) => r.kills + r.assists
    return withFallback(
      async () => (await topRows('ScoreboardPlayers', scope, { fields, where: ['{Deaths} = 0'], expr: `${p('Kills')}+${p('Assists')}=KA`, order: 'KA DESC' })).map(toPlayer),
      // Sans colonne calculée : les 100 games sans mort où le joueur a le plus de kills, puis les 100 avec le plus d'assists.
      async () => {
        const lists = await Promise.all(['Kills', 'Assists'].map((f) => topRows('ScoreboardPlayers', scope, { fields, where: ['{Deaths} = 0'], order: `${p(f)} DESC`, limit: 100 })))
        const seen = new Map(lists.flat().map((r) => [`${str(r.GameId)}|${str(r.Link)}`, toPlayer(r)]))
        return [...seen.values()].sort((a, b) => ka(b) - ka(a)).slice(0, 3)
      },
    )
  })
}
