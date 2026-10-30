import { useId, type ReactNode } from 'react'
import type { GoldPoint } from '../api/lolesports'
import type { Team } from '../api/types'
import { goldDiff } from '../lib/format'

/** Camp en tête d'après un écart d'or (bleu moins rouge). */
const lead = (diff: number) => (diff >= 0 ? 'blue' : 'red')

const signedK = (v: number) => (v === 0 ? '0' : goldDiff(v).replace(/,0k$/, 'k'))

/**
 * Courbe de l'écart d'or (bleu moins rouge) au fil de la game. `ta` joue côté bleu, `tb` côté rouge.
 * `live` : game en cours (flux LoL Esports) ; sinon game terminée (timeline Riot via Leaguepedia).
 */
export function GoldChart({ series, ta, tb, live }: { series: GoldPoint[]; ta: Team; tb: Team; live?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const empty = series.length < 2
  const last = empty ? 0 : series[series.length - 1].blue - series[series.length - 1].red
  const W = 340
  const H = 156
  const L = 38
  const R = 12
  const T = 16
  const B = 22

  let plot: ReactNode = null
  if (!empty) {
    const t0 = series[0].t
    const xs = series.map((p) => (p.t - t0) / 60_000)
    const ds = series.map((p) => p.blue - p.red)
    const ym = Math.max(2000, Math.ceil(Math.max(...ds.map(Math.abs)) / 1000) * 1000)
    const xmax = Math.max(1, xs[xs.length - 1])
    const X = (m: number) => L + (m / xmax) * (W - L - R)
    const Y = (d: number) => T + ((ym - d) / (2 * ym)) * (H - T - B)
    const y0 = Y(0)
    const n = series.length - 1
    const line = series.map((_, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(ds[i]).toFixed(1)}`).join('')
    const area = `${line}L${X(xmax).toFixed(1)},${y0.toFixed(1)}L${X(0).toFixed(1)},${y0.toFixed(1)}Z`
    const iB = ds.indexOf(Math.max(...ds))
    const iR = ds.indexOf(Math.min(...ds))
    const clamp = (x: number) => Math.min(W - R - 26, Math.max(L + 26, x))
    const ticks = [ym, ym / 2, 0, -ym / 2, -ym]
    const minutes: number[] = []
    for (let m = 0; m <= xmax; m += 10) minutes.push(m)
    plot = (
      <svg className="lv-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Écart d’or pendant la game : ${last >= 0 ? ta.code : tb.code} ${goldDiff(Math.abs(last))} ${live ? 'maintenant' : 'à la fin'}`}>
        <defs>
          <clipPath id={`${uid}t`}>
            <rect x="0" y="0" width={W} height={y0.toFixed(1)} />
          </clipPath>
          <clipPath id={`${uid}b`}>
            <rect x="0" y={y0.toFixed(1)} width={W} height={H} />
          </clipPath>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'mid' : 'grid'} x1={L} x2={W - R} y1={Y(v).toFixed(1)} y2={Y(v).toFixed(1)} />
            <text x={L - 6} y={(Y(v) + 3.5).toFixed(1)} textAnchor="end">
              {signedK(v)}
            </text>
          </g>
        ))}
        {minutes.map((m) => (
          <text key={m} x={X(m).toFixed(1)} y={H - 6} textAnchor="middle">
            {m} min
          </text>
        ))}
        <path d={area} className="area b" clipPath={`url(#${uid}t)`} />
        <path d={area} className="area r" clipPath={`url(#${uid}b)`} />
        <path d={line} className="line b" clipPath={`url(#${uid}t)`} />
        <path d={line} className="line r" clipPath={`url(#${uid}b)`} />
        {iB !== n && ds[iB] > 0 && (
          <g>
            <circle cx={X(xs[iB]).toFixed(1)} cy={Y(ds[iB]).toFixed(1)} r="3" className="dot b" />
            <text className="ann b" x={clamp(X(xs[iB])).toFixed(1)} y={(Y(ds[iB]) - 7).toFixed(1)} textAnchor="middle">
              {ta.code} {goldDiff(ds[iB])}
            </text>
          </g>
        )}
        {iR !== n && ds[iR] < 0 && (
          <g>
            <circle cx={X(xs[iR]).toFixed(1)} cy={Y(ds[iR]).toFixed(1)} r="3" className="dot r" />
            <text className="ann r" x={clamp(X(xs[iR])).toFixed(1)} y={(Y(ds[iR]) + 15).toFixed(1)} textAnchor="middle">
              {tb.code} {goldDiff(-ds[iR])}
            </text>
          </g>
        )}
        <circle cx={X(xs[n]).toFixed(1)} cy={Y(ds[n]).toFixed(1)} r="4" className={`dot now ${lead(ds[n])[0]}`} />
      </svg>
    )
  }

  return (
    <section className="card lv-block">
      <div className="lv-chart-head">
        <h4 className="lv-title">Écart d’or</h4>
        {!empty && (
          <strong className={lead(last) === 'blue' ? 'lv-b' : 'lv-r'}>
            {last >= 0 ? ta.code : tb.code} {goldDiff(Math.abs(last))}
          </strong>
        )}
      </div>
      {plot ?? <p className="footnote">{live ? 'Reconstitution de la courbe depuis le début de la game…' : 'Courbe indisponible pour cette game.'}</p>}
      {!empty && (
        <p className="lv-note">
          {live
            ? 'Toute la game, relue dans l’historique du flux. Les minutes sont comptées depuis sa première image, à une minute près.'
            : 'Timeline officielle de la game (données Riot publiées par Leaguepedia), une mesure par minute.'}
        </p>
      )}
    </section>
  )
}
