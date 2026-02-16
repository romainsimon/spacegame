import type { FlightData } from '~/types/game'

// Constants
const EARTH_RADIUS = 6_371_000 // meters
const SURFACE_GRAVITY = 9.81 // m/s²
const SEA_LEVEL_AIR_DENSITY = 1.225 // kg/m³
const ATMOSPHERE_SCALE_HEIGHT = 8500 // meters

// Rocket parameters
const STAGE1_DRY_MASS = 22_200 // kg (Falcon 9 first stage dry)
const STAGE1_FUEL_MASS = 395_700 // kg
const STAGE1_THRUST = 7_607_000 // N (9 Merlin engines at sea level)
const STAGE1_BURN_TIME = 162 // seconds
const STAGE1_ISP = 282 // seconds (sea level)

const STAGE2_DRY_MASS = 4_000 // kg
const STAGE2_FUEL_MASS = 92_670 // kg
const STAGE2_THRUST = 934_000 // N (1 Merlin Vacuum)
const STAGE2_ISP = 348 // seconds (vacuum)

const PAYLOAD_MASS = 5_000 // kg
const DRAG_COEFFICIENT = 0.3
const CROSS_SECTION = 10.5 // m² (3.66m diameter)

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
      const thrust = f.stage === 1 ? STAGE1_THRUST : STAGE2_THRUST
      const isp = f.stage === 1 ? STAGE1_ISP : STAGE2_ISP
      thrustAccel = (thrust * f.throttle) / f.mass

      // Fuel consumption: mass flow = thrust / (isp * g0)
      const massFlowRate = (thrust * f.throttle) / (isp * SURFACE_GRAVITY)
      const fuelBurned = massFlowRate * dt

      // Update fuel and mass
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

  function getStage1FuelMass() { return STAGE1_FUEL_MASS }
  function getStage2FuelMass() { return STAGE2_FUEL_MASS }
  function getStage1BurnTime() { return STAGE1_BURN_TIME }

  return {
    createInitialFlightData,
    update,
    performStageSeparation,
    getStage1FuelMass,
    getStage2FuelMass,
    getStage1BurnTime,
  }
}
