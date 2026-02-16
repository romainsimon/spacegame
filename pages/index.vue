<script setup lang="ts">
import { useGame } from '~/composables/useGame'
import { useRenderer } from '~/composables/useRenderer'
import { useAudio } from '~/composables/useAudio'
import type { GameState } from '~/types/game'

const game = useGame()
const renderer = useRenderer()
const audio = useAudio()

const containerRef = ref<HTMLElement | null>(null)
const state = ref<GameState>(game.createInitialState())
const lastTime = ref(0)
const isInitialized = ref(false)
const audioStarted = ref(false)
const started = ref(false)
const isMuted = ref(false)
const timeScale = ref(1)
const ffTarget = ref<number | null>(null)

// Mission timeline milestones (evenly spaced visually)
const milestones = [
  { id: 'startup', label: 'STARTUP', time: -3 },
  { id: 'liftoff', label: 'LIFTOFF', time: 0 },
  { id: 'max-q', label: 'MAX Q', time: 70 },
  { id: 'meco', label: 'MECO', time: 149 },
  { id: 'stage-sep', label: 'STAGE SEP', time: 153 },
  { id: 'ses-1', label: 'SES-1', time: 161 },
  { id: 'seco', label: 'SECO', time: 480 },
]

// SVG gauge constants
const GAUGE_RADIUS = 50
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS // 314.16
const GAUGE_ARC = GAUGE_CIRCUMFERENCE * 0.75 // 270° = 235.62

// ── Split screen detection ──
const isSplitScreen = computed(() => state.value.stage1Flight !== null)

// ── Derived display values (Stage 2 / main) ──
const missionTime = computed(() => {
  if (state.value.phase === 'pre-launch') {
    return -state.value.countdown
  }
  return state.value.flight.missionTime
})

const missionTimePrefix = computed(() => missionTime.value < 0 ? 'T-' : 'T+')

