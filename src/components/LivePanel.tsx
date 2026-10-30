import { useEffect, useState, type ReactNode } from 'react'
import { champName } from '../api/ddragon'
import { fetchLiveGame, type LiveGameView } from '../api/live'
import { goldSeries, loadGoldHistory, recordGold, type LivePlayer, type LiveTeam } from '../api/lolesports'
import type { Match, Team } from '../api/types'
import { usePolling } from '../hooks/usePolling'
import { goldDiff, kda, kilo } from '../lib/format'
import { GoldChart } from './GoldChart'
import { PlayerSheet } from './LivePlayerSheet'
import { ChampIcon, LiveBadge, TeamLogo } from './ui'

type Side = 'blue' | 'red'

const DRAGONS: Record<string, string> = {
  ocean: 'Océan',
  infernal: 'Infernal',
  mountain: 'Montagne',
  cloud: 'Nuage',
  hextech: 'Hextech',
  chemtech: 'Chimtech',
  elder: 'Ancestral',
}

const ROLES: Record<string, string> = { top: 'Top', jungle: 'Jungle', mid: 'Mid', bottom: 'Bot', support: 'Support' }
const ROLE_ORDER = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

/** Camp en tête d'après un écart d'or (bleu moins rouge). */
const lead = (diff: number): Side => (diff >= 0 ? 'blue' : 'red')

// ---------- Score, kills et barre d'or ----------

function ScoreCard({ view, ta, tb }: { view: LiveGameView; ta: Team; tb: Team }) {
  const { frame, number } = view
  const { blue, red } = frame
  const diff = blue.gold - red.gold
  const share = blue.gold + red.gold ? (blue.gold / (blue.gold + red.gold)) * 100 : 50
  const ahead = lead(diff)
  const aheadTeam = ahead === 'blue' ? ta : tb
  return (
    <section className="card live-panel lv-score">
      <div className="lv-head">
        <LiveBadge />
        <strong>Game {number}</strong>
        {frame.patch && <span className="muted">patch {frame.patch.split('.').slice(0, 2).join('.')}</span>}
        {frame.state === 'paused' && <span className="warn">En pause</span>}
      </div>
      <div className="lv-sc">
        <div className="lv-team">
          <TeamLogo team={ta} size={34} />
          <span>
            <b>{ta.code}</b>
            <small>côté bleu</small>
          </span>
        </div>
        <div className="lv-kills" role="img" aria-label={`Kills : ${ta.code} ${blue.kills}, ${tb.code} ${red.kills}`}>
          <b className="lv-b">{blue.kills}</b>
          <small>kills</small>
          <b className="lv-r">{red.kills}</b>
        </div>
        <div className="lv-team right">
          <TeamLogo team={tb} size={34} />
          <span>
            <b>{tb.code}</b>
            <small>côté rouge</small>
          </span>
        </div>
      </div>
      <div className="lv-gold" role="img" aria-label={`Or : ${ta.code} ${kilo(blue.gold)}, ${tb.code} ${kilo(red.gold)}`}>
        <div className="lv-bar">
          <i className="b" style={{ width: `${share.toFixed(1)}%` }} />
          <i className="r" style={{ width: `${(100 - share).toFixed(1)}%` }} />
        </div>
        <div className="lv-bar-lab">
          <span className="lv-b">{kilo(blue.gold)}</span>
          {diff === 0 ? <span className="lv-chip">Égalité en or</span> : <span className={`lv-chip ${ahead}`}>{aheadTeam.code} {goldDiff(Math.abs(diff))} d’or</span>}
          <span className="lv-r">{kilo(red.gold)}</span>
        </div>
      </div>
    </section>
  )
}

// ---------- Objectifs en paires ----------

function Pips({ n, total, side, left }: { n: number; total: number; side: Side; left?: boolean }) {
  return (
    <span className={`lv-pips ${side} ${left ? 'left' : ''}`} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  )
}

function Dragons({ list, left }: { list: string[]; left?: boolean }) {
  return (
    <span className={`lv-dragons ${left ? 'left' : ''}`} aria-hidden="true">
      {Array.from({ length: Math.max(4, list.length) }, (_, i) => {
        const t = list[i]
        return <i key={i} className={t ? `dr dr-${DRAGONS[t] ? t : 'other'}` : 'dr off'} title={t ? (DRAGONS[t] ?? t) : undefined} />
      })}
    </span>
  )
}

function ObjRow({ label, a, b, left, right }: { label: string; a: number; b: number; left: ReactNode; right: ReactNode }) {
  return (
    <div className="lv-obj" role="group" aria-label={`${label} : ${a} contre ${b}`}>
      <b className="lv-b">{a}</b>
      {left}
      <span className="lbl">{label}</span>
      {right}
      <b className="lv-r">{b}</b>
    </div>
  )
}

