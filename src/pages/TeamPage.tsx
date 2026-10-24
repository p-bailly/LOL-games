import { useEffect, useState } from 'react'
import { fetchTeamMatches, onTeamsResolved, resolveTeams, teamOf } from '../api/leaguepedia'
import { ROLE_FR } from '../api/leagues'
import { applyLive } from '../api/live'
import { fetchElo } from '../api/elo'
import { fetchRoster } from '../api/stats'
import type { Match } from '../api/types'
import { Empty, ErrorBox, LiveBadge, Loading, PageHeader, Segmented, Star, TeamLogo } from '../components/ui'
import { usePolling } from '../hooks/usePolling'
import { bestOfLabel, shortDate, statusLabel } from '../lib/format'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'

type Tab = 'schedule' | 'roster'

export function TeamPage({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>('schedule')
  const favs = useFavorites()
  const [, bump] = useState(0)
  useEffect(() => {
    void resolveTeams([id])
    return onTeamsResolved(() => bump((n) => n + 1))
  }, [id])
  const team = teamOf(id)
  const elo = usePolling(() => fetchElo(), [], null).data?.byId.get(id)

  const sched = usePolling(
    async (signal) => applyLive(await fetchTeamMatches(id, new Date(Date.now() - 150 * 86_400_000), signal), signal),
    [id],
    (d) => (d.some((m) => m.state === 'in') ? 30_000 : null),
  )

  return (
    <>
      <PageHeader
        back
        title={team.name}
        right={
          <button
            className={`icon-btn star ${favs.has(id) ? 'on' : ''}`}
            onClick={() => favs.toggle(id)}
            aria-pressed={favs.has(id)}
            aria-label={favs.has(id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Star on={favs.has(id)} />
          </button>
        }
      />
      <section className="team-hero">
        <TeamLogo team={team} size={72} />
        <div>
          <h2>{team.name}</h2>
          <p className="muted">{[team.code, team.region].filter(Boolean).join(' · ')}</p>
          {sched.data && <Record matches={sched.data} id={id} />}
          {elo && (
            <p className="team-elo">
              Elo mondial : <strong>{Math.round(elo.rating)}</strong> · {elo.majorRank ?? elo.rank}{(elo.majorRank ?? elo.rank) === 1 ? 'er' : 'e'}{elo.majorRank ? ' des ligues majeures' : ''}
            </p>
          )}
        </div>
      </section>
      <div className="toolbar sticky">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'schedule', label: 'Calendrier' },
            { value: 'roster', label: 'Effectif' },
          ]}
        />
      </div>
      <div className="content">
        {tab === 'roster' ? (
          <Roster id={id} />
        ) : sched.error && !sched.data ? (
          <ErrorBox error={sched.error} onRetry={sched.refresh} />
        ) : !sched.data ? (
          <Loading />
        ) : (
          <Schedule matches={sched.data} teamId={id} />
        )}
      </div>
    </>
  )
}

/** Bilan des séries jouées sur la période affichée. */
function Record({ matches, id }: { matches: Match[]; id: string }) {
  const played = matches.filter((m) => m.state === 'post' && m.winner)
  const wins = played.filter((m) => (m.a.team.id === id ? 1 : 2) === m.winner).length
  if (!played.length) return null
  return <p className="team-record">{wins} V – {played.length - wins} D <span className="muted">· 5 derniers mois</span></p>
}

function Schedule({ matches, teamId }: { matches: Match[]; teamId: string }) {
  if (!matches.length) return <Empty>Aucune série récente pour cette équipe.</Empty>
  const upcoming = matches.filter((m) => m.state !== 'post')
  const results = matches.filter((m) => m.state === 'post').reverse()
  return (
    <>
      {upcoming.length > 0 && (
        <section className="card flush">
          <h3 className="card-title">À venir</h3>
          <ul className="sched-list">
            {upcoming.slice(0, 15).map((m) => (
              <SchedRow key={m.id} m={m} teamId={teamId} />
            ))}
          </ul>
        </section>
      )}
      {results.length > 0 && (
        <section className="card flush">
          <h3 className="card-title">Résultats</h3>
          <ul className="sched-list">
            {results.map((m) => (
              <SchedRow key={m.id} m={m} teamId={teamId} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function SchedRow({ m, teamId }: { m: Match; teamId: string }) {
  const mineFirst = m.a.team.id === teamId
  const me = mineFirst ? m.a : m.b
  const opp = mineFirst ? m.b : m.a
  const won = m.state === 'post' && m.winner === (mineFirst ? 1 : 2)
  return (
    <li>
      <a href={href.match(m.id)} className="sched-row">
        <span className="sched-date">{shortDate(m.date)}</span>
        <span className="sched-opp">
          <span className="muted">vs</span>
          <TeamLogo team={opp.team} size={22} />
          <span className="sched-name">
            {opp.team.name}
            <small className="muted">{m.leagueName}{m.round ? ` · ${m.round}` : ''}</small>
          </span>
        </span>
        <span className="sched-result">
          {m.state === 'post' && m.winner ? (
            <>
              <span className={`wl ${won ? 'w' : 'l'}`}>{won ? 'V' : 'D'}</span>
              {me.score}-{opp.score}
            </>
          ) : m.state === 'in' ? (
            <>
              <LiveBadge />
              {me.score}-{opp.score}
            </>
          ) : (
            <>
              {statusLabel(m)} <small className="muted">{bestOfLabel(m)}</small>
            </>
          )}
        </span>
      </a>
    </li>
  )
}

function Roster({ id }: { id: string }) {
  const { data, error, refresh } = usePolling((s) => fetchRoster(id, s), [id])
  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (data === undefined && !error) return <Loading />
  if (!data) return <Empty>Effectif indisponible.</Empty>
  return (
    <section className="card flush">
      <h3 className="card-title">{data.tournament}</h3>
      <ul className="roster">
        {data.players.map((p) => (
          <li key={p.link}>
            <a className="roster-row player-link" href={href.player(p.link)}>
              <span className="role-badge">{ROLE_FR[p.role] ?? (p.role || '?')}</span>
              <span className="roster-main">
                <strong>{p.id}</strong>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
