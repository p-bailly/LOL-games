import { getApiKey } from '../lib/store'

// API non officielle de lolesports.com : séries en direct, détail des games en cours et statistiques « live »
// (or, kills, objectifs, joueurs). Elle demande une clé (en-tête x-api-key) que l'utilisateur colle dans l'appli ;
// sans clé, tout ce fichier reste inutilisé et l'appli fonctionne avec Leaguepedia seule.
// Le format n'est pas documenté : chaque lecture est donc défensive.

const API = 'https://esports-api.lolesports.com/persisted/gw'
const FEED = 'https://feed.lolesports.com/livestats/v1'

export class MissingKeyError extends Error {
  constructor() {
    super('Clé LoL Esports manquante.')
  }
}

async function get<T>(url: string, signal?: AbortSignal, withKey = true): Promise<T> {
  const key = getApiKey()
  if (withKey && !key) throw new MissingKeyError()
  const res = await fetch(url, { signal, headers: withKey ? { 'x-api-key': key } : undefined })
  if (res.status === 403 || res.status === 401) throw new Error('Clé LoL Esports refusée (périmée ?).')
  if (!res.ok) throw new Error(`LoL Esports : erreur ${res.status}`)
  return (await res.json()) as T
}

const gw = <T>(endpoint: string, params: Record<string, string>, signal?: AbortSignal) =>
  get<{ data: T }>(`${API}/${endpoint}?${new URLSearchParams({ hl: 'fr-FR', ...params })}`, signal).then((r) => r.data)

// ---------- Séries en direct ----------

export interface LiveTeamRef {
  id?: string
  name: string
  code: string
  image?: string
  wins: number
}

export interface LiveGameRef {
  id: string
  number: number
  state: string
  /** Équipes de la game avec leur camp. */
  teams: { id: string; side: 'blue' | 'red' }[]
}

export interface LiveEvent {
  matchId: string
  startTime: string
  leagueSlug: string
  leagueName: string
  bestOf: number
  teams: [LiveTeamRef, LiveTeamRef]
  games: LiveGameRef[]
}

interface RawTeam {
  id?: string
  name?: string
  code?: string
  image?: string
  result?: { gameWins?: number }
}
interface RawGame {
  id?: string
  number?: number
  state?: string
  teams?: { id?: string; side?: string }[]
}
interface RawEvent {
  startTime?: string
  league?: { name?: string; slug?: string }
  match?: { id?: string; teams?: RawTeam[]; strategy?: { count?: number }; games?: RawGame[] }
  games?: RawGame[]
}

const games = (raw?: RawGame[]): LiveGameRef[] =>
  (raw ?? []).map((g) => ({
    id: String(g.id ?? ''),
    number: g.number ?? 0,
    state: g.state ?? '',
    teams: (g.teams ?? []).map((t) => ({ id: String(t.id ?? ''), side: t.side === 'red' ? 'red' : 'blue' })),
  }))

function toEvent(e: RawEvent): LiveEvent | undefined {
  const m = e.match
  const t = m?.teams
  if (!m?.id || !t || t.length < 2) return undefined
  const ref = (x: RawTeam): LiveTeamRef => ({ id: x.id, name: x.name ?? '', code: x.code ?? '', image: x.image, wins: x.result?.gameWins ?? 0 })
  return {
    matchId: String(m.id),
    startTime: e.startTime ?? '',
    leagueSlug: e.league?.slug ?? '',
    leagueName: e.league?.name ?? '',
    bestOf: m.strategy?.count ?? 1,
    teams: [ref(t[0]), ref(t[1])],
    games: games(m.games ?? e.games),
  }
}

let liveAt = 0
let livePromise: Promise<LiveEvent[]> | undefined

/** Séries actuellement en direct (partagé 10 s entre les écrans). */
export function fetchLive(signal?: AbortSignal): Promise<LiveEvent[]> {
  if (livePromise && Date.now() - liveAt < 10_000) return livePromise
  liveAt = Date.now()
  livePromise = gw<{ schedule?: { events?: RawEvent[] } }>('getLive', {}, signal)
    .then((d) => (d.schedule?.events ?? []).map(toEvent).filter((e): e is LiveEvent => !!e))
    .catch((e) => {
      livePromise = undefined
      throw e
    })
  return livePromise
}

/** Détail d'une série : identifiants des équipes et des games. */
export async function fetchEvent(matchId: string, signal?: AbortSignal): Promise<LiveEvent | undefined> {
  const d = await gw<{ event?: RawEvent }>('getEventDetails', { id: matchId }, signal)
  return d.event ? toEvent({ ...d.event, match: d.event.match && { ...d.event.match, id: d.event.match.id ?? matchId } }) : undefined
}

