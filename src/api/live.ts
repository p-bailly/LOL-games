import { fetchLive, fetchEvent, fetchLiveFrame, liveActive, type LiveEvent, type LiveFrame } from './lolesports'
import type { Match, Team } from './types'

// Mise en relation du flux en direct de LoL Esports avec les séries de Leaguepedia.

const simple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Même équipe d'après le nom ou l'abréviation (les deux sources n'écrivent pas toujours pareil). */
export function sameTeam(t: Team, name: string, code: string): boolean {
  if (!name && !code) return false
  const n = simple(name)
  const c = simple(code)
  return (!!n && (simple(t.name) === n || (n.length >= 4 && simple(t.name).length >= 4 && (simple(t.name).includes(n) || n.includes(simple(t.name)))))) || (!!c && simple(t.code) === c)
}

/** Série de la liste qui correspond à un événement en direct (mêmes équipes, même jour à 24 h près). */
export function findMatch(matches: Match[], e: LiveEvent): { match: Match; swapped: boolean } | undefined {
  const start = e.startTime ? new Date(e.startTime).getTime() : undefined
  for (const m of matches) {
    if (start && Math.abs(new Date(m.date).getTime() - start) > 36 * 3_600_000) continue
    const [x, y] = e.teams
    if (sameTeam(m.a.team, x.name, x.code) && sameTeam(m.b.team, y.name, y.code)) return { match: m, swapped: false }
    if (sameTeam(m.a.team, y.name, y.code) && sameTeam(m.b.team, x.name, x.code)) return { match: m, swapped: true }
  }
  return undefined
}

function inProgress(e: LiveEvent): number {
  const g = e.games.find((x) => x.state === 'inProgress')
  return g?.number ?? Math.max(1, e.games.filter((x) => x.state === 'completed').length + 1)
}

/** Ajoute à des séries l'état exact (en direct, score de la série) quand le direct LoL Esports est actif. */
export async function applyLive(matches: Match[], signal?: AbortSignal): Promise<Match[]> {
  if (!liveActive() || !matches.some((m) => m.state !== 'post' || Date.now() - new Date(m.date).getTime() < 24 * 3_600_000)) return matches
  let events: LiveEvent[]
  try {
    events = await fetchLive(signal)
  } catch {
    return matches // pas de direct : on garde ce que Leaguepedia sait
  }
  const out = matches.map((m) => ({ ...m }))
  for (const e of events) {
    const hit = findMatch(out, e)
    if (!hit) continue
    const { match: m, swapped } = hit
    const [x, y] = swapped ? [e.teams[1], e.teams[0]] : e.teams
    m.state = 'in'
    m.estimated = false
    m.a = { ...m.a, score: x.wins }
    m.b = { ...m.b, score: y.wins }
    m.live = { eventMatchId: e.matchId, game: inProgress(e), games: e.games.map((g) => ({ id: g.id, number: g.number, state: g.state })) }
  }
  return out
}

// ---------- Game en cours ----------

export interface LiveGameView {
  frame: LiveFrame
  number: number
  /** Camp de chaque équipe de la série. */
  blueIsA: boolean
}

/** Statistiques en direct de la game en cours d'une série. */
export async function fetchLiveGame(match: Match, signal?: AbortSignal): Promise<LiveGameView | undefined> {
  if (!match.live) return undefined
  const event = await fetchEvent(match.live.eventMatchId, signal)
  if (!event) return undefined
  const game = event.games.find((g) => g.state === 'inProgress') ?? event.games.filter((g) => g.state === 'completed').pop()
  if (!game) return undefined
  const frame = await fetchLiveFrame(game.id, signal)
  if (!frame) return undefined
  // Camp de l'équipe A : d'après les identifiants d'équipes de la game, sinon d'après le nom.
  const teamA = event.teams.find((t) => sameTeam(match.a.team, t.name, t.code))
  const sideOfA = teamA?.id ? game.teams.find((t) => t.id === teamA.id)?.side : undefined
  const blueIsA = sideOfA ? sideOfA === 'blue' : teamA?.id ? frame.blue.teamId === teamA.id : true
  return { frame, number: game.number, blueIsA }
}
