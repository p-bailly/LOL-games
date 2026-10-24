import { useMemo, type ReactNode } from 'react'
import { fetchTournamentGames, fetchTournamentLines, type GameRow } from '../api/games'
import { teamOf } from '../api/leaguepedia'
import { usePolling } from '../hooks/usePolling'
import { clock, goldDiff, kilo, shortDate } from '../lib/format'
import { playerGames, top, winStreaks, type PlayerGame, type Ranked } from '../lib/gameStats'
import { href } from '../lib/router'
import { Empty, ErrorBox, Loading } from './ui'

export interface Entry {
  key: string
  href: string
  rank: number
  main: ReactNode
  sub: string
  value: string
}

const code = (team: string) => teamOf(team).code

/** Un record : les trois premiers. `loading` / `error` : la catégorie se charge ou n'a pas pu l'être. */
export function RecordCard({ title, entries, loading, error, onRetry }: { title: string; entries: Entry[]; loading?: boolean; error?: boolean; onRetry?: () => void }) {
  if (!entries.length && !loading && !error) return null
  return (
    <section className="card flush">
      <h3 className="card-title">{title}</h3>
      {loading && !entries.length && <p className="record-note muted">Chargement…</p>}
      {error && !entries.length && (
        <p className="record-note muted">
          Indisponible pour le moment.{' '}
          {onRetry && (
            <button className="link-btn" onClick={onRetry}>
              Réessayer
            </button>
          )}
        </p>
      )}
      <ol className="record-list">
        {entries.map((e) => (
          <li key={e.key}>
            <a className="record-row" href={e.href}>
              <span className="st-rank">{e.rank}</span>
              <span className="record-main">
                <strong>{e.main}</strong>
                <small className="muted">{e.sub}</small>
              </span>
              <span className="record-value">{e.value}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Une game : « BLG – T1 », vainqueur et date en dessous. */
function gameEntries(ranked: Ranked<GameRow>[], value: (g: GameRow) => string, sub: (g: GameRow) => string = () => ''): Entry[] {
  return ranked.map(({ item: g }, i) => ({
    key: g.id,
    href: href.match(g.matchId),
    rank: i + 1,
    main: `${code(g.teams[0])} – ${code(g.teams[1])}`,
    sub: [sub(g), shortDate(g.date)].filter(Boolean).join(' · '),
    value: value(g),
  }))
}

/** Un joueur dans une game : nom, puis champion, équipes et date en dessous. */
function playerEntries(ranked: Ranked<PlayerGame>[], value: (p: PlayerGame) => string, extra?: (p: PlayerGame) => string): Entry[] {
  return ranked.map(({ item: p }, i) => ({
    key: `${p.gameId}|${p.link}`,
    href: href.match(p.matchId),
    rank: i + 1,
    main: p.name,
    sub: [extra?.(p), p.champion, `${code(p.team)} vs ${code(p.opponent)}`, shortDate(p.date)].filter(Boolean).join(' · '),
    value: value(p),
  }))
}

const total = (g: GameRow) => g.kills[0] + g.kills[1]
const lead = (g: GameRow) => g.gold[0] - g.gold[1]

/** Records d'un tournoi : les trois meilleures games et les trois meilleures performances individuelles de chaque catégorie. */
export function Records({ page, active }: { page: string; active: boolean }) {
  const { data, error, refresh } = usePolling(
    async () => {
      const [games, lines] = await Promise.all([fetchTournamentGames(page), fetchTournamentLines(page)])
      return { games, lines }
    },
    [page],
    10 * 60_000,
    active,
  )

  const cards = useMemo(() => {
    if (!data) return undefined
    const games = data.games.filter((g) => g.minutes > 0)
    const players = playerGames(data.lines, data.games)
    const best = (value: (p: PlayerGame) => number) => top(players, value, 'max')
    return {
      games: [
        { title: 'Game la plus courte', entries: gameEntries(top(games, (g) => g.minutes, 'min'), (g) => clock(g.minutes), (g) => `Victoire ${code(g.teams[g.winner - 1])}`) },
        { title: 'Game la plus longue', entries: gameEntries(top(games, (g) => g.minutes, 'max'), (g) => clock(g.minutes), (g) => `Victoire ${code(g.teams[g.winner - 1])}`) },
        { title: 'Plus de kills dans une game', entries: gameEntries(top(games, total, 'max'), (g) => String(total(g)), (g) => `${g.kills[0]}–${g.kills[1]}`) },
        {
          title: 'Plus gros écart d’or en fin de game',
          entries: gameEntries(top(games, (g) => Math.abs(lead(g)), 'max'), (g) => goldDiff(Math.abs(lead(g))), (g) => `Avance de ${code(g.teams[lead(g) > 0 ? 0 : 1])}`),
        },
        {
          title: 'Plus longue suite de victoires',
          entries: winStreaks(data.games)
            .slice(0, 3)
            .map((s, i) => ({ key: s.team, href: href.team(s.team), rank: i + 1, main: teamOf(s.team).name, sub: `Jusqu’au ${shortDate(s.end)}`, value: `${s.length} games` })),
        },
      ],
      players: [
        { title: 'Plus de kills', entries: playerEntries(best((p) => p.kills), (p) => String(p.kills)) },
        { title: 'Plus d’assists', entries: playerEntries(best((p) => p.assists), (p) => String(p.assists)) },
        { title: 'Plus de dégâts', entries: playerEntries(best((p) => p.damage), (p) => kilo(p.damage)) },
        { title: 'Plus de CS', entries: playerEntries(best((p) => p.cs), (p) => String(p.cs)) },
        { title: 'Meilleur score de vision', entries: playerEntries(best((p) => p.vision), (p) => String(p.vision)) },
        {
          title: 'Meilleur KDA sans mourir',
          entries: playerEntries(top(players.filter((p) => p.deaths === 0), (p) => p.kills + p.assists, 'max'), (p) => `${p.kills}/${p.deaths}/${p.assists}`),
        },
      ],
    }
  }, [data])

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (!data || !cards) return <Loading />
  if (!data.games.length) return <Empty>Aucune game jouée dans ce tournoi pour l’instant.</Empty>

  return (
    <>
      <h2 className="section-title">Games</h2>
      <div className="records">
        {cards.games.map((c) => (
          <RecordCard key={c.title} {...c} />
        ))}
      </div>
      <h2 className="section-title">Joueurs, sur une game</h2>
      <div className="records">
        {cards.players.map((c) => (
          <RecordCard key={c.title} {...c} />
        ))}
      </div>
      <p className="footnote">
        Records du tournoi choisi, {data.games.length} game{data.games.length > 1 ? 's' : ''} analysée{data.games.length > 1 ? 's' : ''}. Touche une ligne pour ouvrir la série. À égalité, la plus récente passe devant.
      </p>
    </>
  )
}
