import { useMemo, type ReactNode } from 'react'
import { fetchRatings } from '../api/ratings'
import { fetchTournamentRounds } from '../api/stats'
import { Empty, ErrorBox, Loading, TeamLogo } from './ui'
import { usePolling } from '../hooks/usePolling'
import { projectEvent, projectLeague, SIMS, type EventProjection, type LeagueProjection } from '../lib/projection'
import { fixed } from '../lib/format'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'

/** Pourcentage lisible : « < 1 % » plutôt que 0 quand c'est possible, « – » quand c'est impossible. */
function pct(p: number): string {
  if (p <= 0) return '–'
  if (p < 0.005) return '< 1'
  if (p > 0.995) return '100'
  return String(Math.round(p * 100))
}

/** Teinte d'une case : plus la probabilité est forte, plus elle est foncée (une seule couleur). */
const heat = (p: number) => ({ background: `color-mix(in srgb, var(--heat) ${Math.round(Math.min(1, p) * 70)}%, transparent)` })

type Result = { kind: 'league'; data: LeagueProjection } | { kind: 'event'; data: EventProjection } | { kind: 'none' }

async function load(page: string, signal: AbortSignal): Promise<Result> {
  const [rounds, ratings] = await Promise.all([fetchTournamentRounds(page, signal), fetchRatings()])
  // La simulation tourne après avoir rendu la main à l'écran (quelques centaines de ms).
  await new Promise((r) => setTimeout(r, 30))
  const event = projectEvent(rounds, ratings)
  if (event) return { kind: 'event', data: event }
  const league = projectLeague(rounds, ratings)
  return league ? { kind: 'league', data: league } : { kind: 'none' }
}

export function Projection({ page, active }: { page: string; active: boolean }) {
  const { data, error, refresh } = usePolling((s) => load(page, s), [page], 10 * 60_000, active)
  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (!data) return <Loading label="Simulation du tournoi…" />
  if (data.kind === 'none') return <Empty>Pas de projection pour cette phase : il n’y a plus de série à jouer, ou le format n’est pas géré (playoffs à élimination directe).</Empty>
  return data.kind === 'event' ? <EventTable p={data.data} /> : <LeagueTable p={data.data} />
}

function EventTable({ p }: { p: EventProjection }) {
  const { has } = useFavorites()
  return (
    <>
      <div className="card flush">
        <div className="table-scroll">
          <table className="standings proj-table">
            <thead>
              <tr>
                <th scope="col" className="left">Équipe</th>
                <th scope="col">Bilan</th>
                <th scope="col">Quarts</th>
                <th scope="col">Demies</th>
                <th scope="col">Finale</th>
                <th scope="col">Titre</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.team.id} className={has(r.team.id) ? 'fav' : ''}>
                  <th scope="row" className="left">
                    <a href={href.team(r.team.id)} className="st-team">
                      <TeamLogo team={r.team} size={22} />
                      <span>{r.team.code}</span>
                    </a>
                  </th>
                  <td>
                    {r.wins}–{r.losses}
                  </td>
                  {[r.qualify, r.semis, r.final, r.title].map((v, i) => (
                    <td key={i} className="pc" style={heat(v)}>
                      {pct(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Notes sims={SIMS}>
        Chances (en %) d’atteindre les quarts de finale (qualification de la phase suisse), les demies, la finale et de gagner le titre.
        Les séries déjà jouées ou programmées sont reprises ; les affiches inconnues sont tirées au hasard entre équipes de même bilan.
        Si les quarts ne sont pas connus, ils sont tirés ainsi : meilleur bilan contre moins bon.
      </Notes>
    </>
  )
}

function LeagueTable({ p }: { p: LeagueProjection }) {
  const { has } = useFavorites()
  const n = p.rows.length
  const places = useMemo(() => Array.from({ length: n }, (_, i) => i + 1), [n])
  return (
    <>
      <div className="card flush">
        <div className="table-scroll">
          <table className="standings proj-table places">
            <thead>
              <tr>
                <th scope="col" className="left">Équipe</th>
                <th scope="col">Bilan</th>
                {places.map((k) => (
                  <th key={k} scope="col">{k}</th>
                ))}
                <th scope="col">Moy.</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.team.id} className={has(r.team.id) ? 'fav' : ''}>
                  <th scope="row" className="left">
                    <a href={href.team(r.team.id)} className="st-team">
                      <TeamLogo team={r.team} size={22} />
                      <span>{r.team.code}</span>
                    </a>
                  </th>
                  <td>
                    {r.wins}–{r.losses}
                  </td>
                  {r.places.map((v, i) => (
                    <td key={i} className="pc" style={heat(v)}>
                      {pct(v)}
                    </td>
                  ))}
                  <td className="strong">{fixed(r.avgPlace)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Notes sims={SIMS}>
        Chances (en %) de finir à chaque place du classement, sur {p.remaining} série{p.remaining > 1 ? 's' : ''} restante{p.remaining > 1 ? 's' : ''}. Classement : victoires en
        séries, puis différence de games ; les égalités sont tirées au sort (les confrontations directes ne sont pas prises en compte).
      </Notes>
    </>
  )
}

function Notes({ sims, children }: { sims: number; children: ReactNode }) {
  return (
    <p className="footnote">
      {children} Simulation de {sims.toLocaleString('fr-FR')} tournois. Force des équipes : Elo mondial (onglet Classement), calculé sur toutes les séries depuis 2011 : c’est une estimation, pas un pronostic officiel.
    </p>
  )
}
