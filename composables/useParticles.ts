import * as THREE from 'three'

const MAX_FIRE = 600
const MAX_SMOKE = 500
const MAX_STEAM = 1200

interface Particle {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  age: number
  maxAge: number
  size: number
  active: boolean
}

export interface ParticleConfig {
  nozzleWorldY: number
  rocketBaseY: number
  throttle: number
  fuel: number
  altitude: number
  phase: string
  stage: number
  dt: number
  countdown: number
  started: boolean
}

function createRadialTexture(stops: [number, string][]): THREE.Texture {
  const s = 64
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  for (const [pos, col] of stops) g.addColorStop(pos, col)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}

// ── Shaders ──────────────────────────────────────────────────────────

const FIRE_VERT = /* glsl */ `
attribute float pSize;
attribute float pAge;
attribute float pMaxAge;
varying float vLife;
void main() {
  vLife = clamp(pAge / pMaxAge, 0.0, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float grow = pSize * (1.0 + vLife * 1.5);
  gl_PointSize = min(grow * (500.0 / -mv.z), 256.0);
  gl_Position = projectionMatrix * mv;
}
`

const FIRE_FRAG = /* glsl */ `
uniform sampler2D map;
varying float vLife;
void main() {
  vec4 tex = texture2D(map, gl_PointCoord);
  vec3 col;
  float t = vLife;
  if (t < 0.1) {
    col = vec3(1.0, 1.0, 0.95) * 4.0;
  } else if (t < 0.3) {
    float s = (t - 0.1) / 0.2;
    col = mix(vec3(1.0, 1.0, 0.7) * 3.0, vec3(1.0, 0.7, 0.2) * 2.0, s);
  } else if (t < 0.6) {
    float s = (t - 0.3) / 0.3;
    col = mix(vec3(1.0, 0.7, 0.2) * 2.0, vec3(1.0, 0.3, 0.0), s);
  } else {
    float s = (t - 0.6) / 0.4;
    col = mix(vec3(1.0, 0.3, 0.0), vec3(0.3, 0.05, 0.0), s);
  }
  float a = tex.a * (1.0 - smoothstep(0.6, 1.0, t));
  gl_FragColor = vec4(col, a);
}
`

const SMOKE_VERT = /* glsl */ `
attribute float pSize;
attribute float pAge;
attribute float pMaxAge;
varying float vLife;
varying vec3 vWorldPos;
void main() {
  vLife = clamp(pAge / pMaxAge, 0.0, 1.0);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float grow = pSize * (1.0 + vLife * 8.0);
  gl_PointSize = min(grow * (500.0 / -mv.z), 512.0);
  gl_Position = projectionMatrix * mv;
}
`

const SMOKE_FRAG = /* glsl */ `
uniform vec3 sunDirection;
varying float vLife;
varying vec3 vWorldPos;

// Cheap value noise — single hash per sample
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);

  // 2-octave noise for organic edges
  vec2 nUV = uv * 2.5 + vWorldPos.xz * 0.05;
  float noise = valueNoise(nUV) * 0.6 + valueNoise(nUV * 2.3) * 0.4;

  // Cloud shape: radial falloff warped by noise
  float edge = 0.7 + noise * 0.35;
  float shape = 1.0 - smoothstep(0.0, edge, dist);
  shape *= 0.65 + noise * 0.4;

  // Sun-lit shading
  float sunDot = dot(normalize(uv + 0.001), sunDirection.xz) * 0.5 + 0.5;
  float lightSide = 0.6 + sunDot * 0.4;

  vec3 litColor = vec3(0.92, 0.90, 0.87) * lightSide;
  vec3 shadowColor = vec3(0.45, 0.43, 0.42);
  float shadowMix = vLife * 0.6 + (1.0 - sunDot) * 0.25;
  vec3 col = mix(litColor, shadowColor, shadowMix);

  float a = shape * (1.0 - smoothstep(0.15, 1.0, vLife)) * 0.50;
  gl_FragColor = vec4(col, a);
}
`

