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

  // Music system — multiple tracks, each plays once
  const musicBuffers: Record<string, AudioBuffer | null> = {}
  let musicSource: AudioBufferSourceNode | null = null
  let musicGain: GainNode | null = null
  let musicPlaying = false
  let currentTrack = ''

  // MECO tracking for "reached space" trigger
  let mecoMissionTime = -1
  let reachedSpacePlayed = false

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
      loudEngine: '/sounds/loud-engine-burning.mp3',
      spaceEngine: '/sounds/engine-burning.mp3',
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
      problem: '/sounds/voice/problem/execute-abort-procedure.mp3',
    }

    // Music tracks
    const musicSounds: Record<string, string> = {
      'to-the-stars': '/music/to-the-stars.mp3',
      'reached-space': '/music/reached-space.mp3',
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

    // Load music tracks
    await Promise.all(Object.entries(musicSounds).map(async ([key, src]) => {
      musicBuffers[key] = await loadBuffer(src)
    }))

    // Music gain node
    musicGain = ctx.createGain()
    musicGain.gain.value = 0
    musicGain.connect(ctx.destination)

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

    // ── Track MECO time for "reached space" music trigger ──
    if (lastPhase !== 'stage-sep' && phase === 'stage-sep') {
      mecoMissionTime = missionTime
    }

    // 3 seconds after MECO → switch to "reached-space" track
    if (mecoMissionTime > 0 && !reachedSpacePlayed && missionTime >= mecoMissionTime + 3) {
      reachedSpacePlayed = true
      switchMusic('reached-space')
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
      // Altitude crossfade: loud engine → space engine
      const altFactor = Math.min(1, flight.altitude / 80000)

      // Launch rumble — loud burst then fades over ~12s
      const launchProximity = Math.max(0, 1 - flight.missionTime / 12)
      const launchBoost = launchProximity * launchProximity * 0.5

      // Primary engine: loud at launch, crossfades out with altitude
      layers.loudEngine.targetVolume = (1 - altFactor) * (0.65 + launchBoost)
      // Space engine: crossfades in with altitude
      layers.spaceEngine.targetVolume = altFactor * 0.45

      // Ambient texture layers (lower volume, complement the main engines)
      layers.atmosphere.targetVolume = (1 - altFactor) * (0.15 + launchBoost * 0.3)
      layers.highAltitude.targetVolume = altFactor * 0.12

      const maxQBoost = phase === 'max-q' ? 0.08 : 0
      layers.noise.targetVolume = 0.08 + maxQBoost + launchBoost * 0.3
      layers.highNoise.targetVolume = Math.min(1, flight.dynamicPressure / 30000) * 0.12 + launchBoost * 0.2
    }

    // Smooth volume transitions
    for (const layer of Object.values(layers)) {
      const diff = layer.targetVolume - layer.currentVolume
      const rate = Math.abs(diff) > 0.3 ? 0.15 : 0.06
      layer.currentVolume += diff * rate
      layer.gain.gain.value = Math.max(0, Math.min(1, layer.currentVolume))
    }

    // ── Music — prominent, always audible ──
    if (musicGain && musicPlaying && !muted) {
      const musicTarget = 0.35
      const current = musicGain.gain.value
      musicGain.gain.value += (musicTarget - current) * 0.03
    }
  }

  /** Start a music track (plays once, no loop) */
  function startMusic(trackId: string) {
    if (!ctx || !musicGain || muted) return
    const buffer = musicBuffers[trackId]
    if (!buffer) return

    // Stop current track if playing
    if (musicSource) {
      try { musicSource.stop() } catch {}
      musicSource = null
    }

    musicSource = ctx.createBufferSource()
    musicSource.buffer = buffer
    musicSource.loop = false
    musicSource.connect(musicGain)
    musicSource.onended = () => {
      if (currentTrack === trackId) {
        musicPlaying = false
        currentTrack = ''
      }
    }
    musicSource.start(0)
    musicGain.gain.setValueAtTime(0.30, ctx.currentTime)
    musicPlaying = true
    currentTrack = trackId
  }

  /** Cross-fade to a different music track */
  function switchMusic(trackId: string) {
    if (!ctx || !musicGain) return
    const buffer = musicBuffers[trackId]
    if (!buffer) return

    // Fade out current
    if (musicSource) {
      musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5)
      const oldSrc = musicSource
      musicSource = null
      setTimeout(() => { try { oldSrc.stop() } catch {} }, 1600)
    }

    // Fade in new track after crossfade gap
    setTimeout(() => {
      if (!ctx || !musicGain || muted) return
      musicSource = ctx.createBufferSource()
      musicSource.buffer = buffer
      musicSource.loop = false
      musicSource.connect(musicGain)
      musicSource.onended = () => {
        if (currentTrack === trackId) {
          musicPlaying = false
          currentTrack = ''
        }
      }
      musicSource.start(0)
      musicGain.gain.setValueAtTime(0, ctx.currentTime)
      musicGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 2)
      musicPlaying = true
      currentTrack = trackId
    }, 1500)
  }

  /** Play launch music — called at ignition */
  function playMusic() {
    startMusic('to-the-stars')
  }

  function stopMusic() {
    if (!musicSource || !musicGain || !ctx) return
    musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
    const src = musicSource
    setTimeout(() => { try { src.stop() } catch {} }, 600)
    musicSource = null
    musicPlaying = false
    currentTrack = ''
  }

  /** Play ignition voice cue (called when player presses SPACE to launch) */
  function playIgnition() {
    playVoice('ignition')
  }

  /** Play stage separation voice cue (called from game page) */
  function playStageSep() {
    playVoice('stageSep')
  }

  /** Play problem voice cue (called on mission failure) */
  function playProblem() {
    if (!ctx || !voiceGain || muted) return
    const cue = voices.problem
    if (!cue?.buffer) return
    const src = ctx.createBufferSource()
    src.buffer = cue.buffer
    src.connect(voiceGain)
    src.start(0)
  }

  function resetCues() {
    for (const cue of Object.values(voices)) {
      cue.played = false
    }
    lastMissionTime = -Infinity
    lastPhase = ''
    mecoMissionTime = -1
    reachedSpacePlayed = false
    stopMusic()
  }

  function toggleMute(): boolean {
    muted = !muted
    if (muted) {
      for (const layer of Object.values(layers)) {
        layer.gain.gain.value = 0
        layer.currentVolume = 0
      }
      if (voiceGain) voiceGain.gain.value = 0
      if (musicGain) musicGain.gain.value = 0
    } else {
      if (voiceGain) voiceGain.gain.value = 1
      if (musicGain && musicPlaying) musicGain.gain.value = 0.35
    }
    return muted
  }

  function isMuted(): boolean {
    return muted
  }

  function dispose() {
    stopMusic()
    for (const layer of Object.values(layers)) {
      layer.source?.stop()
      layer.source?.disconnect()
      layer.gain.disconnect()
    }
    musicGain?.disconnect()
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
    playMusic,
    playStageSep,
    playProblem,
    resetCues,
    toggleMute,
    isMuted,
    dispose,
  }
}
