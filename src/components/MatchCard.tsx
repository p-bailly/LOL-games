import { useEffect, useRef, useState } from 'react'
import type { Elo } from '../api/elo'
import { ratingOf, winChance } from '../api/ratings'
import type { Match, Side } from '../api/types'
import { useElo } from '../hooks/useElo'
import { bestOfLabel, isDecider, statusLabel } from '../lib/format'
import { href } from '../lib/router'
import { EloDelta, LiveBadge, TeamLogo } from './ui'

/** Vrai pendant un court instant quand la valeur change (ex. game gagnée). */
function useFlash(value: unknown): boolean {
  const prev = useRef(value)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (prev.current !== value && prev.current != null) {
      setFlash(true)
      const t = window.setTimeout(() => setFlash(false), 1600)
      prev.current = value
      return () => window.clearTimeout(t)
    }
    prev.current = value
  }, [value])
  return flash
}

function TeamRow({ side, n, match, fav, elo, chance, change }: { side: Side; n: 1 | 2; match: Match; fav: boolean; elo?: number; chance?: number; change?: number }) {
  const flash = useFlash(side.score)
  const showScore = match.state !== 'pre' && side.score != null
  const lost = match.state === 'post' && match.winner !== undefined && match.winner !== n
  return (
    <div className={`gc-row ${lost ? 'loser' : ''}`}>
      <TeamLogo team={side.team} size={30} />
      <div className="gc-name">
        <span className="gc-team">
          {side.team.name}
          {fav && <span className="fav-mark" aria-label="Favori">★</span>}
        </span>
        {change !== undefined ? (
          <span className="gc-record">
            Elo <EloDelta value={change} />
          </span>
        ) : (
          elo !== undefined && <span className="gc-record" title="Note Elo">Elo {Math.round(elo)}</span>
        )}
      </div>
      {chance !== undefined && <span className={`gc-prob ${chance >= 0.5 ? 'fav' : ''}`} title="Chances de gagner la série d'après l'Elo">{Math.round(chance * 100)} %</span>}
      {showScore && <span className={`gc-score ${flash ? 'flash' : ''}`}>{side.score}</span>}
    </div>
  )
}

export function MatchCard({ match, favorites }: { match: Match; favorites: string[] }) {
  const live = match.state === 'in'
  const decider = isDecider(match)
  const isFav = (s: Side) => favorites.includes(s.team.id)
  const elo = useElo()
  const odds = chances(match, elo)
  const change = match.state === 'post' ? elo?.recent.get(match.id) : undefined

  return (
    <a className={`game-card ${live ? 'live' : ''} ${decider ? 'clutch' : ''}`} href={href.match(match.id)}>
      <div className="gc-main">
        <div className="gc-teams">
          <TeamRow side={match.a} n={1} match={match} fav={isFav(match.a)} elo={odds?.ra} chance={odds?.pa} change={change?.[0]} />
          <TeamRow side={match.b} n={2} match={match} fav={isFav(match.b)} elo={odds?.rb} chance={odds ? 1 - odds.pa : undefined} change={change?.[1]} />
        </div>
        <div className="gc-status">
          {live && !match.estimated && <LiveBadge label={decider ? 'DÉCISIVE' : 'LIVE'} />}
          <span className={`gc-status-text ${live ? 'is-live' : ''}`}>{statusLabel(match)}</span>
          <span className="gc-tv">{bestOfLabel(match)}</span>
        </div>
      </div>
      {odds && (
        <div className="gc-chance" aria-hidden="true">
          <span className="blue" style={{ flexGrow: odds.pa || 0.001 }} />
          <span className="red" style={{ flexGrow: 1 - odds.pa || 0.001 }} />
        </div>
      )}
      <div className="gc-foot">
        <span className="gc-league">
          <strong>{match.leagueName}</strong>
          {match.round && <span className="muted"> · {match.round}</span>}
        </span>
      </div>
    </a>
  )
}

/** Notes Elo et chances de gagner la série, pour une série à venir ou en cours (rien si une équipe est inconnue). */
function chances(m: Match, elo?: Elo): { ra: number; rb: number; pa: number } | undefined {
  if (!elo || m.state === 'post' || m.a.team.id === 'TBD' || m.b.team.id === 'TBD') return undefined
  const ra = elo.ratings[m.a.team.id]
  const rb = elo.ratings[m.b.team.id]
  if (ra === undefined && rb === undefined) return undefined
  const need = Math.floor(m.bestOf / 2) + 1
  const sa = m.state === 'in' ? Math.min(m.a.score ?? 0, need) : 0
  const sb = m.state === 'in' ? Math.min(m.b.score ?? 0, need) : 0
  const r = { ra: ratingOf(elo.ratings, m.a.team.id), rb: ratingOf(elo.ratings, m.b.team.id) }
  return { ...r, pa: winChance(r.ra, r.rb, m.bestOf, sa, sb) }
}
