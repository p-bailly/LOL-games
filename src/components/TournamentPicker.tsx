import { useState, useSyncExternalStore } from 'react'
import { orderLeagues } from '../api/leagues'
import { defaultTournament, fetchTournaments } from '../api/stats'
import type { Tournament } from '../api/types'
import { runningLeagues } from '../hooks/useLeagueOrder'
import { usePolling } from '../hooks/usePolling'
import { createStore } from '../lib/store'
import { Chips } from './ui'

// Ligue choisie dans les onglets Classement et Stats : gardée d'une ouverture à l'autre.
// Vide : choix automatique (la compétition internationale si elle est en cours, sinon la LEC).
const picked = createStore<{ league: string }>('rift:picker', { league: '' })

/** Choix de la ligue puis du tournoi (en cours par défaut). */
export function useTournamentPicker(active: boolean) {
  const choice = useSyncExternalStore(picked.subscribe, picked.get).league
  const [pages, setPages] = useState<Record<string, string>>({})
  const { data, error, refresh } = usePolling(() => fetchTournaments(), [], 30 * 60_000, active)
  const leagues = orderLeagues(runningLeagues(data))
  const league = choice || leagues[0].key

  const mine = (data ?? []).filter((t) => t.league === league)
  const tournament: Tournament | undefined = mine.find((t) => t.page === pages[league]) ?? (data && defaultTournament(data, league))
  return {
    league,
    leagues,
    setLeague: (l: string) => picked.set({ league: l }),
    tournaments: mine,
    tournament,
    setPage: (page: string) => setPages((p) => ({ ...p, [league]: page })),
    loaded: !!data,
    error,
    refresh,
  }
}

export function TournamentPicker({ picker }: { picker: ReturnType<typeof useTournamentPicker> }) {
  const { league, leagues, setLeague, tournaments, tournament, setPage } = picker
  return (
    <>
      <Chips value={league} onChange={setLeague} options={leagues.map((l) => ({ value: l.key, label: l.label }))} />
      {tournaments.length > 1 && tournament && (
        <div className="picker-row">
          <select className="select" value={tournament.page} onChange={(e) => setPage(e.target.value)} aria-label="Tournoi">
            {tournaments.map((t) => (
              <option key={t.page} value={t.page}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  )
}
