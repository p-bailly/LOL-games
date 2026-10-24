import { useMemo } from 'react'
import { fetchTournamentGames, fetchTournamentLines } from '../api/games'
import { teamOf } from '../api/leaguepedia'
import { ROLE_FR } from '../api/leagues'
import { usePolling } from '../hooks/usePolling'
import { fixed, kdaNum, pct } from '../lib/format'
import { advancedPlayers, type PlayerAdvanced } from '../lib/gameStats'
import { href } from '../lib/router'
import { SortTh, useSort } from './SortTh'
import { Empty, ErrorBox, Loading } from './ui'

type Key = 'games' | 'kda' | 'cs' | 'gold' | 'damage' | 'damageShare' | 'goldShare' | 'kp' | 'vision'

const share = (part: number, total: number) => (total ? part / total : 0)

function value(p: PlayerAdvanced, key: Key): number {
  const min = p.minutes || 1
  switch (key) {
    case 'games':
      return p.games
    case 'cs':
      return p.cs / min
    case 'gold':
      return p.gold / min
    case 'damage':
      return p.damage / min
    case 'damageShare':
      return share(p.damage, p.teamDamage)
    case 'goldShare':
      return share(p.gold, p.teamGold)
    case 'kp':
      return share(p.kills + p.assists, p.teamKills)
    case 'vision':
      return p.vision / min
    default:
      return kdaNum(p.kills, p.deaths, p.assists)
  }
}

/** Stats « par minute » et parts de l'équipe : CS, or, dégâts, participation aux kills, vision. */
export function AdvancedPlayers({ page, role, active }: { page: string; role: string; active: boolean }) {
  const [sort, onSort] = useSort<Key>('damage')
  const { data, error, refresh } = usePolling(
    async () => {
      const [games, lines] = await Promise.all([fetchTournamentGames(page), fetchTournamentLines(page)])
      return advancedPlayers(lines, games)
    },
    [page],
    10 * 60_000,
    active,
  )

  const rows = useMemo(() => {
    if (!data) return []
    const maxGames = Math.max(0, ...data.map((p) => p.games))
    const min = Math.min(3, Math.ceil(maxGames * 0.3))
    const sign = sort.dir === 'best' ? -1 : 1
    return data
      .filter((p) => p.games >= min && (role === 'all' || p.role === role))
      .sort((a, b) => sign * (value(a, sort.key) - value(b, sort.key)) || b.games - a.games || a.name.localeCompare(b.name))
      .slice(0, 100)
  }, [data, sort, role])

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
                <th scope="col" className="left">Joueur</th>
                <SortTh k="games" label="Parties" sort={sort} onSort={onSort} />
                <SortTh k="kda" label="KDA" sort={sort} onSort={onSort} />
                <SortTh k="cs" label="CS/min" sort={sort} onSort={onSort} />
                <SortTh k="gold" label="Or/min" sort={sort} onSort={onSort} />
                <SortTh k="damage" label="Dég./min" sort={sort} onSort={onSort} />
                <SortTh k="damageShare" label="% dég." sort={sort} onSort={onSort} />
                <SortTh k="goldShare" label="% or" sort={sort} onSort={onSort} />
                <SortTh k="kp" label="PK %" sort={sort} onSort={onSort} />
                <SortTh k="vision" label="Vision/min" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.link}>
                  <th scope="row" className="left">
                    <a className="st-team" href={href.player(p.link)}>
                      <span className="who">
                        <span>{p.name}</span>
                        <small className="muted">
                          {teamOf(p.team).code} · {ROLE_FR[p.role] ?? p.role}
                        </small>
                      </span>
                    </a>
                  </th>
                  <td>{p.games}</td>
                  <td className="strong">{fixed(kdaNum(p.kills, p.deaths, p.assists))}</td>
                  <td>{fixed(value(p, 'cs'))}</td>
                  <td>{Math.round(value(p, 'gold'))}</td>
                  <td>{Math.round(value(p, 'damage'))}</td>
                  <td>{pct(p.damage, p.teamDamage)}</td>
                  <td>{pct(p.gold, p.teamGold)}</td>
                  <td>{pct(p.kills + p.assists, p.teamKills)}</td>
                  <td>{fixed(value(p, 'vision'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="footnote">
        Touche une colonne pour trier du meilleur au plus faible, une deuxième fois pour inverser. Par minute de jeu. % dég. et % or : part des dégâts et de l’or de l’équipe. PK % : participation aux kills de l’équipe
        ((kills + assists) / kills de l’équipe). Seuls les joueurs avec assez de parties sont listés (au moins 3, ou 30 % du maximum du tournoi).
      </p>
    </>
  )
}
