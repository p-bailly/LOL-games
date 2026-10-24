import { useEffect, useState, type ReactNode } from 'react'
import { Alerts } from './components/Alerts'
import { href, TABS, useRoute, type TabName } from './lib/router'
import { MatchPage } from './pages/MatchPage'
import { MatchesPage } from './pages/MatchesPage'
import { PlayerPage } from './pages/PlayerPage'
import { StandingsPage } from './pages/StandingsPage'
import { StatsPage } from './pages/StatsPage'
import { TeamPage } from './pages/TeamPage'
import { TeamsPage } from './pages/TeamsPage'

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

const TAB_META: Record<TabName, { label: string; icon: ReactNode }> = {
  matches: {
    label: 'Matchs',
    // Deux épées croisées
    icon: icon(<path d="M5 4l14 14M19 4L5 18M3.5 5.5l2-2M18.5 20.5l2-2M3.5 18.5l2 2M18.5 3.5l2 2" />),
  },
  standings: {
    label: 'Classement',
    icon: icon(<path d="M4 6h16M4 12h16M4 18h16M8 3v18" />),
  },
  stats: {
    label: 'Stats',
    icon: icon(<path d="M5 20V12M10 20V6M15 20v-9M20 20V9M3 20.5h18" />),
  },
  teams: {
    label: 'Équipes',
    icon: icon(<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />),
  },
}

function TabPage({ tab, active }: { tab: TabName; active: boolean }) {
  switch (tab) {
    case 'matches':
      return <MatchesPage active={active} />
    case 'standings':
      return <StandingsPage active={active} />
    case 'stats':
      return <StatsPage active={active} />
    case 'teams':
      return <TeamsPage active={active} />
  }
}

export function App() {
  const route = useRoute()
  const isTab = (TABS as readonly string[]).includes(route.name)
  const [lastTab, setLastTab] = useState<TabName>('matches')
  // Les onglets déjà visités restent montés : on retrouve sa position et sa date en revenant.
  const [visited, setVisited] = useState<Set<TabName>>(() => new Set(['matches']))

  useEffect(() => {
    if (!isTab) return
    const t = route.name as TabName
    setLastTab(t)
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)))
  }, [route.name, isTab])

  const currentTab = isTab ? (route.name as TabName) : lastTab

  return (
    <div className="app">
      <Alerts />
      <main className="views">
        {TABS.filter((t) => visited.has(t) || t === currentTab).map((t) => {
          const shown = isTab && t === currentTab
          return (
            <div key={t} className="view" aria-hidden={!shown} inert={!shown}>
              <TabPage tab={t} active={shown} />
            </div>
          )
        })}
        {route.name === 'match' && (
          <div key={`match-${route.id}`} className="view detail">
            <MatchPage id={route.id} />
          </div>
        )}
        {route.name === 'team' && (
          <div key={`team-${route.id}`} className="view detail">
            <TeamPage id={route.id} />
          </div>
        )}
        {route.name === 'player' && (
          <div key={`player-${route.id}`} className="view detail">
            <PlayerPage id={route.id} />
          </div>
        )}
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((t) => (
          <a key={t} href={href.tab(t)} className={t === currentTab ? 'active' : ''} aria-current={t === currentTab && isTab ? 'page' : undefined}>
            {TAB_META[t].icon}
            <span>{TAB_META[t].label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
