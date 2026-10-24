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
