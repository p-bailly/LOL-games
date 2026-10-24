import { useMemo, useState } from 'react'
import { fetchChampionStats, fetchPlayerStats } from '../api/stats'
import { ROLES, ROLE_FR } from '../api/leagues'
import { teamOf } from '../api/leaguepedia'
import { AdvancedPlayers } from '../components/AdvancedPlayers'
import { AllTimeRecords } from '../components/AllTimeRecords'
import { Records } from '../components/Records'
import { RegionStats } from '../components/RegionStats'
import { SortTh, useSort } from '../components/SortTh'
import { TeamStats } from '../components/TeamStats'
import { TournamentPicker, useTournamentPicker } from '../components/TournamentPicker'
import { ChampIcon, Chips, Empty, ErrorBox, Loading, PageHeader, Segmented } from '../components/ui'
import { usePolling } from '../hooks/usePolling'
import { fixed, kdaNum, kilo, pct } from '../lib/format'
import { href } from '../lib/router'

type View = 'champions' | 'players' | 'teams' | 'records' | 'regions'
type RecordsScope = 'tournament' | 'year' | 'all'

export function StatsPage({ active }: { active: boolean }) {
  const picker = useTournamentPicker(active)
  const [view, setView] = useState<View>('champions')
  const [scope, setScope] = useState<RecordsScope>('tournament')
  const page = picker.tournament?.page
  // Records d'une année ou de toute l'histoire, et régions : pas de choix de tournoi.
  const wide = view === 'records' && scope !== 'tournament'
  const byTournament = view !== 'regions' && !wide
  const subtitle = view === 'regions' ? 'Compétitions internationales' : wide ? (scope === 'all' ? 'Records de tous les temps' : 'Records d’une année') : (picker.tournament?.name ?? ' ')

  return (
    <>
      <PageHeader title="Stats" subtitle={subtitle} />
      <div className="toolbar">
        <Segmented<View>
          compact
          value={view}
          onChange={setView}
          options={[
            { value: 'champions', label: 'Champions' },
            { value: 'players', label: 'Joueurs' },
            { value: 'teams', label: 'Équipes' },
            { value: 'records', label: 'Records' },
            { value: 'regions', label: 'Régions' },
          ]}
        />
      </div>
      {view === 'records' && (
        <div className="toolbar">
          <Segmented<RecordsScope>
            compact
            value={scope}
            onChange={setScope}
            options={[
              { value: 'tournament', label: 'Ce tournoi' },
              { value: 'year', label: 'Une année' },
              { value: 'all', label: 'Tous les temps' },
            ]}
          />
        </div>
      )}
      {byTournament && <TournamentPicker picker={picker} />}
      <div className="content">
        {byTournament && picker.error && !picker.loaded && <ErrorBox error={picker.error} onRetry={picker.refresh} />}
        {byTournament && !picker.loaded && !picker.error && <Loading />}
        {byTournament && picker.loaded && !page && <Empty>Aucun tournoi récent pour cette ligue.</Empty>}
        {byTournament && page && view === 'champions' && <Champions page={page} active={active} />}
        {byTournament && page && view === 'players' && <Players page={page} active={active} />}
        {byTournament && page && view === 'teams' && <TeamStats page={page} active={active} />}
        {byTournament && page && view === 'records' && <Records page={page} active={active} />}
        {wide && <AllTimeRecords scope={scope === 'all' ? 'all' : 'year'} active={active} />}
        {view === 'regions' && <RegionStats active={active} />}
      </div>
    </>
  )
}

type ChampKey = 'presence' | 'picks' | 'bans' | 'winrate'
const MIN_PICKS = 3 // en dessous, un taux de victoire ne veut rien dire : ces champions passent après les autres

