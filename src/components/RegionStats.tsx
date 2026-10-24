import { useMemo, useState } from 'react'
import { fetchIntlSeries } from '../api/games'
import { useElo } from '../hooks/useElo'
import { usePolling } from '../hooks/usePolling'
import { pct } from '../lib/format'
import { CHART_REGIONS, regionBilan, regionLabel } from '../lib/regions'
import { RegionChart, type RegionSeries } from './RegionChart'
import { Chips, Empty, ErrorBox, Loading } from './ui'

const ALL = 'all'

function RegionName({ region }: { region: string }) {
  const { code, name } = regionLabel(region)
  return (
    <span className="who">
      <span>{code}</span>
      {name !== code && <small className="muted">{name}</small>}
    </span>
  )
}

/** Les régions entre elles : bilan des compétitions internationales (séries entre régions différentes) et niveau moyen de chaque région. */
export function RegionStats({ active }: { active: boolean }) {
  const elo = useElo()
  const { data, error, refresh } = usePolling(() => fetchIntlSeries(), [], 10 * 60_000, active)
  const [picked, setPicked] = useState<string>()

  // Compétitions jouées, la plus récente d'abord.
  const events = useMemo(() => {
    const last = new Map<string, string>()
    for (const s of data ?? []) if (s.date > (last.get(s.event) ?? '')) last.set(s.event, s.date)
    return [...last.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([e]) => e)
  }, [data])
  const event = picked && (picked === ALL || events.includes(picked)) ? picked : events[0]

  const bilan = useMemo(() => {
    if (!data || !elo) return undefined
    return regionBilan(event === ALL ? data : data.filter((s) => s.event === event), (team) => elo.regions[team])
  }, [data, elo, event])

  const chart: RegionSeries[] = useMemo(
    () => (elo ? CHART_REGIONS.map((region, i) => ({ region, code: regionLabel(region).code, slot: i + 1, points: elo.regionElo[region] ?? [] })) : []),
    [elo],
  )

  return (
    <>
      {error && !data && <ErrorBox error={error} onRetry={refresh} />}
      {!data && !error && <Loading />}
      {data && !events.length && <Empty>Aucune série internationale jouée ces trois dernières années.</Empty>}
      {data && events.length > 0 && (
        <>
          <Chips value={event} onChange={setPicked} options={[...events.map((e) => ({ value: e, label: e })), { value: ALL, label: 'Tout (3 ans)' }]} />
          {!bilan && <Loading label="Chargement de l’Elo…" />}
          {bilan && !bilan.rows.length && <Empty>Pas encore de série entre deux régions dans cette compétition.</Empty>}
          {bilan && bilan.rows.length > 0 && (
            <>
              <h2 className="section-title">Bilan par région</h2>
              <div className="card flush">
                <div className="table-scroll">
                  <table className="standings stats-table">
                    <thead>
                      <tr>
                        <th scope="col" className="left">Région</th>
                        <th scope="col">Séries</th>
                        <th scope="col">% séries</th>
                        <th scope="col">Games</th>
                        <th scope="col">% games</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bilan.rows.map((r) => (
                        <tr key={r.region}>
                          <th scope="row" className="left">
                            <span className="st-team">
                              <RegionName region={r.region} />
                            </span>
                          </th>
                          <td>
                            {r.winSeries}–{r.lossSeries}
                          </td>
                          <td className={`strong ${r.winSeries >= r.lossSeries ? 'pos' : 'neg'}`}>{pct(r.winSeries, r.winSeries + r.lossSeries)}</td>
                          <td>
                            {r.winGames}–{r.lossGames}
                          </td>
                          <td>{pct(r.winGames, r.winGames + r.lossGames)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <h2 className="section-title">Face-à-face</h2>
              <div className="card flush">
                <div className="table-scroll">
                  <table className="standings stats-table versus">
                    <thead>
                      <tr>
                        <th scope="col" className="left">Région</th>
                        {bilan.rows.map((c) => (
                          <th key={c.region} scope="col">
                            {regionLabel(c.region).code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bilan.rows.map((r) => (
                        <tr key={r.region}>
                          <th scope="row" className="left">
                            <span className="st-team">{regionLabel(r.region).code}</span>
                          </th>
                          {bilan.rows.map((c) => {
                            const v = bilan.vs.get(r.region)?.get(c.region)
                            if (r.region === c.region) return <td key={c.region} className="muted">·</td>
                            if (!v) return <td key={c.region} className="muted">–</td>
                            return (
                              <td key={c.region} className={v[0] > v[1] ? 'pos' : v[0] < v[1] ? 'neg' : ''}>
                                {v[0]}–{v[1]}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="footnote">
                {bilan.counted} série{bilan.counted > 1 ? 's' : ''} entre deux régions différentes.
                {bilan.sameRegion > 0 && ` ${bilan.sameRegion} série${bilan.sameRegion > 1 ? 's' : ''} entre équipes de la même région ne comptent pas.`}
                {bilan.unknown > 0 && ` ${bilan.unknown} série${bilan.unknown > 1 ? 's' : ''} d’une équipe sans région connue non plus.`} Région d’une équipe : celle de sa ligue actuelle. Face-à-face : la région de la ligne
                contre celle de la colonne (séries gagnées–perdues).
              </p>
            </>
          )}
        </>
      )}

      <h2 className="section-title">Niveau des régions</h2>
      {!elo ? (
        <Loading label="Chargement de l’Elo…" />
      ) : (
        <div className="card">
          <RegionChart series={chart} />
        </div>
      )}
    </>
  )
}
