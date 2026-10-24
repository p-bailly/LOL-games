import { allLeagueNames, leagueOfName, LEAGUES, type LeagueDef } from './leagues'
import { cargo, cargoCached, list, num, persisted, q, qList, str, type Row } from './cargo'
import { resolveTeams, teamOf } from './leaguepedia'
import type { ChampionStat, PlayerStat, RosterPlayer, StandingRow, Team, Tournament } from './types'

// Tournois, classements, effectifs et statistiques agrégées (Leaguepedia).

const day = (d: Date) => d.toISOString().slice(0, 10)

// ---------- Tournois ----------

/** Tournois en cours ou récents (4 derniers mois, et à venir), du plus récent au plus ancien. */
export async function fetchTournaments(): Promise<Tournament[]> {
  const rows = await persisted('tournaments', 30 * 60_000, () =>
    cargo({
      tables: 'Tournaments',
      fields: 'Name,OverviewPage,League,DateStart,Date,IsPlayoffs',
      where: `League IN (${qList(allLeagueNames())}) AND IsOfficial='1' AND DateStart <= ${q(day(new Date(Date.now() + 45 * 86_400_000)))} AND Date >= ${q(day(new Date(Date.now() - 120 * 86_400_000)))}`,
      order_by: 'DateStart DESC',
      limit: 80,
    }),
  )
  return rows
    .map((r): Tournament | undefined => {
      const league = leagueOfName(str(r.League))
      const page = str(r.OverviewPage)
      if (!league || /showmatch/i.test(page)) return undefined
      return {
        page,
        name: str(r.Name),
        league: league.key,
        leagueName: league.label,
        start: str(r.DateStart),
        end: str(r.Date),
        playoffs: num(r.IsPlayoffs) === 1,
      }
    })
    .filter((t): t is Tournament => !!t)
}

/** Tournoi à afficher d'office pour une ligue : celui en cours, sinon le plus récent. */
export function defaultTournament(tournaments: Tournament[], league: string): Tournament | undefined {
  const mine = tournaments.filter((t) => t.league === league)
  const today = day(new Date())
  const running = mine.filter((t) => t.start <= today && (t.end >= today || !t.end))
  return (running.find((t) => !t.playoffs) ?? running[0] ?? mine[0])
}

// ---------- Classements ----------

export async function fetchStandings(page: string, signal?: AbortSignal): Promise<StandingRow[]> {
  const rows = await cargoCached(
    {
      tables: 'Standings',
      fields: 'Team,Place,WinSeries,LossSeries,WinGames,LossGames,Streak,StreakDirection,N',
      where: `OverviewPage=${q(page)}`,
      order_by: 'N',
      limit: 40,
    },
    5 * 60_000,
    signal,
  )
  await resolveTeams(rows.map((r) => str(r.Team)))
  return rows.map((r) => ({
    team: teamOf(str(r.Team)),
    place: num(r.Place) ?? num(r.N) ?? 0,
    winSeries: num(r.WinSeries) ?? 0,
    lossSeries: num(r.LossSeries) ?? 0,
    winGames: num(r.WinGames) ?? 0,
    lossGames: num(r.LossGames) ?? 0,
    streak: r.Streak ? `${r.StreakDirection === 'W' ? 'V' : 'D'}${num(r.Streak)}` : '',
  }))
}

// ---------- Équipes et effectifs ----------

