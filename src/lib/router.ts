import { useSyncExternalStore } from 'react'

// Routage par hash (#/match/…) : marche sur n'importe quel hébergement statique.
// Les identifiants (noms d'équipes, séries Leaguepedia) contiennent des espaces et des « / » : ils sont encodés.

export type Route =
  | { name: 'matches' }
  | { name: 'standings' }
  | { name: 'stats' }
  | { name: 'teams' }
  | { name: 'match'; id: string }
  | { name: 'team'; id: string }
  | { name: 'player'; id: string }

export const TABS = ['matches', 'standings', 'stats', 'teams'] as const
export type TabName = (typeof TABS)[number]

function parse(hash: string): Route {
  const [name, id] = hash.replace(/^#\/?/, '').split('/')
  if ((name === 'match' || name === 'team' || name === 'player') && id) {
    try {
      return { name, id: decodeURIComponent(id) }
    } catch {
      return { name: 'matches' }
    }
  }
  if ((TABS as readonly string[]).includes(name)) return { name: name as TabName }
  return { name: 'matches' }
}

let current = parse(location.hash)
const listeners = new Set<() => void>()
// Pile des pages visitées dans l'app, pour savoir si "retour" doit sortir de l'app.
const stack = [location.hash]
window.addEventListener('hashchange', () => {
  if (stack.length > 1 && stack[stack.length - 2] === location.hash) stack.pop()
  else stack.push(location.hash)
  current = parse(location.hash)
  listeners.forEach((l) => l())
})

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

export const href = {
  match: (id: string) => `#/match/${encodeURIComponent(id)}`,
  team: (id: string) => `#/team/${encodeURIComponent(id)}`,
  player: (id: string) => `#/player/${encodeURIComponent(id)}`,
  tab: (t: TabName) => (t === 'matches' ? '#/' : `#/${t}`),
}

/** Retour arrière : historique si on vient de l'app, sinon l'accueil. */
export function goBack() {
  if (stack.length > 1) history.back()
  else location.replace('#/')
}
