import type { GameState, GameEvent } from '~/types/prologue'
import { usePhysics } from './usePhysics'

const COUNTDOWN_DURATION = 16 // seconds
const MAX_Q_DISPLAY_DURATION = 3 // seconds to show MAX-Q label
const LAUNCH_WINDOW = 10 // seconds after countdown=0 before auto-abort

// Stage 1 landing constants
const BOOSTBACK_TRIGGER = 185     // seconds — boostback burn window center
const BOOSTBACK_WINDOW = 8        // ±8s window (easier to hit)
const BOOSTBACK_DURATION = 35     // seconds of full-thrust retrograde burn
const ENTRY_BURN_TIME = 350       // seconds — auto entry burn
const ENTRY_BURN_DURATION = 15    // seconds engine on
const LANDING_ALTITUDE_TRIGGER = 3500 // meters — altitude-based landing burn trigger
const LANDING_GOOD_VELOCITY = 3   // m/s — success threshold
const LANDING_CUT_VELOCITY = -5   // m/s — auto-cut engine when nearly stopped

// Mission events timeline (Falcon 9 profile — stage 2 / main flight)
const MISSION_EVENTS: GameEvent[] = [
  {
    id: 'max-q',
    label: 'MAX-Q',
    triggerTime: 70,
    windowSize: 0,
    phase: 'max-q',
    nextPhase: 'flying',
    requiresInput: false,
  },
  {
    id: 'meco',
    label: 'MECO',
    triggerTime: 149,
    windowSize: 5,
    phase: 'stage-sep',
    nextPhase: 'stage-sep',
    requiresInput: false,
  },
  {
    id: 'stage-sep',
    label: 'STAGE SEPARATION',
    triggerTime: 153,
    windowSize: 4,
    phase: 'stage-sep',
    nextPhase: 'stage2-flight',
    requiresInput: true,
  },
  {
    id: 'ses-1',
    label: 'SES-1',
    triggerTime: 156,
    windowSize: 0,
    phase: 'stage2-flight',
    nextPhase: 'stage2-flight',
    requiresInput: false,
  },
  {
    id: 'boostback',
    label: 'BOOSTBACK BURN',
    triggerTime: BOOSTBACK_TRIGGER,
    windowSize: BOOSTBACK_WINDOW, // ±8s
    phase: 'boostback',
    nextPhase: 'stage2-flight',
    requiresInput: true,
  },
  {
    id: 'seco-1',
    label: 'SECO-1',
    triggerTime: 480,
    windowSize: 6,
    phase: 'seco',
    nextPhase: 'orbit',
    requiresInput: true,
  },
]

