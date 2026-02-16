import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useParticles } from './useParticles'
import type { FlightData, GameState } from '~/types/game'

const EARTH_VISUAL_RADIUS = 30000

// Falcon 9 model constants
const MODEL_SCALE = 2.25
const MODEL_INTERSTAGE_Y = 12    // Y in model coords where S1/S2 split
const MODEL_ROCKET_BASE_Y = 0.5  // Y of rocket base in model coords
const MODEL_PAD_XZ_THRESHOLD = 6 // Meshes wider than this → pad/tower

function altitudeToVisual(altitude: number): number {
  if (altitude < 1000) return altitude
  return 1000 + Math.log10(altitude / 1000) * 2000
}

// ── Terrain noise (CPU side) ────────────────────────────────────────

function _hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function _noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  return _hash(ix, iy) * (1 - sx) * (1 - sy)
    + _hash(ix + 1, iy) * sx * (1 - sy)
    + _hash(ix, iy + 1) * (1 - sx) * sy
    + _hash(ix + 1, iy + 1) * sx * sy
}

function _fbm(x: number, y: number, octaves: number): number {
  let v = 0, a = 0.5
  for (let i = 0; i < octaves; i++) {
    v += a * _noise(x, y)
    x *= 2; y *= 2; a *= 0.5
  }
  return v
}

// ── Renderer ────────────────────────────────────────────────────────

