// Calcule l'Elo des joueurs sur toutes les games de Leaguepedia (depuis 2011) et écrit public/elo-players.json.
//
//   node scripts/build-player-elo.mjs            calcule avec les paramètres par défaut (src/lib/playerEloCore.ts)
//   node scripts/build-player-elo.mjs --tune     cherche d'abord les meilleurs paramètres sur l'historique
//   node scripts/build-player-elo.mjs --refresh  retélécharge les games (sinon celles gardées dans le dossier temporaire)
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PLAYER_DEFAULTS, applyGame, evaluate } from '../src/lib/playerEloCore.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(tmpdir(), 'lol-elo-games.json')
const PAGE = 2000
const args = new Set(process.argv.slice(2))
const INTL = new Set(['World Championship', 'Mid-Season Invitational', 'First Stand', 'Esports World Cup', 'Esports Nations Cup', 'Asian Games 2018', 'International Wildcard Invitational', 'Mid-Season Cup 2020'])

function cargo(params) {
  const url = 'https://lol.fandom.com/wiki/Special:CargoExport?' + new URLSearchParams({ ...params, format: 'json' })
  for (let attempt = 0; ; attempt++) {
    try {
      const out = execFileSync('curl', ['-sS', '-L', '--max-time', '240', '-A', 'LoLLiveElo/1.0', url], { maxBuffer: 1024 * 1024 * 1024 }).toString()
      if (out.startsWith('Error')) throw new Error(out.slice(0, 200))
      return JSON.parse(out)
    } catch (e) {
      if (attempt >= 3) throw e
      console.error('  nouvel essai :', String(e.message).slice(0, 80))
    }
  }
}

function downloadGames() {
  if (!args.has('--refresh') && existsSync(CACHE)) {
    console.log('games lues dans', CACHE)
    return JSON.parse(readFileSync(CACHE, 'utf8'))
  }
  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const page = cargo({
      tables: 'ScoreboardGames=SG,Tournaments=T',
      join_on: 'SG.OverviewPage=T.OverviewPage',
      fields: 'SG.Team1,SG.Team2,SG.Team1Players,SG.Team2Players,SG.Winner,SG.DateTime_UTC,T.League,T.Region,T.TournamentLevel,T.IsPlayoffs',
      where: "T.IsOfficial='1' AND T.TournamentLevel IN ('Primary','Secondary')",
      order_by: 'SG.DateTime_UTC,SG.GameId',
      limit: PAGE,
      offset,
    })
    rows.push(...page)
    console.log(`  ${rows.length} games…`)
    if (page.length < PAGE) break
  }
  writeFileSync(CACHE, JSON.stringify(rows))
  return rows
}

const leagues = {}
const games = []
for (const r of downloadGames()) {
  const a = (r.Team1Players ?? []).map(String)
  const b = (r.Team2Players ?? []).map(String)
  const winner = Number(r.Winner)
  if (a.length !== 5 || b.length !== 5 || a.some((x) => !x) || b.some((x) => !x) || (winner !== 1 && winner !== 2)) continue
  const league = r.League || '?'
  games.push({
    t: Date.parse(r['DateTime UTC'].replace(' ', 'T') + 'Z'),
    a,
    b,
    ta: r.Team1,
    tb: r.Team2,
    aWon: winner === 1,
    league,
    intl: r.Region === 'International' || INTL.has(league) || /^Rift Rivals/.test(league),
    playoffs: Number(r.IsPlayoffs) === 1,
  })
  if (r.League) leagues[r.League] ??= [r.Region || '', r.TournamentLevel === 'Primary' ? 'P' : 'S']
}
games.sort((x, y) => x.t - y.t)
console.log(`${games.length} games du ${new Date(games[0].t).toISOString().slice(0, 10)} au ${new Date(games.at(-1).t).toISOString().slice(0, 10)}`)

