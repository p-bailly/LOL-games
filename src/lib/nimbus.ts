import { Capacitor, registerPlugin } from '@capacitor/core'
import { onTeamsResolved, teamOf } from '../api/leaguepedia'
import { createStore, getFavoriteIds, subscribeFavorites } from './store'

// Partage des équipes favorites avec Nimbus, le launcher de l'utilisateur (appli Android seulement).
// Le plugin natif NimbusBridge les recopie dans des SharedPreferences que NimbusProvider sert à Nimbus
// (content://com.pbailly.riftlive.nimbus/favorites). Envoi au démarrage puis à chaque changement.
// L'identifiant d'une équipe est son nom Leaguepedia ("G2 Esports") ; abréviation et nom sont joints quand
// l'appli les connaît déjà, sinon (ou si elle ne les a jamais vus) seul l'identifiant part.

export interface NimbusTeam {
  id: string
  abbr?: string
  name?: string
}

interface NimbusBridgePlugin {
  setFavorites(options: { teams: NimbusTeam[] }): Promise<void>
}

const NimbusBridge = registerPlugin<NimbusBridgePlugin>('NimbusBridge')

// Dernière liste remise au plugin, pour retrouver les noms dès le démarrage suivant.
const lastSent = createStore<{ teams: NimbusTeam[] }>('rift:nimbus', { teams: [] })

function currentTeams(): NimbusTeam[] {
  return getFavoriteIds().map((id) => {
    const t = teamOf(id)
    return { id, abbr: t.code, name: t.name }
  })
}

let sentJson = '' // ce qui a été remis au plugin pendant cette session
let timer: number | undefined

async function send() {
  timer = undefined
  const teams = currentTeams()
  const json = JSON.stringify(teams)
  if (json === sentJson) return
  sentJson = json
  try {
    await NimbusBridge.setFavorites({ teams })
    lastSent.set({ teams })
  } catch {
    sentJson = '' // on réessaiera au prochain changement
  }
}

function schedule() {
  if (timer === undefined) timer = window.setTimeout(() => void send(), 0)
}

export function startNimbusSync() {
  if (!Capacitor.isNativePlatform()) return
  void send()
  subscribeFavorites(schedule)
  onTeamsResolved(schedule)
}
