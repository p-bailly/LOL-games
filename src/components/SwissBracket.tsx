import { useEffect, useRef } from 'react'
import type { BracketBox, BracketMatch, BracketResult, Swiss } from '../api/swiss'
import { timeOf } from '../lib/format'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'
import { TeamLogo } from './ui'

function Row({ m, favs }: { m: BracketMatch; favs: string[] }) {
  if (m.a && !m.b) {
    // Équipe déjà qualifiée pour ce bilan, adversaire pas encore connu.
    return (
      <div className="bm tbd waiting">
        <span className={`bm-team ${favs.includes(m.a.id) ? 'fav' : ''}`}>
          <b>{m.a.code}</b>
          <TeamLogo team={m.a} size={22} />
        </span>
        <span className="bm-mid" />
        <span className="bm-team right">TBD</span>
      </div>
    )
  }
  if (!m.a || !m.b) {
    // Tirage pas encore fait : pas de « vs ».
    return (
      <div className="bm tbd">
        <span className="bm-team">TBD</span>
        <span className="bm-mid" />
        <span className="bm-team right">TBD</span>
      </div>
    )
  }
  const done = m.winner === 1 || m.winner === 2
  return (
    <a className={`bm ${m.live ? 'live' : ''}`} href={href.match(m.id!)}>
      <span className={`bm-team ${done && m.winner !== 1 ? 'lost' : ''} ${favs.includes(m.a.id) ? 'fav' : ''}`}>
        <b>{m.a.code}</b>
        <TeamLogo team={m.a} size={22} />
      </span>
      <span className="bm-mid">
        {done ? (
          <strong>
            {m.scoreA ?? 0}–{m.scoreB ?? 0}
          </strong>
        ) : m.live ? (
          <span className="bm-live">LIVE</span>
        ) : (
          <>
            vs<small>{m.date ? timeOf(m.date) : ''}</small>
          </>
        )}
      </span>
      <span className={`bm-team right ${done && m.winner !== 2 ? 'lost' : ''} ${favs.includes(m.b.id) ? 'fav' : ''}`}>
        <TeamLogo team={m.b} size={22} />
        <b>{m.b.code}</b>
      </span>
    </a>
  )
}

function Box({ box, favs }: { box: BracketBox; favs: string[] }) {
  return (
    <section className="bbox">
      <h4>
        {box.wins}-{box.losses}
      </h4>
      <div className="bbox-body">
        {box.matches.map((m, i) => (
          <Row key={m.id ?? m.a?.id ?? `tbd${i}`} m={m} favs={favs} />
        ))}
      </div>
      <footer>BO{box.bestOf}</footer>
    </section>
  )
}

function Result({ box, favs }: { box: BracketResult; favs: string[] }) {
  return (
    <section className={`bbox result ${box.qualified ? 'qualified' : 'eliminated'}`}>
      <h4>
        {box.wins}-{box.losses}
      </h4>
      <div className="bbox-body">
        {box.teams.map((t, i) =>
          t ? (
            <a key={t.id} className={`br-team ${favs.includes(t.id) ? 'fav' : ''}`} href={href.team(t.id)}>
              <TeamLogo team={t} size={22} />
              <b>{t.code}</b>
              <span>{t.name}</span>
            </a>
          ) : (
            <div key={`tbd${i}`} className="br-team tbd">
              TBD
            </div>
          ),
        )}
      </div>
      <footer>{box.qualified ? 'Qualifiées' : 'Éliminées'}</footer>
    </section>
  )
}

/** Bracket de la phase suisse : une colonne par tour, une boîte par bilan, comme sur l'affiche officielle. */
export function SwissBracket({ swiss }: { swiss: Swiss }) {
  const { ids: favs } = useFavorites()
  const scroller = useRef<HTMLDivElement>(null)
  // On ouvre sur le tour en cours : le premier avec une série connue et pas encore terminée.
  const current = Math.max(
    0,
    swiss.bracket.findIndex((c) => c.boxes.some((b) => b.matches.some((m) => m.a && m.winner === undefined))),
  )
  useEffect(() => {
    const el = scroller.current?.children[current] as HTMLElement | undefined
    if (el && scroller.current) scroller.current.scrollLeft = Math.max(0, el.offsetLeft - 12)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  return (
    <div className="bracket-wrap">
      <div className="bracket" ref={scroller}>
        {swiss.bracket.map((col, i) => (
          <div key={col.round} className={`bcol ${i === current ? 'current' : ''}`}>
            <h3>{col.round}</h3>
            {col.qualified && <Result box={col.qualified} favs={favs} />}
            {col.boxes.map((b) => (
              <Box key={`${b.wins}-${b.losses}`} box={b} favs={favs} />
            ))}
            {col.eliminated && <Result box={col.eliminated} favs={favs} />}
          </div>
        ))}
      </div>
    </div>
  )
}
