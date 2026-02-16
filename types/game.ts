export type GamePhase =
  | 'pre-launch'    // T-10 countdown
  | 'flying'        // Ascending, no event pending
  | 'max-q'         // Max dynamic pressure (informational)
  | 'stage-sep'     // Stage separation event window
  | 'stage2-flight' // Second stage flying
  | 'seco'          // Second engine cutoff event window
  | 'orbit'         // Success
  | 'failed'        // Missed a timing window

export interface GameEvent {
  id: string
  label: string
  triggerTime: number       // Mission time in seconds when event center occurs
  windowSize: number        // Seconds ± from trigger time for valid input
  phase: GamePhase          // Phase to transition to when triggered
  nextPhase: GamePhase      // Phase after event completes
  requiresInput: boolean    // Does the player need to press SPACE?
}

export interface FlightData {
  altitude: number          // meters
  velocity: number          // m/s (vertical)
  acceleration: number      // m/s²
  missionTime: number       // seconds since T+0
  mass: number              // kg
  fuel: number              // 0-1 fraction remaining
  stage: number             // 1 or 2
  throttle: number          // 0-1
  dynamicPressure: number   // Pa
  gravity: number           // m/s² at current altitude
  drag: number              // m/s² deceleration from drag
}

export interface GameState {
  phase: GamePhase
  countdown: number         // Pre-launch countdown (10 -> 0)
  flight: FlightData
  events: GameEvent[]
  currentEventIndex: number
  activeEvent: GameEvent | null
  eventTimeRemaining: number // Seconds left in current event window
  eventAccuracy: number     // 0-1 how close to center of window
  score: number
  failReason: string
  maxAltitude: number
  maxSpeed: number
}
