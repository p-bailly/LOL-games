import { useState } from 'react'
import { teamOf } from '../api/leaguepedia'
import { LEAGUES } from '../api/leagues'
import {
  fetchGameRecords,
  fetchPlayerRecords,
  goldGap,
  totalKills,
  type GameRecord,
  type GameRecordKind,
  type PlayerRecord,
  type PlayerRecordKind,
  type RecordScope,
} from '../api/records'
import { usePolling } from '../hooks/usePolling'
import { clock, fullDate, goldDiff, kilo } from '../lib/format'
import { href } from '../lib/router'
import { RecordCard, type Entry } from './Records'
import { Chips } from './ui'

const name = (team: string) => teamOf(team).name

const GAMES: { kind: GameRecordKind; title: string; value: (g: GameRecord) => string; sub: (g: GameRecord) => string }[] = [
  { kind: 'shortest', title: 'Game la plus courte', value: (g) => clock(g.minutes), sub: (g) => `Victoire ${name(g.teams[g.winner - 1])}` },
  { kind: 'longest', title: 'Game la plus longue', value: (g) => clock(g.minutes), sub: (g) => `Victoire ${name(g.teams[g.winner - 1])}` },
  { kind: 'kills', title: 'Plus de kills dans une game', value: (g) => String(totalKills(g)), sub: (g) => `${g.kills[0]}–${g.kills[1]}` },
  {
    kind: 'gold',
    title: 'Plus gros écart d’or en fin de game',
    value: (g) => goldDiff(goldGap(g)),
    sub: (g) => `Avance de ${name(g.teams[g.gold[0] > g.gold[1] ? 0 : 1])}`,
  },
]

const PLAYERS: { kind: PlayerRecordKind; title: string; value: (p: PlayerRecord) => string }[] = [
  { kind: 'kills', title: 'Plus de kills', value: (p) => String(p.kills) },
  { kind: 'assists', title: 'Plus d’assists', value: (p) => String(p.assists) },
  { kind: 'damage', title: 'Plus de dégâts', value: (p) => kilo(p.damage) },
  { kind: 'cs', title: 'Plus de CS', value: (p) => String(p.cs) },
  { kind: 'vision', title: 'Meilleur score de vision', value: (p) => String(p.vision) },
  { kind: 'kda', title: 'Meilleur KDA sans mourir', value: (p) => `${p.kills}/${p.deaths}/${p.assists}` },
]

function GameCard({ spec, scope, active }: { spec: (typeof GAMES)[number]; scope: RecordScope; active: boolean }) {
  const { data, error, refresh } = usePolling(() => fetchGameRecords(spec.kind, scope), [spec.kind, scope.year, scope.league], null, active)
  const entries: Entry[] = (data ?? []).map((g, i) => ({
    key: g.gameId,
    href: href.match(g.matchId),
    rank: i + 1,
    main: `${name(g.teams[0])} – ${name(g.teams[1])}`,
    sub: `${spec.sub(g)} · ${fullDate(g.date)}`,
    value: spec.value(g),
  }))
  return <RecordCard title={spec.title} entries={entries} loading={!data && !error} error={!data && !!error} onRetry={refresh} />
}

function PlayerCard({ spec, scope, active }: { spec: (typeof PLAYERS)[number]; scope: RecordScope; active: boolean }) {
  const { data, error, refresh } = usePolling(() => fetchPlayerRecords(spec.kind, scope), [spec.kind, scope.year, scope.league], null, active)
  const entries: Entry[] = (data ?? []).map((p, i) => ({
    key: `${p.gameId}|${p.link}`,
    href: href.match(p.matchId),
    rank: i + 1,
    main: p.name,
    sub: [p.champion, `${name(p.team)} vs ${name(p.opponent)}`, fullDate(p.date)].filter(Boolean).join(' · '),
    value: spec.value(p),
  }))
  return <RecordCard title={spec.title} entries={entries} loading={!data && !error} error={!data && !!error} onRetry={refresh} />
}

const FIRST_YEAR = 2011

/** Records d'une année ou de toute l'histoire de Leaguepedia, toutes ligues ou d'une seule. */
export function AllTimeRecords({ scope: kind, active }: { scope: 'year' | 'all'; active: boolean }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [league, setLeague] = useState('all')
  const scope: RecordScope = { year: kind === 'year' ? year : undefined, league: league === 'all' ? undefined : league }

  return (
    <>
      {kind === 'year' && (
        <Chips
          value={String(year)}
          onChange={(y) => setYear(Number(y))}
          options={Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => String(thisYear - i)).map((y) => ({ value: y, label: y }))}
        />
      )}
      <Chips value={league} onChange={setLeague} options={[{ value: 'all', label: 'Toutes les ligues' }, ...LEAGUES.map((l) => ({ value: l.key, label: l.label }))]} />

      <h2 className="section-title">Games</h2>
      <div className="records">
        {GAMES.map((s) => (
          <GameCard key={s.kind} spec={s} scope={scope} active={active} />
        ))}
      </div>
      <h2 className="section-title">Joueurs, sur une game</h2>
      <div className="records">
        {PLAYERS.map((s) => (
          <PlayerCard key={s.kind} spec={s} scope={scope} active={active} />
        ))}
      </div>
      <p className="footnote">
        {kind === 'all' ? 'Toute l’histoire de Leaguepedia (depuis 2011)' : `Année ${year}`}
        {league === 'all' ? ', toutes compétitions suivies par Leaguepedia' : `, ${LEAGUES.find((l) => l.key === league)?.full ?? league}`}. Les trois premiers de chaque catégorie ; touche une ligne pour ouvrir la série. Game la plus
        courte : au moins 12 minutes. Meilleur KDA : kills + assists sans mourir. Les anciennes saisons sont saisies à la main : une erreur de saisie peut s’y glisser.
      </p>
    </>
  )
}
