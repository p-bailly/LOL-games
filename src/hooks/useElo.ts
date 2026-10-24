import { useEffect, useState } from 'react'
import { fetchElo, type Elo } from '../api/elo'

// Le classement Elo est chargé une seule fois pour tout l'écran, puis partagé par les cartes de série.
let data: Elo | undefined
let loading = false
const listeners = new Set<() => void>()

function load() {
  if (loading) return
  loading = true
  fetchElo()
    .then((d) => {
      data = d
      listeners.forEach((l) => l())
    })
    .catch(() => {
      /* pas d'Elo : les cartes s'affichent sans les chances */
    })
    .finally(() => {
      loading = false
    })
}

/** Le classement Elo, ou rien tant qu'il n'est pas chargé (ou s'il est indisponible). */
export function useElo(): Elo | undefined {
  const [, set] = useState(0)
  useEffect(() => {
    const l = () => set((n) => n + 1)
    listeners.add(l)
    if (!data) load()
    return () => void listeners.delete(l)
  }, [])
  return data
}
