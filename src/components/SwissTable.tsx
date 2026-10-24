import { Fragment } from 'react'
import type { Swiss } from '../api/swiss'
import { SWISS_WINS } from '../api/swiss'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'
import { TeamLogo } from './ui'

/** Phase suisse : une ligne par équipe, une case par tour (V/D contre qui), bilan et statut. */
export function SwissTable({ swiss }: { swiss: Swiss }) {
  const { has } = useFavorites()
  const groups = [
    { key: 'qualified', title: `Qualifiées (${SWISS_WINS} victoires)` },
    { key: 'alive', title: 'En course' },
    { key: 'eliminated', title: `Éliminées (${SWISS_WINS} défaites)` },
  ] as const
  return (
    <div className="swiss">
      {groups.map((g) => {
        const rows = swiss.rows.filter((r) => r.status === g.key)
        if (!rows.length) return null
        return (
          <section key={g.key} className={`card flush swiss-group ${g.key}`}>
            <h3 className="card-title">
              {g.title} <span className="muted">· {rows.length}</span>
            </h3>
            <div className="table-scroll">
              <table className="standings swiss-table">
                <thead>
                  <tr>
                    <th scope="col" className="left">Équipe</th>
                    <th scope="col">Bilan</th>
                    {swiss.rounds.map((r) => (
                      <th key={r} scope="col">
                        {r.replace('Round ', 'T')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, n) => (
                    <Fragment key={r.team.id}>
                      {(n === 0 || rows[n - 1].wins !== r.wins || rows[n - 1].losses !== r.losses) && (
                        <tr className="sw-record">
                          <th colSpan={2 + swiss.rounds.length} scope="colgroup">
                            Bilan {r.wins}–{r.losses}
                          </th>
                        </tr>
                      )}
                    <tr className={has(r.team.id) ? 'fav' : ''}>
                      <th scope="row" className="left">
                        <a href={href.team(r.team.id)} className="st-team">
                          <TeamLogo team={r.team} size={22} />
                          <span>{r.team.code}</span>
                        </a>
                      </th>
                      <td className="strong">
                        {r.wins}–{r.losses}
                      </td>
                      {r.cells.map((c, i) => (
                        <td key={i} className="sw-cell">
                          {c ? (
                            <a href={href.match(c.id)} className={`sw ${c.win === undefined ? 'next' : c.win ? 'w' : 'l'}`} title={`${c.opponent.name}${c.score ? ` · ${c.score}` : ''} · BO${c.bestOf}`}>
                              <strong>{c.win === undefined ? 'vs' : c.win ? 'V' : 'D'}</strong>
                              <small>{c.opponent.code}</small>
                            </a>
                          ) : (
                            <span className="muted">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
      <p className="footnote">
        T1 à T{swiss.rounds.length} : tours de la phase suisse (V/D contre l’adversaire indiqué, « vs » : à venir). Chaque équipe
        joue une série par tour ; {SWISS_WINS} victoires qualifient pour les quarts de finale, {SWISS_WINS} défaites éliminent. À
        bilan égal, l’ordre est celui du classement officiel.
      </p>
    </div>
  )
}
