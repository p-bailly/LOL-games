import { Capacitor } from '@capacitor/core'

// Accès aux tables Cargo de Leaguepedia (lol.fandom.com), la base ouverte des compétitions pro.
//  - appli Android : Special:CargoExport, via le HTTP natif de Capacitor (pas de CORS, pas de quota anonyme gênant) ;
//  - navigateur : api.php?action=cargoquery avec origin=* (seul point d'entrée qui autorise le CORS).
// Les deux renvoient les mêmes lignes, à deux détails près que `rows()` gomme : les listes sont des tableaux d'un
// côté, du texte « a,b,c » de l'autre ; et le texte de api.php est échappé en HTML.

const ORIGIN = 'https://lol.fandom.com'
const native = Capacitor.isNativePlatform()

export interface CargoQuery {
  tables: string
  fields: string
  where?: string
  join_on?: string
  group_by?: string
  order_by?: string
  limit?: number
  offset?: number
}

export type Row = Record<string, unknown>

const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#0?39|apos);/g, (_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e] ?? "'")

/** Clés « DateTime UTC » → « DateTime_UTC », sans les colonnes « __precision » ; texte déséchappé. */
function clean(raw: Record<string, unknown>): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(raw)) {
    if (k.endsWith('__precision')) continue
    out[k.replace(/ /g, '_')] = typeof v === 'string' ? decode(v) : v
  }
  return out
}

export const str = (v: unknown): string => (v == null ? '' : String(v))
export const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
/** Liste Cargo : tableau, ou texte séparé par « ;; » (effectifs) ou par des virgules. */
export const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => str(x).trim())
    : typeof v === 'string' && v
      ? v.split(v.includes(';;') ? ';;' : ',').map((x) => x.trim())
      : []

/** Valeur d'une clause where entre apostrophes. */
export const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
export const qList = (a: string[]) => a.map(q).join(',')
/** "2026-10-23T17:00:00Z" → "2026-10-23 17:00:00" (format des dates Cargo, en UTC). */
export const sqlDate = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')
/** "2026-10-23 17:00:00" → "2026-10-23T17:00:00Z" */
export const isoDate = (s: string) => s.replace(' ', 'T') + 'Z'

// ---------- Cache et file d'attente ----------

const memory = new Map<string, { at: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

/** Résultat gardé `ttl` ms en mémoire ; les appels simultanés partagent la même requête. */
export function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key)
  if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value as T)
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>
  const p = load()
    .then((value) => {
      memory.set(key, { at: Date.now(), value })
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

/** Comme `cached`, mais le résultat survit aux redémarrages (localStorage), pour les données qui bougent peu. */
export async function persisted<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const k = `rift:cache:${key}`
  try {
    const raw = localStorage.getItem(k)
    if (raw) {
      const { at, value } = JSON.parse(raw) as { at: number; value: T }
      if (Date.now() - at < ttl) return value
    }
  } catch {
    /* stockage indisponible */
  }
  const value = await cached(k, ttl, load)
  try {
    localStorage.setItem(k, JSON.stringify({ at: Date.now(), value }))
  } catch {
    /* plein ou indisponible : tant pis */
  }
  return value
}

// Une requête à la fois, espacées : Leaguepedia limite les appels anonymes.
let chain: Promise<unknown> = Promise.resolve()
const GAP = native ? 150 : 400
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job)
  chain = run.then(() => sleep(GAP), () => sleep(GAP))
  return run
}

function url(query: CargoQuery): string {
  const p = new URLSearchParams()
  if (native) {
    for (const [k, v] of Object.entries(query)) if (v !== undefined) p.set(k, String(v))
    p.set('format', 'json')
    return `${ORIGIN}/wiki/Special:CargoExport?${p}`
  }
  p.set('action', 'cargoquery')
  p.set('format', 'json')
  p.set('origin', '*')
  for (const [k, v] of Object.entries(query)) if (v !== undefined) p.set(k, String(v))
  return `${ORIGIN}/api.php?${p}`
}

async function fetchRows(query: CargoQuery, signal?: AbortSignal): Promise<Row[]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url(query), { signal })
    if (!res.ok) throw new Error(`Leaguepedia : erreur ${res.status}`)
    const body = await res.text()
    // Cargo signale ses erreurs en texte brut (CargoExport) ou en JSON (api.php).
    if (body.startsWith('Error')) throw new Error(`Leaguepedia : ${body.slice(0, 160)}`)
    const json = JSON.parse(body) as unknown
    if (Array.isArray(json)) return json.map((r) => clean(r as Record<string, unknown>))
    const obj = json as { error?: { code?: string; info?: string }; cargoquery?: { title: Record<string, unknown> }[] }
    if (obj.error) {
      if (obj.error.code === 'ratelimited' && attempt < 3) {
        await sleep(2000 * 2 ** attempt)
        continue
      }
      throw new Error(obj.error.code === 'ratelimited' ? 'Leaguepedia limite les requêtes : réessayez dans un instant.' : `Leaguepedia : ${obj.error.info}`)
    }
    return (obj.cargoquery ?? []).map((r) => clean(r.title))
  }
}

