import type { Round } from './stats'
import type { StandingRow, Team } from './types'

// Phase suisse (Worlds) : les tours « Round 1 », « Round 2»… où chaque équipe joue une série par tour.
// Trois victoires qualifient, trois défaites éliminent.

export const SWISS_WINS = 3

export interface SwissCell {
  id: string
  opponent: Team
  /** Vrai : série gagnée ; faux : perdue ; absent : pas encore jouée. */
  win?: boolean
  score?: string
  bestOf: number
  date: string
}

export interface SwissRow {
  team: Team
  wins: number
  losses: number
  /** Une case par tour, vide si l'équipe n'y joue pas (ou pas encore connue). */
  cells: (SwissCell | undefined)[]
  status: 'qualified' | 'eliminated' | 'alive'
}

export interface Swiss {
  rounds: string[]
  rows: SwissRow[]
}

const isSwissRound = (name: string) => /^Round \d+$/.test(name)

/** Tableau de la phase suisse, ou rien si le tournoi n'en a pas (au moins 3 tours « Round n »). */
export function buildSwiss(rounds: Round[], standings: StandingRow[]): Swiss | undefined {
  const swiss = rounds
    .filter((r) => isSwissRound(r.name))
    .sort((a, b) => Number(a.name.slice(6)) - Number(b.name.slice(6)))
  if (swiss.length < 3) return undefined

  const rows = new Map<string, SwissRow>()
  const row = (t: Team) => {
    let r = rows.get(t.id)
    if (!r) rows.set(t.id, (r = { team: t, wins: 0, losses: 0, cells: swiss.map(() => undefined), status: 'alive' }))
    return r
  }
  swiss.forEach((round, i) => {
    for (const m of round.matches) {
      if (m.a.id === 'TBD' || m.b.id === 'TBD') continue
      const done = m.winner === 1 || m.winner === 2
      for (const side of [1, 2] as const) {
        const me = side === 1 ? m.a : m.b
        const opp = side === 1 ? m.b : m.a
        const r = row(me)
        const win = done ? m.winner === side : undefined
        if (win === true) r.wins++
        if (win === false) r.losses++
        r.cells[i] = {
          id: m.id,
          opponent: opp,
          win,
          score: done ? (side === 1 ? `${m.scoreA ?? 0}-${m.scoreB ?? 0}` : `${m.scoreB ?? 0}-${m.scoreA ?? 0}`) : undefined,
          bestOf: m.bestOf,
          date: m.date,
        }
      }
    }
  })
  // Équipes du tour 1 sans résultat : elles sont quand même dans le tableau (ligne créée ci-dessus).
  const place = new Map(standings.map((s, i) => [s.team.id, i]))
  const list = [...rows.values()]
  for (const r of list) r.status = r.wins >= SWISS_WINS ? 'qualified' : r.losses >= SWISS_WINS ? 'eliminated' : 'alive'
  // Meilleur bilan d'abord ; à bilan égal, l'ordre du classement Leaguepedia (départage), puis le nom.
  list.sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      (place.get(a.team.id) ?? 99) - (place.get(b.team.id) ?? 99) ||
      a.team.name.localeCompare(b.team.name),
  )
  return { rounds: swiss.map((r) => r.name), rows: list }
}
