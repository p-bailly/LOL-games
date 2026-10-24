import { useEffect, useRef, useState } from 'react'
import { fetchLiveGame, type LiveGameView } from '../api/live'
import type { LivePlayer, LiveTeam } from '../api/lolesports'
import type { Match, Team } from '../api/types'
import { usePolling } from '../hooks/usePolling'
import { goldDiff, kda, kilo } from '../lib/format'
import { ChampIcon, LiveBadge, TeamLogo } from './ui'

const DRAGONS: Record<string, string> = {
  ocean: 'Océan',
  infernal: 'Infernal',
  mountain: 'Montagne',
  cloud: 'Nuage',
  hextech: 'Hextech',
  chemtech: 'Chimtech',
  elder: 'Ancestral',
}

function PlayerRows({ team, players }: { team: Team; players: LivePlayer[] }) {
  return (
    <div className="live-team">
      <h4 className="draft-sub">
        <TeamLogo team={team} size={18} /> {team.name}
      </h4>
      <ul className="live-players">
        {players.map((p) => (
          <li key={p.id}>
            <ChampIcon champion={p.champion} size={32} />
            <span className="lp-main">
              <strong>{p.name}</strong>
              <span className="lp-hp" aria-label={`Vie ${p.hp} sur ${p.maxHp}`}>
                <i style={{ width: `${p.maxHp ? Math.min(100, (p.hp / p.maxHp) * 100) : 0}%` }} />
              </span>
            </span>
            <span className="lp-lvl muted">niv. {p.level}</span>
            <span className="lp-kda">
              {p.kills}/{p.deaths}/{p.assists}
              <small className="muted"> {kda(p.kills, p.deaths, p.assists)}</small>
            </span>
            <span className="lp-cs">{p.cs}</span>
            <span className="lp-gold">{kilo(p.gold)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Écart d'or (équipe A − équipe B) relevé depuis l'ouverture de la page. */
function GoldChart({ points, a, b }: { points: { t: number; diff: number }[]; a: Team; b: Team }) {
  if (points.length < 2) return <p className="footnote">La courbe d’or se dessine au fil des relevés (toutes les 10 s).</p>
  const W = 600
  const H = 120
  const max = Math.max(1000, ...points.map((p) => Math.abs(p.diff)))
  const t0 = points[0].t
  const span = Math.max(1, points[points.length - 1].t - t0)
  const x = (t: number) => ((t - t0) / span) * W
  const y = (d: number) => H / 2 - (d / max) * (H / 2 - 6)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.diff).toFixed(1)}`).join('')
  const area = `${line}L${W},${H / 2}L0,${H / 2}Z`
  const last = points[points.length - 1].diff
  return (
    <div className="wp">
      <div className="wp-head">
        <div className="wp-legend">
          <span><i className="key key-blue" />{a.code}</span>
          <span><i className="key key-red" />{b.code}</span>
        </div>
        <div className="wp-readout">
          <strong>
            {last >= 0 ? a.code : b.code} {goldDiff(Math.abs(last))} d’or
          </strong>
        </div>
      </div>
      <div className="wp-plot" role="img" aria-label={`Écart d’or : ${last >= 0 ? a.code : b.code} ${goldDiff(Math.abs(last))}`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <clipPath id="g-top"><rect x="0" y="0" width={W} height={H / 2} /></clipPath>
            <clipPath id="g-bottom"><rect x="0" y={H / 2} width={W} height={H / 2} /></clipPath>
          </defs>
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="wp-mid" />
          <path d={area} className="wp-area home" clipPath="url(#g-top)" />
          <path d={area} className="wp-area away" clipPath="url(#g-bottom)" />
          <path d={line} className="wp-line home" clipPath="url(#g-top)" />
          <path d={line} className="wp-line away" clipPath="url(#g-bottom)" />
        </svg>
      </div>
    </div>
  )
}

function Summary({ t, name }: { t: LiveTeam; name: string }) {
  const dragons = t.dragons.map((d) => DRAGONS[d] ?? d)
  return (
    <div className="live-sum">
      <strong>{name}</strong>
      <span>{t.kills} kills</span>
      <span>{kilo(t.gold)} d’or</span>
      <span>{t.towers} tours</span>
      <span>{t.barons} baron{t.barons > 1 ? 's' : ''}</span>
      <span title={dragons.join(', ')}>{t.dragons.length} dragon{t.dragons.length > 1 ? 's' : ''}</span>
    </div>
  )
}

/** Stats de la game en cours, relevées dans le flux officiel (une clé LoL Esports est nécessaire). */
export function LivePanel({ match }: { match: Match }) {
  const { data, error } = usePolling<LiveGameView | undefined>((s) => fetchLiveGame(match, s), [match.id, match.live?.eventMatchId], 10_000)
  const history = useRef(new Map<string, { t: number; diff: number }[]>())
  const [, bump] = useState(0)

  useEffect(() => {
    if (!data) return
    const { frame, blueIsA } = data
    const pts = history.current.get(frame.gameId) ?? []
    const diff = (frame.blue.gold - frame.red.gold) * (blueIsA ? 1 : -1)
    if (!pts.length || Date.now() - pts[pts.length - 1].t >= 9_000) {
      pts.push({ t: Date.now(), diff })
      history.current.set(frame.gameId, pts)
      bump((n) => n + 1)
    }
  }, [data])

  if (error && !data) return <p className="warn">Direct indisponible : {error.message}</p>
  if (!data) return <p className="muted small">Le flux en direct n’a pas encore d’images pour cette game (délai de 30 à 60 s).</p>

  const { frame, number, blueIsA } = data
  const [ta, tb] = blueIsA ? [match.a.team, match.b.team] : [match.b.team, match.a.team]
  const pts = history.current.get(frame.gameId) ?? []
  return (
    <section className="card live-panel">
      <div className="live-head">
        <LiveBadge />
        <strong>Game {number}</strong>
        {frame.patch && <span className="muted">patch {frame.patch}</span>}
        {frame.state === 'paused' && <span className="warn">En pause</span>}
      </div>
      <Summary t={frame.blue} name={`${ta.code} (bleu)`} />
      <Summary t={frame.red} name={`${tb.code} (rouge)`} />
      <GoldChart points={pts} a={ta} b={tb} />
      <PlayerRows team={ta} players={frame.blue.players} />
      <PlayerRows team={tb} players={frame.red.players} />
      <p className="footnote">Statistiques du flux officiel, avec 30 à 60 s de retard. La courbe d’or part de l’ouverture de la page.</p>
    </section>
  )
}