function Champions({ page, active }: { page: string; active: boolean }) {
  const [sort, onSort] = useSort<ChampKey>('presence')
  const { data, error, refresh } = usePolling((s) => fetchChampionStats([page], s), [page], 10 * 60_000, active)

  const rows = useMemo(() => {
    if (!data) return []
    const g = data.games || 1
    const val = (c: (typeof data.champions)[number]) =>
      sort.key === 'picks' ? c.picks : sort.key === 'bans' ? c.bans : sort.key === 'winrate' ? c.wins / (c.picks || 1) : (c.picks + c.bans) / g
    const sign = sort.dir === 'best' ? -1 : 1
    return [...data.champions]
      .sort((a, b) => {
        if (sort.key === 'winrate' && (a.picks >= MIN_PICKS) !== (b.picks >= MIN_PICKS)) return a.picks >= MIN_PICKS ? -1 : 1
        return sign * (val(a) - val(b)) || b.picks - a.picks || a.champion.localeCompare(b.champion)
      })
      .slice(0, 100)
  }, [data, sort])

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (!data) return <Loading />
  if (!data.games) return <Empty>Aucune game jouée dans ce tournoi pour l’instant.</Empty>

  return (
    <>
      <div className="card flush">
        <div className="table-scroll">
          <table className="standings stats-table">
            <thead>
              <tr>
                <th scope="col" className="left">Champion</th>
                <SortTh k="presence" label="Présence" sort={sort} onSort={onSort} />
                <SortTh k="picks" label="Picks" sort={sort} onSort={onSort} />
                <SortTh k="bans" label="Bans" sort={sort} onSort={onSort} />
                <SortTh k="winrate" label="Vict." sort={sort} onSort={onSort} />
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
                  <td className={c.picks >= MIN_PICKS ? (c.wins / c.picks >= 0.5 ? 'pos' : 'neg') : ''}>{c.picks ? pct(c.wins, c.picks) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="footnote">
        Touche une colonne pour trier du meilleur au plus faible, une deuxième fois pour inverser. {data.games} game{data.games > 1 ? 's' : ''} analysée{data.games > 1 ? 's' : ''}. Présence : part des games où le champion est pické ou
        banni. Victoires : taux de victoire quand il est pické ({MIN_PICKS} picks minimum, les autres sont classés après).
      </p>
    </>
  )
}

type PlayerKey = 'games' | 'kda' | 'kills' | 'deaths' | 'assists' | 'cs' | 'damage' | 'winrate'

type PlayerMode = 'basic' | 'advanced'

function Players({ page, active }: { page: string; active: boolean }) {
  const [mode, setMode] = useState<PlayerMode>('basic')
  const [role, setRole] = useState('all')
  return (
    <>
      <Segmented<PlayerMode>
        compact
        value={mode}
        onChange={setMode}
        options={[
          { value: 'basic', label: 'Par partie' },
          { value: 'advanced', label: 'Par minute' },
        ]}
      />
      <Chips
        value={role}
        onChange={setRole}
        options={[{ value: 'all', label: 'Tous les rôles' }, ...ROLES.map((r) => ({ value: r as string, label: ROLE_FR[r] }))]}
      />
      {mode === 'basic' ? <BasicPlayers page={page} role={role} active={active} /> : <AdvancedPlayers page={page} role={role} active={active} />}
    </>
  )
}

function BasicPlayers({ page, role, active }: { page: string; role: string; active: boolean }) {
  const [sort, onSort] = useSort<PlayerKey>('kda')
  const { data, error, refresh } = usePolling((s) => fetchPlayerStats([page], s), [page], 10 * 60_000, active)

  const rows = useMemo(() => {
    if (!data) return []
    const maxGames = Math.max(0, ...data.map((p) => p.games))
    const min = Math.min(3, Math.ceil(maxGames * 0.3))
    const val = (p: (typeof data)[number]) => {
      const g = p.games || 1
      switch (sort.key) {
        case 'games':
          return p.games
        case 'kills':
          return p.kills / g
        case 'deaths':
          return -p.deaths / g // moins de morts = meilleur
        case 'assists':
          return p.assists / g
        case 'cs':
          return p.cs / g
        case 'damage':
          return p.damage / g
        case 'winrate':
          return p.wins / g
        default:
          return kdaNum(p.kills, p.deaths, p.assists)
      }
    }
    const sign = sort.dir === 'best' ? -1 : 1
    return data
      .filter((p) => p.games >= min && (role === 'all' || p.role === role))
      .sort((a, b) => sign * (val(a) - val(b)) || b.games - a.games || a.name.localeCompare(b.name))
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
                <SortTh k="kills" label="K" sort={sort} onSort={onSort} />
                <SortTh k="deaths" label="D" sort={sort} onSort={onSort} />
                <SortTh k="assists" label="A" sort={sort} onSort={onSort} />
                <SortTh k="cs" label="CS" sort={sort} onSort={onSort} />
                <SortTh k="damage" label="Dég." sort={sort} onSort={onSort} />
                <SortTh k="winrate" label="Vict." sort={sort} onSort={onSort} />
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
                    <td>{fixed(p.kills / g)}</td>
                    <td>{fixed(p.deaths / g)}</td>
                    <td>{fixed(p.assists / g)}</td>
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
      <p className="footnote">
        Touche une colonne pour trier du meilleur au plus faible (pour D, le moins de morts d’abord), une deuxième fois pour inverser. Moyennes par partie. Seuls les joueurs avec assez de parties sont listés (au moins
        3, ou 30 % du maximum du tournoi).
      </p>
    </>
  )
}
