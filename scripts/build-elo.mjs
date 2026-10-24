// Calcule le classement Elo mondial sur tout l'historique de Leaguepedia (depuis 2011) et écrit public/elo.json.
// Le calcul est fait game par game : chaque game d'une série (BO1, BO3 ou BO5) pèse pareil.
//
//   node scripts/build-elo.mjs            calcule avec les paramètres par défaut (src/lib/eloCore.ts)
//   node scripts/build-elo.mjs --tune     cherche d'abord les meilleurs paramètres sur l'historique
//   node scripts/build-elo.mjs --refresh  retélécharge les séries (sinon celles gardées dans le dossier temporaire)
//
// Les séries viennent de Special:CargoExport (curl, donc le proxy éventuel est respecté). L'appli charge ensuite
// public/elo.json et n'ajoute que les séries postérieures à `until`.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULTS, applySeries, evaluate } from '../src/lib/eloCore.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(tmpdir(), 'lol-elo-series.json')
const PAGE = 2000
const args = new Set(process.argv.slice(2))

function cargo(params) {
  const url = 'https://lol.fandom.com/wiki/Special:CargoExport?' + new URLSearchParams({ ...params, format: 'json' })
  for (let attempt = 0; ; attempt++) {
    try {
      const out = execFileSync('curl', ['-sS', '-L', '--max-time', '180', '-A', 'LoLLiveElo/1.0', url], { maxBuffer: 512 * 1024 * 1024 }).toString()
      if (out.startsWith('Error')) throw new Error(out.slice(0, 200))
      return JSON.parse(out)
    } catch (e) {
      if (attempt >= 3) throw e
      console.error('  nouvel essai :', String(e.message).slice(0, 80))
    }
  }
}

function downloadSeries() {
  if (!args.has('--refresh') && existsSync(CACHE)) {
    console.log('séries lues dans', CACHE)
    return JSON.parse(readFileSync(CACHE, 'utf8'))
  }
  const rows = []
  for (let offset = 0; ; offset += PAGE) {
    const page = cargo({
      tables: 'MatchSchedule=MS,Tournaments=T',
      join_on: 'MS.OverviewPage=T.OverviewPage',
      fields: 'MS.MatchId,MS.Team1,MS.Team2,MS.Team1Score,MS.Team2Score,MS.Winner,MS.DateTime_UTC,MS.BestOf,T.League,T.Region,T.TournamentLevel,T.IsPlayoffs',
      where: "MS.Winner IN (1,2) AND T.IsOfficial='1' AND T.TournamentLevel IN ('Primary','Secondary')",
      order_by: 'MS.DateTime_UTC,MS.MatchId',
      limit: PAGE,
      offset,
    })
    rows.push(...page)
    console.log(`  ${rows.length} séries…`)
    if (page.length < PAGE) break
  }
  writeFileSync(CACHE, JSON.stringify(rows))
  return rows
}

function downloadAliases() {
  const out = {}
  const rows = cargo({ tables: 'Teams', fields: 'Name,OverviewPage,RenamedTo', where: "RenamedTo IS NOT NULL AND RenamedTo != ''", limit: 5000 })
  for (const r of rows) {
    if (r.RenamedTo) for (const k of [r.Name, r.OverviewPage]) if (k && k !== r.RenamedTo) out[k] = r.RenamedTo
  }
  return out
}

const rows = downloadSeries()
const alias = downloadAliases()
const canon = (n) => {
  const seen = new Set()
  while (alias[n] && !seen.has(n)) {
    seen.add(n)
    n = alias[n]
  }
  return n
}

const INTL = new Set(['World Championship', 'Mid-Season Invitational', 'First Stand', 'Esports World Cup', 'Esports Nations Cup', 'Asian Games 2018', 'International Wildcard Invitational', 'Mid-Season Cup 2020'])
const leagues = {}
const series = []
for (const r of rows) {
  const a = canon(r.Team1)
  const b = canon(r.Team2)
  if (!a || !b || a === 'TBD' || b === 'TBD' || a === b) continue
  const winner = Number(r.Winner)
  let sa = Number(r['Team1Score'] ?? 0) || 0
  let sb = Number(r['Team2Score'] ?? 0) || 0
  if (sa + sb === 0 || (winner === 1 && sa <= sb) || (winner === 2 && sb <= sa)) [sa, sb] = winner === 1 ? [1, 0] : [0, 1]
  // Les compétitions internationales : Worlds et MSI portent parfois la région du pays hôte, d'où la liste.
  const intl = r.Region === 'International' || INTL.has(r.League) || /^Rift Rivals/.test(r.League || '')
  series.push({
    id: r.MatchId,
    major: r.TournamentLevel === 'Primary',
    t: Date.parse(r['DateTime UTC'].replace(' ', 'T') + 'Z'),
    a,
    b,
    sa,
    sb,
    bo: Number(r.BestOf) || Math.max(1, sa + sb),
    league: r.League || '?',
    intl,
    playoffs: Number(r.IsPlayoffs) === 1,
  })
  if (r.League) leagues[r.League] ??= [r.Region || '', r.TournamentLevel === 'Primary' ? 'P' : 'S']
}
series.sort((x, y) => x.t - y.t)
console.log(`${series.length} séries du ${new Date(series[0].t).toISOString().slice(0, 10)} au ${new Date(series.at(-1).t).toISOString().slice(0, 10)}`)

