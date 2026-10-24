import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { fetchCalendar, fetchMatches } from '../api/leaguepedia'
import { applyLive } from '../api/live'
import type { Match } from '../api/types'
import { DateStrip } from '../components/DateStrip'
import { MatchCard } from '../components/MatchCard'
import { Chips, Empty, ErrorBox, Loading, PageHeader, Segmented, UpdatedAt } from '../components/ui'
import { useLeagueOrder } from '../hooks/useLeagueOrder'
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

/** Séries d'un jour (heure locale), actualisées plus souvent quand une série est en direct. */
function useDay(day: string, leagues: string[] | undefined, active: boolean) {
  return usePolling(
    async (signal) => {
      const from = dayToDate(day)
      const to = new Date(from)
      to.setDate(to.getDate() + 1)
      return applyLive(await fetchMatches(from, to, leagues, signal), signal)
    },
    [day, leagues?.join(',') ?? ''],
    (m) => liveInterval(m),
    active,
  )
}

/**
 * Séries d'un jour rangées en sections, dans l'ordre de la journée : terminées (en haut, en remontant), en direct,
 * à venir. Les équipes favorites ne passent pas devant.
 */
function sectionsOf(matches: Match[], filter: Filter, favs: string[], intlOn: boolean): [string, Match[]][] {
  const isFav = (m: Match) => favs.includes(m.a.team.id) || favs.includes(m.b.team.id)
  const shown = matches.filter((m) => (filter === 'live' ? m.state === 'in' : filter === 'fav' ? isFav(m) : true))
  const byTime = (a: Match, b: Match) => a.date.localeCompare(b.date)
  // L'international d'abord quand il est en cours, pour les séries en direct seulement.
  const byLive = (a: Match, b: Match) => Number(intlOn && b.league === 'intl') - Number(intlOn && a.league === 'intl') || byTime(a, b)
  return [
    ['Terminés', shown.filter((m) => m.state === 'post').sort(byTime)],
    ['En direct', shown.filter((m) => m.state === 'in').sort(byLive)],
    ['À venir', shown.filter((m) => m.state === 'pre').sort(byTime)],
  ]
}

/** `anchor` : la première section qui n'est pas terminée est repérée pour que la liste s'ouvre dessus. */
function Sections({ sections, favs, anchor }: { sections: [string, Match[]][]; favs: string[]; anchor?: boolean }) {
  const first = sections.find(([t, l]) => t !== 'Terminés' && l.length)?.[0]
  return (
    <>
      {sections.map(
        ([title, list]) =>
          list.length > 0 && (
            <section key={title} className="games-section" data-anchor={anchor && title === first ? '' : undefined}>
              <h2 className="section-title">{title}</h2>
              <div className="games-grid">
                {list.map((m) => (
                  <MatchCard key={m.id} match={m} favorites={favs} />
                ))}
              </div>
            </section>
          ),
      )}
    </>
  )
}

/** Un jour suivant, affiché sous le précédent quand on descend. */
function NextDay({
  day,
  leagues,
  filter,
  favs,
  intlOn,
  active,
  onLoaded,
}: {
  day: string
  leagues: string[] | undefined
  filter: Filter
  favs: string[]
  intlOn: boolean
  active: boolean
  onLoaded: (day: string) => void
}) {
  const { data, error, refresh } = useDay(day, leagues, active)
  useEffect(() => {
    if (data || error) onLoaded(day)
  }, [data, error, day, onLoaded])
  const sections = useMemo(() => sectionsOf(data ?? [], filter, favs, intlOn), [data, filter, favs, intlOn])
  const any = sections.some(([, l]) => l.length)
  return (
    <div className="next-day">
      <h2 className="day-title">{longDay(day)}</h2>
      {!data && !error && <Loading />}
      {error && !data && <ErrorBox error={error} onRetry={refresh} />}
      {data && !any && <Empty>{data.length ? 'Pas de match de vos équipes ce jour-là.' : 'Aucun match ce jour-là.'}</Empty>}
      <Sections sections={sections} favs={favs} />
    </div>
  )
}

