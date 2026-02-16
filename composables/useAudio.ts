import type { FlightData } from '~/types/game'

interface AudioLayer {
  buffer: AudioBuffer | null
  source: AudioBufferSourceNode | null
  gain: GainNode
  targetVolume: number
  currentVolume: number
}

interface VoiceCue {
  buffer: AudioBuffer | null
  played: boolean
}

// Time-triggered voice cues: [missionTime threshold, cue id]
const TIME_CUES: [number, string][] = [
  [-15, '15_seconds'],
  [-10, 'countdown'],
]

const EVENT_CUES: [string, string][] = [
  ['max-q', 'maxq'],
  ['meco', 'meco'],
]

export function useAudio() {
  let ctx: AudioContext | null = null
  const layers: Record<string, AudioLayer> = {}
  const voices: Record<string, VoiceCue> = {}
  let voiceGain: GainNode | null = null
  let initialized = false
  let muted = false
  let lastMissionTime = -Infinity
  let lastPhase = ''

  async function init() {
    if (initialized) return

    ctx = new AudioContext()

    // Voice gain node
    voiceGain = ctx.createGain()
    voiceGain.gain.value = 1.0
    voiceGain.connect(ctx.destination)

    // Engine loop sounds
    const loopSounds: Record<string, string> = {
      atmosphere: '/sounds/rocket_engine_burn_atmosphere.mp3',
      highAltitude: '/sounds/rocket_engine_burn_high_altitude.mp3',
      noise: '/sounds/rocket_engine_burn_noise.mp3',
      highNoise: '/sounds/rocket_engine_burn_high_noise.mp3',
    }

    // Voice cue sounds
    const voiceSounds: Record<string, string> = {
      '15_seconds': '/sounds/voice/15_seconds.mp3',
      countdown: '/sounds/voice/countdown_10-1.mp3',
      ignition: '/sounds/voice/ignition.mp3',
      maxq: '/sounds/voice/max-q.mp3',
      meco: '/sounds/voice/meco.mp3',
      stageSep: '/sounds/voice/stage-separation-confirmed.mp3',
    }

    // Load all buffers in parallel
    const loadBuffer = async (src: string): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(src)
        const arrayBuf = await res.arrayBuffer()
        return await ctx!.decodeAudioData(arrayBuf)
      } catch {
        return null
      }
    }

    // Load loop sounds
    await Promise.all(Object.entries(loopSounds).map(async ([key, src]) => {
      const gain = ctx!.createGain()
      gain.gain.value = 0
      gain.connect(ctx!.destination)
      layers[key] = {
        buffer: null,
        source: null,
        gain,
        targetVolume: 0,
        currentVolume: 0,
      }
      layers[key].buffer = await loadBuffer(src)
    }))

    // Load voice sounds
    await Promise.all(Object.entries(voiceSounds).map(async ([key, src]) => {
      voices[key] = { buffer: await loadBuffer(src), played: false }
    }))

    // Start engine loops at volume 0
    for (const layer of Object.values(layers)) {
      startLoop(layer)
    }

    initialized = true
  }

  function startLoop(layer: AudioLayer) {
    if (!ctx || !layer.buffer) return
    const src = ctx.createBufferSource()
    src.buffer = layer.buffer
    src.loop = true
    src.connect(layer.gain)
    src.start(0)
    layer.source = src
  }

  function playVoice(id: string) {
    if (!ctx || !voiceGain || muted) return
    const cue = voices[id]
    if (!cue?.buffer || cue.played) return
    cue.played = true

    const src = ctx.createBufferSource()
    src.buffer = cue.buffer
    src.connect(voiceGain)
    src.start(0)
  }

  function resume() {
    if (ctx?.state === 'suspended') {
      ctx.resume()
    }
  }

  function update(flight: FlightData, phase: string, countdown: number) {
    if (!initialized || !ctx) return

    const missionTime = phase === 'pre-launch' ? -countdown : flight.missionTime

    // ── Voice cues triggered by time ──
    for (const [threshold, cueId] of TIME_CUES) {
      if (lastMissionTime < threshold && missionTime >= threshold) {
        playVoice(cueId)
      }
    }

    // ── Voice cues triggered by phase change ──
    for (const [eventPhase, cueId] of EVENT_CUES) {
      if (lastPhase !== eventPhase && phase === eventPhase) {
        playVoice(cueId)
      }
    }

    lastMissionTime = missionTime
    lastPhase = phase

    // ── Engine loop volumes ──
    const isFlying = phase !== 'pre-launch' && phase !== 'orbit' && phase !== 'failed'
    const engineOn = flight.throttle > 0 && flight.fuel > 0

    if (muted || !isFlying || !engineOn) {
      for (const layer of Object.values(layers)) {
        layer.targetVolume = 0
      }
    } else {
      const altFactor = Math.min(1, flight.altitude / 80000)

      layers.atmosphere.targetVolume = (1 - altFactor) * 0.7
      layers.highAltitude.targetVolume = altFactor * 0.6

      const maxQBoost = phase === 'max-q' ? 0.15 : 0
      layers.noise.targetVolume = 0.25 + maxQBoost

      const qFactor = Math.min(1, flight.dynamicPressure / 30000)
      layers.highNoise.targetVolume = qFactor * 0.35
    }

    // Smooth volume transitions
    for (const layer of Object.values(layers)) {
      const diff = layer.targetVolume - layer.currentVolume
      const rate = Math.abs(diff) > 0.3 ? 0.08 : 0.03
      layer.currentVolume += diff * rate
      layer.gain.gain.value = Math.max(0, Math.min(1, layer.currentVolume))
    }
  }

  /** Play ignition voice cue (called when player presses SPACE to launch) */
  function playIgnition() {
    playVoice('ignition')
  }

  /** Play stage separation voice cue (called from game page) */
  function playStageSep() {
    playVoice('stageSep')
  }

  function resetCues() {
    for (const cue of Object.values(voices)) {
      cue.played = false
    }
    lastMissionTime = -Infinity
    lastPhase = ''
  }

  function toggleMute(): boolean {
    muted = !muted
    if (muted) {
      for (const layer of Object.values(layers)) {
        layer.gain.gain.value = 0
        layer.currentVolume = 0
      }
      if (voiceGain) voiceGain.gain.value = 0
    } else {
      if (voiceGain) voiceGain.gain.value = 1
    }
    return muted
  }

  function isMuted(): boolean {
    return muted
  }

  function dispose() {
    for (const layer of Object.values(layers)) {
      layer.source?.stop()
      layer.source?.disconnect()
      layer.gain.disconnect()
    }
    if (ctx) {
      ctx.close()
      ctx = null
    }
    initialized = false
  }

  return {
    init,
    resume,
    update,
    playIgnition,
    playStageSep,
    resetCues,
    toggleMute,
    isMuted,
    dispose,
  }
}
