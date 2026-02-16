import type { FlightData } from '~/types/game'

// Constants
const EARTH_RADIUS = 6_371_000 // meters
const SURFACE_GRAVITY = 9.81 // m/s²
const SEA_LEVEL_AIR_DENSITY = 1.225 // kg/m³
const ATMOSPHERE_SCALE_HEIGHT = 8500 // meters

// Rocket parameters (Falcon 9)
const STAGE1_DRY_MASS = 22_200 // kg (first stage dry)
const STAGE1_FUEL_MASS = 395_700 // kg
const STAGE1_THRUST = 7_607_000 // N (9 Merlin at sea level)
const STAGE1_ISP_SL = 282 // seconds (sea level)
const STAGE1_ISP_VAC = 311 // seconds (vacuum)

const STAGE2_DRY_MASS = 4_000 // kg
const STAGE2_FUEL_MASS = 92_670 // kg
const STAGE2_THRUST = 934_000 // N (1 Merlin Vacuum)
const STAGE2_ISP = 348 // seconds (vacuum)

const PAYLOAD_MASS = 5_000 // kg
const DRAG_COEFFICIENT = 0.3
const CROSS_SECTION = 10.5 // m² (3.66m diameter)

// Mass flow rate is constant (set by turbopump, doesn't change with altitude)
const STAGE1_MASS_FLOW = STAGE1_THRUST / (STAGE1_ISP_SL * SURFACE_GRAVITY) // ~2749.5 kg/s

export function usePhysics() {
  function createInitialFlightData(): FlightData {
    return {
      altitude: 0,
      velocity: 0,
      acceleration: 0,
      missionTime: 0,
      mass: STAGE1_DRY_MASS + STAGE1_FUEL_MASS + STAGE2_DRY_MASS + STAGE2_FUEL_MASS + PAYLOAD_MASS,
      fuel: 1,
      stage: 1,
      throttle: 0,
      dynamicPressure: 0,
      gravity: SURFACE_GRAVITY,
      drag: 0,
    }
  }

  function update(flight: FlightData, dt: number): FlightData {
    const f = { ...flight }

    // Gravity at altitude
    const r = EARTH_RADIUS + f.altitude
    f.gravity = SURFACE_GRAVITY * (EARTH_RADIUS / r) ** 2

    // Atmospheric density (exponential decay)
    const airDensity = f.altitude < 200_000
      ? SEA_LEVEL_AIR_DENSITY * Math.exp(-f.altitude / ATMOSPHERE_SCALE_HEIGHT)
      : 0

    // Dynamic pressure
    f.dynamicPressure = 0.5 * airDensity * f.velocity ** 2

    // Drag acceleration
    const dragForce = f.dynamicPressure * DRAG_COEFFICIENT * CROSS_SECTION
    f.drag = f.mass > 0 ? dragForce / f.mass : 0

    // Thrust
    let thrustAccel = 0
    if (f.throttle > 0 && f.fuel > 0) {
      let thrust: number
      let massFlowRate: number

      if (f.stage === 1) {
        // ISP increases with altitude (nozzle expansion in lower pressure)
        const altFactor = Math.min(1, f.altitude / 40000)
        const effectiveIsp = STAGE1_ISP_SL + (STAGE1_ISP_VAC - STAGE1_ISP_SL) * altFactor
        // Thrust = constant mass flow × effective ISP × g0
        thrust = STAGE1_MASS_FLOW * effectiveIsp * SURFACE_GRAVITY * f.throttle
        massFlowRate = STAGE1_MASS_FLOW * f.throttle
      } else {
        thrust = STAGE2_THRUST * f.throttle
        massFlowRate = (STAGE2_THRUST * f.throttle) / (STAGE2_ISP * SURFACE_GRAVITY)
      }

      thrustAccel = thrust / f.mass

      // Fuel consumption
      const fuelBurned = massFlowRate * dt
      const totalFuel = f.stage === 1 ? STAGE1_FUEL_MASS : STAGE2_FUEL_MASS
      const currentFuelMass = f.fuel * totalFuel
      const newFuelMass = Math.max(0, currentFuelMass - fuelBurned)
      f.fuel = newFuelMass / totalFuel
      f.mass -= fuelBurned
    }

    // Total acceleration (thrust up, gravity down, drag opposes velocity)
    f.acceleration = thrustAccel - f.gravity - (f.velocity > 0 ? f.drag : -f.drag)

    // Integration
    f.velocity += f.acceleration * dt
    f.altitude += f.velocity * dt

    // Clamp altitude to 0
    if (f.altitude < 0) {
      f.altitude = 0
      f.velocity = 0
    }

    f.missionTime += dt

    return f
  }

  function performStageSeparation(flight: FlightData): FlightData {
    const f = { ...flight }
    // Drop first stage mass
    f.mass -= STAGE1_DRY_MASS
    // Remove any remaining stage 1 fuel
    const remainingFuel = f.fuel * STAGE1_FUEL_MASS
    f.mass -= remainingFuel
    // Switch to stage 2
    f.stage = 2
    f.fuel = 1 // Full stage 2 fuel
    f.throttle = 0 // Engines off momentarily
    return f
  }

  function createStage1CoastingFlight(flight: FlightData): FlightData {
    return {
      altitude: flight.altitude,
      velocity: flight.velocity,
      acceleration: 0,
      missionTime: flight.missionTime,
      mass: STAGE1_DRY_MASS,
      fuel: 0,
      stage: 1,
      throttle: 0,
      dynamicPressure: 0,
      gravity: flight.gravity,
      drag: 0,
    }
  }

  return {
    createInitialFlightData,
    update,
    performStageSeparation,
    createStage1CoastingFlight,
  }
}
