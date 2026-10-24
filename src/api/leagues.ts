// Compétitions suivies. `names` : valeurs du champ « League » de la table Tournaments de Leaguepedia.
// `slugs` : identifiants de ces ligues dans l'API LoL Esports (flux en direct).

export interface LeagueDef {
  key: string
  label: string
  full: string
  region: string
  names: string[]
  slugs: string[]
}

export const LEAGUES: LeagueDef[] = [
  { key: 'lec', label: 'LEC', full: 'League of Legends EMEA Championship', region: 'Europe', names: ['LoL EMEA Championship'], slugs: ['lec'] },
  { key: 'lck', label: 'LCK', full: 'LoL Champions Korea', region: 'Corée du Sud', names: ['LoL Champions Korea'], slugs: ['lck'] },
  { key: 'lpl', label: 'LPL', full: 'Tencent LoL Pro League', region: 'Chine', names: ['Tencent LoL Pro League'], slugs: ['lpl'] },
  { key: 'lcs', label: 'LCS', full: 'League of Legends Championship Series', region: 'Amérique du Nord', names: ['League of Legends Championship Series'], slugs: ['lcs'] },
  { key: 'lfl', label: 'LFL', full: 'La Ligue Française', region: 'France', names: ['La Ligue Française'], slugs: ['lfl'] },
  { key: 'cblol', label: 'CBLOL', full: 'Circuit Brasileiro de League of Legends', region: 'Brésil', names: ['Circuit Brazilian League of Legends'], slugs: ['cblol-brazil', 'cblol'] },
  { key: 'lcp', label: 'LCP', full: 'League of Legends Championship Pacific', region: 'Asie-Pacifique', names: ['League of Legends Championship Pacific'], slugs: ['lcp'] },
  {
    key: 'intl',
    label: 'International',
    full: 'Worlds, MSI et First Stand',
    region: 'Monde',
    names: ['World Championship', 'Mid-Season Invitational', 'First Stand'],
    slugs: ['worlds', 'msi', 'first_stand'],
  },
]

export const leagueByKey = (key: string) => LEAGUES.find((l) => l.key === key)

export function leagueOfName(name: string): LeagueDef | undefined {
  return LEAGUES.find((l) => l.names.includes(name))
}

export function leagueOfSlug(slug: string): LeagueDef | undefined {
  return LEAGUES.find((l) => l.slugs.includes(slug))
}

export const allLeagueNames = () => LEAGUES.flatMap((l) => l.names)

/** Ligues dont les matchs comptent pour « tout » : toutes. */
export const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'] as const

export const ROLE_FR: Record<string, string> = {
  Top: 'Top',
  Jungle: 'Jungle',
  Mid: 'Mid',
  Bot: 'ADC',
  Support: 'Support',
}

/** Rôles d'une draft, dans l'ordre de l'écran. */
export const roleOrder = (r?: string) => {
  const i = ROLES.indexOf((r ?? '') as (typeof ROLES)[number])
  return i < 0 ? 9 : i
}
