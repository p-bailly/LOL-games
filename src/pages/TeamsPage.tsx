import { useEffect, useState } from 'react'
import { resolveTeams, teamOf, onTeamsResolved } from '../api/leaguepedia'
import { fetchLive, MissingKeyError } from '../api/lolesports'
import { fetchLeagueTeams } from '../api/stats'
import type { Team } from '../api/types'
import { ErrorBox, Loading, PageHeader, Star, TeamLogo } from '../components/ui'
import { useLeagueOrder } from '../hooks/useLeagueOrder'
import { usePolling } from '../hooks/usePolling'
import { isNative, notificationPermission, requestNotificationPermission, type Permission } from '../lib/notifications'
import { href } from '../lib/router'
import { useAlertSettings, useFavorites, useLiveSettings, type AlertSettings } from '../lib/store'

/** Équipes favorites avec logo et abréviation, retrouvés au besoin. */
function useFavoriteTeams(ids: string[]): Team[] {
  const [, bump] = useState(0)
  const key = ids.join('|')
  useEffect(() => {
    void resolveTeams(ids)
    return onTeamsResolved(() => bump((n) => n + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return ids.map(teamOf).sort((a, b) => a.name.localeCompare(b.name))
}

export function TeamsPage({ active }: { active: boolean }) {
  const { data: groups, error, refresh } = usePolling(() => fetchLeagueTeams(), [], null, active)
  const favs = useFavorites()
  const [query, setQuery] = useState('')
  const mine = useFavoriteTeams(favs.ids)
  const { leagues } = useLeagueOrder(active)
  const sorted = groups && [...groups].sort((a, b) => leagues.findIndex((l) => l.key === a.league.key) - leagues.findIndex((l) => l.key === b.league.key))

  const q = query.trim().toLowerCase()
  const match = (t: Team) => !q || `${t.name} ${t.code}`.toLowerCase().includes(q)

  return (
    <>
      <PageHeader title="Équipes" subtitle="Favoris, alertes et direct" />
      <div className="content">
        <section className="card">
          <h3 className="card-title">Favoris</h3>
          {mine.length === 0 ? (
            <p className="muted">Touchez l’étoile d’une équipe ci-dessous pour la suivre : ses matchs remontent en tête de la liste.</p>
          ) : (
            <ul className="team-list">
              {mine.map((t) => (
                <li key={t.id}>
                  <a href={href.team(t.id)} className="team-link">
                    <TeamLogo team={t} size={36} />
                    <span>{t.name}</span>
                  </a>
                  <button className="icon-btn star on" onClick={() => favs.toggle(t.id)} aria-label={`Retirer ${t.name} des favoris`}>
                    <Star on />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AlertsCard />

        <LiveKeyCard />

        <section className="card">
          <h3 className="card-title">Toutes les équipes</h3>
          <input className="search" type="search" placeholder="Rechercher une équipe…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {error && !groups && <ErrorBox error={error} onRetry={refresh} />}
          {!groups && !error && <Loading />}
          {sorted?.map((g) => {
            const list = g.teams.filter(match)
            if (!list.length) return null
            return (
              <div key={g.league.key} className="team-group">
                <h4 className="section-title">
                  {g.league.label} · {g.league.region}
                </h4>
                <ul className="team-grid">
                  {list.map((t) => (
                    <li key={t.id}>
                      <a href={href.team(t.id)} className="team-tile">
                        <TeamLogo team={t} size={40} />
                        <span>{t.name}</span>
                      </a>
                      <button
                        className={`icon-btn star ${favs.has(t.id) ? 'on' : ''}`}
                        onClick={() => favs.toggle(t.id)}
                        aria-pressed={favs.has(t.id)}
                        aria-label={`${favs.has(t.id) ? 'Retirer' : 'Ajouter'} ${t.name} ${favs.has(t.id) ? 'des' : 'aux'} favoris`}
                      >
                        <Star on={favs.has(t.id)} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
        <p className="footnote">LoL Live · version {import.meta.env.VITE_BUILD || 'locale'}</p>
      </div>
    </>
  )
}

const ALERT_OPTIONS: { key: keyof AlertSettings; label: string; hint?: string }[] = [
  { key: 'favoritesOnly', label: 'Seulement mes équipes', hint: 'Sinon : tous les matchs suivis' },
  { key: 'start', label: 'Début de série' },
  { key: 'gameEnd', label: 'Fin de chaque game', hint: 'Avec le score de la série' },
  { key: 'decider', label: 'Game décisive', hint: 'Série à égalité à une victoire du but (1-1 en BO3, 2-2 en BO5)' },
  { key: 'final', label: 'Résultat final' },
]

function AlertsCard() {
  const { settings, update } = useAlertSettings()
  const [perm, setPerm] = useState<Permission>('default')
  useEffect(() => {
    notificationPermission().then(setPerm)
  }, [])

  const toggleEnabled = async () => {
    if (!settings.enabled && perm === 'default') setPerm(await requestNotificationPermission())
    update({ enabled: !settings.enabled })
  }

  return (
    <section className="card">
      <h3 className="card-title">Alertes</h3>
      <label className="switch-row">
        <span>
          <strong>Activer les alertes</strong>
          <small className="muted">Notifications pendant que l’app est ouverte ou en arrière-plan.</small>
        </span>
        <input type="checkbox" role="switch" checked={settings.enabled} onChange={toggleEnabled} />
      </label>
      {settings.enabled && perm === 'denied' && (
        <p className="warn">
          Les notifications sont bloquées par le navigateur : les alertes s’afficheront seulement dans l’app.
          {isNative
            ? ' Autorisez-les dans les réglages Android de l’application.'
            : /iPhone|iPad/.test(navigator.userAgent) && ' Sur iPhone, ajoutez d’abord l’app à l’écran d’accueil.'}
        </p>
      )}
      {settings.enabled &&
        ALERT_OPTIONS.map((o) => (
          <label key={o.key} className="switch-row sub">
            <span>
              {o.label}
              {o.hint && <small className="muted">{o.hint}</small>}
            </span>
            <input type="checkbox" role="switch" checked={!!settings[o.key]} onChange={(e) => update({ [o.key]: e.target.checked })} />
          </label>
        ))}
      {settings.enabled && (
        <p className="muted small">Sans clé LoL Esports, les alertes suivent Leaguepedia : elles arrivent quelques minutes après la fin de chaque game.</p>
      )}
    </section>
  )
}

/** Clé de l'API LoL Esports : active le direct exact (score, or, objectifs) à la place des résultats différés. */
function LiveKeyCard() {
  const { settings, update } = useLiveSettings()
  const [draft, setDraft] = useState(settings.apiKey)
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | undefined>()
  const [testing, setTesting] = useState(false)
  const active = !!settings.apiKey

  const test = async () => {
    setTesting(true)
    try {
      const live = await fetchLive()
      setStatus({ ok: true, text: live.length ? `Clé acceptée · ${live.length} série${live.length > 1 ? 's' : ''} en direct` : 'Clé acceptée · aucune série en direct pour le moment' })
    } catch (e) {
      setStatus({ ok: false, text: e instanceof MissingKeyError ? 'Aucune clé enregistrée.' : (e as Error).message })
    } finally {
      setTesting(false)
    }
  }
  const save = () => {
    update({ apiKey: draft.trim() })
    setStatus(undefined)
    if (draft.trim()) setTimeout(test, 0)
  }
  const remove = () => {
    update({ apiKey: '' })
    setDraft('')
    setStatus(undefined)
  }

  return (
    <section className="card">
      <h3 className="card-title">Direct LoL Esports</h3>
      <p className="muted small">
        Sans clé, l’app utilise Leaguepedia : calendrier, drafts et statistiques, avec quelques minutes de retard. Avec la clé de
        l’API de lolesports.com, elle affiche le direct exact : score de la série en temps réel, or, kills, objectifs et joueurs de la
        game en cours.
      </p>
      <details className="howto">
        <summary>Où trouver la clé ?</summary>
        <ol>
          <li>Ouvrez lolesports.com sur un ordinateur, puis les outils de développement (F12), onglet « Réseau ».</li>
          <li>Rechargez la page et cliquez sur une requête vers <code>esports-api.lolesports.com</code> (ex. getSchedule).</li>
          <li>Copiez la valeur de l’en-tête <code>x-api-key</code> et collez-la ici.</li>
        </ol>
        <p className="muted small">La clé reste sur cet appareil et n’est envoyée qu’à LoL Esports. Elle peut changer : recommencez alors la manipulation.</p>
      </details>
      <div className="key-row">
        <input
          className="search"
          type={show ? 'text' : 'password'}
          placeholder="Collez la clé x-api-key"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="chip" onClick={() => setShow(!show)} aria-pressed={show}>
          {show ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      <div className="key-actions">
        <button className="btn" onClick={save} disabled={!draft.trim() || draft.trim() === settings.apiKey}>
          Enregistrer
        </button>
        {active && (
          <>
            <button className="link-btn" onClick={test} disabled={testing}>
              {testing ? 'Test…' : 'Tester la clé'}
            </button>
            <button className="link-btn" onClick={remove}>
              Supprimer
            </button>
          </>
        )}
      </div>
      {status && <p className={status.ok ? 'muted small' : 'warn'}>{status.text}</p>}
    </section>
  )
}
