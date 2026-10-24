import { useMemo, useState } from 'react'
import { fetchPlayerElo, ROLE_NAMES } from '../api/eloPlayers'
import { fetchPlayerChampions, fetchPlayerGames, fetchPlayerInfo, type ChampionLine, type PlayerGame } from '../api/stats'
import { ROLE_FR } from '../api/leagues'
import { resolveTeams, teamOf } from '../api/leaguepedia'
import { ChampIcon, Empty, EloDelta, ErrorBox, Loading, PageHeader, Segmented } from '../components/ui'
import { usePlayerElo } from '../hooks/usePlayerElo'
import { EloChart } from '../components/EloChart'
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
  const eloAll = usePolling(() => fetchPlayerElo(), [], null).data
  const elo = eloAll?.byId.get(id)

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
        {eloAll?.history.get(id) && (
          <div className="card">
            <h3 className="card-title">Historique de l'Elo</h3>
            <EloChart points={eloAll.history.get(id)!} />
          </div>
        )}
        {games.data && games.data.length > 0 && <Stats games={games.data} link={id} />}
        {games.data && games.data.length === 0 && <ChampionPool link={id} games={[]} />}
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

function Stats({ games, link }: { games: PlayerGame[]; link: string }) {
  const recent = usePlayerElo()?.recent
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

      <ChampionPool link={link} games={games} />

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
                  <EloDelta value={recent?.get(x.gameId)?.[(x.side - 1) * 5 + (x.slot - 1)]} />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

const LINES = 8

/** Champions joués : sur les 12 derniers mois, ou sur toute la carrière (toutes les games connues de Leaguepedia). */
function ChampionPool({ link, games }: { link: string; games: PlayerGame[] }) {
  const [range, setRange] = useState<'year' | 'career'>(games.length ? 'year' : 'career')
  const [all, setAll] = useState(false)
  const career = usePolling((s) => fetchPlayerChampions(link, s), [link], null, range === 'career')
  const year = useMemo(() => {
    const m = new Map<string, ChampionLine>()
    for (const x of games) {
      const c = m.get(x.champion) ?? { champion: x.champion, g: 0, w: 0, k: 0, d: 0, a: 0 }
      c.g++
      if (x.win) c.w++
      c.k += x.kills
      c.d += x.deaths
      c.a += x.assists
      m.set(x.champion, c)
    }
    return [...m.values()].sort((a, b) => b.g - a.g)
  }, [games])
  const lines = range === 'year' ? year : career.data ?? []
  const shown = all ? lines : lines.slice(0, LINES)
  const total = lines.reduce((n, c) => n + c.g, 0)

  return (
    <section className="card flush">
      <h3 className="card-title">Champions les plus joués</h3>
      <div className="pool-range">
        <Segmented<'year' | 'career'>
          compact
          value={range}
          onChange={(r) => {
            setRange(r)
            setAll(false)
          }}
          options={[
            { value: 'year', label: '12 mois' },
            { value: 'career', label: 'Carrière' },
          ]}
        />
      </div>
      {range === 'career' && !career.data && !career.error && <Loading />}
      {range === 'career' && career.error && !career.data && <ErrorBox error={career.error} onRetry={career.refresh} />}
      {lines.length > 0 && (
        <p className="muted small pool-count">
          {lines.length} champion{lines.length > 1 ? 's' : ''} · {total} game{total > 1 ? 's' : ''}
        </p>
      )}
      <ul className="pool">
        {shown.map((c) => (
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
      {lines.length > LINES && (
        <button className="btn more" onClick={() => setAll(!all)}>
          {all ? 'Réduire' : `Tout afficher (${lines.length})`}
        </button>
      )}
    </section>
  )
}
