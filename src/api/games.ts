import { cached, cargoAll, isoDate, num, q, qList, sqlDate, str } from './cargo'
import { LEAGUES } from './leagues'
import { resolveTeams } from './leaguepedia'

// Games et séries en vrac (Leaguepedia), pour les stats d'équipe, les stats avancées, les records et les régions.

/** Une game d'un tournoi. Comme dans ScoreboardGames, l'équipe 1 est du côté bleu : les paires sont [bleu, rouge]. */
export interface GameRow {
  id: string
  matchId: string
  date: string
  minutes: number
  /** 1 : l'équipe bleue gagne, 2 : la rouge. */
  winner: 1 | 2
  teams: [blue: string, red: string]
  kills: [number, number]
  gold: [number, number]
  towers: [number, number]
  dragons: [number, number]
  barons: [number, number]
  heralds: [number, number]
  grubs: [number, number]
}

/** Ligne d'un joueur dans une game. */
export interface LineRow {
  gameId: string
  link: string
  name: string
  team: string
  champion: string
  role: string
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damage: number
  vision: number
}

const SIDE_FIELDS = ['Kills', 'Gold', 'Towers', 'Dragons', 'Barons', 'RiftHeralds', 'VoidGrubs']
const GAME_FIELDS = ['GameId', 'MatchId', 'DateTime_UTC', 'Gamelength_Number', 'Winner', 'Team1', 'Team2', ...[1, 2].flatMap((n) => SIDE_FIELDS.map((f) => `Team${n}${f}`))].join(',')
const LINE_FIELDS = 'GameId,Link,Name,Team,Champion,Role,Kills,Deaths,Assists,CS,Gold,DamageToChampions,VisionScore'

// Ces chargements sont partagés (cache et appels simultanés) : ils ne suivent pas le signal d'annulation d'un seul appelant,
// sinon l'annulation d'un affichage ferait échouer tous ceux qui attendent la même requête.

/** Games terminées d'un tournoi, de la plus ancienne à la plus récente. */
export function fetchTournamentGames(page: string): Promise<GameRow[]> {
  return cached(`games:${page}`, 10 * 60_000, async () => {
    const rows = await cargoAll({ tables: 'ScoreboardGames', fields: GAME_FIELDS, where: `OverviewPage=${q(page)} AND Winner IN (1,2)`, order_by: 'DateTime_UTC,GameId' })
    await resolveTeams(rows.flatMap((r) => [str(r.Team1), str(r.Team2)]))
    const pair = (r: Record<string, unknown>, f: string): [number, number] => [num(r[`Team1${f}`]) ?? 0, num(r[`Team2${f}`]) ?? 0]
    return rows.map(
      (r): GameRow => ({
        id: str(r.GameId),
        matchId: str(r.MatchId) || str(r.GameId).replace(/_\d+$/, ''),
        date: isoDate(str(r.DateTime_UTC)),
        minutes: num(r.Gamelength_Number) ?? 0,
        winner: num(r.Winner) === 2 ? 2 : 1,
        teams: [str(r.Team1), str(r.Team2)],
        kills: pair(r, 'Kills'),
        gold: pair(r, 'Gold'),
        towers: pair(r, 'Towers'),
        dragons: pair(r, 'Dragons'),
        barons: pair(r, 'Barons'),
        heralds: pair(r, 'RiftHeralds'),
        grubs: pair(r, 'VoidGrubs'),
      }),
    )
  })
}

/** Ligne de chaque joueur dans chaque game d'un tournoi. */
export function fetchTournamentLines(page: string): Promise<LineRow[]> {
  return cached(`lines:${page}`, 10 * 60_000, async () => {
    const rows = await cargoAll({ tables: 'ScoreboardPlayers', fields: LINE_FIELDS, where: `OverviewPage=${q(page)}`, order_by: 'GameId,Side,Role_Number' })
    return rows.map(
      (r): LineRow => ({
        gameId: str(r.GameId),
        link: str(r.Link),
        name: str(r.Name) || str(r.Link),
        team: str(r.Team),
        champion: str(r.Champion),
        role: str(r.Role),
        kills: num(r.Kills) ?? 0,
        deaths: num(r.Deaths) ?? 0,
        assists: num(r.Assists) ?? 0,
        cs: num(r.CS) ?? 0,
        gold: num(r.Gold) ?? 0,
        damage: num(r.DamageToChampions) ?? 0,
        vision: num(r.VisionScore) ?? 0,
      }),
    )
  })
}

// ---------- Compétitions internationales ----------

/** Série d'une compétition internationale. */
export interface IntlSeries {
  id: string
  date: string
  /** « Worlds 2025 », « MSI 2026 »… */
  event: string
  a: string
  b: string
  /** Games gagnées par chaque équipe. */
  sa: number
  sb: number
  winner: 1 | 2
}

const INTL = LEAGUES.find((l) => l.key === 'intl')!
const EVENT_NAME: Record<string, string> = { 'World Championship': 'Worlds', 'Mid-Season Invitational': 'MSI', 'First Stand': 'First Stand' }

/** Séries terminées des compétitions internationales des trois dernières années, de la plus ancienne à la plus récente. */
export function fetchIntlSeries(): Promise<IntlSeries[]> {
  return cached('intl-series', 10 * 60_000, async () => {
    const since = new Date(Date.now() - 3 * 365 * 86_400_000)
    const rows = await cargoAll(
      {
        tables: 'MatchSchedule=MS,Tournaments=T',
        join_on: 'MS.OverviewPage=T.OverviewPage',
        fields: 'MS.MatchId,MS.Team1,MS.Team2,MS.Team1Score,MS.Team2Score,MS.Winner,MS.DateTime_UTC,T.League',
        where: `T.League IN (${qList(INTL.names)}) AND MS.Winner IN (1,2) AND MS.DateTime_UTC > ${q(sqlDate(since))}`,
        order_by: 'MS.DateTime_UTC,MS.MatchId',
      },
    )
    const out: IntlSeries[] = []
    for (const r of rows) {
      const a = str(r.Team1)
      const b = str(r.Team2)
      if (!a || !b || a === 'TBD' || b === 'TBD') continue
      const winner = num(r.Winner) === 2 ? 2 : 1
      let sa = num(r.Team1Score) ?? 0
      let sb = num(r.Team2Score) ?? 0
      // Score absent ou incohérent (BO1 sans détail) : une game pour le vainqueur.
      if (sa + sb === 0 || (winner === 1 && sa <= sb) || (winner === 2 && sb <= sa)) [sa, sb] = winner === 1 ? [1, 0] : [0, 1]
      const date = isoDate(str(r.DateTime_UTC))
      out.push({ id: str(r.MatchId), date, event: `${EVENT_NAME[str(r.League)] ?? str(r.League)} ${date.slice(0, 4)}`, a, b, sa, sb, winner })
    }
    return out
  })
}
