import { useMemo, useState } from 'react'
import { Chips } from './ui'

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const label = (m: number) => `${MONTHS[m % 12]} ${2011 + Math.floor(m / 12)}`

type Range = '1' | '3' | 'all'
const SPAN: Record<Range, number> = { '1': 12, '3': 36, all: Infinity }

const W = 360
const H = 210
const L = 38
const R = 12
const T = 10
const B = 22

export interface RegionSeries {
  region: string
  /** Libellé court (LCK, LPL…). */
  code: string
  /** Numéro de couleur (1 à 6) : celle d'une région ne change jamais. */
  slot: number
  /** [mois depuis janvier 2011, note moyenne]. */
  points: [number, number][]
}

/** Niveau moyen des meilleures équipes de chaque région, mois par mois. */
export function RegionChart({ series }: { series: RegionSeries[] }) {
  const [range, setRange] = useState<Range>('3')
  const [hidden, setHidden] = useState<string[]>([])
  const [cursor, setCursor] = useState<number>()

  const shown = series.filter((s) => !hidden.includes(s.region) && s.points.length > 1)

  const view = useMemo(() => {
    if (!shown.length) return undefined
    const hi = Math.max(...shown.map((s) => s.points[s.points.length - 1][0]))
    const first = Math.min(...shown.map((s) => s.points[0][0]))
    const lo = Math.max(first, hi - SPAN[range])
    const ys = shown.flatMap((s) => s.points.filter(([m]) => m >= lo).map((p) => p[1]))
    if (!ys.length) return undefined
    const min = Math.floor((Math.min(...ys) - 15) / 50) * 50
    const max = Math.ceil((Math.max(...ys) + 15) / 50) * 50
    return { lo, hi, min, max: Math.max(max, min + 50) }
  }, [shown, range])

  const options = [
    { value: '1' as Range, label: '1 an' },
    { value: '3' as Range, label: '3 ans' },
    { value: 'all' as Range, label: 'Tout' },
  ]

  const toggle = (region: string) => {
    setHidden((h) => (h.includes(region) ? h.filter((r) => r !== region) : [...h, region]))
    setCursor(undefined)
  }

  if (!series.some((s) => s.points.length > 1)) return <p className="muted">Pas assez d'historique pour tracer la courbe.</p>

  const lo = view?.lo ?? 0
  const hi = view?.hi ?? 1
  const min = view?.min ?? 0
  const max = view?.max ?? 1
  const x = (m: number) => L + ((m - lo) / Math.max(1, hi - lo)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B)
  const grid: number[] = []
  const stepY = max - min > 500 ? 100 : 50
  for (let v = Math.ceil(min / stepY) * stepY; v <= max; v += stepY) grid.push(v)
  const years: number[] = []
  const yearStep = (hi - lo) / 12 > 8 ? 2 : 1
  for (let m = Math.ceil(lo / 12) * 12; m <= hi; m += 12 * yearStep) years.push(m)

  const month = cursor ?? hi
  /** Dernière note connue de la série jusqu'à ce mois (une région peut manquer un mois). */
  const at = (s: RegionSeries, m: number) => s.points.filter(([p]) => p <= m && m - p <= 3).at(-1)?.[1]

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const m = lo + ((((e.clientX - r.left) / r.width) * W - L) / (W - L - R)) * (hi - lo)
    setCursor(Math.min(hi, Math.max(lo, Math.round(m))))
  }

  const readout = shown
    .map((s) => ({ s, v: at(s, month) }))
    .filter((r): r is { s: RegionSeries; v: number } => r.v !== undefined)
    .sort((a, b) => b.v - a.v)

  return (
    <div className="elo-chart region-chart">
      <Chips options={options} value={range} onChange={(r) => { setRange(r); setCursor(undefined) }} />
      <div className="rc-legend" role="group" aria-label="Régions affichées">
        {series.map((s) => {
          const now = at(s, series.reduce((m, o) => Math.max(m, o.points.at(-1)?.[0] ?? 0), 0))
          return (
            <button key={s.region} className="rc-key" aria-pressed={!hidden.includes(s.region)} onClick={() => toggle(s.region)}>
              <span className="rc-swatch" style={{ background: `var(--rc-${s.slot})` }} />
              <span>{s.code}</span>
              {now !== undefined && <span className="muted">{now}</span>}
            </button>
          )
        })}
      </div>
      {view ? (
        <>
          <p className="rc-readout">
            <span className="muted">{label(month)}</span>
            {readout.map(({ s, v }) => (
              <span key={s.region} className="rc-val">
                <span className="rc-tick" style={{ background: `var(--rc-${s.slot})` }} />
                <strong>{v}</strong> <span className="muted">{s.code}</span>
              </span>
            ))}
          </p>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Niveau moyen des meilleures équipes de chaque région"
            onPointerDown={pick}
            onPointerMove={(e) => (e.buttons || e.pointerType === 'mouse' ? pick(e) : undefined)}
            onPointerLeave={() => setCursor(undefined)}
          >
            {grid.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="ec-grid" />
                <text x={L - 5} y={y(v) + 3.5} textAnchor="end" className="ec-axis">
                  {v}
                </text>
              </g>
            ))}
            {years.map((m) => (
              <text key={m} x={x(m)} y={H - 6} textAnchor="middle" className="ec-axis">
                {2011 + m / 12}
              </text>
            ))}
            {shown.map((s) => {
              const pts = s.points.filter(([m]) => m >= lo)
              const before = s.points.filter(([m]) => m < lo).at(-1)
              if (before && pts[0]?.[0] > lo) pts.unshift([lo, before[1]])
              if (pts.length < 2) return null
              const last = pts[pts.length - 1]
              return (
                <g key={s.region}>
                  <path d={pts.map(([m, v], i) => `${i ? 'L' : 'M'}${x(m).toFixed(1)} ${y(v).toFixed(1)}`).join('')} className="rc-line" style={{ stroke: `var(--rc-${s.slot})` }} />
                  <circle cx={x(last[0])} cy={y(last[1])} r="4" className="rc-end" style={{ fill: `var(--rc-${s.slot})` }} />
                </g>
              )
            })}
            {cursor !== undefined && <line x1={x(cursor)} x2={x(cursor)} y1={T} y2={H - B} className="ec-cursor" />}
          </svg>
        </>
      ) : (
        <p className="muted">Touche une région pour l’afficher.</p>
      )}
      <p className="footnote">
        Moyenne de l’Elo des 5 meilleures équipes actives de chaque région (ligues majeures), en fin de mois. Touche la courbe pour lire une date, une région dans la légende pour la masquer.
      </p>
    </div>
  )
}