const STEAM_VERT = /* glsl */ `
attribute float pSize;
attribute float pAge;
attribute float pMaxAge;
varying float vLife;
varying vec3 vWorldPos;
void main() {
  vLife = clamp(pAge / pMaxAge, 0.0, 1.0);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float grow = pSize * (1.0 + vLife * 14.0);
  gl_PointSize = min(grow * (500.0 / -mv.z), 512.0);
  gl_Position = projectionMatrix * mv;
}
`

const STEAM_FRAG = /* glsl */ `
uniform vec3 sunDirection;
varying float vLife;
varying vec3 vWorldPos;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);

  // 2-octave noise for billowy edges
  vec2 nUV = uv * 2.0 + vWorldPos.xz * 0.03;
  float noise = valueNoise(nUV) * 0.6 + valueNoise(nUV * 2.3) * 0.4;

  // Soft billowy shape
  float edge = 0.65 + noise * 0.4;
  float shape = 1.0 - smoothstep(0.0, edge, dist);
  shape *= 0.6 + noise * 0.5;

  // Sun-lit with backlight scatter
  float sunDot = dot(normalize(uv + 0.001), sunDirection.xz) * 0.5 + 0.5;
  float backlight = (1.0 - sunDot) * (1.0 - sunDot) * 0.25;
  float lightSide = 0.7 + sunDot * 0.3 + backlight;

  vec3 litColor = vec3(0.97, 0.95, 0.93) * lightSide;
  vec3 shadowColor = vec3(0.65, 0.63, 0.62);
  float shadowMix = vLife * 0.45 + (1.0 - sunDot) * 0.2;
  vec3 col = mix(litColor, shadowColor, shadowMix);

  float a = shape * (1.0 - smoothstep(0.06, 1.0, vLife)) * 0.45;
  gl_FragColor = vec4(col, a);
}
`

// ── Particle system ──────────────────────────────────────────────────

