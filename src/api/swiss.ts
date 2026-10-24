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

export interface BracketMatch {
  /** Absent tant que les équipes ne sont pas connues (« À déterminer »). */
  id?: string
  a?: Team
  b?: Team
  scoreA?: number
  scoreB?: number
  winner?: number
  date?: string
  live?: boolean
}

/** Une boîte du bracket : toutes les séries d'un tour entre équipes ayant le même bilan. */
export interface BracketBox {
  wins: number
  losses: number
  bestOf: number
  matches: BracketMatch[]
}

export interface BracketColumn {
  round: string
  boxes: BracketBox[]
}

export interface Swiss {
  rounds: string[]
  rows: SwissRow[]
  /** Le bracket : une colonne par tour, une boîte par bilan (0-0, puis 1-0 et 0-1, puis 2-0, 1-1 et 0-2…). */
  bracket: BracketColumn[]
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
  return { rounds: swiss.map((r) => r.name), rows: list, bracket: buildBracket(swiss, rows, list.length) }
}

const choose = (n: number, k: number): number => {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

/**
 * Bracket complet, y compris les tours à venir : après k tours, 2^-k des équipes de départ ont chaque suite de
 * résultats, donc la boîte « w-l » du tour k+1 compte N/2 × C(k, w) / 2^k séries (8, 4+4, 2+4+2, 3+3, 3 pour 16 équipes).
 * Une série est en BO3 quand l'une des deux équipes peut se qualifier ou être éliminée, en BO1 sinon.
 */
function buildBracket(rounds: Round[], rows: Map<string, SwissRow>, teams: number): BracketColumn[] {
  const n = teams || 16
  const maxRounds = 2 * SWISS_WINS - 1
  const now = Date.now()
  // Bilan d'une équipe avant le tour k.
  const before = (id: string, k: number) => {
    const cells = rows.get(id)?.cells ?? []
    let w = 0
    let l = 0
    for (let j = 0; j < k; j++) {
      if (cells[j]?.win === true) w++
      if (cells[j]?.win === false) l++
    }
    return { w, l }
  }
  const columns: BracketColumn[] = []
  for (let k = 0; k < maxRounds; k++) {
    const known = rounds[k]?.matches.filter((m) => m.a.id !== 'TBD' && m.b.id !== 'TBD') ?? []
    const boxes: BracketBox[] = []
    for (let w = SWISS_WINS - 1; w >= 0; w--) {
      const l = k - w
      if (l < 0 || l >= SWISS_WINS) continue
      const slots = Math.round(((n / 2) * choose(k, w)) / 2 ** k)
      const mine = known
        .filter((m) => {
          const r = before(m.a.id, k)
          return r.w === w && r.l === l
        })
        .map((m): BracketMatch => {
          const done = m.winner === 1 || m.winner === 2
          const start = new Date(m.date).getTime()
          return {
            id: m.id,
            a: m.a,
            b: m.b,
            scoreA: m.scoreA,
            scoreB: m.scoreB,
            winner: done ? m.winner : undefined,
            date: m.date,
            live: !done && now >= start && now < start + (m.bestOf * 55 + 20) * 60_000,
          }
        })
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      const bestOf = known.find((m) => before(m.a.id, k).w === w && before(m.a.id, k).l === l)?.bestOf ?? (w === SWISS_WINS - 1 || l === SWISS_WINS - 1 ? 3 : 1)
      // Équipes qui ont fini leurs tours précédents avec ce bilan et attendent leur adversaire du tour k+1 :
      // elles occupent déjà une place de la boîte, le temps que la paire soit connue.
      const waiting = [...rows.values()]
        .filter((r) => !r.cells[k] && before(r.team.id, k).w === w && before(r.team.id, k).l === l && w + l === k && r.cells.slice(0, k).every((c) => c?.win !== undefined))
        .map((r) => r.team)
      const half: BracketMatch[] = []
      for (const t of waiting) {
        const open = half.find((h) => !h.b && half.length >= slots - mine.length)
        if (open) open.b = t
        else half.push({ a: t })
      }
      mine.push(...half.slice(0, Math.max(0, slots - mine.length)))
      while (mine.length < slots) mine.push({})
      boxes.push({ wins: w, losses: l, bestOf, matches: mine })
    }
    columns.push({ round: `Tour ${k + 1}`, boxes })
  }
  return columns
}
