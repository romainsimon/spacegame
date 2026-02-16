import type { GameState, GameEvent } from '~/types/game'
import { usePhysics } from './usePhysics'

const COUNTDOWN_DURATION = 16 // seconds
const MAX_Q_DISPLAY_DURATION = 3 // seconds to show MAX-Q label

// Mission events timeline (approximate Falcon 9 profile)
const MISSION_EVENTS: GameEvent[] = [
  {
    id: 'max-q',
    label: 'MAX-Q',
    triggerTime: 72,
    windowSize: 0,
    phase: 'max-q',
    nextPhase: 'flying',
    requiresInput: false,
  },
  {
    id: 'meco',
    label: 'MECO',
    triggerTime: 155,
    windowSize: 5,
    phase: 'stage-sep',
    nextPhase: 'stage-sep',
    requiresInput: false,
  },
  {
    id: 'stage-sep',
    label: 'STAGE SEPARATION',
    triggerTime: 158,
    windowSize: 4,
    phase: 'stage-sep',
    nextPhase: 'stage2-flight',
    requiresInput: true,
  },
  {
    id: 'ses-1',
    label: 'SES-1',
    triggerTime: 165,
    windowSize: 0,
    phase: 'stage2-flight',
    nextPhase: 'stage2-flight',
    requiresInput: false,
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

  function createInitialState(): GameState {
    maxQTimer = 0
    return {
      phase: 'pre-launch',
      countdown: COUNTDOWN_DURATION,
      flight: physics.createInitialFlightData(),
      events: MISSION_EVENTS.map(e => ({ ...e })),
      currentEventIndex: 0,
      activeEvent: null,
      eventTimeRemaining: 0,
      eventAccuracy: 0,
      score: 0,
      failReason: '',
      maxAltitude: 0,
      maxSpeed: 0,
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
      case 'seco':
        return updateFlight(state, dt)
      case 'orbit':
      case 'failed':
        return state
    }
    return state
  }

  function updatePreLaunch(state: GameState, dt: number): GameState {
    if (state.countdown > 0) {
      state.countdown = Math.max(0, state.countdown - dt)
    }
    return state
  }

  function updateFlight(state: GameState, dt: number): GameState {
    // Update physics
    state.flight = physics.update(state.flight, dt)

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
          // Missed the window
          state.phase = 'failed'
          state.failReason = `Missed ${event.label} window`
          state.activeEvent = null
          state.flight.throttle = 0
        }
      }
    }

    // Cut engines when stage 1 fuel runs out
    if (state.flight.stage === 1 && state.flight.fuel <= 0) {
      state.flight.throttle = 0
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

          // Perform separation
          state.flight = physics.performStageSeparation(state.flight)
          state.phase = 'stage2-flight'
          state.activeEvent = null
          state.currentEventIndex++ // skip past stage-sep to ses-1
          separated = true
        }
        break

      case 'seco':
        if (state.activeEvent?.id === 'seco-1') {
          const timeDiff = Math.abs(state.flight.missionTime - state.activeEvent.triggerTime)
          state.eventAccuracy = Math.max(0, 1 - (timeDiff / state.activeEvent.windowSize))
          state.score += Math.round(state.eventAccuracy * 100)

          state.flight.throttle = 0
          state.phase = 'orbit'
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
  }
}
