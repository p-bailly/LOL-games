import { useState } from 'react'
import { EloPlayers } from '../components/EloPlayers'
import { EloRanking } from '../components/EloRanking'
import { PageHeader, Segmented } from '../components/ui'

type View = 'teams' | 'players'

/** Classement Elo mondial : les équipes ou les joueurs, tous tournois confondus. */
export function RankingPage({ active }: { active: boolean }) {
  const [view, setView] = useState<View>('teams')
  return (
    <>
      <PageHeader title="Classement" subtitle="Elo mondial" />
      <div className="toolbar">
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'teams', label: 'Équipes' },
            { value: 'players', label: 'Joueurs' },
          ]}
        />
      </div>
      {view === 'teams' ? <EloRanking active={active} /> : <EloPlayers active={active} />}
    </>
  )
}
