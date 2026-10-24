import { allLeagueNames, leagueOfName, LEAGUES, ROLES } from './leagues'
import { cargo, cargoCached, fileUrls, isoDate, list, num, q, qList, sqlDate, str, type Row } from './cargo'
import type { FormEntry, Game, GameTeam, Match, MatchDetail, PickBan, PlayerLine, Side, State, Team } from './types'

// Calendrier, séries et games depuis Leaguepedia. Les résultats y arrivent quelques minutes après la fin de chaque
// game ; le direct (LoL Esports) vient les compléter, voir live.ts.

// ---------- Équipes ----------

interface TeamInfo {
  code: string
  logo?: string
  region?: string
  at: number
}

const TEAMS_KEY = 'rift:teams:v1'
const known = new Map<string, TeamInfo>()
try {
  for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(TEAMS_KEY) ?? '{}') as Record<string, TeamInfo>)) known.set(k, v)
} catch {
  /* stockage indisponible */
}
const TEAM_TTL = 7 * 86_400_000
const listeners = new Set<() => void>()

function saveTeams() {
  try {
    localStorage.setItem(TEAMS_KEY, JSON.stringify(Object.fromEntries(known)))
  } catch {
    /* plein ou indisponible */
  }
}

const TBD: Team = { id: 'TBD', name: 'À déterminer', code: 'TBD' }

function initials(name: string): string {
  const words = name.replace(/[()]/g, '').split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words.map((w) => w[0]).join('') : name).slice(0, 3).toUpperCase()
}

/** Équipe telle qu'on la connaît pour l'instant (logo et abréviation arrivent après `resolveTeams`). */
export function teamOf(name: string): Team {
  if (!name || name === 'TBD') return TBD
  const info = known.get(name)
  return { id: name, name, code: info?.code || initials(name), logo: info?.logo, region: info?.region }
}

/** Retrouve abréviation, région et logo des équipes pas encore connues (ou connues depuis plus d'une semaine). */
export async function resolveTeams(names: string[]): Promise<void> {
  const todo = [...new Set(names)].filter((n) => n && n !== 'TBD' && !(known.has(n) && Date.now() - known.get(n)!.at < TEAM_TTL))
  if (!todo.length) return
  const files = new Map<string, string>()
  const infos = new Map<string, TeamInfo>()
  for (let i = 0; i < todo.length; i += 40) {
    const batch = todo.slice(i, i + 40)
    try {
      const rows = await cargo({ tables: 'Teams', fields: 'Name,Short,Region,Image', where: `Name IN (${qList(batch)})`, limit: 100 })
      for (const r of rows) {
        const name = str(r.Name)
        infos.set(name, { code: str(r.Short) || initials(name), region: str(r.Region) || undefined, at: Date.now() })
        if (r.Image) files.set(name, str(r.Image))
      }
    } catch {
      return // on réessaiera au prochain affichage
    }
  }
  const urls = await fileUrls([...files.values()])
  for (const name of todo) {
    const info = infos.get(name) ?? { code: initials(name), at: Date.now() }
    const file = files.get(name)
    info.logo = file ? urls.get(file) : undefined
    known.set(name, info)
  }
  saveTeams()
  listeners.forEach((l) => l())
}