// ---------- Statistiques d'une game en direct ----------

export interface LivePlayer {
  id: number
  name: string
  /** Identifiant Data Dragon du champion. */
  champion: string
  role: string
  level: number
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  hp: number
  maxHp: number
}

export interface LiveTeam {
  teamId: string
  gold: number
  kills: number
  towers: number
  inhibitors: number
  barons: number
  dragons: string[]
  players: LivePlayer[]
}

export interface LiveFrame {
  gameId: string
  patch?: string
  state: string
  at: string
  blue: LiveTeam
  red: LiveTeam
}

interface RawPlayerMeta {
  participantId: number
  summonerName?: string
  championId?: string
  role?: string
}
interface RawTeamMeta {
  esportsTeamId?: string
  participantMetadata?: RawPlayerMeta[]
}
interface RawFrameTeam {
  totalGold?: number
  totalKills?: number
  towers?: number
  inhibitors?: number
  barons?: number
  dragons?: string[]
  participants?: {
    participantId: number
    totalGold?: number
    level?: number
    kills?: number
    deaths?: number
    assists?: number
    creepScore?: number
    currentHealth?: number
    maxHealth?: number
  }[]
}
interface RawWindow {
  gameMetadata?: { patchVersion?: string; blueTeamMetadata?: RawTeamMeta; redTeamMetadata?: RawTeamMeta }
  frames?: { rfc460Timestamp?: string; gameState?: string; blueTeam?: RawFrameTeam; redTeam?: RawFrameTeam }[]
}

/** Horodatage demandé au flux : multiple de 10 s, un peu en arrière (le flux a de 30 à 60 s de retard). */
const startingTime = (lagSeconds: number) => new Date(Math.floor((Date.now() - lagSeconds * 1000) / 10_000) * 10_000).toISOString()

function side(raw: RawFrameTeam | undefined, meta: RawTeamMeta | undefined): LiveTeam {
  const info = new Map((meta?.participantMetadata ?? []).map((p) => [p.participantId, p]))
  return {
    teamId: meta?.esportsTeamId ?? '',
    gold: raw?.totalGold ?? 0,
    kills: raw?.totalKills ?? 0,
    towers: raw?.towers ?? 0,
    inhibitors: raw?.inhibitors ?? 0,
    barons: raw?.barons ?? 0,
    dragons: raw?.dragons ?? [],
    players: (raw?.participants ?? []).map((p) => {
      const m = info.get(p.participantId)
      // « G2 Caps » → « Caps » : le flux préfixe le nom par le tag de l'équipe.
      const name = (m?.summonerName ?? '').replace(/^\S+\s+/, '') || m?.summonerName || `Joueur ${p.participantId}`
      return {
        id: p.participantId,
        name,
        champion: m?.championId ?? '',
        role: m?.role ?? '',
        level: p.level ?? 1,
        kills: p.kills ?? 0,
        deaths: p.deaths ?? 0,
        assists: p.assists ?? 0,
        cs: p.creepScore ?? 0,
        gold: p.totalGold ?? 0,
        hp: p.currentHealth ?? 0,
        maxHp: p.maxHealth ?? 0,
      }
    }),
  }
}

/** Dernière image connue d'une game en cours. */
export async function fetchLiveFrame(gameId: string, signal?: AbortSignal): Promise<LiveFrame | undefined> {
  // Le flux refuse les horodatages trop récents : on recule jusqu'à obtenir des images.
  for (const lag of [45, 75, 120, 240]) {
    const url = `${FEED}/window/${gameId}?startingTime=${encodeURIComponent(startingTime(lag))}`
    let w: RawWindow
    try {
      // Le flux est public ; si jamais il réclamait la clé, on la lui donne au second essai.
      w = await get<RawWindow>(url, signal, false).catch((e: Error) => {
        if (/erreur 40[13]/.test(e.message) && getApiKey()) return get<RawWindow>(url, signal, true)
        throw e
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      continue
    }
    const last = w.frames?.[w.frames.length - 1]
    if (!last) continue
    return {
      gameId,
      patch: w.gameMetadata?.patchVersion,
      state: last.gameState ?? '',
      at: last.rfc460Timestamp ?? '',
      blue: side(last.blueTeam, w.gameMetadata?.blueTeamMetadata),
      red: side(last.redTeam, w.gameMetadata?.redTeamMetadata),
    }
  }
  return undefined
}