/** Équipes de chaque ligue, d'après les effectifs du tournoi en cours (ou le plus récent). */
export async function fetchLeagueTeams(): Promise<{ league: LeagueDef; teams: Team[] }[]> {
  const tournaments = await fetchTournaments()
  const pages = new Map<string, string>() // page → ligue
  for (const l of LEAGUES) {
    const t = defaultTournament(tournaments.filter((x) => !x.playoffs), l.key) ?? defaultTournament(tournaments, l.key)
    if (t) pages.set(t.page, l.key)
  }
  if (!pages.size) return []
  const rows = await cargoCached(
    { tables: 'TournamentRosters', fields: 'Team,OverviewPage', where: `OverviewPage IN (${qList([...pages.keys()])})`, limit: 300 },
    60 * 60_000,
  )
  await resolveTeams(rows.map((r) => str(r.Team)))
  return LEAGUES.map((league) => ({
    league,
    teams: rows
      .filter((r) => pages.get(str(r.OverviewPage)) === league.key && str(r.Team) !== 'TBD')
      .map((r) => teamOf(str(r.Team)))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.teams.length)
}

export interface TeamRoster {
  tournament: string
  players: RosterPlayer[]
}

/** Dernier effectif connu d'une équipe dans les ligues suivies. */
export async function fetchRoster(team: string, signal?: AbortSignal): Promise<TeamRoster | null> {
  const rows = await cargoCached(
    {
      tables: 'TournamentRosters=TR,Tournaments=T',
      join_on: 'TR.OverviewPage=T.OverviewPage',
      fields: 'TR.RosterLinks,TR.Roles,T.Name=TName',
      where: `TR.Team=${q(team)} AND T.League IN (${qList(allLeagueNames())})`,
      order_by: 'T.DateStart DESC',
      limit: 1,
    },
    30 * 60_000,
    signal,
  )
  const r = rows[0]
  if (!r) return null
  const links = list(r.RosterLinks)
  const roles = list(r.Roles)
  // Ids d'affichage : le lien sans la précision entre parenthèses (« Wei (Yan Yang-Wei) » → « Wei »).
  return {
    tournament: str(r.TName),
    players: links.map((link, i) => ({ link, id: link.replace(/\s*\(.*\)$/, ''), role: roles[i] ?? '' })),
  }
}

export interface PlayerInfo {
  link: string
  id: string
  name: string
  country: string
  role: string
  team: string
  birthdate?: string
  retired: boolean
  residency: string
  twitter?: string
  stream?: string
}

export async function fetchPlayerInfo(link: string, signal?: AbortSignal): Promise<PlayerInfo | undefined> {
  const rows = await cargoCached(
    {
      tables: 'Players',
      fields: 'OverviewPage,ID,NameFull,Name,Country,Nationality,Role,Team,Birthdate,IsRetired,Residency,Twitter,Stream',
      where: `OverviewPage=${q(link)}`,
      limit: 1,
    },
    60 * 60_000,
    signal,
  )
  const r = rows[0]
  if (!r) return undefined
  const country = list(r.Nationality)[0] || str(r.Country)
  return {
    link,
    id: str(r.ID) || link,
    name: str(r.NameFull) || str(r.Name),
    country,
    role: str(r.Role),
    team: str(r.Team),
    birthdate: str(r.Birthdate) || undefined,
    retired: num(r.IsRetired) === 1,
    residency: str(r.Residency),
    twitter: str(r.Twitter) || undefined,
    stream: str(r.Stream) || undefined,
  }
}

export interface PlayerGame {
  gameId: string
  matchId: string
  date: string
  champion: string
  kills: number
  deaths: number
  assists: number
  cs: number
  damage: number
  win: boolean
  team: string
  opponent: string
  role: string
}

/** Games d'un joueur sur les 12 derniers mois, de la plus récente à la plus ancienne. */
export async function fetchPlayerGames(link: string, signal?: AbortSignal): Promise<PlayerGame[]> {
  const since = day(new Date(Date.now() - 365 * 86_400_000))
  const rows = await cargoCached(
    {
      tables: 'ScoreboardPlayers',
      fields: 'GameId,DateTime_UTC,Champion,Kills,Deaths,Assists,CS,DamageToChampions,PlayerWin,Team,TeamVs,Role',
      where: `Link=${q(link)} AND DateTime_UTC >= ${q(since)}`,
      order_by: 'DateTime_UTC DESC',
      limit: 300,
    },
    10 * 60_000,
    signal,
  )
  return rows.map((r) => {
    const gameId = str(r.GameId)
    return {
      gameId,
      matchId: gameId.replace(/_\d+$/, ''),
      date: str(r.DateTime_UTC).replace(' ', 'T') + 'Z',
      champion: str(r.Champion),
      kills: num(r.Kills) ?? 0,
      deaths: num(r.Deaths) ?? 0,
      assists: num(r.Assists) ?? 0,
      cs: num(r.CS) ?? 0,
      damage: num(r.DamageToChampions) ?? 0,
      win: str(r.PlayerWin) === 'Yes',
      team: str(r.Team),
      opponent: str(r.TeamVs),
      role: str(r.Role),
    }
  })
}

// ---------- Stats agrégées d'un tournoi ----------

const pagesIn = (pages: string[]) => `OverviewPage IN (${qList(pages)})`

/** Picks, victoires et bans par champion. */
export async function fetchChampionStats(pages: string[], signal?: AbortSignal): Promise<{ games: number; champions: ChampionStat[] }> {
  const [picks, bans] = await Promise.all([
    cargoCached({ tables: 'ScoreboardPlayers', fields: 'Champion,PlayerWin,COUNT(*)=G', where: pagesIn(pages), group_by: 'Champion,PlayerWin', limit: 500 }, 10 * 60_000, signal),
    cargoCached({ tables: 'ScoreboardGames', fields: 'Team1Bans,Team2Bans', where: pagesIn(pages), limit: 500 }, 10 * 60_000, signal),
  ])
  const by = new Map<string, ChampionStat>()
  const get = (champion: string) => {
    let s = by.get(champion)
    if (!s) by.set(champion, (s = { champion, picks: 0, wins: 0, bans: 0 }))
    return s
  }
  let total = 0
  for (const r of picks) {
    const g = num(r.G) ?? 0
    const s = get(str(r.Champion))
    s.picks += g
    if (str(r.PlayerWin) === 'Yes') s.wins += g
    total += g
  }
  for (const r of bans) {
    for (const c of [...list(r.Team1Bans), ...list(r.Team2Bans)]) if (c && c !== 'None') get(c).bans++
  }
  return { games: Math.round(total / 10), champions: [...by.values()].filter((s) => s.champion) }
}

/** Totaux par joueur : parties, K/D/A, CS, dégâts, victoires. */
export async function fetchPlayerStats(pages: string[], signal?: AbortSignal): Promise<PlayerStat[]> {
  const [totals, wins] = await Promise.all([
    cargoCached(
      {
        tables: 'ScoreboardPlayers',
        fields: 'Link,MAX(Name)=N,MAX(Team)=T,MAX(Role)=R,COUNT(*)=G,SUM(Kills)=K,SUM(Deaths)=D,SUM(Assists)=A,SUM(CS)=CS,SUM(DamageToChampions)=DMG',
        where: pagesIn(pages),
        group_by: 'Link',
        order_by: 'G DESC',
        limit: 500,
      },
      10 * 60_000,
      signal,
    ),
    cargoCached({ tables: 'ScoreboardPlayers', fields: 'Link,COUNT(*)=W', where: `${pagesIn(pages)} AND PlayerWin='Yes'`, group_by: 'Link', limit: 500 }, 10 * 60_000, signal),
  ])
  const won = new Map(wins.map((r) => [str(r.Link), num(r.W) ?? 0]))
  await resolveTeams(totals.map((r) => str(r.T)))
  return totals.map((r: Row) => ({
    link: str(r.Link),
    name: str(r.N) || str(r.Link),
    team: str(r.T),
    role: str(r.R),
    games: num(r.G) ?? 0,
    kills: num(r.K) ?? 0,
    deaths: num(r.D) ?? 0,
    assists: num(r.A) ?? 0,
    cs: num(r.CS) ?? 0,
    damage: num(r.DMG) ?? 0,
    wins: won.get(str(r.Link)) ?? 0,
  }))
}

/** Séries d'un tournoi, par tour (arbre des playoffs, phases de groupes). */
export async function fetchTournamentRounds(page: string, signal?: AbortSignal) {
  const rows = await cargoCached(
    {
      tables: 'MatchSchedule',
      fields: 'Team1,Team2,Team1Score,Team2Score,Winner,DateTime_UTC,BestOf,Tab,MatchId',
      where: `OverviewPage=${q(page)}`,
      order_by: 'DateTime_UTC',
      limit: 300,
    },
    5 * 60_000,
    signal,
  )
  await resolveTeams(rows.flatMap((r) => [str(r.Team1), str(r.Team2)]))
  const rounds = new Map<string, Row[]>()
  for (const r of rows) {
    const k = str(r.Tab) || 'Matchs'
    rounds.set(k, [...(rounds.get(k) ?? []), r])
  }
  return [...rounds.entries()].map(([name, matches]) => ({
    name,
    matches: matches.map((r) => ({
      id: str(r.MatchId),
      date: str(r.DateTime_UTC).replace(' ', 'T') + 'Z',
      a: teamOf(str(r.Team1)),
      b: teamOf(str(r.Team2)),
      scoreA: num(r.Team1Score),
      scoreB: num(r.Team2Score),
      winner: num(r.Winner),
      bestOf: num(r.BestOf) ?? 1,
    })),
  }))
}