let params = { ...DEFAULTS }
const FROM = Date.parse('2015-01-01')
if (args.has('--tune')) {
  // Toutes les games comptent pareil : on ne règle ni poids international ou playoffs, ni bonus de série.
  const grid = {
    kMax: [32, 48, 64, 96, 128],
    kMin: [8, 12, 18, 24, 32],
    nHalf: [6, 12, 20, 35, 60],
    regress: [0, 0.2, 0.35, 0.5, 0.65],
    gap: [60, 90, 150, 240],
    seed: [false, true],
  }
  // Objectif : moitié qualité globale, moitié qualité sur les compétitions internationales (comparaison entre régions).
  const objective = (e) => 0.5 * e.logloss + 0.5 * e.intlLogloss
  let best = evaluate(series, params, FROM)
  console.log('départ', JSON.stringify(params), best.logloss.toFixed(4), 'international', best.intlLogloss.toFixed(4))
  for (let pass = 0; pass < 2; pass++) {
    for (const [k, values] of Object.entries(grid)) {
      for (const v of values) {
        if (v === params[k]) continue
        const cand = { ...params, [k]: v }
        const e = evaluate(series, cand, FROM)
        if (objective(e) < objective(best) - 1e-5) {
          best = e
          params = cand
          console.log(`  ${k}=${v} → logloss ${e.logloss.toFixed(4)} (international ${e.intlLogloss.toFixed(4)}, ${(e.intlAccuracy * 100).toFixed(1)} % de games bien prévues)`)
        }
      }
    }
  }
  console.log('retenu', JSON.stringify(params))
}
const score = evaluate(series, params, FROM)
console.log(`qualité depuis 2015 : logloss ${score.logloss.toFixed(4)}, ${(score.accuracy * 100).toFixed(1)} % de games bien prévues (${score.n} games) ; international : ${score.intlLogloss.toFixed(4)}, ${(score.intlAccuracy * 100).toFixed(1)} % (${score.intlN} games)`)

// Calcul final, avec un point d'historique par équipe et par mois.
const state = {}
const hist = {}
const month = (t) => {
  const d = new Date(t)
  return (d.getUTCFullYear() - 2011) * 12 + d.getUTCMonth()
}
const recent = {}
const RECENT_FROM = series.at(-1).t - 120 * 86_400_000
for (const s of series) {
  const { da, db } = applySeries(state, s, params)
  if (s.t >= RECENT_FROM && s.id) recent[s.id] = [Math.round(da * 10) / 10, Math.round(db * 10) / 10]
  const m = month(s.t)
  for (const id of [s.a, s.b]) {
    const h = (hist[id] ??= [])
    const r = Math.round(state[id].r)
    if (h.length && h.at(-1)[0] === m) h.at(-1)[1] = r
    else h.push([m, r])
  }
}
const until = series.at(-1).t
const DAY = 86_400_000
const active = Object.entries(state).filter(([, s]) => until / DAY - s.last <= 548)
const teams = {}
const history = {}
for (const [id, s] of active) {
  teams[id] = [Math.round(s.r * 10) / 10, s.n, s.last, s.lg, Math.round(s.peak), s.w, s.l]
  if (s.n >= 5) history[id] = hist[id].slice(-60)
}
const usedLeagues = Object.fromEntries(Object.entries(leagues).filter(([l]) => active.some(([, s]) => s.lg === l)))
const aliasUsed = Object.fromEntries(Object.entries(alias).filter(([k]) => series.some((s) => s.a === k || s.b === k) || true).slice(0, 4000))
mkdirSync(join(ROOT, 'public'), { recursive: true })
const out = { v: 1, builtAt: new Date().toISOString(), until, params, teams, history, leagues: usedLeagues, alias: aliasUsed, recent, quality: { logloss: +score.logloss.toFixed(4), accuracy: +score.accuracy.toFixed(4), n: score.n, intlAccuracy: +score.intlAccuracy.toFixed(4), intlN: score.intlN } }
writeFileSync(join(ROOT, 'public', 'elo.json'), JSON.stringify(out))
console.log(`${Object.keys(recent).length} séries récentes avec leur variation d'Elo`)
console.log(`public/elo.json : ${active.length} équipes actives, ${(JSON.stringify(out).length / 1024).toFixed(0)} Ko`)
const top = active.sort((x, y) => y[1].r - x[1].r).slice(0, 15)
for (const [id, s] of top) console.log(`  ${Math.round(s.r)}  ${id}  (${s.lg}, ${s.n} games)`)
