import { useMemo } from 'react'
import { fetchTournamentGames } from '../api/games'
import { teamOf } from '../api/leaguepedia'
import { usePolling } from '../hooks/usePolling'
import { clock, fixed, goldDiff, pct } from '../lib/format'
import { teamStats, type TeamStat } from '../lib/gameStats'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'
import { SortTh, useSort } from './SortTh'
import { Empty, ErrorBox, Loading, TeamLogo } from './ui'

type Key = 'games' | 'winrate' | 'length' | 'kills' | 'gold' | 'towers' | 'dragons' | 'barons' | 'heralds' | 'blue' | 'red'

/** Valeur d'une colonne pour le tri (plus haut = meilleur) ; rien quand l'équipe n'a pas joué de ce côté. */
function value(s: TeamStat, key: Key): number | undefined {
  const g = s.games || 1
  switch (key) {
    case 'games':
      return s.games
    case 'winrate':
      return s.wins / g
    case 'length':
      return -s.minutes / g // games plus courtes = meilleur
    case 'kills':
      return s.kills / g
    case 'gold':
      return s.goldDiff / g
    case 'towers':
      return s.towers / g
    case 'dragons':
      return s.dragons / g
    case 'barons':
      return s.barons / g
    case 'heralds':
      return s.heralds / g
    case 'blue':
      return s.blue.games ? s.blue.wins / s.blue.games : undefined
    case 'red':
      return s.red.games ? s.red.wins / s.red.games : undefined
  }
}

/** Stats collectives de chaque équipe d'un tournoi : durée, kills, écart d'or, objectifs, victoires par côté. */
export function TeamStats({ page, active }: { page: string; active: boolean }) {
  const [sort, onSort] = useSort<Key>('winrate')
  const { has } = useFavorites()
  const { data, error, refresh } = usePolling(() => fetchTournamentGames(page), [page], 10 * 60_000, active)

  const rows = useMemo(() => {
    if (!data) return []
    const sign = sort.dir === 'best' ? -1 : 1
    return teamStats(data).sort((a, b) => {
      const x = value(a, sort.key)
      const y = value(b, sort.key)
      if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1
      return sign * (x - y) || b.games - a.games || a.team.localeCompare(b.team)
    })
  }, [data, sort])

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (!data) return <Loading />
  if (!data.length) return <Empty>Aucune game jouée dans ce tournoi pour l’instant.</Empty>

  return (
    <>
      <div className="card flush">
        <div className="table-scroll">
          <table className="standings stats-table">
            <thead>
              <tr>
                <th scope="col" className="left">Équipe</th>
                <SortTh k="games" label="Parties" sort={sort} onSort={onSort} />
                <SortTh k="winrate" label="Vict." sort={sort} onSort={onSort} />
                <SortTh k="length" label="Durée" sort={sort} onSort={onSort} title="Trier de la game la plus courte à la plus longue" />
                <SortTh k="kills" label="Kills" sort={sort} onSort={onSort} />
                <SortTh k="gold" label="Écart or" sort={sort} onSort={onSort} />
                <SortTh k="towers" label="Tours" sort={sort} onSort={onSort} />
                <SortTh k="dragons" label="Drag." sort={sort} onSort={onSort} />
                <SortTh k="barons" label="Barons" sort={sort} onSort={onSort} />
                <SortTh k="heralds" label="Hér." sort={sort} onSort={onSort} />
                <SortTh k="blue" label="Bleu" sort={sort} onSort={onSort} />
                <SortTh k="red" label="Rouge" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const team = teamOf(s.team)
                const g = s.games || 1
                const gold = s.goldDiff / g
                return (
                  <tr key={s.team} className={has(team.id) ? 'fav' : ''}>
                    <th scope="row" className="left">
                      <a href={href.team(team.id)} className="st-team">
                        <TeamLogo team={team} size={22} />
                        <span className="st-abbr">{team.code}</span>
                        <span className="st-name">{team.name}</span>
                      </a>
                    </th>
                    <td>{s.games}</td>
                    <td className={`strong ${s.wins / g >= 0.5 ? 'pos' : 'neg'}`}>{pct(s.wins, s.games)}</td>
                    <td>{clock(s.minutes / g)}</td>
                    <td>{fixed(s.kills / g)}</td>
                    <td className={gold > 0 ? 'pos' : gold < 0 ? 'neg' : ''}>{goldDiff(Math.round(gold))}</td>
                    <td>{fixed(s.towers / g)}</td>
                    <td>{fixed(s.dragons / g)}</td>
                    <td>{fixed(s.barons / g, 2)}</td>
                    <td>{fixed(s.heralds / g)}</td>
                    <td>{s.blue.games ? pct(s.blue.wins, s.blue.games) : '–'}</td>
                    <td>{s.red.games ? pct(s.red.wins, s.red.games) : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="footnote">
        Touche une colonne pour trier du meilleur au plus faible, une deuxième fois pour inverser (pour Durée, les games les plus courtes d’abord). Moyennes par game. Écart or : or de l’équipe moins celui de son adversaire en fin
        de game. Bleu et Rouge : taux de victoire de l’équipe de ce côté. {data.length} game{data.length > 1 ? 's' : ''} analysée{data.length > 1 ? 's' : ''}.
      </p>
    </>
  )
}