export function useRenderer() {
  let renderer: THREE.WebGLRenderer
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let stage1Camera: THREE.PerspectiveCamera
  let composer: EffectComposer
  let renderPass: RenderPass
  let onResizeHandler: (() => void) | null = null

  const particles = useParticles()

  // Viewport
  let containerWidth = 0
  let containerHeight = 0
  let splitMode = false

  // Scene objects
  let rocketGroup: THREE.Group
  let stage1Group: THREE.Group
  let stage2Group: THREE.Group
  let flameGroup: THREE.Group
  let flameMesh: THREE.Mesh
  let separatedStage1: THREE.Group | null = null

  // Environment
  let earthMesh: THREE.Mesh
  let atmosphereMesh: THREE.Mesh
  let launchSiteGroup: THREE.Group
  let skyMesh: THREE.Mesh
  let starsMesh: THREE.Points
  let cloudMesh: THREE.Mesh
  let cloudMaterial: THREE.ShaderMaterial

  // Lights
  let sunLight: THREE.DirectionalLight
  const sunDir = new THREE.Vector3(0.8, 0.15, 0.4).normalize()
  let fireLight: THREE.PointLight
  const floodLights: THREE.SpotLight[] = []

  // Loaded 3D model groups
  let loadedPadGroup: THREE.Group | null = null
  let loadedRocketS1: THREE.Group | null = null
  let loadedRocketS2: THREE.Group | null = null
  let modelLoaded = false
  let s2NozzleLocalY = 41.5 // updated when model loads

  // State
  let countdownZoom = 1
  let cloudTime = 0

  // ── Init ──────────────────────────────────────────────────────────

  function init(container: HTMLElement) {
    containerWidth = container.clientWidth
    containerHeight = container.clientHeight

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(containerWidth, containerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.3
    container.appendChild(renderer.domElement)

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x08101e)
    scene.fog = new THREE.FogExp2(0x0c1830, 0.00010)

    camera = new THREE.PerspectiveCamera(50, containerWidth / containerHeight, 0.1, 100000)
    camera.position.set(80, 30, 120)
    camera.lookAt(0, 30, 0)

    stage1Camera = new THREE.PerspectiveCamera(50, containerWidth / containerHeight, 0.1, 100000)
    stage1Camera.position.copy(camera.position)

    // ── Lighting: golden hour / late dusk ──
    const ambientLight = new THREE.AmbientLight(0x2a3858, 1.2)
    scene.add(ambientLight)

    const hemiLight = new THREE.HemisphereLight(0x6688cc, 0x3a2a10, 0.8)
    scene.add(hemiLight)

    // Sun (low on horizon — golden hour warmth)
    sunLight = new THREE.DirectionalLight(0xffb070, 1.5)
    sunLight.position.set(sunDir.x * 500, sunDir.y * 500, sunDir.z * 500)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 4096
    sunLight.shadow.mapSize.height = 4096
    sunLight.shadow.camera.near = 1
    sunLight.shadow.camera.far = 2000
    sunLight.shadow.camera.left = -150
    sunLight.shadow.camera.right = 150
    sunLight.shadow.camera.top = 150
    sunLight.shadow.camera.bottom = -150
    sunLight.shadow.bias = -0.001
    scene.add(sunLight)
    scene.add(sunLight.target)

    // ── Pad floodlights (bright white spotlights on the rocket) ──
    const floodPositions = [
      { pos: [40, 35, 30], target: [0, 25, 0] },   // front-right
      { pos: [-30, 30, 40], target: [0, 20, 0] },   // front-left
      { pos: [35, 25, -25], target: [0, 30, 0] },   // back-right
      { pos: [-20, 20, -30], target: [0, 15, 0] },   // back-left
    ]
    for (const fl of floodPositions) {
      const spot = new THREE.SpotLight(0xffeedd, 30, 250, Math.PI / 6, 0.5, 1.5)
      spot.position.set(fl.pos[0], fl.pos[1], fl.pos[2])
      spot.target.position.set(fl.target[0], fl.target[1], fl.target[2])
      spot.castShadow = false // perf: only sunlight casts shadows
      scene.add(spot)
      scene.add(spot.target)
      floodLights.push(spot)
    }

    // Dynamic fire light
    fireLight = new THREE.PointLight(0xff6622, 0, 250)
    fireLight.position.set(0, 2, 0)
    scene.add(fireLight)

    // ── Build scene ──
    buildEarth()
    buildTerrain()
    buildLaunchSite()
    buildRocket()
    buildSky()
    buildStars()
    buildClouds()

    // ── Load 3D model ──
    loadFalcon9Model()

    // ── Particles ──
    particles.init()
    scene.add(particles.fireGroup)
    scene.add(particles.smokeGroup)
    scene.add(particles.steamGroup)

    // ── Bloom post-processing ──
    const rt = new THREE.WebGLRenderTarget(containerWidth, containerHeight, {
      type: THREE.HalfFloatType,
    })
    composer = new EffectComposer(renderer, rt)
    renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(containerWidth, containerHeight),
      0.8,  // strength
      0.4,  // radius
      0.75, // threshold
    ))
    composer.addPass(new OutputPass())

    // ── Resize ──
    onResizeHandler = () => {
      containerWidth = container.clientWidth
      containerHeight = container.clientHeight
      renderer.setSize(containerWidth, containerHeight)
      composer.setSize(containerWidth, containerHeight)
    }
    window.addEventListener('resize', onResizeHandler)
  }

  // ── Earth sphere with texture ─────────────────────────────────────

  function buildEarth() {
    const earthGeo = new THREE.SphereGeometry(EARTH_VISUAL_RADIUS, 128, 96)

    const textureLoader = new THREE.TextureLoader()
    const earthTexture = textureLoader.load('/textures/earth_daymap.jpg')
    earthTexture.colorSpace = THREE.SRGBColorSpace

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: earthTexture },
        sunDirection: { value: sunDir.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        void main() {
          vec3 texColor = texture2D(map, vUv).rgb;
          float diffuse = max(0.0, dot(vNormal, sunDirection));
          float ambient = 0.08;
          vec3 lit = texColor * (ambient + diffuse * 0.92);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float rim = 1.0 - max(0.0, dot(vNormal, viewDir));
          float rimGlow = pow(rim, 3.5) * 0.6;
          vec3 atmosColor = vec3(0.3, 0.55, 1.0);
          float sunFacing = max(0.0, dot(vNormal, sunDirection) + 0.2);
          lit += atmosColor * rimGlow * sunFacing;
          gl_FragColor = vec4(lit, 1.0);
        }
      `,
    })
    earthMesh = new THREE.Mesh(earthGeo, earthMat)
    earthMesh.position.y = -EARTH_VISUAL_RADIUS
    earthMesh.rotation.y = Math.PI * 0.8
    scene.add(earthMesh)

    // Atmosphere glow sphere
    const atmosGeo = new THREE.SphereGeometry(EARTH_VISUAL_RADIUS * 1.008, 64, 32)
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: sunDir.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float fresnel = 1.0 - max(0.0, dot(vNormal, viewDir));
          float intensity = pow(fresnel, 4.0);
          float sunFacing = max(0.0, dot(vNormal, sunDirection) + 0.3);
          vec3 color = vec3(0.35, 0.65, 1.0);
          gl_FragColor = vec4(color * intensity * sunFacing, intensity * 0.7);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat)
    atmosphereMesh.position.y = -EARTH_VISUAL_RADIUS
    scene.add(atmosphereMesh)
  }

  // ── Terrain (noise-displaced ground) ──────────────────────────────

  function buildTerrain() {
    const size = 3000
    const segments = 128
    const geo = new THREE.PlaneGeometry(size, size, segments, segments)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const dist = Math.sqrt(x * x + z * z)

      // Height displacement — flat near pad, rolling hills farther out
      const padFlat = Math.max(0, 1 - dist / 80)
      const h = _fbm(x * 0.003 + 10, z * 0.003 + 10, 4) * 12 * (1 - padFlat)
      pos.setY(i, h)

      // Color bands
      const n = _fbm(x * 0.01 + 50, z * 0.01 + 50, 3)
      const n2 = _fbm(x * 0.005 + 100, z * 0.005 + 100, 2)
      let r: number, g: number, b: number

      if (dist < 25) {
        // Concrete launch pad — light grey with scorch marks
        const scorch = _fbm(x * 0.05 + 200, z * 0.05 + 200, 2) * 0.15
        r = 0.50 - scorch + n * 0.04; g = 0.48 - scorch + n * 0.04; b = 0.45 - scorch + n * 0.03
      } else if (dist < 60) {
        // Transition: concrete → sandy ground
        const t = (dist - 25) / 35
        const cr = 0.48, cg = 0.46, cb = 0.42
        const gr = 0.42 + n * 0.06, gg = 0.36 + n * 0.05, gb = 0.26 + n * 0.04
        r = cr * (1 - t) + gr * t; g = cg * (1 - t) + gg * t; b = cb * (1 - t) + gb * t
      } else {
        // Sandy scrubland with sparse vegetation (Florida/Texas coast)
        const sr = 0.40, sg = 0.35, sb = 0.25  // dry sandy base
        const vr = 0.22 + n * 0.06, vg = 0.30 + n * 0.08, vb = 0.15 + n * 0.04  // green patches
        const moisture = n2
        r = sr * (1 - moisture) + vr * moisture
        g = sg * (1 - moisture) + vg * moisture
        b = sb * (1 - moisture) + vb * moisture

        // Gentle fade at edges (not too dark)
        const edgeFade = Math.min(1, dist / 1200)
        r *= 1 - edgeFade * 0.3
        g *= 1 - edgeFade * 0.3
        b *= 1 - edgeFade * 0.3
      }

      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.0,
    })

    const terrain = new THREE.Mesh(geo, mat)
    terrain.receiveShadow = true
    terrain.position.y = 0.05
    scene.add(terrain)
  }

  // ── Launch site (structures only — no ground, no sprites) ─────────

  function buildLaunchSite() {
    launchSiteGroup = new THREE.Group()

    // Pad (raised platform)
    const padGeo = new THREE.CylinderGeometry(20, 20, 1, 32)
    const padMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, metalness: 0.1 })
    const pad = new THREE.Mesh(padGeo, padMat)
    pad.position.y = 0.5
    pad.receiveShadow = true
    pad.castShadow = true
    launchSiteGroup.add(pad)

    // Pad marking
    const markGeo = new THREE.RingGeometry(8, 9, 32)
    const markMat = new THREE.MeshStandardMaterial({ color: 0xcccc00, roughness: 0.5 })
    const marking = new THREE.Mesh(markGeo, markMat)
    marking.rotation.x = -Math.PI / 2
    marking.position.y = 1.02
    launchSiteGroup.add(marking)

    // Flame trench
    const trenchGeo = new THREE.BoxGeometry(12, 3, 30)
    const trenchMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 })
    const trench = new THREE.Mesh(trenchGeo, trenchMat)
    trench.position.set(0, -1, 15)
    trench.receiveShadow = true
    launchSiteGroup.add(trench)

    // Launch tower
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.6, metalness: 0.3 })
    const towerGeo = new THREE.BoxGeometry(3, 80, 3)
    const tower = new THREE.Mesh(towerGeo, towerMat)
    tower.position.set(25, 40, 0)
    tower.castShadow = true
    launchSiteGroup.add(tower)

    const armGeo = new THREE.BoxGeometry(20, 2, 2)
    const arm = new THREE.Mesh(armGeo, towerMat)
    arm.position.set(15, 55, 0)
    arm.castShadow = true
    launchSiteGroup.add(arm)

    // Tower lattice braces
    for (let i = 0; i < 6; i++) {
      const braceGeo = new THREE.BoxGeometry(0.3, 0.3, 4)
      const brace = new THREE.Mesh(braceGeo, towerMat)
      brace.position.set(25, 8 + i * 12, 0)
      brace.rotation.y = ((i % 2) * 2 - 1) * 0.5
      launchSiteGroup.add(brace)
    }

    // Buildings
    for (let i = 0; i < 5; i++) {
      const bGeo = new THREE.BoxGeometry(8 + Math.random() * 12, 4 + Math.random() * 6, 8 + Math.random() * 12)
      const bMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 })
      const building = new THREE.Mesh(bGeo, bMat)
      const angle = (i / 5) * Math.PI * 2 + 0.5
      const dist = 80 + Math.random() * 60
      building.position.set(Math.cos(angle) * dist, building.geometry.parameters.height / 2, Math.sin(angle) * dist)
      building.castShadow = true
      building.receiveShadow = true
      launchSiteGroup.add(building)
    }

    // Water tower
    const wtGeo = new THREE.CylinderGeometry(2, 2, 20, 12)
    const wtMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.5 })
    const wt = new THREE.Mesh(wtGeo, wtMat)
    wt.position.set(-35, 10, 20)
    wt.castShadow = true
    launchSiteGroup.add(wt)

    const tankGeo = new THREE.SphereGeometry(4, 12, 10)
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.4 })
    const tank = new THREE.Mesh(tankGeo, tankMat)
    tank.position.set(-35, 22, 20)
    tank.castShadow = true
    launchSiteGroup.add(tank)

    launchSiteGroup.visible = false
    scene.add(launchSiteGroup)
  }

  // ── Rocket ────────────────────────────────────────────────────────

  function buildRocket() {
    rocketGroup = new THREE.Group()
    stage1Group = new THREE.Group()
    stage2Group = new THREE.Group()
    flameGroup = new THREE.Group()

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3, metalness: 0.1 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.4 })
    const interstgMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.3 })

    // === STAGE 1 ===
    const s1BodyGeo = new THREE.CylinderGeometry(1.83, 1.83, 40, 24)
    const s1Body = new THREE.Mesh(s1BodyGeo, bodyMat)
    s1Body.position.y = 20
    s1Body.castShadow = true
    stage1Group.add(s1Body)

    for (let i = 0; i < 4; i++) {
      const legGeo = new THREE.BoxGeometry(0.2, 12, 0.4)
      const leg = new THREE.Mesh(legGeo, darkMat)
      const angle = (i / 4) * Math.PI * 2
      leg.position.set(Math.cos(angle) * 2.0, 6, Math.sin(angle) * 2.0)
      leg.rotation.z = Math.cos(angle) * 0.15
      leg.rotation.x = Math.sin(angle) * 0.15
      leg.castShadow = true
      stage1Group.add(leg)
    }

    for (let i = 0; i < 4; i++) {
      const finGeo = new THREE.BoxGeometry(2.5, 1.5, 0.15)
      const fin = new THREE.Mesh(finGeo, darkMat)
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
      fin.position.set(Math.cos(angle) * 2.5, 37, Math.sin(angle) * 2.5)
      fin.rotation.y = angle
      fin.castShadow = true
      stage1Group.add(fin)
    }

    const nozzleGeo = new THREE.CylinderGeometry(0.25, 0.4, 1.5, 12)
    const centerNozzle = new THREE.Mesh(nozzleGeo, darkMat)
    centerNozzle.position.y = -0.75
    stage1Group.add(centerNozzle)
    for (let i = 0; i < 8; i++) {
      const nozzle = new THREE.Mesh(nozzleGeo, darkMat)
      const angle = (i / 8) * Math.PI * 2
      nozzle.position.set(Math.cos(angle) * 1.0, -0.75, Math.sin(angle) * 1.0)
      stage1Group.add(nozzle)
    }

    const interGeo = new THREE.CylinderGeometry(1.83, 1.83, 4, 24)
    const inter = new THREE.Mesh(interGeo, interstgMat)
    inter.position.y = 42
    stage1Group.add(inter)

    stage1Group.visible = false
    rocketGroup.add(stage1Group)

    // === STAGE 2 ===
    const s2BodyGeo = new THREE.CylinderGeometry(1.83, 1.83, 12, 24)
    const s2Body = new THREE.Mesh(s2BodyGeo, bodyMat)
    s2Body.position.y = 50
    s2Body.castShadow = true
    stage2Group.add(s2Body)

    const mvacGeo = new THREE.CylinderGeometry(0.3, 0.8, 2.5, 12)
    const mvac = new THREE.Mesh(mvacGeo, darkMat)
    mvac.position.y = 42.75
    stage2Group.add(mvac)

    const fairingGeo = new THREE.ConeGeometry(1.83, 8, 24)
    const fairingMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.35, metalness: 0.05 })
    const fairing = new THREE.Mesh(fairingGeo, fairingMat)
    fairing.position.y = 60
    fairing.castShadow = true
    stage2Group.add(fairing)

    stage2Group.visible = false
    rocketGroup.add(stage2Group)

    // === ENGINE FLAME (additive glow core) ===
    const flameGeo = new THREE.ConeGeometry(1.2, 8, 16)
    const flameMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        varying vec2 vUv;
        void main() {
          float t = vUv.y;
          vec3 col = mix(vec3(0.4, 0.6, 1.0) * 2.0, vec3(1.0, 0.6, 0.1) * 1.5, t);
          float flicker = 0.85 + 0.15 * sin(time * 40.0 + t * 10.0);
          float alpha = (1.0 - t) * 0.7 * flicker;
          gl_FragColor = vec4(col * flicker, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    flameMesh = new THREE.Mesh(flameGeo, flameMat)
    flameMesh.position.y = -5.5
    flameMesh.rotation.x = Math.PI
    flameMesh.visible = false
    flameGroup.add(flameMesh)

    rocketGroup.add(flameGroup)
    rocketGroup.position.y = 0.5
    scene.add(rocketGroup)
  }

  // ── Sky dome (Rayleigh + Mie atmospheric scattering) ─────────────

  function buildSky() {
    const skyGeo = new THREE.SphereGeometry(50000, 32, 32)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: sunDir.clone() },
        cameraAltitude: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 sunDirection;
        uniform float cameraAltitude;
        varying vec3 vWorldPosition;

        const float PI = 3.14159265;
        const float EARTH_R = 6371e3;
        const float ATMOS_R = 6471e3;
        const vec3 BETA_R = vec3(5.5e-6, 13.0e-6, 22.4e-6);
        const float BETA_M = 25e-6;
        const float HR = 8500.0;
        const float HM = 1200.0;
        const float SUN_I = 30.0;

        vec2 raySphere(vec3 ro, vec3 rd, float sr) {
          float b = dot(ro, rd);
          float c = dot(ro, ro) - sr * sr;
          float d = b * b - c;
          if (d < 0.0) return vec2(1e5, -1e5);
          d = sqrt(d);
          return vec2(-b - d, -b + d);
        }

        float phaseR(float mu) {
          return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
        }

        float phaseM(float mu) {
          const float g = 0.76;
          const float g2 = g * g;
          return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu))
            / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
        }

        void main() {
          vec3 dir = normalize(vWorldPosition - cameraPosition);
          float mu = dot(dir, sunDirection);

          float alt = max(10.0, cameraAltitude);
          vec3 ro = vec3(0.0, EARTH_R + alt, 0.0);

          vec3 sky = vec3(0.0);
          float odR = 0.0, odM = 0.0;

          // Intersect view ray with atmosphere
          vec2 ta = raySphere(ro, dir, ATMOS_R);
          if (ta.y > 0.0) {
            ta.x = max(ta.x, 0.0);

            // Clip to Earth surface
            vec2 te = raySphere(ro, dir, EARTH_R);
            float maxDist = ta.y;
            if (te.x > 0.0 && te.x < maxDist) maxDist = te.x;

            float pathLen = maxDist - ta.x;
            if (pathLen > 0.0) {
              const int STEPS = 8;
              float stepLen = pathLen / float(STEPS);

              vec3 totalR = vec3(0.0);
              vec3 totalM = vec3(0.0);

              for (int i = 0; i < STEPS; i++) {
                vec3 pos = ro + dir * (ta.x + (float(i) + 0.5) * stepLen);
                float h = length(pos) - EARTH_R;

                float hr = exp(-h / HR) * stepLen;
                float hm = exp(-h / HM) * stepLen;
                odR += hr;
                odM += hm;

                // Light optical depth toward sun (4 steps)
                vec2 tl = raySphere(pos, sunDirection, ATMOS_R);
                float slLen = tl.y / 4.0;
                float lodR = 0.0, lodM = 0.0;

                for (int j = 0; j < 4; j++) {
                  vec3 pl = pos + sunDirection * ((float(j) + 0.5) * slLen);
                  float hl = length(pl) - EARTH_R;
                  lodR += exp(-hl / HR) * slLen;
                  lodM += exp(-hl / HM) * slLen;
                }

                vec3 tau = BETA_R * (odR + lodR) + BETA_M * 1.1 * (odM + lodM);
                vec3 atten = exp(-tau);

                totalR += hr * atten;
                totalM += hm * atten;
              }

              sky = SUN_I * (totalR * BETA_R * phaseR(mu) + totalM * BETA_M * phaseM(mu));
            }
          }

          // Sun disc — visible from ground and space, attenuated by atmosphere
          vec3 sunAtten = exp(-(BETA_R * odR + BETA_M * 1.1 * odM));
          float sunDisc = smoothstep(0.9998, 0.99995, mu);
          sky += sunDisc * SUN_I * 0.4 * sunAtten;

          // Tone map
          sky = 1.0 - exp(-sky);

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
    })
    skyMesh = new THREE.Mesh(skyGeo, skyMat)
    scene.add(skyMesh)
  }

  // ── Stars ─────────────────────────────────────────────────────────

  function buildStars() {
    const starsGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(5000 * 3)
    for (let i = 0; i < 5000; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI * 0.5
      const r = 40000 + Math.random() * 10000
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 30, sizeAttenuation: true })
    starsMesh = new THREE.Points(starsGeo, starsMat)
    scene.add(starsMesh)
  }

  // ── Volumetric clouds (ray-marched with 3D noise, self-shadowing, HG phase) ──

  function buildClouds() {
    const cloudY = 2500
    const cloudH = 800
    const cloudGeo = new THREE.BoxGeometry(50000, cloudH, 50000)

    cloudMaterial = new THREE.ShaderMaterial({
      uniforms: {
        boundsMin: { value: new THREE.Vector3(-25000, cloudY - cloudH / 2, -25000) },
        boundsMax: { value: new THREE.Vector3(25000, cloudY + cloudH / 2, 25000) },
        time: { value: 0 },
        sunDirection: { value: sunDir.clone() },
        opacity: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 boundsMin;
        uniform vec3 boundsMax;
        uniform float time;
        uniform vec3 sunDirection;
        uniform float opacity;
        varying vec3 vWorldPosition;

        // ── Hash functions ──────────────────────────────────
        float hash13(vec3 p3) {
          p3 = fract(p3 * 0.1031);
          p3 += dot(p3, p3.zyx + 31.32);
          return fract((p3.x + p3.y) * p3.z);
        }

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        // ── 3D value noise ──────────────────────────────────
        float noise3D(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(
              mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
              mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x),
              f.y),
            mix(
              mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
              mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x),
              f.y),
            f.z);
        }

        // ── 2D noise for weather map ────────────────────────
        float noise2D(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
            mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x),
            f.y);
        }

        // ── FBM ─────────────────────────────────────────────
        float fbm3(vec3 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise3D(p);
            p = p * 2.0 + vec3(0.13, 0.27, 0.31);
            a *= 0.5;
          }
          return v;
        }

        float fbm2(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise2D(p);
            p = p * 2.0 + vec2(0.17, 0.23);
            a *= 0.5;
          }
          return v;
        }

        // ── Henyey-Greenstein phase function ────────────────
        float hgPhase(float cosTheta, float g) {
          float g2 = g * g;
          return (1.0 - g2) / (4.0 * 3.14159265 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
        }

        // ── Cloud density ───────────────────────────────────
        float sampleCloud(vec3 pos) {
          // Height fraction
          float hf = (pos.y - boundsMin.y) / (boundsMax.y - boundsMin.y);

          // Cumulus height profile — rounded bottom, anvil top
          float heightProfile = smoothstep(0.0, 0.15, hf) * smoothstep(1.0, 0.55, hf);
          if (heightProfile < 0.01) return 0.0;

          // Weather map — large-scale patchy coverage
          vec2 wUV = pos.xz * 0.00008 + time * 0.002;
          float weather = fbm2(wUV);
          float coverage = smoothstep(0.35, 0.65, weather);
          if (coverage < 0.01) return 0.0;

          // 3D shape noise
          vec3 np = pos * vec3(0.0003, 0.0008, 0.0003);
          np += vec3(time * 0.006, 0.0, time * 0.003);
          float shape = fbm3(np);

          // Detail erosion — carves edges for wispy look
          vec3 dp = pos * vec3(0.0015, 0.003, 0.0015) + time * 0.008;
          float detail = noise3D(dp) * 0.3;

          float density = coverage * heightProfile;
          density = density * shape - detail;
          density = max(0.0, density - 0.08);

          return density;
        }

        // ── Light march toward sun (self-shadowing) ─────────
        float lightMarch(vec3 pos) {
          float accumDensity = 0.0;
          vec3 step = sunDirection * 50.0;
          for (int i = 0; i < 5; i++) {
            pos += step;
            accumDensity += sampleCloud(pos);
          }
          return exp(-accumDensity * 50.0 * 0.008);
        }

        // ── Box intersection ────────────────────────────────
        vec2 intersectBox(vec3 ro, vec3 rd) {
          vec3 tMin = (boundsMin - ro) / rd;
          vec3 tMax = (boundsMax - ro) / rd;
          vec3 t1 = min(tMin, tMax);
          vec3 t2 = max(tMin, tMax);
          float tNear = max(max(t1.x, t1.y), t1.z);
          float tFar = min(min(t2.x, t2.y), t2.z);
          return vec2(tNear, tFar);
        }

        void main() {
          vec3 ro = cameraPosition;
          vec3 rd = normalize(vWorldPosition - cameraPosition);

          vec2 t = intersectBox(ro, rd);
          if (t.x > t.y) discard;
          t.x = max(t.x, 0.0);

          // Blue noise jitter — eliminates banding artifacts
          float jitter = fract(hash12(gl_FragCoord.xy) + time * 0.618033988);

          float rayLen = t.y - t.x;
          float stepSize = rayLen / 28.0;
          vec3 pos = ro + rd * (t.x + stepSize * jitter);

          float transmittance = 1.0;
          vec3 light = vec3(0.0);

          // Dual-lobe HG phase — forward (silver lining) + back scatter
          float cosAngle = dot(rd, sunDirection);
          float phase = mix(
            hgPhase(cosAngle, 0.6),
            hgPhase(cosAngle, -0.15),
            0.25
          );
          phase = max(phase, 0.15);

          for (int i = 0; i < 28; i++) {
            float density = sampleCloud(pos);

            if (density > 0.001) {
              // Self-shadowing: light march toward sun
              float lightT = lightMarch(pos);

              float hf = (pos.y - boundsMin.y) / (boundsMax.y - boundsMin.y);

              // Sun color — warm golden hour light, attenuated by self-shadow
              vec3 sunCol = vec3(0.9, 0.7, 0.45) * lightT * phase;

              // Ambient: cool blue from sky, darker below
              vec3 ambient = mix(
                vec3(0.08, 0.08, 0.12),
                vec3(0.20, 0.25, 0.40),
                hf
              ) * 0.9;

              vec3 scatterCol = sunCol + ambient;

              float absorption = density * stepSize * 0.005;
              light += scatterCol * transmittance * absorption;
              transmittance *= exp(-absorption * 1.2);

              if (transmittance < 0.01) break;
            }

            pos += rd * stepSize;
          }

          float alpha = (1.0 - transmittance) * opacity;
          if (alpha < 0.005) discard;

          // Soft tone mapping for cloud highlights
          light = 1.0 - exp(-light * 1.5);

          gl_FragColor = vec4(light, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    })

    cloudMesh = new THREE.Mesh(cloudGeo, cloudMaterial)
    cloudMesh.position.y = cloudY
    scene.add(cloudMesh)
  }

  // ── Load Falcon 9 GLB model ─────────────────────────────────────

  function loadFalcon9Model() {
    const dracoLoader = new DRACOLoader()
    // Use Google CDN for reliable WASM decoder loading
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    gltfLoader.load(
      '/models/falcon9.glb',
      (gltf) => processLoadedModel(gltf, dracoLoader),
      undefined,
      (error) => {
        console.warn('GLB load failed, keeping procedural fallback:', error)
        dracoLoader.dispose()
      },
    )
  }

  function processLoadedModel(gltf: { scene: THREE.Group }, dracoLoader: DRACOLoader) {
    gltf.scene.updateMatrixWorld(true)

    const padGroup = new THREE.Group()
    const s1Group = new THREE.Group()
    const s2Group = new THREE.Group()

    // Rocket axis in model world-space (from inspection)
    const ROCKET_AXIS_X = -0.1
    const ROCKET_AXIS_Z = -0.7
    // Tight radius: all actual rocket meshes are within dist 0.92 of axis.
    // Structural elements (crane hooks, brackets) start at dist ~1.88.
    const AXIS_RADIUS = 1.2
    let s2MinY = Infinity

    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh

      const box = new THREE.Box3().setFromObject(mesh)
      const center = new THREE.Vector3()
      const size = new THREE.Vector3()
      box.getCenter(center)
      box.getSize(size)

      // Clone and bake world transform into geometry
      const clone = mesh.clone()
      clone.geometry = mesh.geometry.clone()
      clone.geometry.applyMatrix4(mesh.matrixWorld)
      clone.position.set(0, 0, 0)
      clone.quaternion.identity()
      clone.scale.set(1, 1, 1)
      clone.updateMatrix()
      clone.castShadow = true
      clone.receiveShadow = true

      // Distance from rocket center axis in XZ plane
      const distFromAxis = Math.sqrt(
        (center.x - ROCKET_AXIS_X) ** 2 + (center.z - ROCKET_AXIS_Z) ** 2,
      )

      // Max extent in XZ — rocket body tubes are narrow (<5 units)
      const maxXZSize = Math.max(size.x, size.z)

      // Classification: only narrow parts right on the rocket axis are rocket.
      // Everything else (tower, strongback, arm, pad) stays on ground.
      if (distFromAxis <= AXIS_RADIUS && maxXZSize < 5 && box.max.y > 0.5) {
        const stage = center.y >= MODEL_INTERSTAGE_Y ? 'S2' : 'S1'
        console.log(`[ROCKET] ${stage} | name=${mesh.name} centerY=${center.y.toFixed(2)} minY=${box.min.y.toFixed(2)} maxY=${box.max.y.toFixed(2)} dist=${distFromAxis.toFixed(2)}`)
        if (center.y >= MODEL_INTERSTAGE_Y) {
          s2Group.add(clone)
          if (box.min.y < s2MinY) s2MinY = box.min.y
        } else {
          s1Group.add(clone)
        }
      } else {
        padGroup.add(clone)
      }
    })

    // Compute offset so rocket base aligns to Y=0 in game coords
    const baseOffset = -MODEL_ROCKET_BASE_Y * MODEL_SCALE

    // Scale and position all groups
    for (const g of [padGroup, s1Group, s2Group]) {
      g.scale.setScalar(MODEL_SCALE)
      g.position.y = baseOffset
      // Rotate 180° so tower faces away from camera
      g.rotation.y = Math.PI
    }

    // Compute stage 2 nozzle Y in game coords
    if (s2MinY < Infinity) {
      s2NozzleLocalY = s2MinY * MODEL_SCALE + baseOffset
    }

    // Store groups
    loadedRocketS1 = s1Group
    loadedRocketS2 = s2Group
    loadedPadGroup = padGroup

    // Replace procedural visuals
    stage1Group.visible = false
    stage2Group.visible = false
    rocketGroup.add(loadedRocketS1)
    rocketGroup.add(loadedRocketS2)

    launchSiteGroup.visible = false
    scene.add(loadedPadGroup)

    modelLoaded = true
    dracoLoader.dispose()
  }

  // ── Scene update (per frame) ──────────────────────────────────────

  function updateScene(state: GameState, started: boolean, dt: number) {
    if (!rocketGroup) return

    const { flight, phase, countdown, stage1Flight } = state

    // Handle restart
    if (phase === 'pre-launch' && separatedStage1) {
      scene.remove(separatedStage1)
      separatedStage1 = null
      splitMode = false
      if (modelLoaded) {
        if (loadedRocketS1) loadedRocketS1.visible = true
        if (loadedRocketS2) loadedRocketS2.visible = true
      } else {
        stage1Group.visible = true
      }
      flameGroup.position.y = 0
      flameMesh.position.y = -5.5
      particles.reset()
    }

    // Countdown zoom
    if (phase === 'pre-launch') {
      if (!started) {
        countdownZoom = 1
      } else if (countdown > 0) {
        countdownZoom = countdown / 16
      } else {
        countdownZoom = 0
      }
    } else {
      countdownZoom = 0
    }

    // Split mode
    splitMode = stage1Flight !== null && separatedStage1 !== null

    const visualAlt = altitudeToVisual(flight.altitude)
    rocketGroup.position.y = 0.5 + visualAlt

    // ── Dynamic sunrise — sun slowly rises during mission ──
    const missionTime = flight.missionTime
    const sunAngle = 0.15 + missionTime * 0.0004
    sunDir.set(0.8, Math.min(0.45, sunAngle), 0.4).normalize()

    // Update sun light position (follows rocket for proper shadows)
    if (flight.altitude < 5000) {
      sunLight.position.set(
        sunDir.x * 500,
        rocketGroup.position.y + sunDir.y * 500,
        sunDir.z * 500,
      )
      sunLight.target.position.set(0, rocketGroup.position.y, 0)
      sunLight.target.updateMatrixWorld()

      // Scale shadow camera to scene
      const shadowSize = Math.min(300, 100 + flight.altitude * 0.02)
      const cam = sunLight.shadow.camera as THREE.OrthographicCamera
      cam.left = -shadowSize
      cam.right = shadowSize
      cam.top = shadowSize
      cam.bottom = -shadowSize
      cam.updateProjectionMatrix()
    }

    // Update sky sun direction
    const skyMat = skyMesh.material as THREE.ShaderMaterial
    skyMat.uniforms.sunDirection.value.copy(sunDir)

    // ── Flame mesh ──
    const flameOn = flight.throttle > 0 && flight.fuel > 0
    flameMesh.visible = flameOn
    if (flameOn) {
      const flicker = 0.85 + Math.random() * 0.3
      const throttleScale = 0.5 + flight.throttle * 0.5
      flameMesh.scale.set(
        throttleScale * flicker,
        throttleScale * flicker * (flight.stage === 1 ? 1.0 : 0.6),
        throttleScale * flicker,
      )
      ;(flameMesh.material as THREE.ShaderMaterial).uniforms.time.value += dt

      if (flight.stage === 2) {
        const s2FlameY = modelLoaded ? s2NozzleLocalY : 42
        flameGroup.position.y = s2FlameY
        flameMesh.position.y = -3
      }
    }

    // ── Fire light ──
    if (flameOn) {
      const fireLightY = flight.stage === 1 ? -1.5 : (modelLoaded ? s2NozzleLocalY : 41.5)
      fireLight.position.set(0, rocketGroup.position.y + fireLightY, 0)
      const flicker = 0.8 + Math.random() * 0.4
      fireLight.intensity = flight.throttle * (flight.stage === 1 ? 8 : 3) * flicker
      fireLight.distance = flight.altitude < 500 ? 250 : 100
    } else {
      fireLight.intensity = 0
    }

    // ── Particles ──
    particles.setSunDirection(sunDir)
    const nozzleLocalY = flight.stage === 1 ? -1.5 : (modelLoaded ? s2NozzleLocalY : 41.5)
    const nozzleWorldY = rocketGroup.position.y + nozzleLocalY
    particles.update({
      nozzleWorldY,
      rocketBaseY: rocketGroup.position.y,
      throttle: flight.throttle,
      fuel: flight.fuel,
      altitude: flight.altitude,
      phase,
      stage: flight.stage,
      dt,
      countdown,
      started,
    })

    // ── Stage 1 after separation ──
    if (splitMode && stage1Flight && separatedStage1) {
      if (modelLoaded && loadedRocketS1) loadedRocketS1.visible = false
      else stage1Group.visible = false
      const stage1VisualAlt = altitudeToVisual(stage1Flight.altitude)
      separatedStage1.position.y = 0.5 + stage1VisualAlt
      updateStage1Camera(stage1Flight)
    } else if (phase === 'stage2-flight' || phase === 'seco' || phase === 'orbit') {
      if (modelLoaded && loadedRocketS1) loadedRocketS1.visible = false
      else stage1Group.visible = false
    }

    // Camera
    updateCamera(flight, visualAlt, splitMode)

    // Sky + atmosphere transition
    updateSky(flight.altitude)

    // Cloud animation + fade
    cloudTime += dt
    cloudMaterial.uniforms.time.value = cloudTime
    cloudMaterial.uniforms.sunDirection.value.copy(sunDir)
    const cloudFade = flight.altitude < 3000
      ? 1.0
      : flight.altitude < 10000 ? 1.0 - (flight.altitude - 3000) / 7000 : 0
    cloudMaterial.uniforms.opacity.value = cloudFade
    cloudMesh.visible = cloudFade > 0.01

    // Launch site visibility
    const siteVisible = flight.altitude < 50000
    if (launchSiteGroup && !modelLoaded) {
      launchSiteGroup.visible = siteVisible
    }
    if (loadedPadGroup) {
      loadedPadGroup.visible = siteVisible
    }

    // Stars
    if (starsMesh) {
      const maxAlt = stage1Flight
        ? Math.max(flight.altitude, stage1Flight.altitude)
        : flight.altitude
      const starOpacity = Math.min(1, maxAlt / 80000)
      ;(starsMesh.material as THREE.PointsMaterial).opacity = starOpacity
      ;(starsMesh.material as THREE.PointsMaterial).transparent = true
    }
  }

  function updateCamera(flight: FlightData, visualAlt: number, isSplit: boolean = false) {
    const alt = Math.max(1, flight.altitude)
    let camDist: number
    let camHeight: number

    if (isSplit) {
      // Split mode: tighter framing on stage 2
      camDist = 80
      camHeight = 20
    } else if (alt < 500) {
      camDist = 80 + alt * 0.15
      camHeight = 30 + alt * 0.3
    } else if (alt < 10000) {
      const t = (alt - 500) / 9500
      camDist = 155 + t * 300
      camHeight = 180 + t * 200
    } else {
      const t = Math.min(1, Math.log10(alt / 10000) / 3)
      camDist = 455 + t * 400
      camHeight = 380 + t * 300
    }

    // Pre-launch zoom
    const zoom = countdownZoom * countdownZoom
    camDist += zoom * 160
    camHeight += zoom * 40

    const targetX = camDist * 0.6
    const targetZ = camDist * 0.8

    // In split mode, center on S2 body (~50 units above rocket base)
    const lookOffset = isSplit ? 50 : 30
    const lookDown = (!isSplit && alt > 2000) ? Math.min(300, (alt - 2000) * 0.003) : 0
    const lookY = visualAlt + lookOffset - lookDown
    const targetY = lookY + camHeight * 0.3

    const lerpSpeed = isSplit ? 0.04 : (countdownZoom > 0 ? 0.04 : 0.02)
    camera.position.x += (targetX - camera.position.x) * lerpSpeed
    camera.position.y += (targetY - camera.position.y) * lerpSpeed
    camera.position.z += (targetZ - camera.position.z) * lerpSpeed

    const lookTarget = new THREE.Vector3(0, lookY, 0)
    camera.lookAt(lookTarget)
  }

  function updateStage1Camera(stage1Flight: FlightData) {
    const stage1VisualAlt = altitudeToVisual(stage1Flight.altitude)
    const stage1Y = 0.5 + stage1VisualAlt

    // S1 center is ~18 units above its base (half of first stage height)
    const lookY = stage1Y + 18

    const camDist = 70
    const targetX = camDist * 0.5
    const targetY = lookY + 10
    const targetZ = camDist * 0.7

    stage1Camera.position.x += (targetX - stage1Camera.position.x) * 0.04
    stage1Camera.position.y += (targetY - stage1Camera.position.y) * 0.04
    stage1Camera.position.z += (targetZ - stage1Camera.position.z) * 0.04

    stage1Camera.lookAt(new THREE.Vector3(0, lookY, 0))
  }

  function updateSky(altitude: number) {
    if (!skyMesh) return
    const mat = skyMesh.material as THREE.ShaderMaterial
    mat.uniforms.cameraAltitude.value = altitude

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = 0.00008 * Math.max(0, 1 - altitude / 30000)
    }
  }

  function triggerStageSeparation(_flight: FlightData) {
    if (modelLoaded && loadedRocketS1) {
      // Clone loaded S1 as separated piece
      separatedStage1 = loadedRocketS1.clone()
      // Create a wrapper group at the correct world position
      const wrapper = new THREE.Group()
      wrapper.add(separatedStage1)
      separatedStage1 = wrapper
      separatedStage1.position.y = rocketGroup.position.y
      scene.add(separatedStage1)

      loadedRocketS1.visible = false
      const s2FlameY = s2NozzleLocalY
      flameGroup.position.y = s2FlameY
      flameMesh.position.y = -3

      stage1Camera.position.copy(camera.position)
      stage1Camera.quaternion.copy(camera.quaternion)
    } else if (stage1Group.visible) {
      separatedStage1 = stage1Group.clone()
      separatedStage1.position.y = rocketGroup.position.y
      scene.add(separatedStage1)

      stage1Group.visible = false
      flameGroup.position.y = 42
      flameMesh.position.y = -3

      stage1Camera.position.copy(camera.position)
      stage1Camera.quaternion.copy(camera.quaternion)
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  function render() {
    if (!renderer || !scene || !camera) return

    if (splitMode) {
      // Dual viewport — no bloom in split mode
      const w = containerWidth
      const h = containerHeight
      const gap = 4
      const halfW = Math.floor((w - gap) / 2)

      renderer.setScissorTest(true)
      renderer.autoClear = false
      renderer.setClearColor(0x000000)
      renderer.clear()

      // Left — Stage 1
      renderer.setViewport(0, 0, halfW, h)
      renderer.setScissor(0, 0, halfW, h)
      stage1Camera.aspect = halfW / h
      stage1Camera.updateProjectionMatrix()
      renderer.render(scene, stage1Camera)

      // Right — Stage 2
      renderer.setViewport(halfW + gap, 0, halfW, h)
      renderer.setScissor(halfW + gap, 0, halfW, h)
      camera.aspect = halfW / h
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)

      renderer.autoClear = true
      renderer.setScissorTest(false)
    } else {
      // Single viewport with bloom
      renderer.setViewport(0, 0, containerWidth, containerHeight)
      camera.aspect = containerWidth / containerHeight
      camera.updateProjectionMatrix()
      renderPass.camera = camera
      composer.render()
    }
  }

  // ── Dispose ───────────────────────────────────────────────────────

  function dispose() {
    if (onResizeHandler) {
      window.removeEventListener('resize', onResizeHandler)
      onResizeHandler = null
    }
    particles.dispose()
    if (renderer) {
      renderer.dispose()
      renderer.domElement.remove()
    }
  }

  return {
    init,
    updateScene,
    render,
    dispose,
    triggerStageSeparation,
  }
}