const missionTimeDisplay = computed(() => {
  const abs = Math.abs(missionTime.value)
  const hrs = Math.floor(abs / 3600)
  const mins = Math.floor((abs % 3600) / 60)
  const secs = Math.floor(abs % 60)
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

const speedKmh = computed(() => state.value.flight.velocity * 3.6)
const speedDisplay = computed(() => {
  const v = speedKmh.value
  if (v >= 1000) return Math.round(v).toLocaleString('en-US')
  return Math.round(v).toString()
})
const speedUnit = computed(() => 'KM/H')
const speedFill = computed(() => Math.min(1, speedKmh.value / 30000))

const altitudeKm = computed(() => state.value.flight.altitude / 1000)
const altitudeDisplay = computed(() => {
  if (altitudeKm.value >= 10) return Math.round(altitudeKm.value).toString()
  if (altitudeKm.value >= 1) return altitudeKm.value.toFixed(1)
  return (state.value.flight.altitude / 1000).toFixed(2)
})
const altitudeUnit = computed(() => 'KM')
const altitudeFill = computed(() => Math.min(1, altitudeKm.value / 500))

const gForce = computed(() => {
  const f = state.value.flight
  if (state.value.phase === 'pre-launch') return 1
  return Math.max(0, (f.acceleration + f.gravity) / 9.81)
})
const gForceDisplay = computed(() => gForce.value.toFixed(1))
const gForceFill = computed(() => Math.min(1, gForce.value / 6))

// ── Stage 1 telemetry (after separation) ──
const s1SpeedKmh = computed(() => {
  if (!state.value.stage1Flight) return 0
  return state.value.stage1Flight.velocity * 3.6
})
const s1SpeedDisplay = computed(() => {
  const v = Math.abs(s1SpeedKmh.value)
  if (v >= 1000) return Math.round(v).toLocaleString('en-US')
  return Math.round(v).toString()
})
const s1SpeedFill = computed(() => Math.min(1, Math.abs(s1SpeedKmh.value) / 30000))

const s1AltitudeKm = computed(() => {
  if (!state.value.stage1Flight) return 0
  return state.value.stage1Flight.altitude / 1000
})
const s1AltitudeDisplay = computed(() => {
  const a = s1AltitudeKm.value
  if (a >= 10) return Math.round(a).toString()
  if (a >= 1) return a.toFixed(1)
  return a.toFixed(2)
})
const s1AltitudeFill = computed(() => Math.min(1, s1AltitudeKm.value / 500))

// Gauge dashoffset helper
function gaugeDashoffset(fill: number): number {
  return GAUGE_ARC * (1 - fill)
}

// Engine dots: 9 for stage 1 (1 center + 8 ring), 1 for stage 2
const engineDots = computed(() => {
  const stage = state.value.flight.stage
  const active = state.value.flight.throttle > 0 && state.value.flight.fuel > 0
  if (stage === 1) {
    const dots = [{ x: 18, y: 18, r: 4.5 }]
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
      dots.push({
        x: 18 + Math.cos(angle) * 11,
        y: 18 + Math.sin(angle) * 11,
        r: 3.5,
      })
    }
    return { dots, active }
  }
  return { dots: [{ x: 18, y: 18, r: 6 }], active }
})

// Timeline progress
const timelineProgress = computed(() => {
  const t = missionTime.value
  for (let i = 0; i < milestones.length - 1; i++) {
    if (t < milestones[i + 1].time) {
      const segStart = milestones[i].time
      const segEnd = milestones[i + 1].time
      const segProgress = Math.max(0, (t - segStart) / (segEnd - segStart))
      const posStart = i / (milestones.length - 1)
      const posEnd = (i + 1) / (milestones.length - 1)
      return (posStart + segProgress * (posEnd - posStart)) * 100
    }
  }
  return 100
})

const showPrompt = computed(() => {
  if (state.value.phase === 'pre-launch' && !started.value) return true
  if (state.value.phase === 'pre-launch' && state.value.countdown <= 0) return true
  if (state.value.activeEvent?.requiresInput) return true
  return false
})

const promptText = computed(() => {
  if (state.value.phase === 'pre-launch' && !started.value) return 'PRESS SPACE TO START'
  if (state.value.phase === 'pre-launch') return 'PRESS SPACE TO LAUNCH'
  if (state.value.activeEvent) return `PRESS SPACE \u2014 ${state.value.activeEvent.label}`
  return ''
})

const eventWindowProgress = computed(() => {
  if (!state.value.activeEvent) return 0
  const event = state.value.activeEvent
  const elapsed = state.value.flight.missionTime - (event.triggerTime - event.windowSize)
  const total = event.windowSize * 2
  return Math.min(1, Math.max(0, elapsed / total))
})

// ── Fast forward ──
const showFastForward = computed(() => {
  const p = state.value.phase
  if (p === 'orbit' || p === 'failed') return false
  if (p === 'pre-launch' && !started.value) return false
  if (state.value.activeEvent?.requiresInput) return false
  return true
})

function toggleFastForward() {
  if (timeScale.value > 1) {
    timeScale.value = 1
    ffTarget.value = null
    return
  }

  const t = missionTime.value
  const playerInputIds = new Set(['stage-sep', 'seco'])

  for (const m of milestones) {
    if (m.time <= t + 2) continue
    const buffer = playerInputIds.has(m.id) ? 8 : 2
    ffTarget.value = m.time - buffer
    timeScale.value = 8
    return
  }
}

// Game loop
function gameLoop(timestamp: number) {
  if (!isInitialized.value) return

  const rawDt = lastTime.value === 0 ? 0.016 : Math.min((timestamp - lastTime.value) / 1000, 0.05)
  lastTime.value = timestamp
  const dt = rawDt * timeScale.value

  // Auto-stop fast forward at target or on terminal/input states
  if (timeScale.value > 1) {
    if ((ffTarget.value !== null && missionTime.value >= ffTarget.value)
      || state.value.phase === 'orbit' || state.value.phase === 'failed'
      || state.value.activeEvent?.requiresInput) {
      timeScale.value = 1
      ffTarget.value = null
    }
  }

  // Track previous phase to detect failure
  const prevPhase = state.value.phase

  // Update game state (freeze countdown until player starts)
  const canUpdate = state.value.phase !== 'orbit' && state.value.phase !== 'failed'
  if (canUpdate && (state.value.phase !== 'pre-launch' || started.value)) {
    state.value = game.update(state.value, dt)
  } else if (!canUpdate) {
    // Still update stage 1 coasting in orbit/failed
    state.value = game.update(state.value, dt)
  }

  // Play problem voice on mission failure (missed event window)
  if (prevPhase !== 'failed' && state.value.phase === 'failed') {
    audio.playProblem()
  }

  // Update audio (pass countdown for voice cue timing)
  audio.update(state.value.flight, state.value.phase, state.value.countdown)

  // Update 3D scene
  renderer.updateScene(state.value, started.value, dt)
  renderer.render()

  requestAnimationFrame(gameLoop)
}

// Keyboard input
function onKeyDown(event: KeyboardEvent) {
  if (event.code === 'Space') {
    event.preventDefault()

    // Init audio on first interaction (browser requires user gesture)
    if (!audioStarted.value) {
      audio.init()
      audio.resume()
      audioStarted.value = true
    }

    // First press: start the countdown
    if (state.value.phase === 'pre-launch' && !started.value) {
      started.value = true
      return
    }

    // Play ignition cue + start music when launching
    if (state.value.phase === 'pre-launch' && state.value.countdown <= 0) {
      audio.playIgnition()
      audio.playMusic()
    }

    const result = game.handlePlayerAction(state.value)
    state.value = result.state

    if (result.separated) {
      renderer.triggerStageSeparation(state.value.flight)
      audio.playStageSep()
    }
  }

  if (event.code === 'KeyR') {
    if (state.value.phase === 'orbit' || state.value.phase === 'failed') {
      restart()
    }
  }

  if (event.code === 'KeyM') {
    isMuted.value = audio.toggleMute()
  }
}

function restart() {
  state.value = game.createInitialState()
  lastTime.value = 0
  started.value = false
  timeScale.value = 1
  ffTarget.value = null
  audio.resetCues()
}

onMounted(() => {
  if (!containerRef.value) return

  renderer.init(containerRef.value)
  isInitialized.value = true

  window.addEventListener('keydown', onKeyDown)
  requestAnimationFrame(gameLoop)
})

onUnmounted(() => {
  isInitialized.value = false
  window.removeEventListener('keydown', onKeyDown)
  renderer.dispose()
  audio.dispose()
})
</script>

<template>
  <div class="game">
    <!-- 3D Canvas -->
    <div ref="containerRef" class="canvas-container" />

    <!-- Split-screen divider -->
    <div v-if="isSplitScreen" class="split-divider" />

    <!-- SpaceX-style Telemetry HUD -->
    <div class="hud">
      <!-- Left gauges -->
      <div class="hud-left">
        <!-- In split mode: Stage 1 gauges -->
        <template v-if="isSplitScreen">
          <div class="gauge">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" transform="rotate(135, 60, 60)" />
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" :stroke-dashoffset="gaugeDashoffset(s1SpeedFill)" transform="rotate(135, 60, 60)" class="gauge-fill" />
            </svg>
            <div class="gauge-content">
              <div class="gauge-label">SPEED</div>
              <div class="gauge-value">{{ s1SpeedDisplay }}</div>
              <div class="gauge-unit">KM/H</div>
            </div>
          </div>
          <div class="gauge">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" transform="rotate(135, 60, 60)" />
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" :stroke-dashoffset="gaugeDashoffset(s1AltitudeFill)" transform="rotate(135, 60, 60)" class="gauge-fill" />
            </svg>
            <div class="gauge-content">
              <div class="gauge-label">ALTITUDE</div>
              <div class="gauge-value">{{ s1AltitudeDisplay }}</div>
              <div class="gauge-unit">KM</div>
            </div>
          </div>
          <div class="stage-label">STAGE 1</div>
        </template>

        <!-- Normal mode: Speed + Altitude gauges -->
        <template v-else>
          <div class="gauge">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" transform="rotate(135, 60, 60)" />
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" :stroke-dashoffset="gaugeDashoffset(speedFill)" transform="rotate(135, 60, 60)" class="gauge-fill" />
            </svg>
            <div class="gauge-content">
              <div class="gauge-label">SPEED</div>
              <div class="gauge-value">{{ speedDisplay }}</div>
              <div class="gauge-unit">{{ speedUnit }}</div>
            </div>
          </div>
          <div class="gauge">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" transform="rotate(135, 60, 60)" />
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" :stroke-dashoffset="gaugeDashoffset(altitudeFill)" transform="rotate(135, 60, 60)" class="gauge-fill" />
            </svg>
            <div class="gauge-content">
              <div class="gauge-label">ALTITUDE</div>
              <div class="gauge-value">{{ altitudeDisplay }}</div>
              <div class="gauge-unit">{{ altitudeUnit }}</div>
            </div>
          </div>
        </template>
      </div>

      <!-- Center: Timeline + Clock -->
      <div class="hud-center">
        <div class="timeline">
          <div class="timeline-track">
            <div class="timeline-fill" :style="{ width: `${timelineProgress}%` }" />
            <div class="timeline-dot" :style="{ left: `${timelineProgress}%` }" />
          </div>
          <div class="timeline-milestones">
            <div
              v-for="(m, i) in milestones"
              :key="m.id"
              class="milestone"
              :class="{
                passed: missionTime >= m.time,
                top: i % 2 === 1,
                bottom: i % 2 === 0,
              }"
              :style="{ left: `${(i / (milestones.length - 1)) * 100}%` }"
            >
              <div class="milestone-tick" />
              <div class="milestone-label">{{ m.label }}</div>
            </div>
          </div>
        </div>

        <div class="clock-row">
          <div class="mission-clock">
            <span class="clock-prefix">{{ missionTimePrefix }}</span>
            <span class="clock-time">{{ missionTimeDisplay }}</span>
          </div>
          <button
            v-if="showFastForward"
            class="ff-btn"
            :class="{ active: timeScale > 1 }"
            @click="toggleFastForward"
          >
            <span v-if="timeScale > 1">{{ timeScale }}x</span>
            <span v-else>&#x25B6;&#x25B6;</span>
          </button>
        </div>
      </div>

      <!-- Right gauges -->
      <div class="hud-right">
        <!-- In split mode: Stage 2 gauges -->
        <template v-if="isSplitScreen">
          <div class="gauge">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" transform="rotate(135, 60, 60)" />
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" :stroke-dashoffset="gaugeDashoffset(speedFill)" transform="rotate(135, 60, 60)" class="gauge-fill" />
            </svg>
            <div class="gauge-content">
              <div class="gauge-label">SPEED</div>
              <div class="gauge-value">{{ speedDisplay }}</div>
              <div class="gauge-unit">KM/H</div>
            </div>
          </div>
          <div class="gauge">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" transform="rotate(135, 60, 60)" />
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" :stroke-dashoffset="gaugeDashoffset(altitudeFill)" transform="rotate(135, 60, 60)" class="gauge-fill" />
            </svg>
            <div class="gauge-content">
              <div class="gauge-label">ALTITUDE</div>
              <div class="gauge-value">{{ altitudeDisplay }}</div>
              <div class="gauge-unit">KM</div>
            </div>
          </div>
          <div class="stage-label">STAGE 2</div>
        </template>

        <!-- Normal mode: G-Force + Engine status -->
        <template v-else>
          <div class="gauge">
            <svg viewBox="0 0 120 120" class="gauge-svg">
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" transform="rotate(135, 60, 60)" />
              <circle cx="60" cy="60" :r="GAUGE_RADIUS" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${GAUGE_ARC} ${GAUGE_CIRCUMFERENCE}`" :stroke-dashoffset="gaugeDashoffset(gForceFill)" transform="rotate(135, 60, 60)" class="gauge-fill" />
            </svg>
            <div class="gauge-content">
              <div class="gauge-label">G-FORCE</div>
              <div class="gauge-value">{{ gForceDisplay }}</div>
              <div class="gauge-unit">G</div>
            </div>
          </div>
          <div class="engine-status">
            <svg viewBox="0 0 36 36" class="engine-svg">
              <circle
                v-for="(dot, i) in engineDots.dots"
                :key="i"
                :cx="dot.x" :cy="dot.y" :r="dot.r"
                :fill="engineDots.active ? '#ffffff' : 'rgba(255,255,255,0.15)'"
                :class="{ 'engine-active': engineDots.active }"
              />
            </svg>
          </div>
        </template>
      </div>
    </div>

    <!-- Mute indicator -->
    <div class="mute-indicator" :class="{ muted: isMuted }">
      <span v-if="isMuted">MUTED</span>
      <span v-else-if="audioStarted">M TO MUTE</span>
    </div>

    <!-- Event prompt -->
    <Transition name="prompt">
      <div v-if="showPrompt" class="event-prompt">
        <div class="prompt-text">{{ promptText }}</div>
        <div v-if="state.activeEvent?.requiresInput" class="timing-bar">
          <div class="timing-fill" :style="{ width: `${eventWindowProgress * 100}%` }" />
          <div class="timing-marker" />
        </div>
      </div>
    </Transition>

    <!-- Orbit success screen -->
    <Transition name="fade">
      <div v-if="state.phase === 'orbit'" class="result-overlay success">
        <div class="result-content">
          <div class="result-title">ORBIT ACHIEVED</div>
          <div class="result-stats">
            <div class="stat-row">
              <span class="stat-label">MAX ALTITUDE</span>
              <span class="stat-value">{{ game.formatAltitude(state.maxAltitude) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">MAX SPEED</span>
              <span class="stat-value">{{ game.formatSpeed(state.maxSpeed) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">MISSION TIME</span>
              <span class="stat-value">{{ game.formatMissionTime(state.flight.missionTime) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">SCORE</span>
              <span class="stat-value highlight">{{ state.score }}</span>
            </div>
          </div>
          <div class="result-action">PRESS R TO RETRY</div>
        </div>
      </div>
    </Transition>

    <!-- Failure screen -->
    <Transition name="fade">
      <div v-if="state.phase === 'failed'" class="result-overlay failure">
        <div class="result-content">
          <div class="result-title fail">MISSION FAILED</div>
          <div class="fail-reason">{{ state.failReason }}</div>
          <div class="result-stats">
            <div class="stat-row">
              <span class="stat-label">ALTITUDE REACHED</span>
              <span class="stat-value">{{ game.formatAltitude(state.maxAltitude) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">MAX SPEED</span>
              <span class="stat-value">{{ game.formatSpeed(state.maxSpeed) }}</span>
            </div>
          </div>
          <div class="result-action">PRESS R TO RETRY</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.game {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #000;
  overflow: hidden;
}

.canvas-container {
  position: absolute;
  inset: 0;
}

/* === SPLIT SCREEN DIVIDER === */
.split-divider {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: calc(100% - 120px);
  background: #000;
  z-index: 5;
}

/* === HUD === */
.hud {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 24px 12px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.6) 70%, transparent 100%);
  z-index: 10;
}

.hud-left,
.hud-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  position: relative;
}

.hud-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 0 24px;
}

/* === STAGE LABELS === */
.stage-label {
  position: absolute;
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--spacex-dim);
  white-space: nowrap;
}

/* === GAUGES === */
.gauge {
  position: relative;
  width: 100px;
  height: 100px;
}

.gauge-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.gauge-fill {
  transition: stroke-dashoffset 0.15s linear;
}

.gauge-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.gauge-label {
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--spacex-dim);
  margin-bottom: 2px;
}

.gauge-value {
  font-family: var(--font-mono);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--spacex-text);
  line-height: 1;
}

.gauge-unit {
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: var(--spacex-dim);
  margin-top: 2px;
}

/* === TIMELINE === */
.timeline {
  position: relative;
  width: 100%;
  max-width: 500px;
  height: 40px;
  margin-bottom: 4px;
}

.timeline-track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-50%);
}

.timeline-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.5);
  transition: width 0.3s linear;
}

.timeline-dot {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: left 0.3s linear;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
}

.timeline-milestones {
  position: absolute;
  inset: 0;
}

.milestone {
  position: absolute;
  transform: translateX(-50%);
}

.milestone-tick {
  position: absolute;
  left: 50%;
  width: 1px;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  transform: translateX(-50%);
}

.milestone.passed .milestone-tick {
  background: rgba(255, 255, 255, 0.6);
}

.milestone-label {
  font-family: var(--font-mono);
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.milestone.passed .milestone-label {
  color: rgba(255, 255, 255, 0.7);
}

.milestone.top .milestone-tick {
  top: calc(50% - 7px);
}
.milestone.top .milestone-label {
  bottom: calc(50% + 5px);
}

.milestone.bottom .milestone-tick {
  top: calc(50% + 1px);
}
.milestone.bottom .milestone-label {
  top: calc(50% + 9px);
}

/* === MISSION CLOCK === */
.clock-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mission-clock {
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--spacex-text);
  text-align: center;
}

.clock-prefix {
  font-size: 1rem;
  color: var(--spacex-dim);
  margin-right: 4px;
}

.clock-time {
  font-size: 1.6rem;
}

/* === FAST FORWARD === */
.ff-btn {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: var(--spacex-dim);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.ff-btn:hover {
  color: var(--spacex-text);
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.1);
}

.ff-btn.active {
  color: var(--spacex-accent);
  border-color: var(--spacex-accent);
  background: rgba(255, 255, 255, 0.08);
  animation: pulse-border 1s ease-in-out infinite;
}

/* === ENGINE STATUS === */
.engine-status {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.engine-svg {
  width: 50px;
  height: 50px;
}

.engine-active {
  filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.6));
}

/* === MUTE === */
.mute-indicator {
  position: absolute;
  top: 12px;
  right: 16px;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.25);
  z-index: 10;
  pointer-events: none;
}

.mute-indicator.muted {
  color: var(--spacex-fail);
}

/* === EVENT PROMPT === */
.event-prompt {
  position: absolute;
  bottom: 140px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 15;
}

.prompt-text {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--spacex-text);
  padding: 8px 24px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  backdrop-filter: blur(10px);
  animation: pulse-border 1.5s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% { border-color: rgba(255, 255, 255, 0.2); }
  50% { border-color: rgba(255, 255, 255, 0.6); }
}

.timing-bar {
  margin-top: 8px;
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  position: relative;
  margin-left: auto;
  margin-right: auto;
}

.timing-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--spacex-success), var(--spacex-warning), var(--spacex-fail));
  border-radius: 2px;
  transition: width 0.1s linear;
}

.timing-marker {
  position: absolute;
  left: 50%;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: var(--spacex-text);
  transform: translateX(-50%);
}

/* === RESULT SCREENS === */
.result-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  z-index: 50;
}

.result-content {
  text-align: center;
}

.result-title {
  font-family: var(--font-mono);
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  margin-bottom: 32px;
  color: var(--spacex-success);
}

.result-title.fail {
  color: var(--spacex-fail);
}

.fail-reason {
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--spacex-dim);
  margin-bottom: 32px;
  letter-spacing: 0.1em;
}

.result-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 40px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 48px;
}

.stat-label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  color: var(--spacex-dim);
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 600;
  color: var(--spacex-text);
}

.stat-value.highlight {
  color: var(--spacex-accent);
  font-size: 1.25rem;
}

.result-action {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  color: var(--spacex-dim);
  animation: pulse-opacity 2s ease-in-out infinite;
}

@keyframes pulse-opacity {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* === TRANSITIONS === */
.prompt-enter-active,
.prompt-leave-active {
  transition: all 0.3s ease;
}
.prompt-enter-from,
.prompt-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
