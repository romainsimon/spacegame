// Global game types shared across all game modes (hub, flight, hangar, map, etc.)
// Prologue-specific types live in ~/types/prologue.ts

export interface CelestialBody {
  id: string
  name: string
  radius: number            // meters
  mu: number                // gravitational parameter (m³/s²)
  soi: number               // sphere of influence radius (meters)
  parent: string | null     // parent body id (null for Sun)
  atmosphere?: AtmosphereProfile
  semiMajorAxis?: number    // orbital semi-major axis around parent (meters)
  eccentricity?: number     // orbital eccentricity
  orbitalPeriod?: number    // seconds
}

export interface AtmosphereProfile {
  height: number            // meters — top of atmosphere
  seaLevelDensity: number   // kg/m³
  scaleHeight: number       // meters
  seaLevelPressure?: number // Pa
}

export interface OrbitalElements {
  semiMajorAxis: number     // meters
  eccentricity: number      // 0 = circular, <1 = elliptic, >=1 = hyperbolic
  inclination: number       // radians
  apoapsis: number          // meters above surface
  periapsis: number         // meters above surface
  period: number            // seconds
}

export interface PartDefinition {
  id: string
  name: string
  category: 'command' | 'engine' | 'tank' | 'structure' | 'landing' | 'science' | 'habitat'
  mass: number              // kg (dry)
  fuelMass?: number         // kg when full
  thrust?: number           // N
  isp?: number              // seconds
  fuelType?: 'kerosene' | 'methane' | 'hydrogen' | 'xenon' | 'nuclear'
  attachTop: boolean
  attachBottom: boolean
  attachRadial: boolean
  era: number               // 0-6, which era unlocks this part
}

export interface PartInstance {
  partId: string
  position: [number, number, number]
  rotation: [number, number, number, number] // quaternion
}

export interface StageDefinition {
  order: number
  partIds: string[]
  actions: ('activate' | 'decouple')[]
}

export interface CraftBlueprint {
  id: string
  name: string
  createdAt: number
  parts: PartInstance[]
  stages: StageDefinition[]
}

export interface Achievement {
  id: string
  name: string
  description: string
  category: 'navigation' | 'engineering' | 'civilisation' | 'hidden'
  kardashevReward?: number
}