let params = { ...PLAYER_DEFAULTS }
const FROM = Date.parse('2016-01-01')
if (args.has('--tune')) {
  // Toutes les games comptent pareil : on ne règle ni poids international ni poids des playoffs.
  const grid = {
    kMax: [24, 32, 48, 64, 96],
    kMin: [4, 6, 10, 14, 20],
    nHalf: [10, 20, 40, 80, 150],
    regress: [0, 0.15, 0.3, 0.5],
    gap: [90, 150, 240],
  }
  const objective = (e) => 0.5 * e.logloss + 0.5 * e.intlLogloss
  let best = evaluate(games, params, FROM)
  console.log('départ', JSON.stringify(params), best.logloss.toFixed(4), 'international', best.intlLogloss.toFixed(4))
  for (let pass = 0; pass < 2; pass++) {
    for (const [k, values] of Object.entries(grid)) {
      for (const v of values) {
        if (v === params[k]) continue
        const cand = { ...params, [k]: v }
        const e = evaluate(games, cand, FROM)
        if (objective(e) < objective(best) - 1e-5) {
          best = e
          params = cand
          console.log(`  ${k}=${v} → logloss ${e.logloss.toFixed(4)} (international ${e.intlLogloss.toFixed(4)}, ${(e.intlAccuracy * 100).toFixed(1)} % bien prévues)`)
        }
      }
    }
  }
  console.log('retenu', JSON.stringify(params))
}
const score = evaluate(games, params, FROM)
console.log(`qualité depuis 2016 : logloss ${score.logloss.toFixed(4)}, ${(score.accuracy * 100).toFixed(1)} % de games bien prévues (${score.n} games) ; international : ${score.intlLogloss.toFixed(4)}, ${(score.intlAccuracy * 100).toFixed(1)} % (${score.intlN} games)`)

// Calcul final avec un point d'historique par joueur et par mois (gardé pour les meilleurs joueurs actifs).
const state = {}
const hist = {}
const month = (t) => {
  const d = new Date(t)
  return (d.getUTCFullYear() - 2011) * 12 + d.getUTCMonth()
}
for (const g of games) {
  applyGame(state, g, params)
  const m = month(g.t)
  for (const id of [...g.a, ...g.b]) {
    const h = (hist[id] ??= [])
    const r = Math.round(state[id].r)
    if (h.length && h.at(-1)[0] === m) h.at(-1)[1] = r
    else h.push([m, r])
  }
}
const until = games.at(-1).t
const DAY = 86_400_000
const active = Object.entries(state).filter(([, s]) => until / DAY - s.last <= 548 && s.n >= 5)
const players = {}
for (const [id, s] of active) players[id] = [Math.round(s.r * 10) / 10, s.n, s.last, s.lg, s.team, s.role, Math.round(s.peak), s.w, s.l]
const history = {}
for (const [id] of active.sort((x, y) => y[1].r - x[1].r).slice(0, 700)) history[id] = hist[id].slice(-36)
const usedLeagues = Object.fromEntries(Object.entries(leagues).filter(([l]) => active.some(([, s]) => s.lg === l)))
mkdirSync(join(ROOT, 'public'), { recursive: true })
const out = { v: 1, builtAt: new Date().toISOString(), until, params, players, history, leagues: usedLeagues, quality: { logloss: +score.logloss.toFixed(4), accuracy: +score.accuracy.toFixed(4), n: score.n, intlAccuracy: +score.intlAccuracy.toFixed(4), intlN: score.intlN } }
writeFileSync(join(ROOT, 'public', 'elo-players.json'), JSON.stringify(out))
console.log(`public/elo-players.json : ${active.length} joueurs actifs, ${(JSON.stringify(out).length / 1024).toFixed(0)} Ko`)
const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']
for (const [id, s] of active.sort((x, y) => y[1].r - x[1].r).slice(0, 15)) console.log(`  ${Math.round(s.r)}  ${id}  (${ROLES[s.role]}, ${s.team}, ${s.n} games)`)
