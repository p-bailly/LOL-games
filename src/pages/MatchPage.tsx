import { useEffect, useState } from 'react'
import { fetchMatchDetail } from '../api/leaguepedia'
import { applyLive } from '../api/live'
import { fetchRatings, ratingOf, winChance } from '../api/ratings'
import type { FormEntry, Game, Match, MatchDetail, Side } from '../api/types'
import { Draft, Scoreboard, TeamCompare } from '../components/GameViews'
import { LivePanel } from '../components/LivePanel'
import { Chips, Empty, EloDelta, ErrorBox, LiveBadge, Loading, PageHeader, Segmented, TeamLogo, UpdatedAt } from '../components/ui'
import { useElo } from '../hooks/useElo'
import { usePolling } from '../hooks/usePolling'
import { bestOfLabel, isDecider, shortDate, statusLabel, timeOf } from '../lib/format'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'

type Tab = 'draft' | 'players' | 'teams'

export function MatchPage({ id }: { id: string }) {
  const { data, error, updatedAt, loading, refresh } = usePolling(
    async (signal) => {
      const d = await fetchMatchDetail(id, signal)
      const [match] = await applyLive([d.match], signal)
      return { ...d, match }
    },
    [id],
    (d) => {
      if (d.match.state === 'in') return d.match.estimated ? 45_000 : 20_000
      // Série terminée mais résultats pas encore publiés par Leaguepedia : on réessaie un moment.
      const recent = Date.now() - new Date(d.match.date).getTime() < 4 * 3_600_000
      if (d.match.state === 'post' && recent && d.games.length < Math.max(1, (d.match.a.score ?? 0) + (d.match.b.score ?? 0))) return 60_000
      return d.match.state === 'pre' ? 120_000 : null
    },
  )

  if (!data) {
    return (
      <>
        <PageHeader back title="Match" />
        <div className="content">{error ? <ErrorBox error={error} onRetry={refresh} /> : <Loading />}</div>
      </>
    )
  }

  const { match } = data
  return (
    <>
      <PageHeader back title={`${match.a.team.code} – ${match.b.team.code}`} subtitle={<UpdatedAt at={updatedAt} loading={loading} />} />
      <SeriesHeader match={match} />
      <div className="content">
        {match.live && <LivePanel match={match} />}
        {data.games.length > 0 ? (
          <Games detail={data} />
        ) : match.state === 'pre' ? (
          <PreMatch detail={data} />
        ) : (
          !match.live && <Empty>Les statistiques détaillées arrivent quelques minutes après la fin de chaque game.</Empty>
        )}
      </div>
    </>
  )
}

function SideCol({ side, n, match }: { side: Side; n: 1 | 2; match: Match }) {
  const { has } = useFavorites()
  const lost = match.state === 'post' && match.winner !== undefined && match.winner !== n
  return (
    <a className={`sb-team ${lost ? 'loser' : ''}`} href={href.team(side.team.id)}>
      <TeamLogo team={side.team} size={56} />
      <span className="sb-name">
        {side.team.name}
        {has(side.team.id) && <span className="fav-mark">★</span>}
      </span>
    </a>
  )
}

function SeriesHeader({ match }: { match: Match }) {
  const elo = useElo()
  const change = match.state === 'post' ? elo?.recent.get(match.id) : undefined
  const live = match.state === 'in'
  const showScore = match.state !== 'pre'
  return (
    <section className={`scoreboard ${live ? 'live' : ''}`}>
      <div className="sb-main">
        <SideCol side={match.a} n={1} match={match} />
        <div className="sb-center">
          {live && !match.estimated && <LiveBadge label={isDecider(match) ? 'DÉCISIVE' : 'LIVE'} />}
          {showScore ? (
            <span className="sb-series">
              {match.a.score ?? 0} <span className="muted">–</span> {match.b.score ?? 0}
            </span>
          ) : (
            <>
              <span className="sb-date">{shortDate(match.date)}</span>
              <span className="sb-time">{timeOf(match.date)}</span>
            </>
          )}
          <span className={`sb-status ${live ? 'is-live' : ''}`}>{showScore ? statusLabel(match) : bestOfLabel(match)}</span>
          <span className="sb-note">
            {match.leagueName}
            {match.round ? ` · ${match.round}` : ''} · {bestOfLabel(match)}
          </span>
        </div>
        <SideCol side={match.b} n={2} match={match} />
      </div>
      {change && (
        <div className="sb-elo">
          <span>
            {match.a.team.code} <EloDelta value={change[0]} />
          </span>
          <span className="muted">variation d’Elo</span>
          <span>
            <EloDelta value={change[1]} /> {match.b.team.code}
          </span>
        </div>
      )}
      {match.state !== 'post' && match.a.team.id !== 'TBD' && match.b.team.id !== 'TBD' && <WinChance match={match} />}
      {match.stream && match.state !== 'post' && (
        <a className="sb-stream" href={match.stream} target="_blank" rel="noreferrer">
          {live ? 'Regarder en direct' : 'Lien de la retransmission'}
        </a>
      )}
    </section>
  )
}

