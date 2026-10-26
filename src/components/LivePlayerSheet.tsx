import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { champName, itemIconById, runeIconUrl, useDetailData, type DetailData, type ItemKind } from '../api/ddragon'
import { fetchLiveDetails, type LivePlayer, type PlayerDetails } from '../api/lolesports'
import type { Team } from '../api/types'
import { usePolling } from '../hooks/usePolling'
import { kda, kilo } from '../lib/format'
import { ChampIcon, Loading } from './ui'

type Side = 'blue' | 'red'

const ROLES: Record<string, string> = { top: 'Top', jungle: 'Jungle', mid: 'Mid', bottom: 'Bot', support: 'Support' }
const percent = (x: number) => `${Math.round(x * 100)} %`

/** Ordre de priorité des sorts : celui qui a le plus de points d'abord (à égalité, celui monté en premier). */
function priority(skills: string[]): string {
  const count: Record<string, number> = { Q: 0, W: 0, E: 0 }
  const first: Record<string, number> = {}
  skills.forEach((s, i) => {
    if (s in count) {
      count[s]++
      first[s] ??= i
    }
  })
  return ['Q', 'W', 'E'].sort((a, b) => count[b] - count[a] || (first[a] ?? 99) - (first[b] ?? 99)).join(' > ')
}

function ItemIcons({ ids, dd, onTap }: { ids: number[]; dd?: DetailData; onTap: (name: string) => void }) {
  const kind = (id: number): ItemKind => dd?.items[id]?.k ?? 'item'
  const name = (id: number) => dd?.items[id]?.n ?? `Objet ${id}`
  const main = ids.filter((id) => kind(id) === 'item')
  const extra = ids.filter((id) => kind(id) !== 'item')
  const icon = (id: number, i: number, small = false) => {
    const url = itemIconById(id)
    return (
      <button key={`${id}-${i}`} type="button" className={`lv-it ${small ? 'small' : ''}`} onClick={() => onTap(name(id))} aria-label={name(id)}>
        {url ? <img src={url} alt="" width={small ? 22 : 30} height={small ? 22 : 30} loading="lazy" /> : null}
      </button>
    )
  }
  return (
    <div className="lv-items">
      {Array.from({ length: Math.max(6, main.length) }, (_, i) => (main[i] ? icon(main[i], i) : <span key={`e${i}`} className="lv-it empty" aria-hidden="true" />))}
      {extra.length > 0 && <span className="gap" aria-hidden="true" />}
      {extra.map((id, i) => icon(id, i, true))}
    </div>
  )
}

function RuneButton({ id, dd, big, onTap }: { id?: number; dd?: DetailData; big?: boolean; onTap: (name: string) => void }) {
  const r = id !== undefined ? dd?.runes[id] : undefined
  return (
    <button type="button" className={`lv-rune ${big ? 'big' : ''}`} onClick={() => onTap(r?.n ?? '')} aria-label={r?.n ?? 'Rune'} disabled={!r}>
      {r ? <img src={runeIconUrl(r.i)} alt="" width={big ? 34 : 26} height={big ? 34 : 26} loading="lazy" /> : null}
    </button>
  )
}