export function useGame() {
  const physics = usePhysics()

  // Track max-q display timer (not part of serializable state)
  let maxQTimer = 0
  let launchWindowTimer = 0
  let entryBurnTimer = 0

  function createInitialState(): GameState {
    maxQTimer = 0
    launchWindowTimer = 0
    entryBurnTimer = 0
    return {
      phase: 'pre-launch',
      countdown: COUNTDOWN_DURATION,
      flight: physics.createInitialFlightData(),
      stage1Flight: null,
      events: MISSION_EVENTS.map(e => ({ ...e })),
      currentEventIndex: 0,
      activeEvent: null,
      eventTimeRemaining: 0,
      eventAccuracy: 0,
      score: 0,
      failReason: '',
      maxAltitude: 0,
      maxSpeed: 0,
      stage1LandingResult: null,
      stage1BoostbackEndTime: 0,
      stage1LandingPromptShown: false,
      orbitAchieved: false,
    }
  }

  function update(state: GameState, dt: number): GameState {
    switch (state.phase) {
      case 'pre-launch':
        return updatePreLaunch(state, dt)
      case 'flying':
      case 'max-q':
      case 'stage-sep':
      case 'stage2-flight':
      case 'boostback':
      case 'seco':
        return updateFlight(state, dt)
      case 'orbit':
      case 'failed':
        // Still update stage 1 coasting/landing in terminal states
        if (state.stage1Flight && state.stage1Flight.altitude > 0) {
          state = updateStage1(state, dt)
        }
        return state
    }
    return state
  }

  function updatePreLaunch(state: GameState, dt: number): GameState {
    if (state.countdown > 0) {
      state.countdown = Math.max(0, state.countdown - dt)
    } else {
      // Countdown reached 0 — player must press SPACE within the launch window
      launchWindowTimer += dt
      if (launchWindowTimer >= LAUNCH_WINDOW) {
        state.phase = 'failed'
        state.failReason = 'Launch window expired — mission aborted'
      }
    }
    return state
  }

  // Stage 1 throttle profile (mimics Falcon 9 max-Q bucket)
  function getStage1Throttle(missionTime: number): number {
    if (missionTime < 26) return 1.0      // Full throttle at launch
    if (missionTime < 60) return 0.80     // Throttle bucket for max-Q
    if (missionTime < 70) {               // Ramp back up after max-Q
      const t = (missionTime - 60) / 10
      return 0.80 + t * 0.20
    }
    return 1.0                            // Full throttle to MECO
  }

  function updateFlight(state: GameState, dt: number): GameState {
    // Apply throttle profile for stage 1
    if (state.flight.stage === 1 && state.flight.throttle > 0) {
      state.flight.throttle = getStage1Throttle(state.flight.missionTime)
    }

    // Update physics
    state.flight = physics.update(state.flight, dt)

    // Update stage 1 coasting/landing physics (after separation)
    if (state.stage1Flight) {
      state = updateStage1(state, dt)
    }

    // Track max values
    if (state.flight.altitude > state.maxAltitude) {
      state.maxAltitude = state.flight.altitude
    }
    if (state.flight.velocity > state.maxSpeed) {
      state.maxSpeed = state.flight.velocity
    }

    // Max-Q auto-transition back to flying
    if (state.phase === 'max-q') {
      maxQTimer += dt
      if (maxQTimer >= MAX_Q_DISPLAY_DURATION) {
        state.phase = 'flying'
        maxQTimer = 0
      }
    }

    // Check events
    const missionTime = state.flight.missionTime

    if (state.currentEventIndex < state.events.length) {
      const event = state.events[state.currentEventIndex]
      const windowStart = event.triggerTime - event.windowSize
      const windowEnd = event.triggerTime + event.windowSize

      if (!event.requiresInput) {
        // Auto-events trigger at their time
        if (missionTime >= event.triggerTime) {
          state = handleAutoEvent(state, event)
          state.currentEventIndex++
        }
      } else {
        // Player-input events
        if (missionTime >= windowStart && missionTime <= windowEnd) {
          state.activeEvent = event
          state.eventTimeRemaining = windowEnd - missionTime
          // Update phase for the event
          state.phase = event.phase
        } else if (missionTime > windowEnd) {
          // Missed the window — boostback is optional (mission continues), others fail
          if (event.id === 'boostback') {
            state.phase = 'stage2-flight'
            state.activeEvent = null
            state.currentEventIndex++
          } else {
            state.phase = 'failed'
            state.failReason = `Missed ${event.label} window`
            state.activeEvent = null
            state.flight.throttle = 0
          }
        }
      }
    }

    // Cut engines when stage 1 fuel runs out
    if (state.flight.stage === 1 && state.flight.fuel <= 0) {
      state.flight.throttle = 0
    }

    return state
  }

  function updateStage1(state: GameState, dt: number): GameState {
    if (!state.stage1Flight) return state
    const s1 = state.stage1Flight
    const missionTime = state.flight.missionTime

    // Boostback retrograde burn (player-triggered, full 3-engine thrust)
    if (state.stage1BoostbackEndTime > 0 && missionTime < state.stage1BoostbackEndTime) {
      state.stage1Flight = { ...s1, throttle: 1.0, retrograde: true }
    } else if (state.stage1BoostbackEndTime > 0 && missionTime >= state.stage1BoostbackEndTime && s1.retrograde) {
      state.stage1Flight = { ...s1, throttle: 0, retrograde: false }
    }

    // Auto entry burn at set time
    if (!s1.retrograde) {
      const entryBurnActive = missionTime >= ENTRY_BURN_TIME && missionTime < ENTRY_BURN_TIME + ENTRY_BURN_DURATION
      const entryBurnJustEnded = missionTime >= ENTRY_BURN_TIME + ENTRY_BURN_DURATION && s1.throttle > 0 && s1.altitude > LANDING_ALTITUDE_TRIGGER
      if (entryBurnActive && !s1.retrograde) {
        state.stage1Flight = { ...state.stage1Flight!, throttle: 0.33 }
      } else if (entryBurnJustEnded) {
        state.stage1Flight = { ...state.stage1Flight!, throttle: 0 }
      }
    }

    // Show landing prompt when below 4000m (altitude-based trigger)
    if (state.stage1Flight!.altitude < 4000 && state.stage1Flight!.altitude > 0 && !state.stage1LandingResult && state.stage1Flight!.throttle === 0) {
      state.stage1LandingPromptShown = true
    }

    // Auto-cut landing engine when nearly stopped (prevents overshoot and hover)
    const s1updated = state.stage1Flight!
    if (s1updated.throttle > 0 && !s1updated.retrograde && s1updated.velocity >= LANDING_CUT_VELOCITY) {
      state.stage1Flight = { ...s1updated, throttle: 0 }
    }

    // Update stage 1 physics
    if (state.stage1Flight!.altitude > 0) {
      state.stage1Flight = physics.update(state.stage1Flight!, dt)
    }

    // Check for landing / crash
    if (state.stage1Flight && state.stage1Flight.altitude <= 0 && !state.stage1LandingResult) {
      const touchdownVel = Math.abs(state.stage1Flight.velocity)
      state.stage1LandingResult = {
        touchdownVelocity: touchdownVel,
        fuelRemaining: state.stage1Flight.fuel,
        accuracy: Math.max(0, 1 - touchdownVel / 10),
        landed: touchdownVel <= LANDING_GOOD_VELOCITY,
      }
      state.stage1Flight = { ...state.stage1Flight, velocity: 0, altitude: 0, throttle: 0, retrograde: false }
      state.stage1LandingPromptShown = false
      // Score bonus for landing
      if (state.stage1LandingResult.landed) {
        const stars = touchdownVel < 1 ? 5 : touchdownVel < 2 ? 4 : 3
        state.score += stars * 20
      }
    }

    return state
  }

  function handleAutoEvent(state: GameState, event: GameEvent): GameState {
    switch (event.id) {
      case 'max-q':
        state.phase = 'max-q'
        maxQTimer = 0
        break
      case 'meco':
        state.flight.throttle = 0
        state.phase = 'stage-sep'
        break
      case 'ses-1':
        state.flight.throttle = 1
        break
    }
    return state
  }

  function handlePlayerAction(state: GameState): { state: GameState; separated: boolean } {
    let separated = false

    // Stage 1 landing burn — triggers whenever landing prompt is showing, regardless of main phase
    if (state.stage1LandingPromptShown && state.stage1Flight && state.stage1Flight.altitude <= LANDING_ALTITUDE_TRIGGER && state.stage1Flight.throttle === 0) {
      state.stage1Flight = { ...state.stage1Flight, throttle: 1.0, retrograde: false }
      state.stage1LandingPromptShown = false
      return { state, separated }
    }

    switch (state.phase) {
      case 'pre-launch':
        if (state.countdown <= 0) {
          state.phase = 'flying'
          state.flight.throttle = 1
        }
        break

      case 'stage-sep':
        if (state.activeEvent?.id === 'stage-sep') {
          // Calculate accuracy (1.0 = perfect center)
          const timeDiff = Math.abs(state.flight.missionTime - state.activeEvent.triggerTime)
          state.eventAccuracy = Math.max(0, 1 - (timeDiff / state.activeEvent.windowSize))
          state.score += Math.round(state.eventAccuracy * 100)

          // Create stage 1 coasting flight data (before separation changes the flight)
          state.stage1Flight = physics.createStage1CoastingFlight(state.flight)

          // Perform separation
          state.flight = physics.performStageSeparation(state.flight)
          state.phase = 'stage2-flight'
          state.activeEvent = null
          state.currentEventIndex++ // skip past stage-sep to ses-1
          separated = true
        }
        break

      case 'boostback':
        if (state.activeEvent?.id === 'boostback' && state.stage1Flight) {
          // Full 3-engine retrograde burn to reverse trajectory
          state.stage1BoostbackEndTime = state.flight.missionTime + BOOSTBACK_DURATION
          state.stage1Flight = { ...state.stage1Flight, retrograde: true, throttle: 1.0 }
          state.phase = 'stage2-flight'
          state.activeEvent = null
          state.currentEventIndex++
        }
        break

      case 'seco':
        if (state.activeEvent?.id === 'seco-1') {
          const timeDiff = Math.abs(state.flight.missionTime - state.activeEvent.triggerTime)
          state.eventAccuracy = Math.max(0, 1 - (timeDiff / state.activeEvent.windowSize))
          state.score += Math.round(state.eventAccuracy * 100)

          state.flight.throttle = 0
          state.phase = 'orbit'
          state.orbitAchieved = true
          state.activeEvent = null
        }
        break

    }

    return { state, separated }
  }

  function formatMissionTime(seconds: number): string {
    const sign = seconds < 0 ? '-' : '+'
    const abs = Math.abs(seconds)
    const mins = Math.floor(abs / 60)
    const secs = Math.floor(abs % 60)
    return `T${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  function formatAltitude(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} KM`
    }
    return `${Math.round(meters)} M`
  }

  function formatSpeed(ms: number): string {
    const kmh = ms * 3.6
    if (kmh >= 1000) {
      return `${Math.round(kmh).toLocaleString()} KM/H`
    }
    return `${Math.round(kmh)} KM/H`
  }

  return {
    createInitialState,
    update,
    handlePlayerAction,
    formatMissionTime,
    formatAltitude,
    formatSpeed,
    LANDING_ALTITUDE_TRIGGER,
  }
}
