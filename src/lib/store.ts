import { useSyncExternalStore } from 'react'

// Petits stores persistés dans le navigateur (favoris, réglages d'alertes et clé LoL Esports).
// Tout reste sur l'appareil : l'app est pour un usage perso.

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function createStore<T extends object>(key: string, initial: T) {
  let value = load(key, initial)
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* stockage indisponible (navigation privée) : on garde en mémoire */
      }
      listeners.forEach((l) => l())
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

// ---------- Favoris ----------
// Une équipe favorite est identifiée par son nom Leaguepedia ("G2 Esports").

const favorites = createStore<{ ids: string[] }>('rift:favorites', { ids: [] })

export function useFavorites() {
  const { ids } = useSyncExternalStore(favorites.subscribe, favorites.get)
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) =>
      favorites.set({ ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] }),
  }
}

export const getFavoriteIds = () => favorites.get().ids
export const subscribeFavorites = favorites.subscribe

// ---------- Alertes ----------

export interface AlertSettings {
  enabled: boolean
  favoritesOnly: boolean
  start: boolean
  gameEnd: boolean
  decider: boolean
  final: boolean
}

const alerts = createStore<AlertSettings>('rift:alerts', {
  enabled: false,
  favoritesOnly: true,
  start: true,
  gameEnd: true,
  decider: true,
  final: true,
})

export function useAlertSettings() {
  const settings = useSyncExternalStore(alerts.subscribe, alerts.get)
  return { settings, update: (patch: Partial<AlertSettings>) => alerts.set({ ...settings, ...patch }) }
}

// ---------- Direct (API LoL Esports) ----------

export interface LiveSettings {
  /** Clé de l'API LoL Esports, collée par l'utilisateur. Vide : pas de direct, Leaguepedia seule. */
  apiKey: string
}

export const liveSettings = createStore<LiveSettings>('rift:live', { apiKey: '' })

export function useLiveSettings() {
  const settings = useSyncExternalStore(liveSettings.subscribe, liveSettings.get)
  return { settings, update: (patch: Partial<LiveSettings>) => liveSettings.set({ ...settings, ...patch }) }
}

export const getApiKey = () => liveSettings.get().apiKey.trim()
