import { useEffect, useState } from 'react'
import { persisted } from './cargo'

// Icônes de champions et d'objets : Data Dragon, le CDN officiel de Riot. Les noms de Leaguepedia ("Kai'Sa",
// "Nunu & Willump") sont rapprochés des identifiants Riot ("Kaisa", "Nunu") par une forme simplifiée.

interface Compact {
  version: string
  champs: Record<string, string> // nom simplifié → identifiant ("kaisa" → "Kaisa")
  ids: Record<string, string> // identifiant → nom ("MonkeyKing" → "Wukong")
  items: Record<string, string> // nom simplifié → numéro d'objet
}

const CDN = 'https://ddragon.leagueoflegends.com'
const simple = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

let data: Compact | undefined
const listeners = new Set<() => void>()

async function load(): Promise<Compact> {
  return persisted('ddragon:v1', 6 * 3_600_000, async () => {
    const versions = (await (await fetch(`${CDN}/api/versions.json`)).json()) as string[]
    const version = versions[0]
    const [champs, items] = await Promise.all([
      fetch(`${CDN}/cdn/${version}/data/en_US/champion.json`).then((r) => r.json()),
      fetch(`${CDN}/cdn/${version}/data/en_US/item.json`).then((r) => r.json()),
    ])
    const out: Compact = { version, champs: {}, ids: {}, items: {} }
    for (const c of Object.values(champs.data as Record<string, { id: string; name: string }>)) {
      out.champs[simple(c.name)] = c.id
      out.ids[c.id] = c.name
    }
    const entries = Object.entries(items.data as Record<string, { name: string; maps?: Record<string, boolean> }>)
    for (const [id, it] of entries.sort((a, b) => Number(a[0]) - Number(b[0]))) {
      if (it.maps?.['11'] === false) continue // objets des autres modes de jeu
      const k = simple(it.name)
      if (!(k in out.items)) out.items[k] = id
    }
    return out
  })
}

export function startDataDragon() {
  load()
    .then((d) => {
      data = d
      listeners.forEach((l) => l())
    })
    .catch(() => {
      /* hors-ligne : les icônes sont remplacées par le nom */
    })
}

/** Redessine le composant quand Data Dragon est chargé. */
export function useDataDragon() {
  const [, set] = useState(0)
  useEffect(() => {
    const l = () => set((n) => n + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  return data
}

/** Identifiant Riot d'un champion d'après son nom d'affichage ou déjà son identifiant. */
export function champId(nameOrId: string): string | undefined {
  if (!data || !nameOrId) return undefined
  return data.champs[simple(nameOrId)] ?? (data.ids[nameOrId] ? nameOrId : undefined)
}

export const champName = (nameOrId: string) => data?.ids[nameOrId] ?? nameOrId

export function championIcon(nameOrId: string): string | undefined {
  const id = champId(nameOrId)
  return id && data ? `${CDN}/cdn/${data.version}/img/champion/${id}.png` : undefined
}

export function itemIcon(name: string): string | undefined {
  const id = data?.items[simple(name)]
  return id && data ? `${CDN}/cdn/${data.version}/img/item/${id}.png` : undefined
}

// ---------- Objets et runes d'après leur numéro (flux en direct) ----------
// Le flux en direct de LoL Esports donne des numéros (objet 3748, rune 8010) : les noms français et les icônes viennent
// de Data Dragon. Chargé à la première ouverture d'une carte de joueur, puis gardé 6 h.

export type ItemKind = 'item' | 'trinket' | 'consumable'

export interface DetailData {
  items: Record<string, { n: string; k: ItemKind }>
  /** Runes et arbres de runes : nom et chemin de l'icône. */
  runes: Record<string, { n: string; i: string }>
}

interface RawStyle {
  id: number
  name: string
  icon: string
  slots: { runes: { id: number; name: string; icon: string }[] }[]
}

let detail: DetailData | undefined
let detailLoading: Promise<DetailData> | undefined

function loadDetail(): Promise<DetailData> {
  if (!detailLoading) {
    detailLoading = persisted('ddragon:detail:v1', 6 * 3_600_000, async () => {
      const version = ((await (await fetch(`${CDN}/api/versions.json`)).json()) as string[])[0]
      const [items, runes] = await Promise.all([
        fetch(`${CDN}/cdn/${version}/data/fr_FR/item.json`).then((r) => r.json()),
        fetch(`${CDN}/cdn/${version}/data/fr_FR/runesReforged.json`).then((r) => r.json()),
      ])
      const out: DetailData = { items: {}, runes: {} }
      for (const [id, it] of Object.entries(items.data as Record<string, { name: string; consumed?: boolean; tags?: string[] }>)) {
        const tags = it.tags ?? []
        out.items[id] = { n: it.name, k: it.consumed || tags.includes('Consumable') ? 'consumable' : tags.includes('Trinket') ? 'trinket' : 'item' }
      }
      for (const style of runes as RawStyle[]) {
        out.runes[style.id] = { n: style.name, i: style.icon }
        for (const slot of style.slots) for (const r of slot.runes) out.runes[r.id] = { n: r.name, i: r.icon }
      }
      return out
    })
      .then((d) => {
        detail = d
        listeners.forEach((l) => l())
        return d
      })
      .catch((e) => {
        detailLoading = undefined // on réessaiera à la prochaine ouverture
        throw e
      })
  }
  return detailLoading
}

/** Noms d'objets et de runes ; `undefined` tant qu'ils ne sont pas chargés (ou hors-ligne). */
export function useDetailData(): DetailData | undefined {
  useDataDragon()
  useEffect(() => {
    if (!detail) loadDetail().catch(() => {})
  }, [])
  return detail
}

export const itemIconById = (id: number): string | undefined => (data ? `${CDN}/cdn/${data.version}/img/item/${id}.png` : undefined)
export const runeIconUrl = (path: string): string => `${CDN}/cdn/img/${path}`
