import { useEffect, useMemo, useState } from 'react'
import { fetchPlayerElo, ROLE_NAMES, type EloPlayer } from '../api/eloPlayers'
import { onTeamsResolved, resolveTeams, teamOf } from '../api/leaguepedia'
import { ROLE_FR } from '../api/leagues'
import { Chips, Empty, ErrorBox, Loading, TeamLogo } from './ui'
import { usePolling } from '../hooks/usePolling'
import { shortDate } from '../lib/format'
import { href } from '../lib/router'

const PAGE = 50

function Delta({ v }: { v?: number }) {
  if (v === undefined || Math.abs(v) < 1) return <span className="muted">=</span>
  return <span className={v > 0 ? 'pos' : 'neg'}>{v > 0 ? '▲' : '▼'} {Math.round(Math.abs(v))}</span>
}

/** Classement Elo des joueurs : tous les joueurs actifs, ou un rôle à la fois. */
export function EloPlayers({ active }: { active: boolean }) {
  const { data, error, loading, refresh } = usePolling(() => fetchPlayerElo(), [], 30 * 60_000, active)
  const [scope, setScope] = useState<'major' | 'all'>('major')
  const [role, setRole] = useState('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [, bump] = useState(0)

  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const yearAgo = Date.now() - 365 * 86_400_000
    return data.players.filter((p) => p.last >= yearAgo && (scope === 'all' || p.major) && (role === 'all' || String(p.role) === role) && (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)))
  }, [data, scope, role, query])

  const visible = rows.slice(0, shown)
  const key = visible.map((p) => p.team).join('|')
  useEffect(() => {
    void resolveTeams(visible.map((p) => p.team))
    return onTeamsResolved(() => bump((n) => n + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (!data) return <Loading label="Chargement du classement…" />

  return (
    <>
      <Chips
        value={scope}
        onChange={(s) => {
          setScope(s)
          setShown(PAGE)
        }}
        options={[
          { value: 'major', label: 'Ligues majeures' },
          { value: 'all', label: 'Toutes les ligues' },
        ]}
      />
      <Chips
        value={role}
        onChange={(r) => {
          setRole(r)
          setShown(PAGE)
        }}
        options={[{ value: 'all', label: 'Tous les rôles' }, ...ROLE_NAMES.map((r, i) => ({ value: String(i), label: ROLE_FR[r] }))]}
      />
      <div className="content">
        <input className="search" type="search" placeholder="Rechercher un joueur…" value={query} onChange={(e) => (setQuery(e.target.value), setShown(PAGE))} />
        {rows.length === 0 && <Empty>Aucun joueur ne correspond.</Empty>}
        {rows.length > 0 && (
          <div className="card flush">
            <ol className="elo-list">
              {visible.map((p, i) => (
                <PlayerRow key={p.id} p={p} pos={i + 1} />
              ))}
            </ol>
          </div>
        )}
        {rows.length > shown && (
          <button className="btn more" onClick={() => setShown(shown + PAGE)}>
            Voir {Math.min(PAGE, rows.length - shown)} joueurs de plus
          </button>
        )}
        <p className="footnote">
          Elo des joueurs calculé sur toutes les games de Leaguepedia depuis 2011 ({Math.round(data.quality.n / 1000)} 000 games depuis 2016 pour le réglage), mis à jour avec les dernières games
          {data.added ? ` (${data.added} depuis le calcul du ${shortDate(new Date(data.until).toISOString())})` : ''}. La force d’une équipe est la moyenne des notes de ses cinq joueurs ; après chaque game, chaque
          joueur gagne ou perd selon l’écart entre le résultat et ce qui était attendu. Un nouveau joueur démarre à la moyenne de ses coéquipiers (K = {data.params.kMax}), puis sa note se stabilise (K ={' '}
          {data.params.kMin}) : ce sont les changements d’équipe qui séparent les coéquipiers, et un joueur toujours avec les mêmes partenaires a une note proche d’eux. Réglage mesuré sur l’historique :{' '}
          {(data.quality.accuracy * 100).toFixed(0)} % des vainqueurs de games bien prévus. Le jeu des rôles n’est pas pris en compte (un support et un mid d’une même équipe sont jugés sur le même résultat).
          {loading ? ' Mise à jour…' : ''}
        </p>
      </div>
    </>
  )
}

function PlayerRow({ p, pos }: { p: EloPlayer; pos: number }) {
  const team = teamOf(p.team)
  return (
    <li>
      <a className="elo-row" href={href.player(p.id)}>
        <span className="elo-rank">{pos}</span>
        <TeamLogo team={team} size={30} />
        <span className="elo-name">
          <strong>{p.name}</strong>
          <small className="muted">{[ROLE_FR[ROLE_NAMES[p.role]], team.code, `${p.games} games`, `${Math.round((p.wins / Math.max(1, p.wins + p.losses)) * 100)} %`, p.games < 60 ? 'provisoire' : ''].filter(Boolean).join(' · ')}</small>
        </span>
        <span className="elo-score">
          <strong>{Math.round(p.rating)}</strong>
          <small>
            <Delta v={p.delta} />
          </small>
        </span>
      </a>
    </li>
  )
}
