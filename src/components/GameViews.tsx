import { useState } from 'react'
import type { Game, GameTeam, PlayerLine } from '../api/types'
import { ROLES, ROLE_FR } from '../api/leagues'
import { fixed, kda, kilo, kdaNum } from '../lib/format'
import { href } from '../lib/router'
import { usePlayerElo } from '../hooks/usePlayerElo'
import { ChampIcon, EloDelta, ItemIcon, Segmented, TeamLogo } from './ui'

// ---------- Draft : bans et picks ----------

function lineFor(t: GameTeam, role: string): { champion?: string; order?: number; player?: PlayerLine } {
  const pick = t.picks.find((p) => p.role === role)
  const player = t.players.find((p) => p.role === role)
  return { champion: pick?.champion ?? player?.champion, order: pick?.order, player }
}

function PickCell({ t, role, align }: { t: GameTeam; role: string; align: 'left' | 'right' }) {
  const { champion, order, player } = lineFor(t, role)
  if (!champion) return <div className={`pick-cell ${align}`} />
  return (
    <div className={`pick-cell ${align} ${t.side}`}>
      <ChampIcon champion={champion} size={44} />
      <div className="pick-text">
        <strong>{champion}</strong>
        <span className="muted">
          {player ? (
            <a className="player-link" href={href.player(player.link)}>
              {player.name}
            </a>
          ) : (
            ROLE_FR[role]
          )}
        </span>
      </div>
      {order && <span className="pick-order">{order}</span>}
    </div>
  )
}

function BanRow({ t }: { t: GameTeam }) {
  return (
    <div className={`ban-row ${t.side}`}>
      {Array.from({ length: 5 }, (_, i) => {
        const b = t.bans[i]
        return b ? (
          <div key={i} className="ban" title={b.order ? `Ban n°${b.order}` : undefined}>
            <ChampIcon champion={b.champion} size={34} banned />
            {b.order && <span className="ban-order">{b.order}</span>}
          </div>
        ) : (
          <span key={i} className="ban empty" />
        )
      })}
    </div>
  )
}

/** Draft d'une game : bans de chaque camp, puis les cinq picks rôle par rôle. */
export function Draft({ game }: { game: Game }) {
  const { blue, red } = game
  return (
    <div className="draft">
      <div className="draft-head">
        <span className="dh blue">
          <TeamLogo team={blue.team} size={22} /> {blue.team.code} <small>Bleu</small>
        </span>
        <span className="dh red">
          <small>Rouge</small> {red.team.code} <TeamLogo team={red.team} size={22} />
        </span>
      </div>
      <h4 className="draft-sub">Bans</h4>
      <div className="ban-grid">
        <BanRow t={blue} />
        <BanRow t={red} />
      </div>
      <h4 className="draft-sub">Picks</h4>
      <div className="pick-grid">
        {ROLES.map((role) => (
          <div key={role} className="pick-line">
            <PickCell t={blue} role={role} align="left" />
            <span className="pick-role">{ROLE_FR[role]}</span>
            <PickCell t={red} role={role} align="right" />
          </div>
        ))}
      </div>
      {game.ordered && <DraftOrder game={game} />}
      <p className="footnote">
        {game.ordered
          ? 'Les numéros donnent l’ordre de la draft (1 à 20) : bans, puis picks, puis seconds bans et derniers picks.'
          : 'Ordre de la draft indisponible pour cette game.'}
        {game.patch && ` Patch ${game.patch}.`}
      </p>
    </div>
  )
}

function DraftOrder({ game }: { game: Game }) {
  const steps = [
    ...game.blue.bans.map((b) => ({ ...b, kind: 'ban', side: 'blue' })),
    ...game.red.bans.map((b) => ({ ...b, kind: 'ban', side: 'red' })),
    ...game.blue.picks.map((b) => ({ ...b, kind: 'pick', side: 'blue' })),
    ...game.red.picks.map((b) => ({ ...b, kind: 'pick', side: 'red' })),
  ]
    .filter((s) => s.order)
    .sort((a, b) => a.order! - b.order!)
  if (steps.length < 10) return null
  return (
    <>
      <h4 className="draft-sub">Déroulé</h4>
      <ol className="draft-seq">
        {steps.map((s) => (
          <li key={s.order} className={`${s.side} ds-${s.kind}`}>
            <ChampIcon champion={s.champion} size={30} banned={s.kind === 'ban'} />
            <span>{s.order}</span>
          </li>
        ))}
      </ol>
    </>
  )
}

// ---------- Tableau des scores ----------

function PlayerRow({ p, teamKills, delta }: { p: PlayerLine; teamKills: number; delta?: number }) {
  const share = teamKills ? Math.round(((p.kills + p.assists) / teamKills) * 100) : 0
  return (
    <tr>
      <th scope="row">
        <a className="player-link bs-player" href={href.player(p.link)}>
          <ChampIcon champion={p.champion} size={34} />
          <span className="bs-who">
            <span className="bs-name">{p.name}</span>
            <span className="bs-pos">{ROLE_FR[p.role] ?? p.role}</span>
          </span>
        </a>
      </th>
      <td className="strong">
        {p.kills}/{p.deaths}/{p.assists}
        <small className="muted"> {kda(p.kills, p.deaths, p.assists)}</small>
      </td>
      <td>
        <EloDelta value={delta} />
      </td>
      <td>{p.cs}</td>
      <td>{kilo(p.gold)}</td>
      <td>{kilo(p.damage)}</td>
      <td>{share} %</td>
      <td>{p.vision}</td>
      <td className="items">
        <span className="item-row">
          {Array.from({ length: 6 }, (_, i) => (
            <ItemIcon key={i} name={p.items[i] ?? ''} />
          ))}
          <ItemIcon name={p.trinket} />
        </span>
      </td>
    </tr>
  )
}