function Games({ detail }: { detail: MatchDetail }) {
  const { games, match } = detail
  const [num, setNum] = useState<number>()
  const [tab, setTab] = useState<Tab>('draft')
  // Par défaut la dernière game publiée ; si une nouvelle game arrive, on la suit tant qu'on n'a rien choisi.
  const current = games.find((g) => g.number === num) ?? games[games.length - 1]
  useEffect(() => setNum(undefined), [match.id])

  const winnerOf = (g: Game) => (g.blue.win ? g.blue : g.red.win ? g.red : undefined)
  return (
    <>
      <Chips
        value={String(current.number)}
        onChange={(v) => setNum(Number(v))}
        options={games.map((g) => ({ value: String(g.number), label: `Game ${g.number}` }))}
      />
      <section className="card game-summary">
        <div className="gs-line">
          <strong>Game {current.number}</strong>
          <span className="muted">
            {current.length} · {winnerOf(current) ? `victoire ${winnerOf(current)!.team.code}` : 'résultat à venir'}
          </span>
          {current.vod && (
            <a className="link-btn" href={current.vod} target="_blank" rel="noreferrer">
              Replay
            </a>
          )}
        </div>
        <div className="gs-score">
          <span className="blue">{current.blue.team.code} {current.blue.kills}</span>
          <span className="muted">kills</span>
          <span className="red">{current.red.kills} {current.red.team.code}</span>
        </div>
      </section>
      <div className="toolbar">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'players', label: 'Joueurs' },
            { value: 'teams', label: 'Équipes' },
          ]}
        />
      </div>
      {tab === 'draft' && <Draft game={current} />}
      {tab === 'players' && (current.blue.players.length ? <Scoreboard game={current} /> : <Empty>Statistiques des joueurs indisponibles.</Empty>)}
      {tab === 'teams' && <TeamCompare game={current} />}
    </>
  )
}

function FormList({ title, entries }: { title: string; entries: FormEntry[] }) {
  if (!entries.length) return null
  return (
    <section className="card flush">
      <h3 className="card-title">{title}</h3>
      <ul className="sched-list">
        {entries.map((e) => (
          <li key={e.id}>
            <a href={href.match(e.id)} className="sched-row">
              <span className="sched-date">{shortDate(e.date)}</span>
              <span className="sched-opp">
                <span className="muted">vs</span>
                <TeamLogo team={e.opponent} size={22} />
                {e.opponent.name}
              </span>
              <span className="sched-result">
                <span className={`wl ${e.win ? 'w' : 'l'}`}>{e.win ? 'V' : 'D'}</span>
                {e.score}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PreMatch({ detail }: { detail: MatchDetail }) {
  const { match, form } = detail
  if (!form) return <Empty>La draft et les statistiques seront disponibles pendant et après la série.</Empty>
  return (
    <>
      <FormList title={`Forme · ${match.a.team.name}`} entries={form.a} />
      <FormList title={`Forme · ${match.b.team.name}`} entries={form.b} />
      <FormList title={`Face-à-face · ${match.a.team.code} contre ${match.b.team.code}`} entries={form.h2h} />
      {!form.a.length && !form.b.length && <Empty>Aucun résultat récent pour ces équipes.</Empty>}
    </>
  )
}

/** Chances de gagner la série d'après la force des équipes (classement de type Elo), avant le début ou pendant la série. */
function WinChance({ match }: { match: Match }) {
  const { data } = usePolling(() => fetchRatings(), [], null)
  if (!data) return null
  const need = Math.floor(match.bestOf / 2) + 1
  const sa = match.state === 'in' ? match.a.score ?? 0 : 0
  const sb = match.state === 'in' ? match.b.score ?? 0 : 0
  const pa = winChance(ratingOf(data, match.a.team.id), ratingOf(data, match.b.team.id), match.bestOf, Math.min(sa, need), Math.min(sb, need))
  const pct = Math.round(pa * 100)
  return (
    <div className="chance" aria-label={`Chances de gagner : ${match.a.team.code} ${pct} %, ${match.b.team.code} ${100 - pct} %`}>
      <div className="chance-top">
        <strong>{match.a.team.code} {pct} %</strong>
        <span className="muted">chances de gagner</span>
        <strong>{100 - pct} % {match.b.team.code}</strong>
      </div>
      <div className="sc-bar">
        <span className="blue" style={{ flexGrow: pa || 0.001 }} />
        <span className="red" style={{ flexGrow: 1 - pa || 0.001 }} />
      </div>
    </div>
  )
}