/** Appelé quand de nouveaux logos / abréviations sont connus (pour réafficher). */
export function onTeamsResolved(l: () => void) {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** Version qui attend d'avoir les infos, pour les fonctions de chargement. */
async function teamsOf(names: string[]): Promise<void> {
  await resolveTeams(names)
}

// ---------- Séries ----------

const MATCH_FIELDS = [
  'MS.Team1',
  'MS.Team2',
  'MS.Team1Score',
  'MS.Team2Score',
  'MS.Winner',
  'MS.DateTime_UTC',
  'MS.BestOf',
  'MS.OverviewPage',
  'MS.MatchId',
  'MS.Tab',
  'MS.Stream',
  'T.League',
  'T.Name=TName',
].join(',')

const SERIES_MINUTES = 55 // durée moyenne d'une game, lobby compris, pour deviner qu'une série est en cours

function stateOf(r: Row, start: number, bestOf: number): { state: State; estimated?: boolean } {
  const winner = num(r.Winner)
  if (winner === 1 || winner === 2) return { state: 'post' }
  const now = Date.now()
  if (now < start) return { state: 'pre' }
  if (now < start + (bestOf * SERIES_MINUTES + 20) * 60_000) return { state: 'in', estimated: true }
  return { state: 'post' }
}

function toMatch(r: Row): Match {
  const bestOf = num(r.BestOf) ?? 1
  const date = isoDate(str(r.DateTime_UTC))
  const winner = num(r.Winner)
  const { state, estimated } = stateOf(r, new Date(date).getTime(), bestOf)
  const league = leagueOfName(str(r.League))
  const side = (n: 1 | 2): Side => ({
    team: teamOf(str(r[`Team${n}`])),
    score: state === 'pre' ? undefined : num(r[`Team${n}Score`]) ?? (state === 'post' && winner ? (winner === n ? 1 : 0) : 0),
  })
  return {
    id: str(r.MatchId),
    date,
    state,
    estimated,
    league: league?.key ?? 'other',
    leagueName: league?.label ?? str(r.League),
    tournament: str(r.TName),
    page: str(r.OverviewPage),
    round: str(r.Tab),
    bestOf,
    a: side(1),
    b: side(2),
    winner: winner === 1 || winner === 2 ? winner : undefined,
    stream: str(r.Stream) || undefined,
  }
}

async function withTeams(rows: Row[]): Promise<Match[]> {
  await teamsOf(rows.flatMap((r) => [str(r.Team1), str(r.Team2)]))
  return rows.map(toMatch)
}

const leagueFilter = (keys?: string[]) => {
  const names = keys?.length ? keys.flatMap((k) => LEAGUES.find((l) => l.key === k)?.names ?? []) : allLeagueNames()
  return `T.League IN (${qList(names)})`
}

const SCHEDULE = { tables: 'MatchSchedule=MS,Tournaments=T', join_on: 'MS.OverviewPage=T.OverviewPage', fields: MATCH_FIELDS }

/** Séries qui commencent entre `from` et `to` (UTC), dans les ligues suivies. */
export async function fetchMatches(from: Date, to: Date, leagues?: string[], signal?: AbortSignal): Promise<Match[]> {
  const rows = await cargo(
    {
      ...SCHEDULE,
      where: `${leagueFilter(leagues)} AND MS.DateTime_UTC >= ${q(sqlDate(from))} AND MS.DateTime_UTC < ${q(sqlDate(to))}`,
      order_by: 'MS.DateTime_UTC',
      limit: 200,
    },
    signal,
  )
  return withTeams(rows)
}

/** Jours (heure locale) avec au moins une série, pour le bandeau de dates. */
export async function fetchCalendar(from: Date, to: Date, leagues?: string[]): Promise<Date[]> {
  const rows = await cargoCached(
    {
      ...SCHEDULE,
      fields: 'MS.DateTime_UTC',
      where: `${leagueFilter(leagues)} AND MS.DateTime_UTC >= ${q(sqlDate(from))} AND MS.DateTime_UTC < ${q(sqlDate(to))}`,
      order_by: 'MS.DateTime_UTC',
      limit: 500,
    },
    30 * 60_000,
  )
  return rows.map((r) => new Date(isoDate(str(r.DateTime_UTC))))
}

/** Calendrier et résultats d'une équipe (depuis `since`). */
export async function fetchTeamMatches(team: string, since: Date, signal?: AbortSignal): Promise<Match[]> {
  const rows = await cargo(
    {
      ...SCHEDULE,
      where: `(MS.Team1=${q(team)} OR MS.Team2=${q(team)}) AND MS.DateTime_UTC >= ${q(sqlDate(since))}`,
      order_by: 'MS.DateTime_UTC',
      limit: 200,
    },
    signal,
  )
  return withTeams(rows)
}

// ---------- Une série en détail ----------

const lines = (n: 1 | 2) =>
  ['Kills', 'Gold', 'Towers', 'Dragons', 'Barons', 'RiftHeralds', 'Inhibitors', 'VoidGrubs', 'Bans', 'Picks', 'Players'].map((f) => `Team${n}${f}`)
const GAME_FIELDS = ['GameId', 'N_GameInMatch', 'DateTime_UTC', 'Gamelength', 'Gamelength_Number', 'Patch', 'VOD', 'Winner', 'Team1', 'Team2', ...lines(1), ...lines(2)].join(',')
const PLAYER_FIELDS = [
  'GameId',
  'Name',
  'Link',
  'Champion',
  'Kills',
  'Deaths',
  'Assists',
  'Gold',
  'CS',
  'DamageToChampions',
  'VisionScore',
  'Items',
  'Trinket',
  'Role',
  'Team',
  'Side',
  'SummonerSpells',
  'KeystoneRune',
  'PrimaryTree',
  'SecondaryTree',
  'Runes',
  'PlayerWin',
  'Role_Number',
].join(',')
const PB_FIELDS = ['GameId', 'Team1', 'Team2', ...[1, 2].flatMap((t) => ['Ban', 'Pick', 'Role'].flatMap((k) => [1, 2, 3, 4, 5].map((i) => `Team${t}${k}${i}`)))].join(',')

// Ordre officiel d'une draft : [type, camp, rang parmi les bans ou les sélections de ce camp].
const DRAFT: ['ban' | 'pick', 'blue' | 'red', number][] = [
  ['ban', 'blue', 0],
  ['ban', 'red', 0],
  ['ban', 'blue', 1],
  ['ban', 'red', 1],
  ['ban', 'blue', 2],
  ['ban', 'red', 2],
  ['pick', 'blue', 0],
  ['pick', 'red', 0],
  ['pick', 'red', 1],
  ['pick', 'blue', 1],
  ['pick', 'blue', 2],
  ['pick', 'red', 2],
  ['ban', 'red', 3],
  ['ban', 'blue', 3],
  ['ban', 'red', 4],
  ['ban', 'blue', 4],
  ['pick', 'red', 3],
  ['pick', 'blue', 3],
  ['pick', 'blue', 4],
  ['pick', 'red', 4],
]
const draftRank = (kind: 'ban' | 'pick', side: 'blue' | 'red', i: number) => DRAFT.findIndex((d) => d[0] === kind && d[1] === side && d[2] === i) + 1

const real = (s: string) => s && s !== 'None' && s !== 'none'

function playerLine(r: Row): PlayerLine {
  return {
    name: str(r.Name),
    link: str(r.Link),
    champion: str(r.Champion),
    role: str(r.Role),
    kills: num(r.Kills) ?? 0,
    deaths: num(r.Deaths) ?? 0,
    assists: num(r.Assists) ?? 0,
    cs: num(r.CS) ?? 0,
    gold: num(r.Gold) ?? 0,
    damage: num(r.DamageToChampions) ?? 0,
    vision: num(r.VisionScore) ?? 0,
    items: list(r.Items).filter(Boolean),
    trinket: str(r.Trinket),
    spells: list(r.SummonerSpells).filter(Boolean),
    keystone: str(r.KeystoneRune),
    trees: [str(r.PrimaryTree), str(r.SecondaryTree)].filter(Boolean),
    runes: list(r.Runes).filter(Boolean),
    win: str(r.PlayerWin) === 'Yes',
  }
}

function parseGame(g: Row, players: Row[], pb: Row | undefined): Game {
  const winner = num(g.Winner)
  const names = [str(g.Team1), str(g.Team2)]
  // Dans ScoreboardGames, l'équipe 1 est du côté bleu.
  const sides: ('blue' | 'red')[] = ['blue', 'red']
  const ordered = !!pb
  const teams = ([1, 2] as const).map((n): GameTeam => {
    const side = sides[n - 1]
    const name = names[n - 1]
    const mine = players.filter((p) => str(p.Team) === name).sort((a, b) => (num(a.Role_Number) ?? 9) - (num(b.Role_Number) ?? 9))
    const lineup = mine.map(playerLine)
    const listBans = list(g[`Team${n}Bans`]).filter(real)
    const listPicks = list(g[`Team${n}Picks`])

    // Draft : numéros et ordre de sélection viennent de PicksAndBans (ses équipes 1 et 2 sont nommées).
    let pbN: 1 | 2 | undefined
    if (pb) pbN = str(pb.Team1) === name ? 1 : str(pb.Team2) === name ? 2 : undefined
    const bans: PickBan[] = (pbN ? [1, 2, 3, 4, 5].map((i) => str(pb![`Team${pbN}Ban${i}`])) : listBans).map((c, i) => ({
      champion: c,
      order: pbN ? draftRank('ban', side, i) : undefined,
    }))
    let picks: PickBan[]
    if (pbN) {
      picks = [1, 2, 3, 4, 5].map((i) => ({
        champion: str(pb![`Team${pbN}Pick${i}`]),
        role: str(pb![`Team${pbN}Role${i}`]) || undefined,
        order: draftRank('pick', side, i - 1),
      }))
    } else {
      picks = listPicks.map((c, i) => ({ champion: lineup[i]?.champion || c, role: lineup[i]?.role ?? ROLES[i] }))
    }
    return {
      team: teamOf(name),
      side,
      win: winner === n,
      kills: num(g[`Team${n}Kills`]) ?? lineup.reduce((s, p) => s + p.kills, 0),
      gold: num(g[`Team${n}Gold`]) ?? lineup.reduce((s, p) => s + p.gold, 0),
      towers: num(g[`Team${n}Towers`]) ?? 0,
      dragons: num(g[`Team${n}Dragons`]) ?? 0,
      barons: num(g[`Team${n}Barons`]) ?? 0,
      heralds: num(g[`Team${n}RiftHeralds`]) ?? 0,
      grubs: num(g[`Team${n}VoidGrubs`]) ?? 0,
      inhibitors: num(g[`Team${n}Inhibitors`]) ?? 0,
      bans: bans.filter((b) => real(b.champion)),
      picks: picks.filter((p) => real(p.champion)),
      players: lineup,
    }
  })
  return {
    id: str(g.GameId),
    number: num(g.N_GameInMatch) ?? 1,
    date: isoDate(str(g.DateTime_UTC)),
    length: str(g.Gamelength),
    minutes: num(g.Gamelength_Number) ?? 0,
    patch: str(g.Patch) || undefined,
    vod: str(g.VOD) || undefined,
    blue: teams[0],
    red: teams[1],
    ordered,
  }
}

/** Games jouées d'une série (draft, stats des joueurs, objectifs). Vide tant que rien n'est publié. */
export async function fetchGames(matchId: string, signal?: AbortSignal): Promise<Game[]> {
  const games = await cargo({ tables: 'ScoreboardGames', fields: GAME_FIELDS, where: `MatchId=${q(matchId)}`, order_by: 'N_GameInMatch', limit: 10 }, signal)
  if (!games.length) return []
  const ids = qList(games.map((g) => str(g.GameId)))
  const [players, pbs] = await Promise.all([
    cargo({ tables: 'ScoreboardPlayers', fields: PLAYER_FIELDS, where: `GameId IN (${ids})`, limit: 100 }, signal),
    cargo({ tables: 'PicksAndBansS7', fields: PB_FIELDS, where: `GameId IN (${ids})`, limit: 10 }, signal).catch(() => [] as Row[]),
  ])
  await teamsOf(games.flatMap((g) => [str(g.Team1), str(g.Team2)]))
  return games.map((g) => {
    const id = str(g.GameId)
    return parseGame(
      g,
      players.filter((p) => str(p.GameId) === id),
      pbs.find((p) => str(p.GameId) === id),
    )
  })
}

export async function fetchMatchRow(matchId: string, signal?: AbortSignal): Promise<Match | undefined> {
  const rows = await cargo({ ...SCHEDULE, where: `MS.MatchId=${q(matchId)}`, limit: 1 }, signal)
  return (await withTeams(rows))[0]
}

const SERIES_SCORE = (r: Row) => `${num(r.Team1Score) ?? 0}-${num(r.Team2Score) ?? 0}`

/** Forme récente des deux équipes (5 dernières séries) et derniers face-à-face. */
export async function fetchForm(a: string, b: string, before: string, signal?: AbortSignal): Promise<NonNullable<MatchDetail['form']>> {
  const rows = await cargo(
    {
      ...SCHEDULE,
      where: `(MS.Team1 IN (${qList([a, b])}) OR MS.Team2 IN (${qList([a, b])})) AND MS.Winner IN (1,2) AND MS.DateTime_UTC < ${q(sqlDate(new Date(before)))} AND MS.DateTime_UTC > ${q(sqlDate(new Date(Date.now() - 400 * 86_400_000)))}`,
      order_by: 'MS.DateTime_UTC DESC',
      limit: 60,
    },
    signal,
  )
  await teamsOf(rows.flatMap((r) => [str(r.Team1), str(r.Team2)]))
  const entry = (r: Row, me: string): FormEntry => {
    const mine = str(r.Team1) === me ? 1 : 2
    const opp = str(r[`Team${mine === 1 ? 2 : 1}`])
    const winner = num(r.Winner) as 1 | 2
    return {
      id: str(r.MatchId),
      date: isoDate(str(r.DateTime_UTC)),
      opponent: teamOf(opp),
      win: winner === mine,
      score: mine === 1 ? SERIES_SCORE(r) : `${num(r.Team2Score) ?? 0}-${num(r.Team1Score) ?? 0}`,
      winner: teamOf(str(r[`Team${winner}`])),
    }
  }
  const of = (me: string) => rows.filter((r) => str(r.Team1) === me || str(r.Team2) === me)
  return {
    a: of(a).slice(0, 5).map((r) => entry(r, a)),
    b: of(b).slice(0, 5).map((r) => entry(r, b)),
    h2h: rows.filter((r) => [str(r.Team1), str(r.Team2)].sort().join() === [a, b].sort().join()).slice(0, 5).map((r) => entry(r, a)),
  }
}

export async function fetchMatchDetail(matchId: string, signal?: AbortSignal): Promise<MatchDetail> {
  const match = await fetchMatchRow(matchId, signal)
  if (!match) throw new Error('Série introuvable.')
  const games = await fetchGames(matchId, signal)
  let form: MatchDetail['form']
  if (match.state === 'pre' && match.a.team.id !== 'TBD' && match.b.team.id !== 'TBD') {
    form = await fetchForm(match.a.team.id, match.b.team.id, match.date, signal).catch(() => undefined)
  }
  // Score de la série d'après les games publiées, plus à jour que la ligne du calendrier.
  const wins = [games.filter((g) => g.blue.win && g.blue.team.id === match.a.team.id).length + games.filter((g) => g.red.win && g.red.team.id === match.a.team.id).length]
  const winsB = games.filter((g) => (g.blue.win && g.blue.team.id === match.b.team.id) || (g.red.win && g.red.team.id === match.b.team.id)).length
  if (match.state !== 'pre' && games.length) {
    match.a = { ...match.a, score: Math.max(match.a.score ?? 0, wins[0]) }
    match.b = { ...match.b, score: Math.max(match.b.score ?? 0, winsB) }
  }
  return { match, games, form }
}