/** Stats des dix joueurs, une équipe à la fois. */
export function Scoreboard({ game }: { game: Game }) {
  const [side, setSide] = useState<'blue' | 'red'>('blue')
  const t = game[side]
  // Variation d'Elo de chaque joueur sur cette game : les cinq de l'équipe bleue (équipe 1), puis les cinq de la rouge.
  const deltas = usePlayerElo()?.recent.get(game.id)
  const total = (f: (p: PlayerLine) => number) => t.players.reduce((s, p) => s + f(p), 0)
  return (
    <div className="boxscore">
      <Segmented
        value={side}
        onChange={setSide}
        options={(['blue', 'red'] as const).map((s) => ({
          value: s,
          label: (
            <span className="seg-team">
              <TeamLogo team={game[s].team} size={18} />
              <span className="seg-name">{game[s].team.name}</span>
              {game[s].win && <span className="win-tag">V</span>}
            </span>
          ),
        }))}
      />
      <div className="table-scroll">
        <table className="bs-table lol">
          <thead>
            <tr>
              <th scope="col">Joueur</th>
              <th scope="col">K/D/A</th>
              <th scope="col">Elo</th>
              <th scope="col">CS</th>
              <th scope="col">Or</th>
              <th scope="col">Dég.</th>
              <th scope="col">PK</th>
              <th scope="col">Vision</th>
              <th scope="col">Objets</th>
            </tr>
          </thead>
          <tbody>
            {t.players.map((p, i) => (
              <PlayerRow key={p.link + p.champion} p={p} teamKills={t.kills} delta={deltas?.[(side === 'blue' ? 0 : 5) + i]} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>
                {total((p) => p.kills)}/{total((p) => p.deaths)}/{total((p) => p.assists)}
              </td>
              <td />
              <td>{total((p) => p.cs)}</td>
              <td>{kilo(total((p) => p.gold))}</td>
              <td>{kilo(total((p) => p.damage))}</td>
              <td />
              <td>{total((p) => p.vision)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <RunesBlock team={t} />
      <p className="footnote">PK : participation aux kills · Dég. : dégâts aux champions · Or et dégâts en milliers.</p>
    </div>
  )
}

function RunesBlock({ team }: { team: GameTeam }) {
  const players = team.players.filter((p) => p.keystone)
  if (!players.length) return null
  return (
    <details className="runes">
      <summary>Runes et sorts d’invocateur</summary>
      <ul>
        {players.map((p) => (
          <li key={p.link + p.champion}>
            <strong>{p.name}</strong>
            <span className="muted">
              {p.keystone}
              {p.trees.length ? ` (${p.trees.join(' + ')})` : ''} · {p.spells.join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

// ---------- Objectifs et comparaison d'équipes ----------

/** Compare les deux camps : valeurs aux extrémités, barre partagée au milieu (bleu à gauche, rouge à droite). */
export function TeamCompare({ game }: { game: Game }) {
  const { blue, red } = game
  const rows: { label: string; b: number; r: number; fmt?: (n: number) => string }[] = [
    { label: 'Kills', b: blue.kills, r: red.kills },
    { label: 'Or', b: blue.gold, r: red.gold, fmt: kilo },
    { label: 'Tours', b: blue.towers, r: red.towers },
    { label: 'Dragons', b: blue.dragons, r: red.dragons },
    { label: 'Barons', b: blue.barons, r: red.barons },
    { label: 'Hérauts', b: blue.heralds, r: red.heralds },
    { label: 'Larves du Néant', b: blue.grubs, r: red.grubs },
    { label: 'Inhibiteurs', b: blue.inhibitors, r: red.inhibitors },
  ]
  const minutes = game.minutes || 1
  return (
    <div className="stat-compare">
      <div className="sc-legend">
        <span>
          <TeamLogo team={blue.team} size={20} />
          <i className="key key-blue" />
          {blue.team.code}
        </span>
        <span>
          {red.team.code}
          <i className="key key-red" />
          <TeamLogo team={red.team} size={20} />
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="sc-row">
          <div className="sc-values">
            <span>{(r.fmt ?? String)(r.b)}</span>
            <span className="sc-label">{r.label}</span>
            <span>{(r.fmt ?? String)(r.r)}</span>
          </div>
          <div className="sc-bar">
            <span className="blue" style={{ flexGrow: r.b + r.r ? r.b / (r.b + r.r) : 0.5 }} />
            <span className="red" style={{ flexGrow: r.b + r.r ? r.r / (r.b + r.r) : 0.5 }} />
          </div>
        </div>
      ))}
      <p className="footnote">
        Durée {game.length} · {fixed((blue.kills + red.kills) / minutes)} kills par minute
        {blue.players.length > 0 && ` · meilleur KDA : ${bestKda(game)}`}
      </p>
    </div>
  )
}

function bestKda(game: Game): string {
  const all = [...game.blue.players, ...game.red.players]
  const best = all.reduce((a, b) => (kdaNum(b.kills, b.deaths, b.assists) > kdaNum(a.kills, a.deaths, a.assists) ? b : a))
  return `${best.name} (${best.kills}/${best.deaths}/${best.assists})`
}
