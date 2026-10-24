import { useState } from 'react'

export type Dir = 'best' | 'worst'

/** Tri d'un tableau : on touche une colonne pour trier du meilleur au plus faible, une 2e fois pour inverser. */
export function useSort<K extends string>(initial: K) {
  const [sort, set] = useState<{ key: K; dir: Dir }>({ key: initial, dir: 'best' })
  const toggle = (key: K) => set((s) => (s.key === key ? { key, dir: s.dir === 'best' ? 'worst' : 'best' } : { key, dir: 'best' }))
  return [sort, toggle] as const
}

export function SortTh<K extends string>({
  k,
  label,
  sort,
  onSort,
  left,
  title,
}: {
  k: K
  label: string
  sort: { key: K; dir: Dir }
  onSort: (k: K) => void
  left?: boolean
  /** Précise ce que « meilleur » veut dire pour cette colonne. */
  title?: string
}) {
  const on = sort.key === k
  return (
    <th scope="col" className={left ? 'left' : ''} aria-sort={on ? (sort.dir === 'best' ? 'descending' : 'ascending') : 'none'}>
      <button
        className={`sort-btn ${on ? 'on' : ''}`}
        onClick={() => onSort(k)}
        title={on && sort.dir === 'best' ? 'Du meilleur au plus faible (toucher pour inverser)' : on ? 'Du plus faible au meilleur (toucher pour inverser)' : (title ?? 'Trier du meilleur au plus faible')}
      >
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {on ? (sort.dir === 'best' ? '▼' : '▲') : ''}
        </span>
      </button>
    </th>
  )
}
