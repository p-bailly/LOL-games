import { gameProb, ratingOf, type Ratings } from '../api/ratings'
import type { Round, RoundMatch } from '../api/stats'
import type { Team } from '../api/types'

// Projections par simulation (Monte-Carlo) : les séries restantes sont jouées des milliers de fois d'après la force
// des équipes (voir api/ratings.ts), et l'on compte combien de fois chaque équipe finit à chaque place, ou va
// jusqu'au titre.

export const SIMS = 4000
const WINS = 3 // phase suisse : 3 victoires qualifient, 3 défaites éliminent

/** Joue une série au meilleur des `bestOf` games : renvoie les games gagnées par A et par B. */
function play(pg: number, bestOf: number): [number, number] {
  const need = Math.floor(bestOf / 2) + 1
  let a = 0
  let b = 0
  while (a < need && b < need) {
    if (Math.random() < pg) a++
    else b++
  }
  return [a, b]
}

const isTbd = (t: Team) => t.id === 'TBD'
const decided = (m: RoundMatch) => m.winner === 1 || m.winner === 2
const shuffle = <T,>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- Classement d'une ligue : chances de finir à chaque place ----------

export interface PlaceRow {
  team: Team
  /** Probabilité de finir à chaque place (index 0 = 1re). */
  places: number[]
  avgPlace: number
  /** Bilan actuel en séries. */
  wins: number
  losses: number
  /** Nombre moyen de victoires en fin de phase. */
  avgWins: number
}

export interface LeagueProjection {
  kind: 'league'
  rows: PlaceRow[]
  remaining: number
}

/** Projection d'un classement à partir des séries jouées et restantes ; rien s'il n'y a plus (ou pas) de série à jouer. */
export function projectLeague(rounds: Round[], ratings: Ratings, sims = SIMS): LeagueProjection | undefined {
  const matches = rounds.flatMap((r) => r.matches).filter((m) => !isTbd(m.a) && !isTbd(m.b))
  const teams = new Map<string, Team>()
  for (const m of matches) {
    teams.set(m.a.id, m.a)
    teams.set(m.b.id, m.b)
  }
  const ids = [...teams.keys()]
  if (ids.length < 3) return undefined
  const idx = new Map(ids.map((id, i) => [id, i]))
  const w = ids.map(() => 0)
  const l = ids.map(() => 0)
  const diff = ids.map(() => 0)
  const todo: { a: number; b: number; p: number; bo: number }[] = []
  for (const m of matches) {
    const a = idx.get(m.a.id)!
    const b = idx.get(m.b.id)!
    if (decided(m)) {
      if (m.winner === 1) (w[a]++, l[b]++)
      else (w[b]++, l[a]++)
      diff[a] += (m.scoreA ?? 0) - (m.scoreB ?? 0)
      diff[b] += (m.scoreB ?? 0) - (m.scoreA ?? 0)
    } else {
      todo.push({ a, b, p: gameProb(ratingOf(ratings, m.a.id), ratingOf(ratings, m.b.id)), bo: m.bestOf })
    }
  }
  if (!todo.length) return undefined

  const n = ids.length
  const counts = ids.map(() => new Array<number>(n).fill(0))
  const sumWins = ids.map(() => 0)
  const order = ids.map((_, i) => i)
  for (let s = 0; s < sims; s++) {
    const sw = w.slice()
    const sd = diff.slice()
    for (const m of todo) {
      const [ga, gb] = play(m.p, m.bo)
      if (ga > gb) sw[m.a]++
      else sw[m.b]++
      sd[m.a] += ga - gb
      sd[m.b] += gb - ga
    }
    const tie = shuffle(order.slice())
    const ranked = order.slice().sort((x, y) => sw[y] - sw[x] || sd[y] - sd[x] || tie.indexOf(x) - tie.indexOf(y))
    ranked.forEach((t, place) => counts[t][place]++)
    for (let t = 0; t < n; t++) sumWins[t] += sw[t]
  }
  const rows = ids.map((id, i): PlaceRow => {
    const places = counts[i].map((c) => c / sims)
    return {
      team: teams.get(id)!,
      places,
      avgPlace: places.reduce((acc, p, k) => acc + p * (k + 1), 0),
      wins: w[i],
      losses: l[i],
      avgWins: sumWins[i] / sims,
    }
  })
  rows.sort((x, y) => x.avgPlace - y.avgPlace)
  return { kind: 'league', rows, remaining: todo.length }
}

