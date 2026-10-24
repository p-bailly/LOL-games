// Modèles simples utilisés par l'interface, quelle que soit la source des données.

/** Avant la série, en cours, terminée. */
export type State = 'pre' | 'in' | 'post'

export interface Team {
  /** Nom Leaguepedia, qui sert d'identifiant partout (favoris, adresses). */
  id: string
  name: string
  /** Abréviation (G2, T1, KC…). */
  code: string
  logo?: string
  region?: string
}

export interface Side {
  team: Team
  score?: number
}

/** Une série (BO1, BO3, BO5) entre deux équipes. */
export interface Match {
  id: string
  /** Heure de début prévue, ISO UTC. */
  date: string
  state: State
  /** État déduit de l'heure (pas de flux en direct pour confirmer). */
  estimated?: boolean
  /** Clé de la ligue (lec, lck…, intl). */
  league: string
  leagueName: string
  tournament: string
  /** Page Leaguepedia du tournoi (OverviewPage). */
  page: string
  round: string
  bestOf: number
  a: Side
  b: Side
  /** 1 ou 2 : camp vainqueur de la série. */
  winner?: 1 | 2
  stream?: string
  live?: LiveInfo
}

/** Ce que le flux officiel LoL Esports ajoute à une série en cours. */
export interface LiveInfo {
  eventMatchId: string
  /** Numéro de la game en cours. */
  game: number
  games: { id: string; number: number; state: string }[]
}

// ---------- Games ----------

export interface PlayerLine {
  name: string
  link: string
  champion: string
  role: string
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damage: number
  vision: number
  items: string[]
  trinket: string
  spells: string[]
  keystone: string
  trees: string[]
  runes: string[]
  win: boolean
}

export interface PickBan {
  champion: string
  role?: string
  /** Rang dans la draft (1 à 20), quand l'ordre est connu. */
  order?: number
}

export interface GameTeam {
  team: Team
  side: 'blue' | 'red'
  win: boolean
  kills: number
  gold: number
  towers: number
  dragons: number
  barons: number
  heralds: number
  grubs: number
  inhibitors: number
  bans: PickBan[]
  /** Dans l'ordre de sélection quand on le connaît, sinon dans l'ordre des rôles. */
  picks: PickBan[]
  players: PlayerLine[]
}

export interface Game {
  id: string
  number: number
  date: string
  length: string
  minutes: number
  patch?: string
  vod?: string
  blue: GameTeam
  red: GameTeam
  /** Faux quand seules les listes (sans l'ordre de la draft) sont connues. */
  ordered: boolean
}

export interface MatchDetail {
  match: Match
  games: Game[]
  form?: { a: FormEntry[]; b: FormEntry[]; h2h: FormEntry[] }
}

export interface FormEntry {
  id: string
  date: string
  opponent: Team
  win: boolean
  score: string
  /** Pour le face-à-face : vainqueur. */
  winner?: Team
}

// ---------- Classements, effectifs, stats ----------

export interface StandingRow {
  team: Team
  place: number
  winSeries: number
  lossSeries: number
  winGames: number
  lossGames: number
  streak: string
}

export interface Tournament {
  page: string
  name: string
  league: string
  leagueName: string
  start: string
  end: string
  playoffs: boolean
}

export interface RosterPlayer {
  link: string
  id: string
  role: string
}

export interface ChampionStat {
  champion: string
  picks: number
  wins: number
  bans: number
}

export interface PlayerStat {
  link: string
  name: string
  team: string
  role: string
  games: number
  kills: number
  deaths: number
  assists: number
  cs: number
  damage: number
  wins: number
}
