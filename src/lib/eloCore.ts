// Classement Elo mondial : le calcul, sans rien d'autre (aucune dépendance), pour servir à la fois à l'appli
// (mise à jour avec les dernières séries) et au script scripts/build-elo.mjs (calcul sur tout l'historique).
// Ne mettre ici que de la syntaxe TypeScript effaçable : Node exécute ce fichier tel quel.

export interface SeriesIn {
  /** Début de la série, en millisecondes. */
  t: number
  a: string
  b: string
  /** Games gagnées par A et par B. */
  sa: number
  sb: number
  bo: number
  /** Ligue (nom Leaguepedia). */
  league: string
  /** Compétition internationale (Worlds, MSI…). */
  intl: boolean
  /** Phase à élimination (playoffs). */
  playoffs: boolean
}

export interface TeamState {
  /** Note Elo. */
  r: number
  /** Séries jouées. */
  n: number
  /** Dernière série, en jours depuis 1970. */
  last: number
  /** Ligue d'origine (la dernière ligue nationale jouée). */
  lg: string
  peak: number
  w: number
  l: number
}

export type EloState = Record<string, TeamState>

export interface Params {
  /** K d'une équipe sans historique (les notes bougent vite au début). */
  kMax: number
  /** K d'une équipe établie. */
  kMin: number
  /** Nombre de séries pour que K soit à mi-chemin entre kMax et kMin. */
  nHalf: number
  /** Poids d'une série de compétition internationale. */
  intl: number
  /** Poids d'une série de playoffs. */
  playoffs: number
  /** Bonus par game supplémentaire dans la série (une victoire 3-0 en BO5 pèse plus qu'un BO1). */
  boost: number
  /** Après `gap` jours d'inactivité, part de l'écart à la moyenne de la ligue effacée (changements d'effectif). */
  regress: number
  gap: number
  /** Une équipe qui apparaît démarre à la moyenne de sa ligue (sinon à 1500). */
  seed: boolean
}

/** Paramètres retenus après réglage sur l'historique (voir scripts/build-elo.mjs --tune). */
export const DEFAULTS: Params = { kMax: 96, kMin: 18, nHalf: 6, intl: 2, playoffs: 1.1, boost: 0.25, regress: 0.5, gap: 90, seed: true }

export const BASE = 1500
const DAY = 86_400_000

/** Chance de gagner une game d'après l'écart de notes. */
export const gameProb = (ra: number, rb: number) => 1 / (1 + 10 ** ((rb - ra) / 400))

const choose = (n: number, k: number) => {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/** Chance de gagner une série au meilleur des `bo` games, sachant la chance `p` de gagner une game. */
export function seriesProb(p: number, bo: number): number {
  const need = Math.floor(bo / 2) + 1
  let total = 0
  for (let k = 0; k < need; k++) total += choose(need - 1 + k, k) * p ** need * (1 - p) ** k
  return total
}

/** K d'une équipe : élevé tant qu'on la connaît mal, puis décroissant vers kMin. */
export const kOf = (n: number, p: Params) => p.kMin + (p.kMax - p.kMin) / (1 + n / p.nHalf)

/** Moyenne des notes des équipes actives d'une ligue (au moins 3 séries, jouées dans l'année). */
function leagueMean(state: EloState, league: string, day: number, except?: string): number {
  let sum = 0
  let c = 0
  for (const id in state) {
    const s = state[id]
    if (id === except || s.lg !== league || s.n < 3 || day - s.last > 400) continue
    sum += s.r
    c++
  }
  return c >= 3 ? sum / c : BASE
}

/**
 * Applique une série à l'état. Renvoie la chance qu'avait A de la gagner (pour mesurer la qualité des prévisions)
 * et les notes avant la série.
 */
export function applySeries(state: EloState, s: SeriesIn, p: Params): { pa: number; ra: number; rb: number } {
  const day = Math.floor(s.t / DAY)
  const touch = (id: string): TeamState => {
    let t = state[id]
    if (!t) {
      const start = p.seed && !s.intl ? leagueMean(state, s.league, day, id) : BASE
      t = state[id] = { r: start, n: 0, last: day, lg: s.league, peak: start, w: 0, l: 0 }
    } else if (day - t.last > p.gap) {
      // Longue absence : on rapproche l'équipe de la moyenne de sa ligue (effectifs renouvelés).
      const mean = leagueMean(state, t.lg, day, id)
      t.r += (mean - t.r) * p.regress
    }
    return t
  }
  const ta = touch(s.a)
  const tb = touch(s.b)
  const pa = gameProb(ta.r, tb.r)
  const games = s.sa + s.sb
  const share = games > 0 ? s.sa / games : 0.5
  const weight = (s.intl ? p.intl : s.playoffs ? p.playoffs : 1) * (1 + p.boost * Math.max(0, Math.min(games, 5) - 1))
  const ra = ta.r
  const rb = tb.r
  ta.r += kOf(ta.n, p) * weight * (share - pa)
  tb.r += kOf(tb.n, p) * weight * (1 - share - (1 - pa))
  for (const [t, won] of [[ta, s.sa > s.sb], [tb, s.sb > s.sa]] as const) {
    t.n++
    t.last = day
    if (won) t.w++
    else t.l++
    if (t.r > t.peak) t.peak = t.r
    if (!s.intl) t.lg = s.league
  }
  return { pa, ra, rb }
}

export interface Score {
  logloss: number
  accuracy: number
  n: number
  /** Mêmes mesures sur les seules compétitions internationales, où se joue la comparaison entre régions. */
  intlLogloss: number
  intlAccuracy: number
  intlN: number
}

/** Qualité des prévisions de vainqueur de série (perte logarithmique : plus bas = mieux), à partir de `from`. */
export function evaluate(series: SeriesIn[], p: Params, from = 0): Score {
  const state: EloState = {}
  const acc = { all: { loss: 0, hit: 0, n: 0 }, intl: { loss: 0, hit: 0, n: 0 } }
  for (const s of series) {
    const { pa } = applySeries(state, s, p)
    if (s.t < from || s.sa === s.sb) continue
    const ps = Math.min(0.995, Math.max(0.005, seriesProb(pa, s.bo)))
    const aWon = s.sa > s.sb
    const loss = -Math.log(aWon ? ps : 1 - ps)
    const hit = aWon === ps > 0.5 ? 1 : 0
    for (const k of s.intl ? (['all', 'intl'] as const) : (['all'] as const)) {
      acc[k].loss += loss
      acc[k].hit += hit
      acc[k].n++
    }
  }
  const { all, intl } = acc
  return { logloss: all.loss / all.n, accuracy: all.hit / all.n, n: all.n, intlLogloss: intl.loss / (intl.n || 1), intlAccuracy: intl.hit / (intl.n || 1), intlN: intl.n }
}