// ---------- Phase suisse puis phase à élimination : chances de se qualifier et de gagner ----------

export interface EventRow {
  team: Team
  /** Bilan actuel de la phase suisse. */
  wins: number
  losses: number
  qualify: number
  semis: number
  final: number
  title: number
}

export interface EventProjection {
  kind: 'event'
  rows: EventRow[]
}

const swissRounds = (rounds: Round[]) =>
  rounds
    .filter((r) => /^Round \d+$/.test(r.name))
    .sort((a, b) => Number(a.name.slice(6)) - Number(b.name.slice(6)))

const stage = (rounds: Round[], re: RegExp) =>
  (rounds.find((r) => re.test(r.name))?.matches ?? []).slice().sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

/**
 * Projection d'un tournoi à phase suisse (3 victoires qualifient, 3 défaites éliminent) puis quarts, demies et
 * finale. Les séries déjà connues sont reprises telles quelles ; pour les tours dont les affiches ne sont pas
 * connues, les équipes de même bilan sont appariées au hasard sans rejouer deux fois la même série. Si les quarts ne
 * sont pas connus, ils sont tirés ainsi : meilleur bilan contre moins bon (1-8, 4-5, 2-7, 3-6).
 */
export function projectEvent(rounds: Round[], ratings: Ratings, sims = SIMS): EventProjection | undefined {
  const swiss = swissRounds(rounds)
  if (swiss.length < 3) return undefined
  const teams = new Map<string, Team>()
  for (const r of swiss) for (const m of r.matches) for (const t of [m.a, m.b]) if (!isTbd(t)) teams.set(t.id, t)
  if (teams.size < 8) return undefined
  const ids = [...teams.keys()]
  const rating = (id: string) => ratingOf(ratings, id)
  const qf = stage(rounds, /^Quarterfinals$/i)
  const sf = stage(rounds, /^Semifinals$/i)
  const fin = stage(rounds, /^Finals$/i)

  const tally = new Map(ids.map((id) => [id, { qualify: 0, semis: 0, final: 0, title: 0 }]))
  const now = new Map(ids.map((id) => [id, { w: 0, l: 0 }]))

  // Bilan actuel (séries jouées).
  for (const r of swiss) {
    for (const m of r.matches) {
      if (!decided(m)) continue
      const win = m.winner === 1 ? m.a.id : m.b.id
      const lose = m.winner === 1 ? m.b.id : m.a.id
      now.get(win)!.w++
      now.get(lose)!.l++
    }
  }

  const simulate = (a: string, b: string, bestOf: number) => {
    const [ga, gb] = play(gameProb(rating(a), rating(b)), bestOf)
    return ga > gb ? a : b
  }

  for (let s = 0; s < sims; s++) {
    const rec = new Map(ids.map((id) => [id, { w: 0, l: 0 }]))
    const met = new Set<string>()
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

    for (const round of swiss) {
      const fixed = round.matches.filter((m) => !isTbd(m.a) && !isTbd(m.b))
      const missing = round.matches.length - fixed.length
      const busy = new Set(fixed.flatMap((m) => [m.a.id, m.b.id]))
      const todo: { a: string; b: string; bo: number; known?: RoundMatch }[] = fixed.map((m) => ({ a: m.a.id, b: m.b.id, bo: m.bestOf, known: m }))

      if (missing > 0) {
        // Équipes encore en lice qui n'ont pas d'affiche, groupées par bilan (meilleur bilan d'abord).
        const alive = ids.filter((id) => !busy.has(id) && rec.get(id)!.w < WINS && rec.get(id)!.l < WINS)
        const groups = new Map<string, string[]>()
        for (const id of alive) {
          const r = rec.get(id)!
          const k = `${r.w}-${r.l}`
          groups.set(k, [...(groups.get(k) ?? []), id])
        }
        const keys = [...groups.keys()].sort((x, y) => {
          const [xw, xl] = x.split('-').map(Number)
          const [yw, yl] = y.split('-').map(Number)
          return yw - xw || xl - yl
        })
        let carry: string | undefined
        for (const k of keys) {
          const [kw, kl] = k.split('-').map(Number)
          let pool = shuffle(groups.get(k)!.slice())
          if (carry) pool = [carry, ...pool]
          carry = undefined
          // Évite les revanches : quelques tirages, on garde celui qui en compte le moins.
          let best: string[] = pool
          let bestRematch = Infinity
          for (let t = 0; t < 12 && bestRematch > 0; t++) {
            const cand = shuffle(pool.slice())
            let rem = 0
            for (let i = 0; i + 1 < cand.length; i += 2) if (met.has(key(cand[i], cand[i + 1]))) rem++
            if (rem < bestRematch) (best = cand, bestRematch = rem)
          }
          for (let i = 0; i + 1 < best.length; i += 2) todo.push({ a: best[i], b: best[i + 1], bo: kw === WINS - 1 || kl === WINS - 1 ? 3 : 1 })
          if (best.length % 2 === 1) carry = best[best.length - 1]
        }
      }
      for (const m of todo) {
        let winner: string
        if (m.known && decided(m.known)) winner = m.known.winner === 1 ? m.a : m.b
        else winner = simulate(m.a, m.b, m.bo)
        const loser = winner === m.a ? m.b : m.a
        rec.get(winner)!.w++
        rec.get(loser)!.l++
        met.add(key(m.a, m.b))
      }
    }

    // Les huit qualifiés : 3 victoires ; à défaut (données incomplètes), les meilleurs bilans.
    const seeds = ids
      .slice()
      .sort((x, y) => rec.get(y)!.w - rec.get(x)!.w || rec.get(x)!.l - rec.get(y)!.l || rating(y) - rating(x))
      .slice(0, 8)
      .sort((x, y) => rec.get(x)!.l - rec.get(y)!.l || rating(y) - rating(x))
    for (const id of seeds) tally.get(id)!.qualify++

    // Quarts : affiches connues, sinon tirage 1-8, 4-5, 2-7, 3-6.
    const seeded: [string, string][] = [[seeds[0], seeds[7]], [seeds[3], seeds[4]], [seeds[1], seeds[6]], [seeds[2], seeds[5]]]
    const knownTeams = (m?: RoundMatch) => (m && !isTbd(m.a) && !isTbd(m.b) ? ([m.a.id, m.b.id] as [string, string]) : undefined)
    const pick = (known: RoundMatch | undefined, pair: [string, string] | undefined, bo: number): string | undefined => {
      const kt = knownTeams(known)
      const p = kt ?? pair
      if (!p) return undefined
      if (known && kt && decided(known)) return known.winner === 1 ? kt[0] : kt[1]
      return simulate(p[0], p[1], known?.bestOf ?? bo)
    }
    const qw = [0, 1, 2, 3].map((i) => pick(qf[i], seeded[i], 5)!)
    for (const id of qw) if (id) tally.get(id)!.semis++
    const sw = [0, 1].map((i) => pick(sf[i], [qw[2 * i], qw[2 * i + 1]], 5)!)
    for (const id of sw) if (id) tally.get(id)!.final++
    const champ = pick(fin[0], [sw[0], sw[1]], 5)
    if (champ) tally.get(champ)!.title++
  }

  const rows = ids.map((id): EventRow => {
    const t = tally.get(id)!
    const r = now.get(id)!
    return { team: teams.get(id)!, wins: r.w, losses: r.l, qualify: t.qualify / sims, semis: t.semis / sims, final: t.final / sims, title: t.title / sims }
  })
  rows.sort((x, y) => y.title - x.title || y.final - x.final || y.qualify - x.qualify)
  return { kind: 'event', rows }
}