/** Exécute une requête Cargo (mise en file, relancée si Leaguepedia limite le débit). */
export function cargo(query: CargoQuery, signal?: AbortSignal): Promise<Row[]> {
  return enqueue(() => fetchRows(query, signal))
}

/** Toutes les lignes d'une requête, 500 par 500 (Cargo plafonne chaque réponse) : l'`order_by` doit départager chaque ligne. */
export async function cargoAll(query: CargoQuery, signal?: AbortSignal, maxPages = 10): Promise<Row[]> {
  const out: Row[] = []
  for (let page = 0; page < maxPages; page++) {
    const rows = await cargo({ ...query, limit: 500, offset: page * 500 }, signal)
    out.push(...rows)
    if (rows.length < 500) break
  }
  return out
}

/** `cargo` avec cache mémoire (clé = la requête elle-même). */
export function cargoCached(query: CargoQuery, ttl: number, signal?: AbortSignal): Promise<Row[]> {
  return cached(`cargo:${JSON.stringify(query)}`, ttl, () => cargo(query, signal))
}

// ---------- Pages du wiki ----------

/** Texte d'une page du wiki (ex. les données Riot « V5 data:… »), via api.php ; `undefined` si la page n'existe pas. */
export function wikiPage(title: string, signal?: AbortSignal): Promise<string | undefined> {
  const p = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: title })
  return enqueue(async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${ORIGIN}/api.php?${p}`, { signal })
      if (!res.ok) throw new Error(`Leaguepedia : erreur ${res.status}`)
      const json = (await res.json()) as {
        error?: { code?: string; info?: string }
        query?: { pages?: { missing?: boolean; revisions?: { slots?: { main?: { content?: string } } }[] }[] }
      }
      if (json.error?.code === 'ratelimited' && attempt < 3) {
        await sleep(2000 * 2 ** attempt)
        continue
      }
      if (json.error) throw new Error(json.error.code === 'ratelimited' ? 'Leaguepedia limite les requêtes : réessayez dans un instant.' : `Leaguepedia : ${json.error.info}`)
      return json.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content
    }
  })
}

// ---------- Images (logos d'équipes) ----------

const logoCache = new Map<string, string>()

/** URLs des fichiers Leaguepedia (noms de fichier → adresse du CDN), par lots de 50. */
export async function fileUrls(files: string[], width = 96): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const todo: string[] = []
  for (const f of new Set(files.filter(Boolean))) {
    const hit = logoCache.get(f) ?? readLogo(f)
    if (hit) out.set(f, hit)
    else todo.push(f)
  }
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50)
    const p = new URLSearchParams({
      action: 'query',
      format: 'json',
      origin: '*',
      prop: 'imageinfo',
      iiprop: 'url',
      iiurlwidth: String(width),
      titles: batch.map((f) => `File:${f}`).join('|'),
    })
    try {
      const res = await enqueue(() => fetch(`${ORIGIN}/api.php?${p}`))
      const json = (await res.json()) as {
        query?: { pages?: Record<string, { title: string; imageinfo?: { thumburl?: string; url: string }[] }>; normalized?: { from: string; to: string }[] }
      }
      // MediaWiki normalise les titres (« _ » ↔ espace) : on retrouve le nom demandé par son titre normalisé.
      const wanted = new Map(batch.map((f) => [f.replace(/_/g, ' '), f]))
      for (const page of Object.values(json.query?.pages ?? {})) {
        const name = wanted.get(page.title.replace(/^File:/, '').replace(/_/g, ' '))
        const info = page.imageinfo?.[0]
        if (name && info) {
          const u = info.thumburl ?? info.url
          out.set(name, u)
          logoCache.set(name, u)
          saveLogo(name, u)
        }
      }
    } catch {
      /* pas de logos : les équipes s'affichent avec leurs initiales */
    }
  }
  return out
}

const LOGO_KEY = (f: string) => `rift:logo:${f}`
function readLogo(f: string): string | undefined {
  try {
    const raw = localStorage.getItem(LOGO_KEY(f))
    if (!raw) return undefined
    const { at, u } = JSON.parse(raw) as { at: number; u: string }
    return Date.now() - at < 30 * 86_400_000 ? u : undefined
  } catch {
    return undefined
  }
}
function saveLogo(f: string, u: string) {
  try {
    localStorage.setItem(LOGO_KEY(f), JSON.stringify({ at: Date.now(), u }))
  } catch {
    /* ignoré */
  }
}
