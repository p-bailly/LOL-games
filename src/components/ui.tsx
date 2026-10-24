import { useState, type ReactNode } from 'react'
import type { Team } from '../api/types'
import { champName, championIcon, itemIcon, useDataDragon } from '../api/ddragon'
import { goBack } from '../lib/router'

export function TeamLogo({ team, size = 32 }: { team: Pick<Team, 'logo' | 'code'>; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (!team.logo || failed) {
    return (
      <span className="logo-fallback" style={{ width: size, height: size, fontSize: Math.max(9, size * 0.3) }}>
        {team.code}
      </span>
    )
  }
  return (
    <span className="team-logo" style={{ width: size, height: size }}>
      <img src={team.logo} width={size} height={size} alt={team.code} loading="lazy" onError={() => setFailed(true)} />
    </span>
  )
}

/** Icône d'un champion (nom Leaguepedia ou identifiant Riot) ; ses initiales tant que Data Dragon n'est pas là. */
export function ChampIcon({ champion, size = 36, banned = false }: { champion: string; size?: number; banned?: boolean }) {
  useDataDragon()
  const url = championIcon(champion)
  const label = champName(champion)
  return (
    <span className={`champ-icon ${banned ? 'banned' : ''}`} style={{ width: size, height: size }} title={label}>
      {url ? <img src={url} width={size} height={size} alt={label} loading="lazy" /> : <span className="champ-ph">{champion.slice(0, 2)}</span>}
    </span>
  )
}

export function ItemIcon({ name, size = 24 }: { name: string; size?: number }) {
  useDataDragon()
  const url = name ? itemIcon(name) : undefined
  return (
    <span className={`item-icon ${name ? '' : 'empty'}`} style={{ width: size, height: size }} title={name || undefined}>
      {url && <img src={url} width={size} height={size} alt={name} loading="lazy" />}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: boolean
  right?: ReactNode
}) {
  return (
    <header className="page-header">
      {back && (
        <button className="icon-btn" onClick={goBack} aria-label="Retour">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <div className="page-header-titles">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  /** Boutons plus serrés, pour cinq choix sur un téléphone. */
  compact?: boolean
}) {
  return (
    <div className={`segmented ${compact ? 'compact' : ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Rangée de pastilles défilante (ligues, tournois). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="chips scroll" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" className={`chip ${o.value === value ? 'active' : ''}`} aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="state-box" aria-live="polite">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state-box error">
      <strong>Impossible de charger les données</strong>
      <span className="muted">{navigator.onLine ? error.message : 'Pas de connexion internet'}</span>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state-box muted">{children}</div>
}

export function LiveBadge({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="live-badge">
      <span className="live-dot" />
      {label}
    </span>
  )
}

export function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UpdatedAt({ at, loading }: { at?: number; loading?: boolean }) {
  if (!at) return null
  const t = new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return <span className={`updated ${loading ? 'is-loading' : ''}`}>Mis à jour {t}</span>
}

/** Variation d'Elo signée : « +12 » en vert, « −9 » en rouge (une décimale sous 10 points). */
export function EloDelta({ value }: { value?: number }) {
  if (value === undefined || !Number.isFinite(value)) return null
  const abs = Math.abs(value)
  const text = abs < 10 ? abs.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : String(Math.round(abs))
  const sign = value > 0.04 ? '+' : value < -0.04 ? '−' : '±'
  return (
    <span className={`elo-delta ${sign === '+' ? 'pos' : sign === '−' ? 'neg' : ''}`} title="Variation d’Elo">
      {sign}
      {text}
    </span>
  )
}