function Details({ player, d, dd }: { player: LivePlayer; d: PlayerDetails; dd?: DetailData }) {
  const [caption, setCaption] = useState('')
  const tap = (name: string) => setCaption(name)
  const primary = d.perks.slice(0, 4)
  const secondary = d.perks.slice(4, 6)
  const treeName = (id?: number) => (id !== undefined ? dd?.runes[id]?.n : undefined)
  const stats: [string, string][] = [
    ['Attaque', String(Math.round(d.attackDamage))],
    ['Puissance', String(Math.round(d.abilityPower))],
    ['Armure', String(Math.round(d.armor))],
    ['Rés. mag.', String(Math.round(d.magicResist))],
    ['Vol de vie', `${Math.round(d.lifeSteal)} %`],
  ]
  return (
    <>
      <div className="lv-chips">
        <span>
          <b>{player.cs}</b> CS
        </span>
        <span>
          <b>{kilo(player.gold)}</b> or
        </span>
        <span>
          Kills <b>{percent(d.killShare)}</b>
        </span>
        <span>
          Dégâts <b>{percent(d.damageShare)}</b>
        </span>
        <span title="Balises posées / détruites">
          Balises <b>{d.wardsPlaced}</b> / {d.wardsDestroyed}
        </span>
      </div>

      <h5 className="lv-sub">Objets</h5>
      <ItemIcons ids={d.items} dd={dd} onTap={tap} />

      <h5 className="lv-sub">Runes</h5>
      <div className="lv-runes">
        <div>
          <span className="lv-tree">{treeName(d.style) ?? 'Arbre principal'}</span>
          <div className="row">
            {primary.map((id, i) => (
              <RuneButton key={id} id={id} dd={dd} big={i === 0} onTap={tap} />
            ))}
          </div>
        </div>
        <div>
          <span className="lv-tree">{treeName(d.subStyle) ?? 'Arbre secondaire'}</span>
          <div className="row">
            {secondary.map((id) => (
              <RuneButton key={id} id={id} dd={dd} onTap={tap} />
            ))}
          </div>
        </div>
      </div>
      <p className="lv-caption" aria-live="polite">
        {caption || 'Touche un objet ou une rune pour son nom.'}
      </p>

      <h5 className="lv-sub">Chiffres de combat</h5>
      <div className="lv-cstats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {d.skills.length > 0 && (
        <>
          <h5 className="lv-sub">Montée des sorts · {priority(d.skills)}</h5>
          <div className="lv-skills">
            {d.skills.map((s, i) => (
              <span key={i} className={s === 'R' ? 'r' : ''}>
                <small>{i + 1}</small>
                {s}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/** Carte d'un joueur de la game en cours : objets, runes, sorts et chiffres de combat. Le détail n'est demandé qu'à l'ouverture. */
export function PlayerSheet({ player, side, team, gameId, onClose }: { player: LivePlayer; side: Side; team: Team; gameId: string; onClose: () => void }) {
  const { data, error } = usePolling((s) => fetchLiveDetails(gameId, s), [gameId], 10_000)
  const dd = useDetailData()
  const d = data?.get(player.id)
  const sheet = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onCloseRef.current()
      if (e.key !== 'Tab' || !sheet.current) return
      // Le focus reste dans la carte tant qu'elle est ouverte.
      const items = Array.from(sheet.current.querySelectorAll<HTMLElement>('button:not([disabled])'))
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  const hp = player.maxHp ? Math.min(100, Math.round((player.hp / player.maxHp) * 100)) : 0
  const role = ROLES[player.role] ?? player.role
  return createPortal(
    <div className="lv-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lv-sheet" role="dialog" aria-modal="true" aria-label={`Détail de ${player.name}`} ref={sheet}>
        <div className="lv-sheet-head">
          <span className="lv-cw">
            <ChampIcon champion={player.champion} size={52} />
            <i className="lv-lvl">{player.level}</i>
          </span>
          <div className="lv-sheet-id">
            <b>{player.name}</b>
            <span>
              {[role, champName(player.champion), team.code].filter(Boolean).join(' · ')}
              <i className={`lv-side ${side}`}>{side === 'blue' ? 'côté bleu' : 'côté rouge'}</i>
            </span>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="lv-sheet-kda">
          <b>
            {player.kills}/{player.deaths}/{player.assists}
          </b>
          <span>{kda(player.kills, player.deaths, player.assists)} KDA</span>
          <span className="lv-hp" role="img" aria-label={`Vie ${hp} %`}>
            <i style={{ width: `${hp}%` }} />
          </span>
        </div>

        {d ? (
          <Details player={player} d={d} dd={dd} />
        ) : data ? (
          <p className="muted small">Le flux ne donne pas encore le détail de ce joueur.</p>
        ) : error ? (
          <p className="warn">Détails indisponibles : {error.message}</p>
        ) : (
          <Loading label="Chargement du détail…" />
        )}
        <p className="footnote">Même flux que le reste du direct : 30 à 60 s de retard.</p>
      </div>
    </div>,
    document.body,
  )
}
