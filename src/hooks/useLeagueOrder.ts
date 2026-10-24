import { orderLeagues } from '../api/leagues'
import { fetchTournaments } from '../api/stats'
import type { Tournament } from '../api/types'
import { today } from '../lib/format'
import { usePolling } from './usePolling'

/** Clés des ligues qui ont un tournoi en cours aujourd'hui. */
export function runningLeagues(tournaments: Tournament[] | undefined): Set<string> {
  const t = today()
  return new Set((tournaments ?? []).filter((x) => x.start <= t && (!x.end || x.end >= t)).map((x) => x.league))
}

/** Ligues dans l'ordre d'affichage : l'international en premier s'il y en a un en cours. */
export function useLeagueOrder(active = true) {
  const { data } = usePolling(() => fetchTournaments(), [], 30 * 60_000, active)
  const running = runningLeagues(data)
  return { leagues: orderLeagues(running), intlOn: running.has('intl') }
}
