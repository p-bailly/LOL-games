import { useMemo, useState, useSyncExternalStore } from 'react'
import { fetchCalendar, fetchMatches } from '../api/leaguepedia'
import { LEAGUES } from '../api/leagues'
import { applyLive } from '../api/live'
import type { Match } from '../api/types'
import { DateStrip } from '../components/DateStrip'
import { MatchCard } from '../components/MatchCard'
import { Chips, Empty, ErrorBox, Loading, PageHeader, Segmented, UpdatedAt } from '../components/ui'
import { liveInterval, usePolling } from '../hooks/usePolling'
import { dayToDate, longDay, toDay, today } from '../lib/format'
import { createStore, useFavorites } from '../lib/store'

type Filter = 'all' | 'live' | 'fav'

// Ligue choisie : gardée d'une ouverture à l'autre.
const ui = createStore<{ league: string }>('rift:matches', { league: 'all' })

/** Jour affiché d'office : aujourd'hui, sinon le prochain jour de matchs, sinon le dernier. */
function defaultDay(days: string[]): string {
  const t = today()
  if (!days.length || days.includes(t)) return t
  return days.find((d) => d > t) ?? days[days.length - 1]
}

export function MatchesPage({ active }: { active: boolean }) {
  const [day, setDay] = useState<string>()
  const [filter, setFilter] = useState<Filter>('all')
  const { league } = useSyncExternalStore(ui.subscribe, ui.get)
  const { ids: favs } = useFavorites()
  const leagues = league === 'all' ? undefined : [league]

  // Jours avec des séries, de -45 à +60 jours.
  const calendar = usePolling(
    async () => {
      const from = new Date(Date.now() - 45 * 86_400_000)
      const to = new Date(Date.now() + 60 * 86_400_000)
      return [...new Set((await fetchCalendar(from, to, leagues)).map(toDay))]
    },
    [league],
    30 * 60_000,
    active,
  )
  const days = calendar.data ?? []
  const selected = day ?? defaultDay(days)

  const { data, error, loading, updatedAt, refresh } = usePolling(
    async (signal) => {
      const from = dayToDate(selected)
      const to = new Date(from)
      to.setDate(to.getDate() + 1)
      return applyLive(await fetchMatches(from, to, leagues, signal), signal)
    },
    [selected, league],
    (m) => liveInterval(m),
    active,
  )

  const matches = data ?? []
  const isFav = (m: Match) => favs.includes(m.a.team.id) || favs.includes(m.b.team.id)
  const liveCount = matches.filter((m) => m.state === 'in').length

  const shown = matches.filter((m) => (filter === 'live' ? m.state === 'in' : filter === 'fav' ? isFav(m) : true))
  const favMatches = filter === 'all' ? shown.filter(isFav) : []
  const rest = shown.filter((m) => !favMatches.includes(m))
  const byTime = (a: Match, b: Match) => a.date.localeCompare(b.date)
  const sections: [string, Match[]][] = useMemo(
    () => [
      ['Mes équipes', favMatches.sort(byTime)],
      ['En direct', rest.filter((m) => m.state === 'in').sort(byTime)],
      ['À venir', rest.filter((m) => m.state === 'pre').sort(byTime)],
      ['Terminés', rest.filter((m) => m.state === 'post').sort(byTime)],
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, filter, favs],
  )
  const estimated = matches.some((m) => m.state === 'in' && m.estimated)

  return (
    <>
      <PageHeader
        title="Matchs LoL"
        subtitle={longDay(selected)}
        right={
          <button className="icon-btn" onClick={refresh} aria-label="Actualiser">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={loading ? 'spin' : ''}>
              <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        }
      />
      <DateStrip calendar={days} selected={selected} onSelect={setDay} />
      <Chips
        value={league}
        onChange={(l) => ui.set({ league: l })}
        options={[{ value: 'all', label: 'Toutes' }, ...LEAGUES.map((l) => ({ value: l.key, label: l.label }))]}
      />

      <div className="toolbar">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `Tous${matches.length ? ` (${matches.length})` : ''}` },
            { value: 'live', label: `En direct${liveCount ? ` (${liveCount})` : ''}` },
            { value: 'fav', label: 'Mes équipes' },
          ]}
        />
        <UpdatedAt at={updatedAt} loading={loading} />
      </div>

      <div className="content">
        {error && !data && <ErrorBox error={error} onRetry={refresh} />}
        {!data && !error && <Loading />}
        {data && matches.length === 0 && <Empty>Aucun match ce jour-là.</Empty>}
        {data && matches.length > 0 && shown.length === 0 && (
          <Empty>
            {filter === 'live'
              ? 'Aucun match en cours pour le moment.'
              : favs.length
                ? 'Pas de match de vos équipes ce jour-là.'
                : 'Ajoutez vos équipes favorites dans l’onglet « Équipes ».'}
          </Empty>
        )}
        {sections.map(
          ([title, list]) =>
            list.length > 0 && (
              <section key={title} className="games-section">
                <h2 className="section-title">{title}</h2>
                <div className="games-grid">
                  {list.map((m) => (
                    <MatchCard key={m.id} match={m} favorites={favs} />
                  ))}
                </div>
              </section>
            ),
        )}
        {data && matches.length > 0 && (
          <p className="footnote">
            Heures affichées dans votre fuseau horaire.
            {estimated && ' « En cours (estimé) » : déduit de l’heure de début, sans flux en direct. Ajoutez une clé LoL Esports (onglet Équipes) pour le direct exact.'}
          </p>
        )}
      </div>
    </>
  )
}
