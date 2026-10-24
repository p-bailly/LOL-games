import type { GameRow, LineRow } from '../api/games'
import { kdaNum } from './format'

// Agrégats calculés sur les games d'un tournoi : stats d'équipe, stats avancées des joueurs, records.

// ---------- Équipes ----------

export interface TeamStat {
  team: string
  games: number
  wins: number
  minutes: number
  kills: number
  /** Somme des écarts d'or (équipe moins adversaire) en fin de game. */
  goldDiff: number
  towers: number
  dragons: number
  barons: number
  heralds: number
  grubs: number
  blue: { games: number; wins: number }
  red: { games: number; wins: number }
}

export function teamStats(games: GameRow[]): TeamStat[] {
  const by = new Map<string, TeamStat>()
  const get = (team: string) => {
    let s = by.get(team)
    if (!s) by.set(team, (s = { team, games: 0, wins: 0, minutes: 0, kills: 0, goldDiff: 0, towers: 0, dragons: 0, barons: 0, heralds: 0, grubs: 0, blue: { games: 0, wins: 0 }, red: { games: 0, wins: 0 } }))
    return s
  }
  for (const g of games) {
    for (const i of [0, 1] as const) {
      const s = get(g.teams[i])
      const win = g.winner === i + 1
      s.games++
      if (win) s.wins++
      s.minutes += g.minutes
      s.kills += g.kills[i]
      s.goldDiff += g.gold[i] - g.gold[1 - i]
      s.towers += g.towers[i]
      s.dragons += g.dragons[i]
      s.barons += g.barons[i]
      s.heralds += g.heralds[i]
      s.grubs += g.grubs[i]
      const side = i === 0 ? s.blue : s.red
      side.games++
      if (win) side.wins++
    }
  }
  return [...by.values()].filter((s) => s.team && s.team !== 'TBD')
}

// ---------- Joueurs ----------

export interface PlayerAdvanced {
  link: string
  name: string
  team: string
  role: string
  games: number
  minutes: number
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damage: number
  vision: number
  /** Totaux de l'équipe sur les games du joueur. */
  teamKills: number
  teamGold: number
  teamDamage: number
}

/** Totaux de chaque équipe dans chaque game, d'après les lignes des joueurs. */
function teamTotals(lines: LineRow[]) {
  const totals = new Map<string, { kills: number; gold: number; damage: number }>()
  for (const l of lines) {
    const key = `${l.gameId}|${l.team}`
    const t = totals.get(key) ?? { kills: 0, gold: 0, damage: 0 }
    t.kills += l.kills
    t.gold += l.gold
    t.damage += l.damage
    totals.set(key, t)
  }
  return totals
}

export function advancedPlayers(lines: LineRow[], games: GameRow[]): PlayerAdvanced[] {
  const game = new Map(games.map((g) => [g.id, g]))
  const totals = teamTotals(lines)
  const by = new Map<string, PlayerAdvanced & { last: string }>()
  for (const l of lines) {
    const g = game.get(l.gameId)
    if (!g || g.minutes <= 0 || !l.link) continue
    const t = totals.get(`${l.gameId}|${l.team}`)!
    let p = by.get(l.link)
    if (!p) by.set(l.link, (p = { link: l.link, name: l.name, team: l.team, role: l.role, games: 0, minutes: 0, kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0, damage: 0, vision: 0, teamKills: 0, teamGold: 0, teamDamage: 0, last: '' }))
    // Équipe et rôle : ceux de sa dernière game.
    if (g.date >= p.last) {
      p.last = g.date
      p.team = l.team
      p.role = l.role
      p.name = l.name
    }
    p.games++
    p.minutes += g.minutes
    p.kills += l.kills
    p.deaths += l.deaths
    p.assists += l.assists
    p.cs += l.cs
    p.gold += l.gold
    p.damage += l.damage
    p.vision += l.vision
    p.teamKills += t.kills
    p.teamGold += t.gold
    p.teamDamage += t.damage
  }
  return [...by.values()]
}

// ---------- Records ----------

export interface Ranked<T> {
  item: T
  value: number
}

/** Les `n` meilleures valeurs (`dir` : « max » ou « min »), à égalité la plus récente d'abord. */
export function top<T extends { date: string }>(items: T[], value: (t: T) => number, dir: 'max' | 'min', n = 3): Ranked<T>[] {
  const sign = dir === 'max' ? -1 : 1
  return items
    .map((item) => ({ item, value: value(item) }))
    .sort((a, b) => sign * (a.value - b.value) || b.item.date.localeCompare(a.item.date))
    .slice(0, n)
}

/** Plus longue suite de victoires (en games) de chaque équipe, de la plus longue à la plus courte. */
export function winStreaks(games: GameRow[]): { team: string; length: number; end: string }[] {
  const run = new Map<string, number>()
  const best = new Map<string, { length: number; end: string }>()
  for (const g of [...games].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const i of [0, 1] as const) {
      const team = g.teams[i]
      if (!team || team === 'TBD') continue
      const n = g.winner === i + 1 ? (run.get(team) ?? 0) + 1 : 0
      run.set(team, n)
      if (n > (best.get(team)?.length ?? 0)) best.set(team, { length: n, end: g.date })
    }
  }
  return [...best.entries()].map(([team, b]) => ({ team, ...b })).sort((a, b) => b.length - a.length || b.end.localeCompare(a.end))
}

export interface PlayerGame extends LineRow {
  date: string
  matchId: string
  /** Équipe adverse. */
  opponent: string
  win: boolean
}

/** Lignes des joueurs avec la date, la série, l'adversaire et le résultat de leur game. */
export function playerGames(lines: LineRow[], games: GameRow[]): PlayerGame[] {
  const game = new Map(games.map((g) => [g.id, g]))
  const out: PlayerGame[] = []
  for (const l of lines) {
    const g = game.get(l.gameId)
    if (!g || !l.link) continue
    const i = g.teams[0] === l.team ? 0 : g.teams[1] === l.team ? 1 : -1
    if (i < 0) continue
    out.push({ ...l, date: g.date, matchId: g.matchId, opponent: g.teams[1 - i], win: g.winner === i + 1 })
  }
  return out
}

export const kdaOf = (p: Pick<LineRow, 'kills' | 'deaths' | 'assists'>) => kdaNum(p.kills, p.deaths, p.assists)
