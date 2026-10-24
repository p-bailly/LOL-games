import { useState } from 'react'
import { fetchStandings, fetchTournamentRounds } from '../api/stats'
import { leagueByKey } from '../api/leagues'
import type { StandingRow } from '../api/types'
import { TournamentPicker, useTournamentPicker } from '../components/TournamentPicker'
import { Empty, ErrorBox, Loading, PageHeader, Segmented, TeamLogo } from '../components/ui'
import { usePolling } from '../hooks/usePolling'
import { shortDate, timeOf } from '../lib/format'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'

type View = 'table' | 'rounds'

export function StandingsPage({ active }: { active: boolean }) {
  const picker = useTournamentPicker(active)
  const { tournament } = picker
  const [view, setView] = useState<View | undefined>()

  const standings = usePolling((s) => (tournament ? fetchStandings(tournament.page, s) : Promise.resolve([] as StandingRow[])), [tournament?.page], 5 * 60_000, active && !!tournament)
  const rounds = usePolling((s) => (tournament ? fetchTournamentRounds(tournament.page, s) : Promise.resolve([])), [tournament?.page], 5 * 60_000, active && !!tournament)

  const rows = standings.data ?? []
  // Sans classement (playoffs, phases à élimination), on montre les séries tour par tour.
  const shown: View = view ?? (standings.data && rows.length === 0 ? 'rounds' : 'table')
  const league = leagueByKey(picker.league)

  return (
    <>
      <PageHeader title="Classement" subtitle={tournament?.name ?? league?.full ?? ' '} />
      <TournamentPicker picker={picker} />
      <div className="toolbar">
        <Segmented<View>
          value={shown}
          onChange={setView}
          options={[
            { value: 'table', label: 'Classement' },
            { value: 'rounds', label: 'Séries par tour' },
          ]}
        />
      </div>
      <div className="content">
        {picker.error && !picker.loaded && <ErrorBox error={picker.error} onRetry={picker.refresh} />}
        {!picker.loaded && !picker.error && <Loading />}
        {picker.loaded && !tournament && <Empty>Aucun tournoi récent pour cette ligue.</Empty>}
        {tournament && shown === 'table' && (
          <>
            {standings.error && !standings.data && <ErrorBox error={standings.error} onRetry={standings.refresh} />}
            {!standings.data && !standings.error && <Loading />}
            {standings.data && rows.length === 0 && <Empty>Pas de classement pour ce tournoi (phase à élimination directe).</Empty>}
            {rows.length > 0 && <Table rows={rows} />}
          </>
        )}
        {tournament && shown === 'rounds' && (
          <>
            {rounds.error && !rounds.data && <ErrorBox error={rounds.error} onRetry={rounds.refresh} />}
            {!rounds.data && !rounds.error && <Loading />}
            {rounds.data?.length === 0 && <Empty>Aucune série programmée.</Empty>}
            {rounds.data?.map((r) => (
              <section key={r.name} className="card flush">
                <h3 className="card-title">{r.name}</h3>
                <ul className="sched-list">
                  {r.matches.map((m) => {
                    const done = m.winner === 1 || m.winner === 2
                    return (
                      <li key={m.id}>
                        <a className="round-row" href={href.match(m.id)}>
                          <span className="sched-date">{done ? shortDate(m.date) : `${shortDate(m.date)} ${timeOf(m.date)}`}</span>
                          <span className={`rr-team ${done && m.winner !== 1 ? 'lost' : ''}`}>
                            <TeamLogo team={m.a} size={20} />
                            {m.a.code}
                          </span>
                          <span className="rr-score">{done ? `${m.scoreA ?? 0} – ${m.scoreB ?? 0}` : `BO${m.bestOf}`}</span>
                          <span className={`rr-team right ${done && m.winner !== 2 ? 'lost' : ''}`}>
                            {m.b.code}
                            <TeamLogo team={m.b} size={20} />
                          </span>
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
        {tournament && shown === 'table' && rows.length > 0 && (
          <p className="footnote">V–D : séries gagnées et perdues · Games : manches gagnées et perdues · Série : V = victoires, D = défaites de suite</p>
        )}
      </div>
    </>
  )
}

function Table({ rows }: { rows: StandingRow[] }) {
  const { has } = useFavorites()
  return (
    <div className="card flush">
      <div className="table-scroll">
        <table className="standings">
          <thead>
            <tr>
              <th scope="col" className="left">Équipe</th>
              <th scope="col">V</th>
              <th scope="col">D</th>
              <th scope="col">Games</th>
              <th scope="col">Série</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.team.id} className={has(r.team.id) ? 'fav' : ''}>
                <th scope="row" className="left">
                  <a href={href.team(r.team.id)} className="st-team">
                    <span className="st-rank">{r.place}</span>
                    <TeamLogo team={r.team} size={22} />
                    <span className="st-abbr">{r.team.code}</span>
                    <span className="st-name">{r.team.name}</span>
                  </a>
                </th>
                <td className="strong">{r.winSeries}</td>
                <td>{r.lossSeries}</td>
                <td>
                  {r.winGames}–{r.lossGames}
                </td>
                <td className={r.streak.startsWith('V') ? 'pos' : r.streak.startsWith('D') ? 'neg' : ''}>{r.streak || '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
