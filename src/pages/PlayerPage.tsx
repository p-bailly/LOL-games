import { useMemo } from 'react'
import { fetchPlayerElo, ROLE_NAMES } from '../api/eloPlayers'
import { fetchPlayerGames, fetchPlayerInfo, type PlayerGame } from '../api/stats'
import { ROLE_FR } from '../api/leagues'
import { resolveTeams, teamOf } from '../api/leaguepedia'
import { ChampIcon, Empty, ErrorBox, Loading, PageHeader } from '../components/ui'
import { usePolling } from '../hooks/usePolling'
import { fixed, flag, kda, kdaNum, kilo, pct, shortDate } from '../lib/format'
import { href } from '../lib/router'

function age(birthdate?: string): number | undefined {
  if (!birthdate) return undefined
  const b = new Date(birthdate)
  return Number.isNaN(b.getTime()) ? undefined : Math.floor((Date.now() - b.getTime()) / (365.25 * 86_400_000))
}

export function PlayerPage({ id }: { id: string }) {
  const info = usePolling(async (s) => {
    const p = await fetchPlayerInfo(id, s)
    if (p?.team) await resolveTeams([p.team])
    return p ?? null
  }, [id])
  const games = usePolling((s) => fetchPlayerGames(id, s), [id])
  const elo = usePolling(() => fetchPlayerElo(), [], null).data?.byId.get(id)

  const display = info.data?.id ?? id.replace(/\s*\(.*\)$/, '')
  const a = age(info.data?.birthdate)

  return (
    <>
      <PageHeader back title={display} subtitle={info.data?.name && info.data.name !== display ? info.data.name : undefined} />
      {info.data && (
        <section className="player-hero">
          <div>
            <h2>
              {flag(info.data.country)} {display}
            </h2>
            <p className="muted">
              {[ROLE_FR[info.data.role] ?? info.data.role, info.data.country, a ? `${a} ans` : '', info.data.retired ? 'retraité' : ''].filter(Boolean).join(' · ')}
            </p>
            {elo && (
              <p className="team-elo">
                Elo : <strong>{Math.round(elo.rating)}</strong>
                {elo.roleRank ? ` · ${elo.roleRank}${elo.roleRank === 1 ? 'er' : 'e'} ${ROLE_FR[ROLE_NAMES[elo.role]]} des ligues majeures` : ` · ${elo.rank}${elo.rank === 1 ? 'er' : 'e'} mondial`}
              </p>
            )}
            {info.data.team && (
              <a className="player-team" href={href.team(info.data.team)}>
                Équipe : <strong>{teamOf(info.data.team).name}</strong>
              </a>
            )}
          </div>
        </section>
      )}
      <div className="content">
        {info.error && !info.data && <ErrorBox error={info.error} onRetry={info.refresh} />}
        {games.error && !games.data && <ErrorBox error={games.error} onRetry={games.refresh} />}
        {!games.data && !games.error && <Loading />}
        {games.data && games.data.length === 0 && <Empty>Aucune game enregistrée sur les 12 derniers mois.</Empty>}
        {games.data && games.data.length > 0 && <Stats games={games.data} />}
        {info.data && (info.data.twitter || info.data.stream) && (
          <p className="footnote">
            {info.data.twitter && (
              <a className="link-btn" href={info.data.twitter} target="_blank" rel="noreferrer">
                Twitter
              </a>
            )}{' '}
            {info.data.stream && (
              <a className="link-btn" href={info.data.stream} target="_blank" rel="noreferrer">
                Stream
              </a>
            )}
          </p>
        )}
      </div>
    </>
  )
}

function Stats({ games }: { games: PlayerGame[] }) {
  const sum = useMemo(() => {
    const t = { g: games.length, k: 0, d: 0, a: 0, cs: 0, dmg: 0, w: 0 }
    for (const x of games) {
      t.k += x.kills
      t.d += x.deaths
      t.a += x.assists
      t.cs += x.cs
      t.dmg += x.damage
      if (x.win) t.w++
    }
    return t
  }, [games])

  const pool = useMemo(() => {
    const m = new Map<string, { champion: string; g: number; w: number; k: number; d: number; a: number }>()
    for (const x of games) {
      const c = m.get(x.champion) ?? { champion: x.champion, g: 0, w: 0, k: 0, d: 0, a: 0 }
      c.g++
      if (x.win) c.w++
      c.k += x.kills
      c.d += x.deaths
      c.a += x.assists
      m.set(x.champion, c)
    }
    return [...m.values()].sort((a, b) => b.g - a.g).slice(0, 8)
  }, [games])

  return (
    <>
      <section className="card">
        <h3 className="card-title">12 derniers mois · {sum.g} games</h3>
        <div className="stat-tiles">
          <div>
            <strong>{fixed(kdaNum(sum.k, sum.d, sum.a))}</strong>
            <span className="muted">KDA</span>
          </div>
          <div>
            <strong>{pct(sum.w, sum.g)}</strong>
            <span className="muted">victoires</span>
          </div>
          <div>
            <strong>
              {fixed(sum.k / sum.g)}/{fixed(sum.d / sum.g)}/{fixed(sum.a / sum.g)}
            </strong>
            <span className="muted">K/D/A moyen</span>
          </div>
          <div>
            <strong>{fixed(sum.cs / sum.g, 0)}</strong>
            <span className="muted">CS par game</span>
          </div>
          <div>
            <strong>{kilo(sum.dmg / sum.g)}</strong>
            <span className="muted">dégâts par game</span>
          </div>
        </div>
      </section>

      <section className="card flush">
        <h3 className="card-title">Champions les plus joués</h3>
        <ul className="pool">
          {pool.map((c) => (
            <li key={c.champion}>
              <ChampIcon champion={c.champion} size={36} />
              <span className="pool-main">
                <strong>{c.champion}</strong>
                <span className="muted">{c.g} game{c.g > 1 ? 's' : ''} · {pct(c.w, c.g)} de victoires</span>
              </span>
              <span className="pool-kda">{kda(c.k, c.d, c.a)} KDA</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card flush">
        <h3 className="card-title">Dernières games</h3>
        <ul className="sched-list">
          {games.slice(0, 15).map((x) => (
            <li key={x.gameId}>
              <a href={href.match(x.matchId)} className="sched-row">
                <span className="sched-date">{shortDate(x.date)}</span>
                <span className="sched-opp">
                  <ChampIcon champion={x.champion} size={26} />
                  <span>
                    {x.champion}
                    <small className="muted"> vs {teamOf(x.opponent).code}</small>
                  </span>
                </span>
                <span className="sched-result">
                  <span className={`wl ${x.win ? 'w' : 'l'}`}>{x.win ? 'V' : 'D'}</span>
                  {x.kills}/{x.deaths}/{x.assists}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