export function useParticles() {
  const fireGroup = new THREE.Group()
  const smokeGroup = new THREE.Group()
  const steamGroup = new THREE.Group()

  let fireGeo: THREE.BufferGeometry
  let smokeGeo: THREE.BufferGeometry
  let steamGeo: THREE.BufferGeometry
  const firePool: Particle[] = []
  const smokePool: Particle[] = []
  const steamPool: Particle[] = []

  let hasIgnited = false

  function makePool(n: number): Particle[] {
    return Array.from({ length: n }, () => ({
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      age: 0, maxAge: 1, size: 1, active: false,
    }))
  }

  function initGeometry(max: number): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(max * 3), 3))
    geo.setAttribute('pSize', new THREE.Float32BufferAttribute(new Float32Array(max), 1))
    geo.setAttribute('pAge', new THREE.Float32BufferAttribute(new Float32Array(max), 1))
    geo.setAttribute('pMaxAge', new THREE.Float32BufferAttribute(new Float32Array(max), 1))
    geo.setDrawRange(0, 0)
    return geo
  }

  function init() {
    const fireTex = createRadialTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.15, 'rgba(255,230,170,0.9)'],
      [0.4, 'rgba(255,160,60,0.5)'],
      [0.7, 'rgba(220,60,0,0.15)'],
      [1, 'rgba(0,0,0,0)'],
    ])

    // Smoke and steam use procedural noise in shader — no texture needed

    // Fire
    fireGeo = initGeometry(MAX_FIRE)
    const fireMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: fireTex } },
      vertexShader: FIRE_VERT,
      fragmentShader: FIRE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    fireGroup.add(new THREE.Points(fireGeo, fireMat))

    // Smoke
    smokeGeo = initGeometry(MAX_SMOKE)
    const smokeMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      },
      vertexShader: SMOKE_VERT,
      fragmentShader: SMOKE_FRAG,
      transparent: true,
      depthWrite: false,
    })
    smokeGroup.add(new THREE.Points(smokeGeo, smokeMat))

    // Steam (water deluge)
    steamGeo = initGeometry(MAX_STEAM)
    const steamMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
      },
      vertexShader: STEAM_VERT,
      fragmentShader: STEAM_FRAG,
      transparent: true,
      depthWrite: false,
    })
    steamGroup.add(new THREE.Points(steamGeo, steamMat))

    firePool.push(...makePool(MAX_FIRE))
    smokePool.push(...makePool(MAX_SMOKE))
    steamPool.push(...makePool(MAX_STEAM))
  }

  function findSlot(pool: Particle[]): Particle | null {
    for (const p of pool) if (!p.active) return p
    return null
  }

  // ── LOX venting: vapor from top of rocket, falls down, then drifts with wind ──

  function emitVent(rocketBaseY: number, countdown: number, started: boolean, dt: number) {
    if (countdown <= 0) return

    // Gentle venting, intensifies as countdown progresses
    const baseRate = started ? 25 : 15
    const intensity = started ? Math.min(1, (16 - countdown) / 8) : 0.5
    const rate = baseRate + intensity * 35
    const count = Math.floor(rate * dt + Math.random())

    for (let i = 0; i < count; i++) {
      const p = findSlot(steamPool)
      if (!p) break
      p.active = true
      p.age = 0
      p.maxAge = 5 + Math.random() * 7
      p.size = 1.5 + Math.random() * 2.5  // Start small, shader grows with life

      // Single emission point at the top of the rocket
      p.x = 0
      p.y = rocketBaseY + 52
      p.z = 0

      // Falls down, wind pushes right (+X), slight random spread
      p.vx = 1.5 + Math.random() * 2.0
      p.vy = -(2.0 + Math.random() * 3.5)
      p.vz = (Math.random() - 0.5) * 2.0
    }
  }

  // ── Pre-ignition water deluge steam (T-3 to T-0) ──

  function emitPreIgnitionSteam(countdown: number, started: boolean, dt: number) {
    if (!started) return
    if (countdown > 3 || countdown <= 0) return

    const intensity = 1 - countdown / 3
    const rate = 120 * intensity
    const count = Math.floor(rate * dt + Math.random())

    for (let i = 0; i < count; i++) {
      const p = findSlot(steamPool)
      if (!p) break
      p.active = true
      p.age = 0
      p.maxAge = 3 + Math.random() * 5
      p.size = 10 + Math.random() * 25

      p.x = (Math.random() - 0.5) * 20
      p.y = Math.random() * 3
      p.z = (Math.random() - 0.5) * 20

      const angle = Math.random() * Math.PI * 2
      const outSpeed = 3 + Math.random() * 10
      p.vx = Math.cos(angle) * outSpeed
      p.vy = 2 + Math.random() * 8
      p.vz = Math.sin(angle) * outSpeed
    }
  }

  // ── Ignition burst: massive one-time explosion of fire + clouds ──

  function emitIgnitionBurst(nozzleY: number) {
    // Fire burst — intense orange/white fireball
    for (let i = 0; i < 150; i++) {
      const p = findSlot(firePool)
      if (!p) break
      p.active = true
      p.age = 0
      p.maxAge = 0.2 + Math.random() * 0.7
      p.size = 12 + Math.random() * 25

      const angle = Math.random() * Math.PI * 2
      const radiusXZ = Math.random() * 8
      p.x = Math.cos(angle) * radiusXZ
      p.y = nozzleY + (Math.random() - 0.3) * 5
      p.z = Math.sin(angle) * radiusXZ

      const outSpeed = 15 + Math.random() * 35
      p.vx = Math.cos(angle) * outSpeed * (0.5 + Math.random())
      p.vy = -8 + Math.random() * 22
      p.vz = Math.sin(angle) * outSpeed * (0.5 + Math.random())
    }

    // Steam/water deluge cloud — staggered ages so they don't vanish together
    for (let i = 0; i < 300; i++) {
      const p = findSlot(steamPool)
      if (!p) break
      p.active = true
      p.age = Math.random() * 2  // Stagger start so they fade at different times
      p.maxAge = 10 + Math.random() * 20
      p.size = 35 + Math.random() * 65

      const angle = Math.random() * Math.PI * 2
      const radiusXZ = Math.random() * 18
      p.x = Math.cos(angle) * radiusXZ
      p.y = Math.random() * 6
      p.z = Math.sin(angle) * radiusXZ

      const outSpeed = 8 + Math.random() * 20
      p.vx = Math.cos(angle) * outSpeed
      p.vy = 3 + Math.random() * 15
      p.vz = Math.sin(angle) * outSpeed
    }

    // Smoke burst — staggered ages
    for (let i = 0; i < 200; i++) {
      const p = findSlot(smokePool)
      if (!p) break
      p.active = true
      p.age = Math.random() * 2
      p.maxAge = 10 + Math.random() * 18
      p.size = 20 + Math.random() * 55

      const angle = Math.random() * Math.PI * 2
      const radiusXZ = Math.random() * 22
      p.x = Math.cos(angle) * radiusXZ
      p.y = Math.random() * 8
      p.z = Math.sin(angle) * radiusXZ

      const outSpeed = 5 + Math.random() * 18
      p.vx = Math.cos(angle) * outSpeed
      p.vy = 3 + Math.random() * 12
      p.vz = Math.sin(angle) * outSpeed
    }
  }

  // ── Fire: engine exhaust flame ──

  function emitFire(nozzleY: number, throttle: number, altitude: number, stage: number, dt: number) {
    if (throttle <= 0) return

    const altFactor = Math.min(1, altitude / 50000)
    const spread = 0.5 + altFactor * 2.0
    const sizeBase = stage === 1 ? 7 : 3.5

    // Boost at very low altitude — ground deflection effect
    const groundBoost = altitude < 300 ? 1.5 + (1 - altitude / 300) : 1.0
    const rate = (stage === 1 ? 250 : 100) * groundBoost
    const count = Math.floor(rate * throttle * dt + Math.random())

    for (let i = 0; i < count; i++) {
      const p = findSlot(firePool)
      if (!p) break
      p.active = true
      p.age = 0
      p.maxAge = 0.15 + Math.random() * 0.5
      p.size = (sizeBase + Math.random() * sizeBase * 0.8) * (1 + (groundBoost - 1) * 0.5)

      // Wider fire at ground level (deflection off flame trench)
      const groundSpread = altitude < 200 ? spread + (1 - altitude / 200) * 5 : spread
      p.x = (Math.random() - 0.5) * groundSpread * 2
      p.y = nozzleY
      p.z = (Math.random() - 0.5) * groundSpread * 2

      const speed = 15 + Math.random() * 15
      p.vx = (Math.random() - 0.5) * groundSpread * 8
      p.vy = -speed
      p.vz = (Math.random() - 0.5) * groundSpread * 8

      // At ground level, fire deflects sideways off the pad
      if (altitude < 100) {
        const a = Math.random() * Math.PI * 2
        const deflect = (1 - altitude / 100) * 20
        p.vx += Math.cos(a) * deflect
        p.vz += Math.sin(a) * deflect
        p.vy *= 0.5
      }
    }
  }

  // ── Smoke: pad smoke + exhaust trail ──

  function emitSmoke(nozzleY: number, altitude: number, phase: string, throttle: number, stage: number, dt: number) {
    if (phase === 'pre-launch' || phase === 'orbit' || phase === 'failed') return
    if (throttle <= 0) return

    // Pad-level billowing smoke
    if (altitude < 3000) {
      const fadeout = Math.max(0, 1 - altitude / 3000)
      // Boost at very low altitude
      const lowBoost = altitude < 500 ? 2.5 - altitude / 500 * 1.5 : 1.0
      const rate = 120 * fadeout * lowBoost
      const count = Math.floor(rate * dt + Math.random())

      for (let i = 0; i < count; i++) {
        const p = findSlot(smokePool)
        if (!p) break
        p.active = true
        p.age = 0
        p.maxAge = 4 + Math.random() * 6
        p.size = (12 + Math.random() * 20) * (1 + (lowBoost - 1) * 0.4)

        const spreadR = 30 + (lowBoost > 1 ? 15 : 0)
        p.x = (Math.random() - 0.5) * spreadR
        p.y = Math.random() * 3
        p.z = (Math.random() - 0.5) * spreadR

        const angle = Math.random() * Math.PI * 2
        const outSpeed = 3 + Math.random() * 12 * lowBoost
        p.vx = Math.cos(angle) * outSpeed
        p.vy = 2 + Math.random() * 8
        p.vz = Math.sin(angle) * outSpeed
      }
    }

    // Exhaust trail (from nozzle at altitude)
    if (altitude > 200) {
      const rate = stage === 1 ? 50 : 25
      const count = Math.floor(rate * throttle * dt + Math.random())

      for (let i = 0; i < count; i++) {
        const p = findSlot(smokePool)
        if (!p) break
        p.active = true
        p.age = 0
        p.maxAge = 2 + Math.random() * 3
        p.size = 3 + Math.random() * 6

        p.x = (Math.random() - 0.5) * 3
        p.y = nozzleY
        p.z = (Math.random() - 0.5) * 3

        p.vx = (Math.random() - 0.5) * 2
        p.vy = -4 + Math.random() * 2
        p.vz = (Math.random() - 0.5) * 2
      }
    }
  }

  // ── Steam: massive water deluge clouds ──

  function emitSteam(nozzleY: number, throttle: number, altitude: number, phase: string, dt: number) {
    if (altitude > 2000) return
    if (phase === 'pre-launch' || phase === 'orbit' || phase === 'failed') return
    if (throttle <= 0) return

    const fadeout = Math.max(0, 1 - altitude / 2000)
    // Boost at very low altitude
    const lowBoost = altitude < 500 ? 2.0 - altitude / 500 : 1.0
    const rate = 300 * fadeout * Math.min(1, throttle + 0.3) * lowBoost
    const count = Math.floor(rate * dt + Math.random())

    for (let i = 0; i < count; i++) {
      const p = findSlot(steamPool)
      if (!p) break
      p.active = true
      p.age = 0
      p.maxAge = 5 + Math.random() * 8
      p.size = (18 + Math.random() * 35) * (1 + (lowBoost - 1) * 0.5)

      // 30% from nozzle area, 70% from pad base
      const fromNozzle = Math.random() < 0.3
      if (fromNozzle) {
        p.x = (Math.random() - 0.5) * 10
        p.y = Math.min(nozzleY + 2, 10)
        p.z = (Math.random() - 0.5) * 10
      } else {
        const spreadR = 30 + lowBoost * 10
        p.x = (Math.random() - 0.5) * spreadR
        p.y = Math.random() * 3
        p.z = (Math.random() - 0.5) * spreadR
      }

      const angle = Math.random() * Math.PI * 2
      const outSpeed = 5 + Math.random() * 20 * (1 + (lowBoost - 1) * 0.3)
      p.vx = Math.cos(angle) * outSpeed
      p.vy = 3 + Math.random() * 15
      p.vz = Math.sin(angle) * outSpeed
    }
  }

  function updatePool(pool: Particle[], dt: number, drag: number = 0, buoyancy: number = 0, windX: number = 0) {
    for (const p of pool) {
      if (!p.active) continue
      p.age += dt
      if (p.age >= p.maxAge) { p.active = false; continue }

      const life = p.age / p.maxAge

      // Air resistance — particles slow down over time
      if (drag > 0) {
        const d = 1 - drag * dt
        p.vx *= d
        p.vy *= d
        p.vz *= d
      }

      // Buoyancy — hot gas rises (stronger as particle ages / warms up)
      if (buoyancy > 0) {
        p.vy += buoyancy * life * dt
      }

      // Wind drift — increases with age as particle spreads out
      if (windX !== 0) {
        p.vx += windX * life * dt
      }

      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
    }
  }

  function uploadGPU(pool: Particle[], geo: THREE.BufferGeometry) {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const sz = geo.getAttribute('pSize') as THREE.BufferAttribute
    const ag = geo.getAttribute('pAge') as THREE.BufferAttribute
    const ma = geo.getAttribute('pMaxAge') as THREE.BufferAttribute
    let n = 0
    for (const p of pool) {
      if (!p.active) continue
      pos.setXYZ(n, p.x, p.y, p.z)
      sz.setX(n, p.size)
      ag.setX(n, p.age)
      ma.setX(n, p.maxAge)
      n++
    }
    pos.needsUpdate = true
    sz.needsUpdate = true
    ag.needsUpdate = true
    ma.needsUpdate = true
    geo.setDrawRange(0, n)
  }

  // ── Launch ground clouds: continuous billowing below engine at liftoff ──

  function emitLaunchClouds(nozzleY: number, altitude: number, dt: number) {
    if (altitude > 500) return

    const fade = 1 - altitude / 500
    const rate = 200 * fade
    const count = Math.floor(rate * dt + Math.random())

    for (let i = 0; i < count; i++) {
      const p = findSlot(steamPool)
      if (!p) break
      p.active = true
      p.age = 0
      p.maxAge = 8 + Math.random() * 14
      p.size = 20 + Math.random() * 40

      // Spawn at ground level below engine
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * 15
      p.x = Math.cos(angle) * r
      p.y = Math.min(nozzleY, 5) + Math.random() * 3
      p.z = Math.sin(angle) * r

      const outSpeed = 4 + Math.random() * 12
      p.vx = Math.cos(angle) * outSpeed
      p.vy = 2 + Math.random() * 10
      p.vz = Math.sin(angle) * outSpeed
    }
  }

  function update(config: ParticleConfig) {
    const { nozzleWorldY, rocketBaseY, throttle, fuel, altitude, phase, stage, dt, countdown, started } = config
    const engineOn = throttle > 0 && fuel > 0

    // Pre-launch effects
    if (phase === 'pre-launch') {
      emitVent(rocketBaseY, countdown, started, dt)
      emitPreIgnitionSteam(countdown, started, dt)
    }

    // Detect ignition — one-time massive burst
    if (engineOn && !hasIgnited) {
      hasIgnited = true
      emitIgnitionBurst(nozzleWorldY)
    }

    if (engineOn) emitFire(nozzleWorldY, throttle, altitude, stage, dt)
    if (engineOn && altitude < 500) emitLaunchClouds(nozzleWorldY, altitude, dt)
    emitSmoke(nozzleWorldY, altitude, phase, throttle, stage, dt)
    emitSteam(nozzleWorldY, throttle, altitude, phase, dt)

    updatePool(firePool, dt, 0, 0, 0)
    updatePool(smokePool, dt, 0.3, 1.0, 2.0)
    updatePool(steamPool, dt, 0.2, 0.8, 3.0)

    uploadGPU(firePool, fireGeo)
    uploadGPU(smokePool, smokeGeo)
    uploadGPU(steamPool, steamGeo)
  }

  function setSunDirection(dir: THREE.Vector3) {
    const smokeMat = smokeGroup.children[0] as THREE.Points
    const steamMat = steamGroup.children[0] as THREE.Points
    if (smokeMat) {
      ;(smokeMat.material as THREE.ShaderMaterial).uniforms.sunDirection.value.copy(dir)
    }
    if (steamMat) {
      ;(steamMat.material as THREE.ShaderMaterial).uniforms.sunDirection.value.copy(dir)
    }
  }

  function reset() {
    hasIgnited = false
    for (const p of firePool) p.active = false
    for (const p of smokePool) p.active = false
    for (const p of steamPool) p.active = false
    uploadGPU(firePool, fireGeo)
    uploadGPU(smokePool, smokeGeo)
    uploadGPU(steamPool, steamGeo)
  }

  function dispose() {
    fireGeo?.dispose()
    smokeGeo?.dispose()
    steamGeo?.dispose()
  }

  return { fireGroup, smokeGroup, steamGroup, init, update, setSunDirection, reset, dispose }
}
