import { useMemo, useState } from 'react'
import { fetchChampionStats, fetchPlayerStats } from '../api/stats'
import { ROLES, ROLE_FR } from '../api/leagues'
import { teamOf } from '../api/leaguepedia'
import { TournamentPicker, useTournamentPicker } from '../components/TournamentPicker'
import { ChampIcon, Chips, Empty, ErrorBox, Loading, PageHeader, Segmented } from '../components/ui'
import { usePolling } from '../hooks/usePolling'
import { fixed, kdaNum, kilo, pct } from '../lib/format'
import { href } from '../lib/router'

type View = 'champions' | 'players'
type ChampSort = 'presence' | 'picks' | 'bans' | 'winrate'
type PlayerSort = 'kda' | 'kills' | 'damage' | 'cs' | 'winrate'

export function StatsPage({ active }: { active: boolean }) {
  const picker = useTournamentPicker(active)
  const [view, setView] = useState<View>('champions')
  const page = picker.tournament?.page

  return (
    <>
      <PageHeader title="Stats" subtitle={picker.tournament?.name ?? ' '} />
      <TournamentPicker picker={picker} />
      <div className="toolbar">
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'champions', label: 'Champions' },
            { value: 'players', label: 'Joueurs' },
          ]}
        />
      </div>
      <div className="content">
        {picker.error && !picker.loaded && <ErrorBox error={picker.error} onRetry={picker.refresh} />}
        {!picker.loaded && !picker.error && <Loading />}
        {picker.loaded && !page && <Empty>Aucun tournoi récent pour cette ligue.</Empty>}
        {page && view === 'champions' && <Champions page={page} active={active} />}
        {page && view === 'players' && <Players page={page} active={active} />}
      </div>
    </>
  )
}

function Champions({ page, active }: { page: string; active: boolean }) {
  const [sort, setSort] = useState<ChampSort>('presence')
  const { data, error, refresh } = usePolling((s) => fetchChampionStats([page], s), [page], 10 * 60_000, active)

  const rows = useMemo(() => {
    if (!data) return []
    const g = data.games || 1
    const val = (c: (typeof data.champions)[number]) =>
      sort === 'picks' ? c.picks : sort === 'bans' ? c.bans : sort === 'winrate' ? (c.picks >= 3 ? c.wins / c.picks : -1) : (c.picks + c.bans) / g
    return [...data.champions].sort((a, b) => val(b) - val(a) || b.picks - a.picks).slice(0, 60)
  }, [data, sort])

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (!data) return <Loading />
  if (!data.games) return <Empty>Aucune game jouée dans ce tournoi pour l’instant.</Empty>

  return (
    <>
      <Chips
        value={sort}
        onChange={setSort}
        options={[
          { value: 'presence', label: 'Présence' },
          { value: 'picks', label: 'Picks' },
          { value: 'bans', label: 'Bans' },
          { value: 'winrate', label: 'Victoires' },
        ]}
      />
      <div className="card flush">
        <div className="table-scroll">
          <table className="standings stats-table">
            <thead>
              <tr>
                <th scope="col" className="left">Champion</th>
                <th scope="col">Présence</th>
                <th scope="col">Picks</th>
                <th scope="col">Bans</th>
                <th scope="col">Vict.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.champion}>
                  <th scope="row" className="left">
                    <span className="st-team">
                      <ChampIcon champion={c.champion} size={28} />
                      <span>{c.champion}</span>
                    </span>
                  </th>
                  <td className="strong">{pct(c.picks + c.bans, data.games)}</td>
                  <td>{c.picks}</td>
                  <td>{c.bans}</td>
                  <td className={c.picks >= 3 ? (c.wins / c.picks >= 0.5 ? 'pos' : 'neg') : ''}>{c.picks ? pct(c.wins, c.picks) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="footnote">
        {data.games} game{data.games > 1 ? 's' : ''} analysée{data.games > 1 ? 's' : ''}. Présence : part des games où le champion est pické ou banni. Victoires : taux de victoire quand il est pické (3 picks minimum pour le tri).
      </p>
    </>
  )
}

function Players({ page, active }: { page: string; active: boolean }) {
  const [sort, setSort] = useState<PlayerSort>('kda')
  const [role, setRole] = useState('all')
  const { data, error, refresh } = usePolling((s) => fetchPlayerStats([page], s), [page], 10 * 60_000, active)

  const rows = useMemo(() => {
    if (!data) return []
    const maxGames = Math.max(0, ...data.map((p) => p.games))
    const min = Math.min(3, Math.ceil(maxGames * 0.3))
    const val = (p: (typeof data)[number]) => {
      const g = p.games || 1
      switch (sort) {
        case 'kills':
          return p.kills / g
        case 'damage':
          return p.damage / g
        case 'cs':
          return p.cs / g
        case 'winrate':
          return p.wins / g
        default:
          return kdaNum(p.kills, p.deaths, p.assists)
      }
    }
    return data
      .filter((p) => p.games >= min && (role === 'all' || p.role === role))
      .sort((a, b) => val(b) - val(a))
      .slice(0, 50)
  }, [data, sort, role])

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (!data) return <Loading />
  if (!data.length) return <Empty>Aucune game jouée dans ce tournoi pour l’instant.</Empty>

  return (
    <>
      <Chips
        value={role}
        onChange={setRole}
        options={[{ value: 'all', label: 'Tous les rôles' }, ...ROLES.map((r) => ({ value: r as string, label: ROLE_FR[r] }))]}
      />
      <Chips
        value={sort}
        onChange={setSort}
        options={[
          { value: 'kda', label: 'KDA' },
          { value: 'kills', label: 'Kills' },
          { value: 'damage', label: 'Dégâts' },
          { value: 'cs', label: 'CS' },
          { value: 'winrate', label: 'Victoires' },
        ]}
      />
      <div className="card flush">
        <div className="table-scroll">
          <table className="standings stats-table">
            <thead>
              <tr>
                <th scope="col" className="left">Joueur</th>
                <th scope="col">Parties</th>
                <th scope="col">KDA</th>
                <th scope="col">K/D/A</th>
                <th scope="col">CS</th>
                <th scope="col">Dég.</th>
                <th scope="col">Vict.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const g = p.games || 1
                return (
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
                    <td>
                      {fixed(p.kills / g)}/{fixed(p.deaths / g)}/{fixed(p.assists / g)}
                    </td>
                    <td>{fixed(p.cs / g, 0)}</td>
                    <td>{kilo(p.damage / g)}</td>
                    <td>{pct(p.wins, p.games)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="footnote">Moyennes par partie. Seuls les joueurs avec assez de parties sont listés (au moins 3, ou 30 % du maximum du tournoi).</p>
    </>
  )
}
