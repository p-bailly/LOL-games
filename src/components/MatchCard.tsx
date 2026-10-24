import { useEffect, useRef, useState } from 'react'
import type { Match, Side } from '../api/types'
import { bestOfLabel, isDecider, statusLabel } from '../lib/format'
import { href } from '../lib/router'
import { LiveBadge, TeamLogo } from './ui'

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

function TeamRow({ side, n, match, fav }: { side: Side; n: 1 | 2; match: Match; fav: boolean }) {
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
      </div>
      {showScore && <span className={`gc-score ${flash ? 'flash' : ''}`}>{side.score}</span>}
    </div>
  )
}

export function MatchCard({ match, favorites }: { match: Match; favorites: string[] }) {
  const live = match.state === 'in'
  const decider = isDecider(match)
  const isFav = (s: Side) => favorites.includes(s.team.id)

  return (
    <a className={`game-card ${live ? 'live' : ''} ${decider ? 'clutch' : ''}`} href={href.match(match.id)}>
      <div className="gc-main">
        <div className="gc-teams">
          <TeamRow side={match.a} n={1} match={match} fav={isFav(match.a)} />
          <TeamRow side={match.b} n={2} match={match} fav={isFav(match.b)} />
        </div>
        <div className="gc-status">
          {live && !match.estimated && <LiveBadge label={decider ? 'DÉCISIVE' : 'LIVE'} />}
          <span className={`gc-status-text ${live ? 'is-live' : ''}`}>{statusLabel(match)}</span>
          <span className="gc-tv">{bestOfLabel(match)}</span>
        </div>
      </div>
      <div className="gc-foot">
        <span className="gc-league">
          <strong>{match.leagueName}</strong>
          {match.round && <span className="muted"> · {match.round}</span>}
        </span>
      </div>
    </a>
  )
}