function Objectives({ blue, red }: { blue: LiveTeam; red: LiveTeam }) {
  const barons = Math.max(2, blue.barons, red.barons)
  return (
    <section className="card lv-block">
      <h4 className="lv-title">Objectifs</h4>
      <ObjRow label="Tours" a={blue.towers} b={red.towers} left={<Pips n={blue.towers} total={11} side="blue" left />} right={<Pips n={red.towers} total={11} side="red" />} />
      <ObjRow label="Inhibiteurs" a={blue.inhibitors} b={red.inhibitors} left={<Pips n={blue.inhibitors} total={3} side="blue" left />} right={<Pips n={red.inhibitors} total={3} side="red" />} />
      <ObjRow label="Dragons" a={blue.dragons.length} b={red.dragons.length} left={<Dragons list={blue.dragons} left />} right={<Dragons list={red.dragons} />} />
      <ObjRow label="Barons" a={blue.barons} b={red.barons} left={<Pips n={blue.barons} total={barons} side="blue" left />} right={<Pips n={red.barons} total={barons} side="red" />} />
    </section>
  )
}

// ---------- Face-à-face par poste ----------

function Cell({ p, side, onPick }: { p: LivePlayer; side: Side; onPick: (side: Side, id: number) => void }) {
  return (
    <button
      type="button"
      className={`lv-cell ${side}`}
      onClick={() => onPick(side, p.id)}
      aria-label={`${p.name}, ${champName(p.champion)}, ${p.kills}/${p.deaths}/${p.assists}, ${p.cs} CS. Ouvrir le détail du joueur.`}
    >
      <span className="lv-cw">
        <ChampIcon champion={p.champion} size={36} />
        <i className="lv-lvl">{p.level}</i>
      </span>
      <span className="lv-who">
        <b>{p.name}</b>
        <span title={`KDA ${kda(p.kills, p.deaths, p.assists)}`}>
          {p.kills}/{p.deaths}/{p.assists}
        </span>
        <span>{p.cs} CS</span>
      </span>
    </button>
  )
}

function Duels({ blue, red, ta, tb, onPick }: { blue: LiveTeam; red: LiveTeam; ta: Team; tb: Team; onPick: (side: Side, id: number) => void }) {
  const rows = Math.max(blue.players.length, red.players.length)
  return (
    <section className="card lv-block">
      <h4 className="lv-title">Face à face par poste</h4>
      <div className="lv-duel-head">
        <span className="lv-b">{ta.code}</span>
        <span />
        <span className="lv-r">{tb.code}</span>
      </div>
      {Array.from({ length: rows }, (_, i) => {
        const x = blue.players[i]
        const y = red.players[i]
        // Le flux liste les joueurs dans l'ordre des postes (haut, jungle, milieu, bas, soutien).
        const role = ROLES[x?.role ?? ''] ?? ROLES[y?.role ?? ''] ?? ROLE_ORDER[i] ?? ''
        const d = x && y ? x.gold - y.gold : 0
        return (
          <div className="lv-duel" key={i}>
            {x ? <Cell p={x} side="blue" onPick={onPick} /> : <span />}
            <div className="lv-role">
              <span>{role}</span>
              {x && y && <em className={`lv-chip ${d === 0 ? '' : lead(d)}`}>{goldDiff(Math.abs(d))}</em>}
            </div>
            {y ? <Cell p={y} side="red" onPick={onPick} /> : <span />}
          </div>
        )
      })}
      <p className="lv-note">Touche un joueur pour ses objets, ses runes et ses sorts. Le chiffre central est l’écart d’or du poste, dans la couleur du joueur en avance.</p>
    </section>
  )
}

// ---------- Panneau ----------

/** Stats de la game en cours, relevées dans le flux public de LoL Esports (série repérée par applyLive). */
export function LivePanel({ match }: { match: Match }) {
  const { data, error } = usePolling<LiveGameView | undefined>((s) => fetchLiveGame(match, s), [match.id, match.live?.eventMatchId], 10_000)
  const [, bump] = useState(0)
  const [picked, setPicked] = useState<{ side: Side; id: number }>()
  const gameId = data?.frame.gameId

  // Chaque image reçue complète la courbe d'or de la game.
  useEffect(() => {
    if (!data) return
    recordGold(data.frame)
    bump((n) => n + 1)
  }, [data])

  // À l'ouverture, on relit le début de la game dans l'historique du flux.
  useEffect(() => {
    if (!data) return
    let mounted = true
    loadGoldHistory(data.frame)
      .then(() => mounted && bump((n) => n + 1))
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [gameId])

  useEffect(() => setPicked(undefined), [gameId])

  if (error && !data) return <p className="warn">Direct indisponible : {error.message}</p>
  if (!data) return <p className="muted small">Le flux en direct n’a pas encore d’images pour cette game (délai de 30 à 60 s).</p>

  const { frame, blueIsA } = data
  const [ta, tb] = blueIsA ? [match.a.team, match.b.team] : [match.b.team, match.a.team]
  const player = picked ? frame[picked.side].players.find((p) => p.id === picked.id) : undefined
  return (
    <>
      <ScoreCard view={data} ta={ta} tb={tb} />
      <Objectives blue={frame.blue} red={frame.red} />
      <GoldChart series={goldSeries(frame.gameId)} ta={ta} tb={tb} live />
      <Duels blue={frame.blue} red={frame.red} ta={ta} tb={tb} onPick={(side, id) => setPicked({ side, id })} />
      <p className="footnote">Statistiques du flux officiel, avec 30 à 60 s de retard.</p>
      {player && picked && <PlayerSheet player={player} side={picked.side} team={picked.side === 'blue' ? ta : tb} gameId={frame.gameId} onClose={() => setPicked(undefined)} />}
    </>
  )
}