export function MatchesPage({ active }: { active: boolean }) {
  const [day, setDay] = useState<string>()
  const [filter, setFilter] = useState<Filter>('all')
  const { league } = useSyncExternalStore(ui.subscribe, ui.get)
  const { ids: favs } = useFavorites()
  const order = useLeagueOrder(active)
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

  const { data, error, loading, updatedAt, refresh } = useDay(selected, leagues, active)

  const matches = data ?? []
  const liveCount = matches.filter((m) => m.state === 'in').length
  const sections = useMemo(
    () => sectionsOf(data ?? [], filter, favs, order.intlOn),
    [data, filter, favs, order.intlOn],
  )
  const anyShown = sections.some(([, l]) => l.length)

  // À l'ouverture d'un jour, la liste se place sur les séries en direct ou à venir : les terminées sont au-dessus.
  const top = useRef<HTMLDivElement>(null)
  const placed = useRef('')
  const stop = useRef<(() => void) | undefined>(undefined)
  useEffect(() => {
    const key = `${selected}|${league}|${filter}`
    const box = top.current
    if (!data || !box || placed.current === key) return
    placed.current = key
    const go = () => box.querySelector('[data-anchor]')?.scrollIntoView({ block: 'start' })
    go()
    // Les cartes grandissent en se complétant (Elo, logos) : on se replace jusqu'au premier geste de l'utilisateur.
    const done = () => {
      ro.disconnect()
      for (const e of ['pointerdown', 'wheel', 'touchstart', 'keydown']) window.removeEventListener(e, done, true)
      clearTimeout(timer)
    }
    const ro = new ResizeObserver(go)
    ro.observe(box)
    for (const e of ['pointerdown', 'wheel', 'touchstart', 'keydown']) window.addEventListener(e, done, true)
    const timer = setTimeout(done, 5000)
    stop.current?.()
    stop.current = done
  }, [data, selected, league, filter])
  useEffect(() => () => stop.current?.(), [])

  // Jours suivants : quand on arrive en bas de la liste, le jour d'après s'ajoute dessous.
  const [more, setMore] = useState<string[]>([])
  const [loaded, setLoaded] = useState<string[]>([])
  const [atEnd, setAtEnd] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setMore([])
    setLoaded([])
  }, [selected, league, filter === 'live'])
  const onLoaded = useRef((d: string) => setLoaded((l) => (l.includes(d) ? l : [...l, d]))).current
  useEffect(() => {
    const el = end.current
    if (!el) return
    const io = new IntersectionObserver((e) => setAtEnd(e.some((x) => x.isIntersecting)), { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const last = more.length ? more[more.length - 1] : selected
  const ready = !!data && more.every((d) => loaded.includes(d))
  const next = days.find((d) => d > last)
  useEffect(() => {
    if (atEnd && ready && next && filter !== 'live') setMore((m) => [...m, next])
  }, [atEnd, ready, next, filter])

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
        options={[{ value: 'all', label: 'Toutes' }, ...order.leagues.map((l) => ({ value: l.key, label: l.label }))]}
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
        {data && matches.length > 0 && !anyShown && (
          <Empty>
            {filter === 'live'
              ? 'Aucun match en cours pour le moment.'
              : favs.length
                ? 'Pas de match de vos équipes ce jour-là.'
                : 'Ajoutez vos équipes favorites dans l’onglet « Équipes ».'}
          </Empty>
        )}
        <div ref={top}>
          <Sections sections={sections} favs={favs} anchor />
        </div>
        {filter !== 'live' &&
          more.map((d) => (
            <NextDay key={d} day={d} leagues={leagues} filter={filter} favs={favs} intlOn={order.intlOn} active={active} onLoaded={onLoaded} />
          ))}
        <div ref={end} className="scroll-end" aria-hidden="true" />
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
