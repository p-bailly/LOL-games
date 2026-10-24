// Elo des joueurs : chaque game oppose deux équipes de cinq joueurs. La force d'une équipe est la moyenne des notes de
// ses joueurs ; après la game, chaque joueur gagne ou perd selon l'écart entre le résultat et ce qui était attendu,
// avec un K qui dépend de son propre nombre de games. Les joueurs se distinguent donc par leur parcours : un nouveau
// venu bouge vite, un joueur établi peu, et les changements d'équipe séparent les coéquipiers.
// Même contrainte que eloCore.ts : syntaxe TypeScript effaçable seulement (Node exécute ce fichier tel quel).

export interface GameIn {
  /** Début de la game, en millisecondes. */
  t: number
  /** Les cinq joueurs de chaque équipe (identifiants Leaguepedia), dans l'ordre top, jungle, mid, bot, support. */
  a: string[]
  b: string[]
  /** Équipes et ligue (pour l'affichage et la moyenne de ligue). */
  ta: string
  tb: string
  aWon: boolean
  league: string
  intl: boolean
  playoffs: boolean
}

export interface PlayerState {
  r: number
  n: number
  /** Dernière game, en jours depuis 1970. */
  last: number
  lg: string
  team: string
  /** Rôle le plus récent : 0 top, 1 jungle, 2 mid, 3 bot, 4 support. */
  role: number
  peak: number
  w: number
  l: number
}

export type PlayerEloState = Record<string, PlayerState>

export interface PlayerParams {
  kMax: number
  kMin: number
  nHalf: number
  intl: number
  playoffs: number
  regress: number
  gap: number
}

export const PLAYER_DEFAULTS: PlayerParams = { kMax: 96, kMin: 14, nHalf: 20, intl: 1, playoffs: 1, regress: 0.5, gap: 90 }

export const BASE = 1500
const DAY = 86_400_000

export const gameProb = (ra: number, rb: number) => 1 / (1 + 10 ** ((rb - ra) / 400))
export const kOf = (n: number, p: PlayerParams) => p.kMin + (p.kMax - p.kMin) / (1 + n / p.nHalf)

function leagueMean(state: PlayerEloState, league: string, day: number): number {
  let sum = 0
  let c = 0
  for (const id in state) {
    const s = state[id]
    if (s.lg !== league || s.n < 10 || day - s.last > 400) continue
    sum += s.r
    c++
  }
  return c >= 10 ? sum / c : BASE
}

/** Applique une game à l'état ; renvoie la chance qu'avait l'équipe A de la gagner. */
export function applyGame(state: PlayerEloState, g: GameIn, p: PlayerParams): number {
  const day = Math.floor(g.t / DAY)
  const ids = [g.a, g.b]
  // Joueurs nouveaux : ils démarrent à la moyenne de leurs coéquipiers déjà connus, sinon à celle de la ligue.
  for (const team of ids) {
    const known = team.filter((id) => state[id])
    const start = known.length ? known.reduce((acc, id) => acc + state[id].r, 0) / known.length : g.intl ? BASE : leagueMean(state, g.league, day)
    team.forEach((id, i) => {
      const s = state[id]
      if (!s) state[id] = { r: start, n: 0, last: day, lg: g.league, team: team === g.a ? g.ta : g.tb, role: i, peak: start, w: 0, l: 0 }
      else if (day - s.last > p.gap) s.r += (leagueMean(state, s.lg, day) - s.r) * p.regress
    })
  }
  const mean = (team: string[]) => team.reduce((acc, id) => acc + state[id].r, 0) / team.length
  const pa = gameProb(mean(g.a), mean(g.b))
  const weight = g.intl ? p.intl : g.playoffs ? p.playoffs : 1
  const sa = g.aWon ? 1 : 0
  ids.forEach((team, side) => {
    const delta = side === 0 ? sa - pa : 1 - sa - (1 - pa)
    team.forEach((id, i) => {
      const s = state[id]
      s.r += kOf(s.n, p) * weight * delta
      s.n++
      s.last = day
      s.role = i
      s.team = side === 0 ? g.ta : g.tb
      if (!g.intl) s.lg = g.league
      if (s.r > s.peak) s.peak = s.r
      if ((side === 0) === g.aWon) s.w++
      else s.l++
    })
  })
  return pa
}

export interface PlayerScore {
  logloss: number
  accuracy: number
  n: number
  intlLogloss: number
  intlAccuracy: number
  intlN: number
}

/** Qualité des prévisions de vainqueur de game, à partir de `from`. */
export function evaluate(games: GameIn[], p: PlayerParams, from = 0): PlayerScore {
  const state: PlayerEloState = {}
  const acc = { all: { loss: 0, hit: 0, n: 0 }, intl: { loss: 0, hit: 0, n: 0 } }
  for (const g of games) {
    const pa = applyGame(state, g, p)
    if (g.t < from) continue
    const ps = Math.min(0.995, Math.max(0.005, pa))
    const loss = -Math.log(g.aWon ? ps : 1 - ps)
    const hit = g.aWon === ps > 0.5 ? 1 : 0
    for (const k of g.intl ? (['all', 'intl'] as const) : (['all'] as const)) {
      acc[k].loss += loss
      acc[k].hit += hit
      acc[k].n++
    }
  }
  const { all, intl } = acc
  return { logloss: all.loss / all.n, accuracy: all.hit / all.n, n: all.n, intlLogloss: intl.loss / (intl.n || 1), intlAccuracy: intl.hit / (intl.n || 1), intlN: intl.n }
}
