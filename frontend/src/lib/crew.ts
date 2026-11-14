// Crew roster for the Metamorphosis mission: maps API participant ids (p01…) to a mission crew ID, callsign and role.
// Purely presentational — the API contract and URL hash keep using the participant id.
import type { AstronautListItem } from '@/api/types'

export const TEAM = 'Metamorphosis'
export const MISSION = 'MTM'

const CALLSIGNS = ['Orion', 'Vega', 'Lyra', 'Atlas', 'Nova', 'Rigel', 'Altair', 'Kepler', 'Halley', 'Sirius', 'Draco', 'Phoenix', 'Titan', 'Elara', 'Corvus', 'Hydra', 'Cygnus', 'Polaris', 'Auriga', 'Carina']
const ROLES = [
  { code: 'CDR', label: 'Commander' },
  { code: 'PLT', label: 'Pilot' },
  { code: 'FE', label: 'Flight engineer' },
  { code: 'MS', label: 'Mission specialist' },
  { code: 'FS', label: 'Flight surgeon' },
  { code: 'PS', label: 'Payload specialist' },
] as const

export interface CrewMember {
  id: string // API participant id, "p01"
  code: string // "MTM-01"
  callsign: string // "Orion"
  role: (typeof ROLES)[number]
}

export function crewMember(id: string): CrewMember {
  const n = parseInt(id.replace(/\D/g, ''), 10) || 0
  const i = Math.max(0, n - 1)
  return {
    id,
    code: `${MISSION}-${String(n).padStart(2, '0')}`,
    callsign: CALLSIGNS[i % CALLSIGNS.length] + (i >= CALLSIGNS.length ? ` ${Math.floor(i / CALLSIGNS.length) + 1}` : ''),
    role: i === 0 ? ROLES[0] : i === 1 ? ROLES[1] : ROLES[2 + ((i - 2) % (ROLES.length - 2))],
  }
}

/** case-insensitive match on crew ID, callsign, role and participant id ("mtm-03", "03", "vega", "surgeon", "p03") */
export function matchCrew(c: AstronautListItem, q: string) {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const m = crewMember(c.id)
  return [m.code, m.code.replace('-', ''), m.callsign, m.role.code, m.role.label, c.id, c.name].some((x) => x.toLowerCase().includes(s))
}
