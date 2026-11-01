import type { BracketMatch, KnockoutRound } from '../api/swiss'
import { timeOf } from '../lib/format'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'
import { TeamLogo } from './ui'

function Side({ m, side, favs }: { m: BracketMatch; side: 1 | 2; favs: string[] }) {
  const team = side === 1 ? m.a : m.b
  const score = side === 1 ? m.scoreA : m.scoreB
  const done = m.winner === 1 || m.winner === 2
  if (!team) {
    return (
      <div className="po-side tbd">
        <span className="po-dot" />
        <span className="po-name">TBD</span>
      </div>
    )
  }
  return (
    <div className={`po-side ${done && m.winner !== side ? 'lost' : ''} ${favs.includes(team.id) ? 'fav' : ''}`}>
      <TeamLogo team={team} size={24} />
      <span className="po-name">{team.name}</span>
      <span className="po-score">{m.a && m.b && (done || m.live) ? (score ?? 0) : ''}</span>
    </div>
  )
}

function Match({ m, favs }: { m: BracketMatch; favs: string[] }) {
  const body = (
    <>
      <Side m={m} side={1} favs={favs} />
      <Side m={m} side={2} favs={favs} />
      {m.a && m.b && m.winner === undefined && (
        <div className="po-when">{m.live ? <span className="bm-live">LIVE</span> : m.date ? `${new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${timeOf(m.date)}` : ''}</div>
      )}
    </>
  )
  return m.id && m.a && m.b ? (
    <a className={`po-match ${m.live ? 'live' : ''}`} href={href.match(m.id)}>
      {body}
    </a>
  ) : (
    <div className="po-match">{body}</div>
  )
}

/** Phase finale (quarts, demies, finale) en arbre : chaque tour rejoint le suivant par des traits. */
export function PlayoffBracket({ rounds }: { rounds: KnockoutRound[] }) {
  const { ids: favs } = useFavorites()
  const [qf, sf, fin] = rounds
  if (!qf || !sf || !fin) return null
  return (
    <div className="bracket-wrap">
      <div className="po-scroll">
        <div className="po-tree">
          {[qf, sf, fin].map((r, i) => (
            <h3 key={r.label} className="po-head" style={{ gridColumn: 1 + i * 2, gridRow: 1 }}>
              {r.label} <small>BO{r.bestOf}</small>
            </h3>
          ))}
          {qf.matches.map((m, i) => (
            <div key={`q${i}`} className="po-cell" style={{ gridColumn: 1, gridRow: i + 2 }}>
              <Match m={m} favs={favs} />
            </div>
          ))}
          {[0, 1].map((j) => (
            <div key={`j1${j}`} className="po-gap" style={{ gridColumn: 2, gridRow: `${j * 2 + 2} / span 2` }}>
              <i className="po-join" />
            </div>
          ))}
          {sf.matches.map((m, j) => (
            <div key={`s${j}`} className="po-cell" style={{ gridColumn: 3, gridRow: `${j * 2 + 2} / span 2` }}>
              <Match m={m} favs={favs} />
            </div>
          ))}
          <div className="po-gap" style={{ gridColumn: 4, gridRow: '2 / span 4' }}>
            <i className="po-join" />
          </div>
          <div className="po-cell" style={{ gridColumn: 5, gridRow: '2 / span 4' }}>
            <Match m={fin.matches[0] ?? {}} favs={favs} />
          </div>
        </div>
      </div>
    </div>
  )
}
