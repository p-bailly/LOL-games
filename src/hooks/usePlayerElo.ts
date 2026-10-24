import { useEffect, useState } from 'react'
import { fetchPlayerElo, type PlayerElo } from '../api/eloPlayers'

// Le classement Elo des joueurs est chargé une seule fois pour tout l'écran, puis partagé.
let data: PlayerElo | undefined
let loading = false
const listeners = new Set<() => void>()

function load() {
  if (loading) return
  loading = true
  fetchPlayerElo()
    .then((d) => {
      data = d
      listeners.forEach((l) => l())
    })
    .catch(() => {
      /* pas d'Elo : les variations ne s'affichent pas */
    })
    .finally(() => {
      loading = false
    })
}

/** Le classement Elo des joueurs, ou rien tant qu'il n'est pas chargé (ou s'il est indisponible). */
export function usePlayerElo(): PlayerElo | undefined {
  const [, set] = useState(0)
  useEffect(() => {
    const l = () => set((n) => n + 1)
    listeners.add(l)
    if (!data) load()
    return () => void listeners.delete(l)
  }, [])
  return data
}
