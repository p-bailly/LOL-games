import { useEffect, useMemo, useState } from 'react'
import { fetchElo, type EloTeam } from '../api/elo'
import { onTeamsResolved, resolveTeams, teamOf } from '../api/leaguepedia'
import { Chips, Empty, ErrorBox, Loading, TeamLogo } from './ui'
import { usePolling } from '../hooks/usePolling'
import { shortDate } from '../lib/format'
import { href } from '../lib/router'
import { useFavorites } from '../lib/store'

const REGIONS: Record<string, string> = {
  Korea: 'Corée',
  China: 'Chine',
  EMEA: 'Europe',
  'North America': 'Amérique du Nord',
  Brazil: 'Brésil',
  'Asia Pacific': 'Asie-Pacifique',
  'Latin America': 'Amérique latine',
  Vietnam: 'Vietnam',
  Japan: 'Japon',
  Turkey: 'Turquie',
  CIS: 'CEI',
  Oceania: 'Océanie',
  International: 'International',
  Taiwan: 'Taïwan',
  SEA: 'Asie du Sud-Est',
}
const regionFr = (r: string) => REGIONS[r] ?? r

const PAGE = 50

function Delta({ v }: { v?: number }) {
  if (v === undefined || Math.abs(v) < 1) return <span className="muted">=</span>
  return <span className={v > 0 ? 'pos' : 'neg'}>{v > 0 ? '▲' : '▼'} {Math.round(Math.abs(v))}</span>
}

/** Classement Elo mondial : toutes les équipes actives, de la meilleure à la plus faible. */
export function EloRanking({ active }: { active: boolean }) {
  const { data, error, loading, refresh } = usePolling(() => fetchElo(), [], 30 * 60_000, active)
  const { has } = useFavorites()
  const [scope, setScope] = useState<'major' | 'all'>('major')
  const [region, setRegion] = useState('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [, bump] = useState(0)

  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const yearAgo = Date.now() - 365 * 86_400_000
    return data.teams.filter(
      (t) => t.last >= yearAgo && (scope === 'all' || t.major) && (region === 'all' || t.region === region) && (!q || t.id.toLowerCase().includes(q)),
    )
  }, [data, scope, region, query])

  const regions = useMemo(() => {
    const count = new Map<string, number>()
    for (const t of data?.teams ?? []) if (t.region && (scope === 'all' || t.major) && t.last >= Date.now() - 365 * 86_400_000) count.set(t.region, (count.get(t.region) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r)
  }, [data, scope])

  const visible = rows.slice(0, shown)
  const key = visible.map((t) => t.id).join('|')
  useEffect(() => {
    void resolveTeams(visible.map((t) => t.id))
    return onTeamsResolved(() => bump((n) => n + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />
  if (!data) return <Loading label="Chargement du classement…" />

  return (
    <>
      <Chips
        value={scope}
        onChange={(s) => {
          setScope(s)
          setRegion('all')
          setShown(PAGE)
        }}
        options={[
          { value: 'major', label: 'Ligues majeures' },
          { value: 'all', label: 'Toutes les ligues' },
        ]}
      />
      <Chips
        value={region}
        onChange={(r) => {
          setRegion(r)
          setShown(PAGE)
        }}
        options={[{ value: 'all', label: 'Monde' }, ...regions.map((r) => ({ value: r, label: regionFr(r) }))]}
      />
      <div className="content">
        <input className="search" type="search" placeholder="Rechercher une équipe…" value={query} onChange={(e) => (setQuery(e.target.value), setShown(PAGE))} />
        {rows.length === 0 && <Empty>Aucune équipe ne correspond.</Empty>}
        {rows.length > 0 && (
          <div className="card flush">
            <ol className="elo-list">
              {visible.map((t, i) => (
                <EloRow key={t.id} t={t} pos={i + 1} fav={has(t.id)} />
              ))}
            </ol>
          </div>
        )}
        {rows.length > shown && (
          <button className="btn more" onClick={() => setShown(shown + PAGE)}>
            Voir {Math.min(PAGE, rows.length - shown)} équipes de plus
          </button>
        )}
        <p className="footnote">
          Classement Elo calculé game par game sur toutes les games de Leaguepedia depuis 2011 ({Math.round(data.quality.n / 1000)} 000 games depuis 2015 pour le réglage), mis à jour avec les dernières
          séries{data.added ? ` (${data.added} depuis le calcul du ${shortDate(new Date(data.until).toISOString())})` : ''}. Chaque game compte pareil, qu’elle soit dans un BO1, un BO3 ou un BO5 : seul
          compte son résultat par rapport à ce qui était attendu. Toute équipe démarre à la moyenne de sa ligue ; sa note bouge beaucoup à ses premières games (K = {data.params.kMax}) puis se stabilise
          (K = {data.params.kMin}), et se rapproche de la moyenne de sa ligue après {data.params.gap} jours sans jouer. Réglage mesuré sur l’historique : {(data.quality.accuracy * 100).toFixed(0)} % des
          vainqueurs de games bien prévus ({(data.quality.intlAccuracy * 100).toFixed(0)} % en compétition internationale). « Provisoire » : moins de 60 games, la note peut encore bouger beaucoup. Les ligues
          secondaires et les régions qui se rencontrent rarement ne sont pas vraiment comparables entre elles. Évolution : sur environ 90 jours.
          {loading ? ' Mise à jour…' : ''}
        </p>
      </div>
    </>
  )
}

function EloRow({ t, pos, fav }: { t: EloTeam; pos: number; fav: boolean }) {
  const team = teamOf(t.id)
  return (
    <li>
      <a className="elo-row" href={href.team(t.id)}>
        <span className="elo-rank">{pos}</span>
        <TeamLogo team={team} size={30} />
        <span className="elo-name">
          <strong>
            {team.name}
            {fav && <span className="fav-mark">★</span>}
          </strong>
          <small className="muted">
            {[regionFr(t.region), `${t.series} séries`, `${Math.round((t.wins / Math.max(1, t.wins + t.losses)) * 100)} % de victoires`].filter(Boolean).join(' · ')}
          </small>
        </span>
        <span className="elo-score">
          <strong>{Math.round(t.rating)}</strong>
          <small>
            <Delta v={t.delta} />
          </small>
        </span>
      </a>
    </li>
  )
}
