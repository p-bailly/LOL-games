import { Capacitor } from '@capacitor/core'
import { liveSettings } from '../lib/store'

// API non officielle de lolesports.com : séries en direct et statistiques « live » de la game en cours (or, kills,
// objectifs, joueurs). Deux sources, sans aucune clé :
//  - la liste des séries en direct vient de l'API GraphQL du site (lolesports.com/api/gql), la même que celle de ses
//    pages. Elle n'envoie pas d'en-têtes CORS : seul l'appli Android, qui passe par le HTTP natif de Capacitor, peut
//    l'appeler (dans un navigateur, tout ce fichier reste inutilisé et l'appli fonctionne avec Leaguepedia seule) ;
//  - les statistiques d'une game viennent du flux public feed.lolesports.com, ouvert à tous les navigateurs.
// Rien n'est documenté : chaque lecture est donc défensive, et toute erreur ramène à Leaguepedia.

const GQL = 'https://lolesports.com/api/gql'
const FEED = 'https://feed.lolesports.com/livestats/v1'

// La requête « homeEvents » du site est « persistée » : le serveur la connaît par son empreinte, liée à la version du
// site. Si le direct cesse de marcher (« requête périmée »), relever ces trois valeurs sur lolesports.com : F12 →
// Réseau → filtrer « api/gql » → une requête homeEvents ; l'empreinte est `sha256Hash` dans le paramètre `extensions`,
// la version est l'en-tête `apollographql-client-version`.
const GQL_CLIENT = { name: 'Esports Web', version: '50f31bf' }
const HOME_EVENTS_HASH = 'e4da9fd0ab89ecdb783912d74799688d1f52f1edc9b87497d3409c74d9b4291a'

/** Le direct LoL Esports ne peut être demandé que depuis l'appli Android (voir plus haut). */
export const liveSupported = Capacitor.isNativePlatform()

/** Direct actif : appli Android, et réglage « Direct LoL Esports » non coupé. */
export const liveActive = () => liveSupported && liveSettings.get().enabled

export class LiveUnavailableError extends Error {
  constructor() {
    super('Le direct LoL Esports n’est disponible que dans l’appli Android.')
  }
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`LoL Esports : erreur ${res.status}`)
  return (await res.json()) as T
}

/** Appelle une requête persistée de l'API GraphQL du site. */
async function gql<T>(operationName: string, hash: string, variables: object, signal?: AbortSignal): Promise<T> {
  if (!liveSupported) throw new LiveUnavailableError()
  const params = new URLSearchParams({
    operationName,
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      clientLibrary: { name: '@apollo/client', version: '4.1.9' },
      persistedQuery: { version: 1, sha256Hash: hash },
    }),
  })
  const res = await fetch(`${GQL}?${params}`, {
    signal,
    headers: {
      accept: 'application/graphql-response+json,application/json;q=0.9',
      'content-type': 'application/json',
      'apollographql-client-name': GQL_CLIENT.name,
      'apollographql-client-version': GQL_CLIENT.version,
    },
  })
  // Les erreurs GraphQL arrivent avec un statut 200 ou 4xx et un corps JSON : on le lit d'abord.
  const body = (await res.json().catch(() => undefined)) as { data?: T; errors?: { message?: string; extensions?: { code?: string } }[] } | undefined
  const err = body?.errors?.[0]
  if (err) {
    throw new Error(
      err.extensions?.code === 'PERSISTED_QUERY_NOT_FOUND' || /PersistedQueryNotFound/i.test(err.message ?? '')
        ? 'LoL Esports : requête périmée (le site a changé, voir lolesports.ts).'
        : `LoL Esports : ${err.message ?? 'erreur'}`,
    )
  }
  if (!res.ok || !body?.data) throw new Error(`LoL Esports : erreur ${res.status}`)
  return body.data
}

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
  /** Identifiant d'équipe LoL Esports : le même que `esportsTeamId` dans le flux de statistiques. */
  teamId?: string
  name?: string
  code?: string
  image?: string
  result?: { gameWins?: number }
}
interface RawGame {
  id?: string
  number?: number
  state?: string
}
interface RawEvent {
  startTime?: string
  league?: { name?: string; slug?: string }
  match?: { id?: string; strategy?: { count?: number }; games?: RawGame[] }
  matchTeams?: RawTeam[]
}

// Le camp (bleu / rouge) de chaque équipe n'est pas dans cette liste : fetchLiveGame le lit dans le flux de statistiques.
const games = (raw?: RawGame[]): LiveGameRef[] =>
  (raw ?? []).map((g) => ({ id: String(g.id ?? ''), number: g.number ?? 0, state: g.state ?? '', teams: [] }))

function toEvent(e: RawEvent): LiveEvent | undefined {
  const m = e.match
  const t = e.matchTeams
  if (!m?.id || !t || t.length < 2) return undefined
  const ref = (x: RawTeam): LiveTeamRef => ({ id: x.teamId, name: x.name ?? '', code: x.code ?? '', image: x.image, wins: x.result?.gameWins ?? 0 })
  return {
    matchId: String(m.id),
    startTime: e.startTime ?? '',
    leagueSlug: e.league?.slug ?? '',
    leagueName: e.league?.name ?? '',
    bestOf: m.strategy?.count ?? 1,
    teams: [ref(t[0]), ref(t[1])],
    games: games(m.games),
  }
}

let liveAt = 0
let livePromise: Promise<LiveEvent[]> | undefined

/** Séries actuellement en direct (partagé 10 s entre les écrans). */
export function fetchLive(signal?: AbortSignal): Promise<LiveEvent[]> {
  if (livePromise && Date.now() - liveAt < 10_000) return livePromise
  liveAt = Date.now()
  livePromise = gql<{ esports?: { events?: RawEvent[] } }>(
    'homeEvents',
    HOME_EVENTS_HASH,
    { hl: 'fr-FR', sport: 'lol', eventState: ['inProgress'], eventType: 'all', vodType: ['recap'], pageSize: 300 },
    signal,
  )
    .then((d) => (d.esports?.events ?? []).map(toEvent).filter((e): e is LiveEvent => !!e))
    .catch((e) => {
      livePromise = undefined
      throw e
    })
  return livePromise
}

/** Une série en direct d'après son identifiant : identifiants des équipes et des games, états à jour. */
export async function fetchEvent(matchId: string, signal?: AbortSignal): Promise<LiveEvent | undefined> {
  return (await fetchLive(signal)).find((e) => e.matchId === matchId)
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
      w = await get<RawWindow>(url, signal)
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
