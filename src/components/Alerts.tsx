import { useEffect, useRef, useState } from 'react'
import { fetchMatches } from '../api/leaguepedia'
import { applyLive } from '../api/live'
import type { Match } from '../api/types'
import { liveInterval, usePolling } from '../hooks/usePolling'
import { isDecider } from '../lib/format'
import { showNotification, onNotificationOpen } from '../lib/notifications'
import { href } from '../lib/router'
import { getFavoriteIds, useAlertSettings, type AlertSettings } from '../lib/store'

interface Alert {
  key: string
  matchId: string
  title: string
  body: string
}

const score = (m: Match) => `${m.a.team.code} ${m.a.score ?? 0} – ${m.b.score ?? 0} ${m.b.team.code}`
const total = (m: Match) => (m.a.score ?? 0) + (m.b.score ?? 0)

/** Compare deux états d'une série et renvoie les alertes à déclencher. */
function diff(prev: Match, next: Match, s: AlertSettings): Alert[] {
  const out: Alert[] = []
  const base = { matchId: next.id }
  const names = `${next.a.team.name} – ${next.b.team.name}`
  if (s.start && prev.state === 'pre' && next.state === 'in') {
    out.push({ ...base, key: `${next.id}:start`, title: `C’est parti · ${next.leagueName}`, body: names })
  }
  if (s.gameEnd && next.state !== 'pre' && total(next) > total(prev) && !(prev.state === 'in' && next.state === 'post' && s.final)) {
    out.push({ ...base, key: `${next.id}:game:${total(next)}`, title: `Game ${total(next)} terminée`, body: score(next) })
  }
  if (s.decider && !isDecider(prev) && isDecider(next)) {
    out.push({ ...base, key: `${next.id}:decider`, title: `Game décisive · ${next.leagueName}`, body: score(next) })
  }
  if (s.final && prev.state !== 'post' && next.state === 'post' && next.winner) {
    const w = next.winner === 1 ? next.a : next.b
    out.push({ ...base, key: `${next.id}:final`, title: `Terminé · victoire de ${w.team.name}`, body: score(next) })
  }
  return out
}

/** Surveille les séries du jour et affiche des alertes (bandeau dans l'app + notification système). */
export function Alerts() {
  const { settings } = useAlertSettings()
  const [toasts, setToasts] = useState<Alert[]>([])
  const prev = useRef(new Map<string, Match>())
  const fired = useRef(new Set<string>())

  const { data } = usePolling(
    async (signal) => {
      const from = new Date(Date.now() - 12 * 3_600_000)
      const to = new Date(Date.now() + 24 * 3_600_000)
      return applyLive(await fetchMatches(from, to, undefined, signal), signal)
    },
    [],
    (ms) => liveInterval(ms),
    settings.enabled,
  )

  useEffect(() => {
    if (!data || !settings.enabled) return
    const favs = getFavoriteIds()
    const fresh: Alert[] = []
    for (const m of data) {
      const before = prev.current.get(m.id)
      prev.current.set(m.id, m)
      if (!before) continue // premier passage : on mémorise l'état sans alerter
      if (settings.favoritesOnly && !favs.includes(m.a.team.id) && !favs.includes(m.b.team.id)) continue
      for (const a of diff(before, m, settings)) {
        if (fired.current.has(a.key)) continue
        fired.current.add(a.key)
        fresh.push(a)
      }
    }
    if (!fresh.length) return
    fresh.forEach((a) => showNotification(a.key, a.title, a.body, href.match(a.matchId)))
    setToasts((t) => [...t, ...fresh].slice(-3))
  }, [data, settings])

  useEffect(() => {
    if (!toasts.length) return
    const t = window.setTimeout(() => setToasts((list) => list.slice(1)), 8000)
    return () => window.clearTimeout(t)
  }, [toasts])

  // Notification système touchée : on ouvre la série.
  useEffect(() => onNotificationOpen((hash) => (location.hash = hash)), [])

  if (!toasts.length) return null
  return (
    <div className="toasts" role="status">
      {toasts.map((t) => (
        <a key={t.key} className="toast" href={href.match(t.matchId)} onClick={() => setToasts((l) => l.filter((x) => x !== t))}>
          <strong>{t.title}</strong>
          <span>{t.body}</span>
        </a>
      ))}
    </div>
  )
}
