import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useParticles } from './useParticles'
import type { FlightData, GameState } from '~/types/prologue'

const EARTH_VISUAL_RADIUS = 150000

// Falcon 9 model constants
const MODEL_SCALE = 2.25
const MODEL_INTERSTAGE_Y = 12    // Y in model coords where S1/S2 split
const MODEL_ROCKET_BASE_Y = -1.0 // Y of rocket base in model coords (raised so nothing clips floor)
const MODEL_PAD_XZ_THRESHOLD = 6 // Meshes wider than this → pad/tower

function altitudeToVisual(altitude: number): number {
  // Linear up to 5 km — Earth looks flat, realistic ground phase
  if (altitude < 5000) return altitude
  // Gentle log compression above — orbit (200 km) → ~10,000 visual units
  // Ratio to Earth radius: 10k / 150k ≈ 6.7% (real is 3.1%, close enough for gameplay)
  return 5000 + Math.log10(altitude / 5000) * 3200
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
  let s2FlameMesh: THREE.Mesh
  let separatedStage1: THREE.Group | null = null

  // Environment
  let earthMesh: THREE.Mesh
  let atmosphereMesh: THREE.Mesh
  let launchSiteGroup: THREE.Group
  let skyMesh: THREE.Mesh
  let horizonHaze: THREE.Mesh
  let starsMesh: THREE.Points
  let cloudMesh: THREE.Mesh
  let cloudMaterial: THREE.ShaderMaterial

  // Lights
  let sunLight: THREE.DirectionalLight
  const sunDir = new THREE.Vector3(-0.4, 0.03, -0.8).normalize()
  let fireLight: THREE.PointLight
  const floodLights: THREE.SpotLight[] = []
  let ambientLight: THREE.AmbientLight
  let hemiLight: THREE.HemisphereLight
  let bloomPass: UnrealBloomPass
  let sunBillboard: THREE.Mesh
  let sunBillboardMaterial: THREE.ShaderMaterial
  let sunLensflare: Lensflare

  // Pre-allocated temporaries to avoid GC pressure
  const _sunColor = new THREE.Color()
  const _camForward = new THREE.Vector3()

  // Loaded 3D model groups
  let loadedPadGroup: THREE.Group | null = null
  let loadedRocketS1: THREE.Group | null = null
  let loadedRocketS2: THREE.Group | null = null
  let supportTower: THREE.Group | null = null
  let towerPivot: THREE.Group | null = null
  let towerRotation = 0 // current rotation angle (radians)
  let passerelle: THREE.Group | null = null
  let passerellePivot: THREE.Group | null = null
  let passerelleRotation = 0
  let modelLoaded = false
  let s2NozzleLocalY = 41.5 // updated when model loads

  // State
  let countdownZoom = 1
  let cloudTime = 0
  let shakeTime = 0
  let separationOffset = 0

  // Gravity turn — visual pitch and downrange displacement
  const DOWNRANGE_DIR = new THREE.Vector3(-0.6, 0, -0.8).normalize()
  const PITCH_AXIS = new THREE.Vector3(
    DOWNRANGE_DIR.z, 0, -DOWNRANGE_DIR.x,
  ).normalize() // perpendicular to downrange in horizontal plane
  let stage1SepPitch = 0
  let stage1SepOffsetX = 0
  let stage1SepOffsetZ = 0

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
    scene.background = new THREE.Color(0x2a1e14)
    scene.fog = new THREE.FogExp2(0x0c1830, 0.00010)

    camera = new THREE.PerspectiveCamera(50, containerWidth / containerHeight, 0.1, 100000)
    camera.position.set(80, 30, 120)
    camera.lookAt(0, 30, 0)

    stage1Camera = new THREE.PerspectiveCamera(50, containerWidth / containerHeight, 0.1, 100000)
    stage1Camera.position.copy(camera.position)

    // ── Lighting: golden hour / late dusk ──
    ambientLight = new THREE.AmbientLight(0x2a3858, 1.0)
    scene.add(ambientLight)

    hemiLight = new THREE.HemisphereLight(0x4a5577, 0x2a1a08, 0.7)
    scene.add(hemiLight)

    // Sun (low on horizon — sunrise warmth)
    sunLight = new THREE.DirectionalLight(0xff7030, 1.2)
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
    fireLight = new THREE.PointLight(0xffaa33, 0, 250)
    fireLight.position.set(0, 2, 0)
    scene.add(fireLight)

    // ── Build scene ──
    buildEarth()
    buildTerrain()
    buildLaunchSite()
    buildRocket()
    buildSky()
    buildHorizonHaze()
    buildStars()
    buildClouds()
    buildSunBillboard()
    buildLensflare()

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
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(containerWidth, containerHeight),
      0.7,  // strength — subtle bloom, not washed out
      0.4,  // radius
      0.88, // threshold — only the very brightest HDR fire blooms
    )
    composer.addPass(bloomPass)
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
          float intensity = pow(fresnel, 5.0) * 0.5;
          float sunFacing = max(0.0, dot(vNormal, sunDirection) + 0.2);
          vec3 color = vec3(0.3, 0.55, 1.0);
          gl_FragColor = vec4(color * intensity * sunFacing, intensity * 0.4);
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

  // ── Terrain (satellite texture with displacement) ───────────────

  function buildTerrain() {
    const size = 2000
    const segments = 256
    const geo = new THREE.PlaneGeometry(size, size, segments, segments)
    geo.rotateX(-Math.PI / 2)

    // UV2 needed for aoMap
    geo.setAttribute('uv2', geo.getAttribute('uv').clone())

    // Radial alpha map — fully opaque in center, fades to transparent at edges
    const alphaSize = 256
    const alphaCanvas = document.createElement('canvas')
    alphaCanvas.width = alphaSize
    alphaCanvas.height = alphaSize
    const actx = alphaCanvas.getContext('2d')!
    const grad = actx.createRadialGradient(
      alphaSize / 2, alphaSize / 2, 0,
      alphaSize / 2, alphaSize / 2, alphaSize / 2,
    )
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.65, '#ffffff')
    grad.addColorStop(0.9, '#888888')
    grad.addColorStop(1.0, '#000000')
    actx.fillStyle = grad
    actx.fillRect(0, 0, alphaSize, alphaSize)
    const alphaTex = new THREE.CanvasTexture(alphaCanvas)

    const loader = new THREE.TextureLoader()

    const colorTex = loader.load('/textures/launch/launch-site.jpg')
    colorTex.colorSpace = THREE.SRGBColorSpace

    const normalTex = loader.load('/textures/launch/launch-site_normal.jpg')

    const displacementTex = loader.load('/textures/launch/launch-site_displacement.jpg')

    const aoTex = loader.load('/textures/launch/launch-site_ao.jpg')

    const mat = new THREE.MeshStandardMaterial({
      map: colorTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(1.5, 1.5),
      displacementMap: displacementTex,
      displacementScale: 0.7,
      displacementBias: -0.35,
      aoMap: aoTex,
      aoMapIntensity: 0.6,
      alphaMap: alphaTex,
      transparent: true,
      roughness: 0.85,
      metalness: 0.0,
    })

    const terrain = new THREE.Mesh(geo, mat)
    terrain.receiveShadow = true
    terrain.position.y = 0
    scene.add(terrain)
  }

  // ── Launch site (structures only — no ground, no sprites) ─────────

  function buildLaunchSite() {
    launchSiteGroup = new THREE.Group()
    // Empty — 3D model provides pad/tower geometry via loadFalcon9Model()
    launchSiteGroup.visible = false
    scene.add(launchSiteGroup)
  }

  // ── Rocket ────────────────────────────────────────────────────────

  function buildRocket() {
    rocketGroup = new THREE.Group()
    stage1Group = new THREE.Group()
    stage2Group = new THREE.Group()
    flameGroup = new THREE.Group()

    // Empty groups — 3D model populates these via loadFalcon9Model()
    stage1Group.visible = false
    stage2Group.visible = false
    rocketGroup.add(stage1Group)
    rocketGroup.add(stage2Group)

    // === ENGINE FLAME (additive glow core — tall columnar plume) ===
    const flameGeo = new THREE.ConeGeometry(2.2, 45, 16)
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
          // Noise-based flicker
          float n = fract(sin(dot(vec2(t * 8.0 + time * 25.0, time * 15.0), vec2(127.1, 311.7))) * 43758.5453);
          float flicker = 0.85 + 0.15 * n;

          // Color: warm yellow core → golden → amber tip
          vec3 col;
          if (t < 0.15) {
            col = vec3(1.0, 0.9, 0.55) * 4.0;
          } else if (t < 0.4) {
            float s = (t - 0.15) / 0.25;
            col = mix(vec3(1.0, 0.85, 0.4) * 3.5, vec3(1.0, 0.65, 0.15) * 2.5, s);
          } else if (t < 0.7) {
            float s = (t - 0.4) / 0.3;
            col = mix(vec3(1.0, 0.65, 0.15) * 2.5, vec3(0.9, 0.35, 0.03) * 1.2, s);
          } else {
            float s = (t - 0.7) / 0.3;
            col = mix(vec3(0.9, 0.35, 0.03) * 1.2, vec3(0.4, 0.08, 0.0) * 0.3, s);
          }
          float alpha = (1.0 - t * t) * 0.8 * flicker;
          gl_FragColor = vec4(col * flicker, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    flameMesh = new THREE.Mesh(flameGeo, flameMat)
    flameMesh.position.y = -19.5
    flameMesh.rotation.x = Math.PI
    flameMesh.visible = false
    flameGroup.add(flameMesh)
    flameGroup.position.x = -1.2

    // === S2 VACUUM PLUME (wide bell-shaped, blue-white) ===
    const s2FlameGeo = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55)
    const s2FlameMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          // Distance from center axis (0 at core, 1 at edge)
          float r = length(vPosition.xz);
          float y = -vPosition.y; // flip so tip = 0, base = 1
          float dist = length(vec2(r * 1.2, y));

          // Noise flicker
          float n = fract(sin(dot(vec2(r * 6.0 + time * 20.0, y * 4.0 + time * 12.0), vec2(127.1, 311.7))) * 43758.5453);
          float flicker = 0.9 + 0.1 * n;

          // Color: bright white-blue core → pale blue → deep blue edge
          vec3 col;
          float coreDist = length(vec2(r * 2.5, y * 0.8));
          if (coreDist < 0.2) {
            // Hot white core
            col = vec3(0.9, 0.95, 1.0) * 3.5;
          } else if (coreDist < 0.45) {
            float s = (coreDist - 0.2) / 0.25;
            col = mix(vec3(0.8, 0.9, 1.0) * 3.0, vec3(0.4, 0.6, 1.0) * 2.0, s);
          } else if (coreDist < 0.7) {
            float s = (coreDist - 0.45) / 0.25;
            col = mix(vec3(0.4, 0.6, 1.0) * 2.0, vec3(0.2, 0.35, 0.8) * 1.0, s);
          } else {
            float s = min(1.0, (coreDist - 0.7) / 0.3);
            col = mix(vec3(0.2, 0.35, 0.8) * 1.0, vec3(0.08, 0.12, 0.4) * 0.3, s);
          }

          // Alpha: solid core, fading at edges
          float alpha = smoothstep(1.0, 0.15, coreDist) * 0.7 * flicker;

          // Slight radial mach diamonds (concentric rings)
          float rings = 0.9 + 0.1 * sin(coreDist * 25.0 - time * 8.0);
          col *= rings;

          gl_FragColor = vec4(col * flicker, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    s2FlameMesh = new THREE.Mesh(s2FlameGeo, s2FlameMat)
    s2FlameMesh.rotation.x = Math.PI
    s2FlameMesh.position.y = -12
    s2FlameMesh.visible = false
    flameGroup.add(s2FlameMesh)

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
        const float ATMOS_R = 6471e3;  // 100 km atmosphere — thinner, less limb glow
        const vec3 BETA_R = vec3(5.5e-6, 13.0e-6, 22.4e-6);
        const float BETA_M = 21e-6;
        const float HR = 8500.0;
        const float HM = 1200.0;
        const float SUN_I = 18.0;

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
              const int STEPS = 12;
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

                // Light optical depth toward sun (6 steps)
                vec2 tl = raySphere(pos, sunDirection, ATMOS_R);
                float slLen = tl.y / 6.0;
                float lodR = 0.0, lodM = 0.0;

                for (int j = 0; j < 6; j++) {
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

  // ── Horizon haze (radial gradient disc that blends terrain edge into sky) ──

  function buildHorizonHaze() {
    const hazeGeo = new THREE.PlaneGeometry(40000, 40000, 1, 1)
    hazeGeo.rotateX(-Math.PI / 2)

    const hazeMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: sunDir.clone() },
        opacity: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 sunDirection;
        uniform float opacity;
        varying vec2 vUv;
        void main() {
          vec2 centered = vUv - 0.5;
          float dist = length(centered) * 2.0;

          float innerFade = smoothstep(0.04, 0.15, dist);

          vec3 hazeColor = mix(
            vec3(0.25, 0.22, 0.25),
            vec3(0.45, 0.30, 0.18),
            smoothstep(0.15, 0.8, dist)
          );

          // Warm orange glow concentrated on sun-facing side
          vec2 sunXZ = normalize(sunDirection.xz);
          vec2 dirXZ = normalize(centered);
          float sunFacing = max(0.0, dot(dirXZ, sunXZ));
          float sunGlow = pow(sunFacing, 3.0) * smoothstep(0.05, 0.5, dist);
          hazeColor += vec3(0.5, 0.22, 0.07) * sunGlow * 0.4;

          float alpha = innerFade * 0.9 * opacity;
          gl_FragColor = vec4(hazeColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    horizonHaze = new THREE.Mesh(hazeGeo, hazeMat)
    horizonHaze.position.y = 2
    scene.add(horizonHaze)
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

  // ── Sun billboard (HDR radial gradient, picked up by bloom) ─────

  function buildSunBillboard() {
    const geo = new THREE.PlaneGeometry(1, 1)
    sunBillboardMaterial = new THREE.ShaderMaterial({
      uniforms: {
        warmth: { value: 0.0 },
        spaceIntensity: { value: 0.0 },
        time: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float warmth;
        uniform float spaceIntensity;
        uniform float time;
        varying vec2 vUv;

        float hash(float n) { return fract(sin(n) * 43758.5453); }

        void main() {
          vec2 centered = vUv - 0.5;
          float dist = length(centered) * 2.0;

          // Circular mask
          float edgeMask = smoothstep(1.0, 0.45, dist);
          if (edgeMask < 0.001) discard;

          float angle = atan(centered.y, centered.x);

          // ── Tiny hard core ──
          float core = exp(-dist * dist * 50.0);

          // ── 4 structured cross spikes (always visible) ──
          float rot = time * 0.05;
          float cross4 = pow(abs(cos((angle + rot) * 2.0)), 16.0);
          float crossFade = exp(-dist * 1.3) * (1.0 - exp(-dist * 14.0));
          float crossRays = cross4 * crossFade * (0.3 + spaceIntensity * 0.3);

          // ── Many individual random flares (space: 24 rays) ──
          float flares = 0.0;
          const float PI = 3.14159265;
          for (int i = 0; i < 24; i++) {
            float fi = float(i);
            // Each ray: random fixed angle, length, width, brightness
            float rayAngle = hash(fi * 127.1 + 7.3) * PI * 2.0;
            float rayLen = hash(fi * 311.7 + 13.1) * 0.55 + 0.15;
            float rayWidth = 0.02 + hash(fi * 73.1 + 3.7) * 0.03;
            float rayBright = hash(fi * 43.7 + 17.1) * 0.7 + 0.3;

            // Twinkle: each ray pulses independently
            float speed = 1.5 + hash(fi * 97.3 + 5.3) * 4.0;
            float twinkle = 0.4 + 0.6 * sin(time * speed + fi * 3.71);

            // Angular proximity to this ray
            float ad = angle - rayAngle;
            ad = mod(ad + PI, PI * 2.0) - PI; // wrap to [-PI, PI]
            float inRay = exp(-ad * ad / (rayWidth * rayWidth));

            // Radial falloff per ray
            float radFade = exp(-dist / rayLen * 2.5) * smoothstep(0.0, 0.04, dist);

            flares += inRay * radFade * rayBright * twinkle;
          }
          flares *= spaceIntensity;

          // ── Combine ──
          float totalRays = crossRays + flares * 0.5;

          // Orange sunrise → near-white
          vec3 warmTint = mix(vec3(1.0, 0.5, 0.2), vec3(1.0, 0.97, 0.93), warmth);

          float coreHDR = 1.1 + spaceIntensity * 1.0;
          vec3 coreColor = vec3(coreHDR, coreHDR * 0.92, coreHDR * 0.85) * warmTint;
          vec3 rayColor = vec3(0.6, 0.42, 0.18) * warmTint * (1.0 + spaceIntensity * 1.2);

          vec3 color = (coreColor * core + rayColor * totalRays) * edgeMask;
          float alpha = (core + totalRays * 0.9) * edgeMask;
          alpha = min(alpha, 1.0);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    sunBillboard = new THREE.Mesh(geo, sunBillboardMaterial)
    sunBillboard.scale.setScalar(3000)
    sunBillboard.position.copy(sunDir).multiplyScalar(45000)
    scene.add(sunBillboard)
  }

  // ── Lens flare (procedural textures, warm sunrise tones) ────────

  function buildLensflare() {
    function createGlowTexture(size: number, r: number, g: number, b: number): THREE.CanvasTexture {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const cx = size / 2
      const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`)
      gradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.8)`)
      gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.3)`)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
      return new THREE.CanvasTexture(canvas)
    }

    function createRingTexture(size: number): THREE.CanvasTexture {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const cx = size / 2
      const gradient = ctx.createRadialGradient(cx, cx, size * 0.25, cx, cx, size * 0.45)
      gradient.addColorStop(0, 'rgba(255, 160, 80, 0)')
      gradient.addColorStop(0.4, 'rgba(255, 140, 60, 0.15)')
      gradient.addColorStop(0.5, 'rgba(255, 120, 40, 0.25)')
      gradient.addColorStop(0.6, 'rgba(255, 140, 60, 0.15)')
      gradient.addColorStop(1, 'rgba(255, 100, 30, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
      return new THREE.CanvasTexture(canvas)
    }

    const mainGlow = createGlowTexture(256, 255, 200, 120)
    const smallGlow = createGlowTexture(128, 255, 160, 80)
    const ring = createRingTexture(256)

    sunLensflare = new Lensflare()
    sunLensflare.addElement(new LensflareElement(mainGlow, 50, 0, new THREE.Color(1.0, 0.7, 0.4)))
    sunLensflare.addElement(new LensflareElement(ring, 35, 0, new THREE.Color(1.0, 0.5, 0.25)))
    sunLensflare.addElement(new LensflareElement(smallGlow, 20, 0.2, new THREE.Color(1.0, 0.6, 0.25)))
    sunLensflare.addElement(new LensflareElement(smallGlow, 12, 0.4, new THREE.Color(0.9, 0.5, 0.2)))
    sunLensflare.addElement(new LensflareElement(smallGlow, 8, 0.7, new THREE.Color(0.8, 0.4, 0.15)))

    sunLensflare.position.copy(sunDir).multiplyScalar(44000)
    scene.add(sunLensflare)
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
    const towerGroup = new THREE.Group()
    const passerelleGroup = new THREE.Group()

    // Rocket axis in model world-space (from inspection)
    const ROCKET_AXIS_X = -0.1
    const ROCKET_AXIS_Z = -0.7
    const AXIS_RADIUS = 1.5

    // First pass: identify rocket meshes and compute total height
    interface MeshInfo {
      mesh: THREE.Mesh
      box: THREE.Box3
      center: THREE.Vector3
      size: THREE.Vector3
      isRocket: boolean
    }
    const meshInfos: MeshInfo[] = []
    let rocketMinY = Infinity
    let rocketMaxY = -Infinity

    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh

      const box = new THREE.Box3().setFromObject(mesh)
      const center = new THREE.Vector3()
      const size = new THREE.Vector3()
      box.getCenter(center)
      box.getSize(size)

      const distFromAxis = Math.sqrt(
        (center.x - ROCKET_AXIS_X) ** 2 + (center.z - ROCKET_AXIS_Z) ** 2,
      )
      const maxXZSize = Math.max(size.x, size.z)
      const isRocket = distFromAxis <= AXIS_RADIUS && maxXZSize < MODEL_PAD_XZ_THRESHOLD && box.max.y > 0.5

      meshInfos.push({ mesh, box, center, size, isRocket })
      if (isRocket) {
        if (box.min.y < rocketMinY) rocketMinY = box.min.y
        if (box.max.y > rocketMaxY) rocketMaxY = box.max.y
      }
    })
    // Auto-compute interstage split: Falcon 9 S1 + interstage is ~63% of total height
    const rocketHeight = rocketMaxY - rocketMinY
    const interstageY = rocketMinY + rocketHeight * 0.63
    let s2MinY = Infinity

    // Second pass: classify by Y position and add to groups
    for (const info of meshInfos) {
      const clone = info.mesh.clone()
      clone.geometry = info.mesh.geometry.clone()
      clone.geometry.applyMatrix4(info.mesh.matrixWorld)
      clone.position.set(0, 0, 0)
      clone.quaternion.identity()
      clone.scale.set(1, 1, 1)
      clone.updateMatrix()
      clone.castShadow = true
      clone.receiveShadow = true

      if (info.isRocket) {
        // Y-based split at interstage, with override for S2 Merlin Vacuum engine
        const isS2 = info.center.y >= interstageY
          || info.mesh.name === 'Object_3'
        if (isS2) {
          s2Group.add(clone)
          if (info.box.min.y < s2MinY) s2MinY = info.box.min.y
        } else {
          s1Group.add(clone)
        }
      } else if (info.mesh.name === 'Support_Tower') {
        towerGroup.add(clone)
      } else if (info.mesh.name.toLowerCase().startsWith('passerelle')) {
        passerelleGroup.add(clone)
      } else {
        padGroup.add(clone)
      }
    }

    // Compute offset so rocket base aligns to Y=0 in game coords
    const baseOffset = -MODEL_ROCKET_BASE_Y * MODEL_SCALE

    // Scale and position all groups
    for (const g of [padGroup, s1Group, s2Group, towerGroup, passerelleGroup]) {
      g.scale.setScalar(MODEL_SCALE)
      g.position.y = baseOffset
      // Rotate 180° so tower faces away from camera
      g.rotation.y = Math.PI
    }

    // Wrap tower in a pivot at its base so it rotates away from rocket
    towerPivot = new THREE.Group()
    towerPivot.position.set(towerGroup.position.x, towerGroup.position.y, towerGroup.position.z)
    towerGroup.position.set(0, 0, 0)
    towerPivot.add(towerGroup)
    supportTower = towerGroup
    towerRotation = 0

    // Wrap passerelle in a pivot at its tower-side end so it swings away
    if (passerelleGroup.children.length > 0) {
      passerelleGroup.updateMatrixWorld(true)
      const passBox = new THREE.Box3().setFromObject(passerelleGroup)

      // Pivot at tower-side end: farthest X from rocket axis, center Z
      const pivotX = Math.abs(passBox.min.x) > Math.abs(passBox.max.x) ? passBox.min.x : passBox.max.x
      const pivotZ = (passBox.min.z + passBox.max.z) / 2

      passerellePivot = new THREE.Group()
      passerellePivot.position.set(pivotX, passerelleGroup.position.y, pivotZ)
      passerelleGroup.position.set(-pivotX, 0, -pivotZ)
      passerellePivot.add(passerelleGroup)
      passerelle = passerelleGroup
      passerelleRotation = 0
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
    scene.add(towerPivot)
    if (passerellePivot) scene.add(passerellePivot)

    modelLoaded = true
    dracoLoader.dispose()
  }

  // ── Gravity turn pitch profile (Falcon 9 style) ──────────────────

  function getGravityTurnPitch(missionTime: number): number {
    const DEG = Math.PI / 180
    if (missionTime < 5) return 0                          // vertical off pad
    if (missionTime < 15) {
      // pitch kick: 0° → 3°
      return ((missionTime - 5) / 10) * 3 * DEG
    }
    if (missionTime < 70) {
      // gravity turn through max-Q: 3° → 25°
      const t = (missionTime - 15) / 55
      return (3 + t * 22) * DEG
    }
    if (missionTime < 149) {
      // continue to MECO: 25° → 55°
      const t = (missionTime - 70) / 79
      return (25 + t * 30) * DEG
    }
    // Stage 2: 55° → 70°
    const t = Math.min(1, (missionTime - 149) / 200)
    return (55 + t * 15) * DEG
  }

  // ── Scene update (per frame) ──────────────────────────────────────

  function updateScene(state: GameState, started: boolean, dt: number, audioStarted: boolean = false) {
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
      flameGroup.position.x = -1.2
      flameMesh.position.y = -19.5
      s2FlameMesh.visible = false
      separationOffset = 0
      stage1SepPitch = 0
      stage1SepOffsetX = 0
      stage1SepOffsetZ = 0
      rocketGroup.quaternion.identity()
      towerRotation = 0
      if (towerPivot) towerPivot.rotation.z = 0
      passerelleRotation = 0
      if (passerellePivot) passerellePivot.rotation.y = 0
      particles.reset()
      // Reset sun effects
      if (sunBillboardMaterial) {
        sunBillboardMaterial.uniforms.warmth.value = 0.0
      }
      if (bloomPass) {
        bloomPass.strength = 0.7
        bloomPass.threshold = 0.88
      }
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

    // ── Gravity turn: visual pitch and downrange displacement ──
    const isFlying = phase !== 'pre-launch' && phase !== 'orbit' && phase !== 'failed'
    if (isFlying) {
      const pitch = getGravityTurnPitch(flight.missionTime)
      const horizontalOffset = visualAlt * Math.sin(pitch) * 0.25
      rocketGroup.position.x = DOWNRANGE_DIR.x * horizontalOffset
      rocketGroup.position.z = DOWNRANGE_DIR.z * horizontalOffset
      rocketGroup.quaternion.setFromAxisAngle(PITCH_AXIS, pitch)
    } else if (phase === 'pre-launch') {
      rocketGroup.position.x = 0
      rocketGroup.position.z = 0
      rocketGroup.quaternion.identity()
    }

    // ── Dynamic sunrise — sun slowly rises during mission ──
    const missionTime = flight.missionTime
    const sunAngle = 0.03 + missionTime * 0.0003
    sunDir.set(-0.4, Math.min(0.35, sunAngle), -0.8).normalize()

    // ── Dynamic sunrise lighting ──
    const sunProgress = Math.min(1, Math.max(0, (sunAngle - 0.03) / 0.32))

    // sunLight: deep orange → warm white
    _sunColor.setRGB(1.0, 0.35 + sunProgress * 0.55, 0.15 + sunProgress * 0.65)
    sunLight.color.copy(_sunColor)
    sunLight.intensity = 1.0 + sunProgress * 1.0

    // In space: no atmosphere to scatter fill light → deep shadows
    const altFadeFactor = Math.min(1, Math.max(0, (flight.altitude - 10000) / 80000))

    // Ambient: pre-dawn → normal on ground, reduced in space (but not black)
    ambientLight.intensity = (1.0 + sunProgress * 0.4) * (1.0 - altFadeFactor * 0.55)

    // Hemisphere: darker sky/ground → normal, reduced in space
    hemiLight.color.setRGB(
      0.29 + sunProgress * 0.11,
      0.33 + sunProgress * 0.20,
      0.47 + sunProgress * 0.33,
    )
    hemiLight.groundColor.setRGB(
      0.17 + sunProgress * 0.06,
      0.10 + sunProgress * 0.06,
      0.03 + sunProgress * 0.03,
    )
    hemiLight.intensity = (0.7 + sunProgress * 0.1) * (1.0 - altFadeFactor * 0.65)

    // Sun light position follows rocket for shadows at all altitudes
    sunLight.position.set(
      rocketGroup.position.x + sunDir.x * 500,
      rocketGroup.position.y + sunDir.y * 500,
      rocketGroup.position.z + sunDir.z * 500,
    )
    sunLight.target.position.set(rocketGroup.position.x, rocketGroup.position.y, rocketGroup.position.z)
    sunLight.target.updateMatrixWorld()

    // Shadow camera — tight around rocket at altitude, wider on the ground
    if (flight.altitude < 5000) {
      const shadowSize = Math.min(300, 100 + flight.altitude * 0.02)
      const cam = sunLight.shadow.camera as THREE.OrthographicCamera
      cam.left = -shadowSize
      cam.right = shadowSize
      cam.top = shadowSize
      cam.bottom = -shadowSize
      cam.far = 2000
      cam.updateProjectionMatrix()
    } else {
      // Tight shadow frustum on the rocket body in space
      const cam = sunLight.shadow.camera as THREE.OrthographicCamera
      cam.left = -60
      cam.right = 60
      cam.top = 60
      cam.bottom = -60
      cam.far = 1200
      cam.updateProjectionMatrix()
    }

    // Update sky sun direction
    const skyMat = skyMesh.material as THREE.ShaderMaterial
    skyMat.uniforms.sunDirection.value.copy(sunDir)

    // ── Flame mesh ──
    const flameOn = flight.throttle > 0 && flight.fuel > 0
    if (flameOn) {
      const flicker = 0.85 + Math.random() * 0.3
      const throttleScale = 0.5 + flight.throttle * 0.5

      if (flight.stage === 1) {
        flameMesh.visible = true
        s2FlameMesh.visible = false
        flameMesh.scale.set(
          throttleScale * flicker,
          throttleScale * flicker,
          throttleScale * flicker,
        )
        ;(flameMesh.material as THREE.ShaderMaterial).uniforms.time.value += dt
      } else {
        // MVac: wide vacuum-expanded blue plume + original cone
        flameMesh.visible = true
        s2FlameMesh.visible = true
        // Cone (atmospheric style, scaled down for S2)
        flameMesh.scale.set(
          throttleScale * flicker * 0.4,
          throttleScale * flicker * 0.5,
          throttleScale * flicker * 0.4,
        )
        const plumeScale = throttleScale * flicker
        s2FlameMesh.scale.set(
          plumeScale * 12,
          plumeScale * 18,
          plumeScale * 12,
        )
        const s2FlameY = modelLoaded ? s2NozzleLocalY : 42
        flameGroup.position.y = s2FlameY
        flameGroup.position.x = -1.5
        flameMesh.position.y = -12
        ;(s2FlameMesh.material as THREE.ShaderMaterial).uniforms.time.value += dt
      }
    } else {
      flameMesh.visible = false
      s2FlameMesh.visible = false
    }

    // ── Fire light ──
    if (flameOn) {
      const fireLightY = flight.stage === 1 ? -1.5 : (modelLoaded ? s2NozzleLocalY : 41.5)
      fireLight.position.set(rocketGroup.position.x, rocketGroup.position.y + fireLightY, rocketGroup.position.z)
      const flicker = 0.8 + Math.random() * 0.4
      fireLight.color.setHex(flight.stage === 1 ? 0xffaa33 : 0x6688ff)
      fireLight.intensity = flight.throttle * (flight.stage === 1 ? 12 : 6) * flicker
      fireLight.distance = flight.altitude < 500 ? 300 : 120
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

      // Animate separation gap (grows smoothly over time)
      const maxSeparation = 30
      if (separationOffset < maxSeparation) {
        separationOffset += dt * 4
      }

      const stage1VisualAlt = altitudeToVisual(stage1Flight.altitude)
      separatedStage1.position.y = 0.5 + stage1VisualAlt - separationOffset
      separatedStage1.position.x = stage1SepOffsetX
      separatedStage1.position.z = stage1SepOffsetZ
      separatedStage1.quaternion.setFromAxisAngle(PITCH_AXIS, stage1SepPitch)
      updateStage1Camera(stage1Flight, flight.missionTime, stage1SepOffsetX, stage1SepOffsetZ)
    } else if (phase === 'stage2-flight' || phase === 'seco' || phase === 'orbit') {
      if (modelLoaded && loadedRocketS1) loadedRocketS1.visible = false
      else stage1Group.visible = false
    }

    // Camera
    const rocketX = rocketGroup.position.x
    const rocketZ = rocketGroup.position.z
    updateCamera(flight, visualAlt, splitMode, rocketX, rocketZ)

    // ── Sun billboard + lensflare tracking ──
    // No atmosphere → sun gets brighter/sharper; ramp starts at ~10 km (max Q dazzle)
    const spaceFactor = Math.min(1, Math.max(0, (flight.altitude - 10000) / 60000))

    if (sunBillboard) {
      sunBillboard.position.copy(camera.position).addScaledVector(sunDir, 45000)
      sunBillboard.lookAt(camera.position)
      // Slight growth for ray room, but sun disc stays compact
      sunBillboard.scale.setScalar(3000 + spaceFactor * 1500)
      sunBillboardMaterial.uniforms.warmth.value = sunProgress
      sunBillboardMaterial.uniforms.spaceIntensity.value = spaceFactor
      sunBillboardMaterial.uniforms.time.value = cloudTime
    }
    if (sunLensflare) {
      sunLensflare.position.copy(camera.position).addScaledVector(sunDir, 44000)
      // Fade out round lensflare in space — starburst shader takes over
      sunLensflare.visible = spaceFactor < 0.8
    }

    // Boost sun light intensity in space (no atmospheric attenuation)
    sunLight.intensity = (1.0 + sunProgress * 1.0) * (1.0 + spaceFactor * 0.8)

    // ── Dynamic bloom when facing sun ──
    if (bloomPass && !splitMode) {
      _camForward.set(0, 0, -1).applyQuaternion(camera.quaternion)
      const sunDot = _camForward.dot(sunDir)
      // In space: less bloom radius to keep starburst sharp, not smeared
      const spaceBloomBoost = spaceFactor * 0.2
      if (sunDot > 0.3) {
        const t = (sunDot - 0.3) / 0.7
        bloomPass.strength = 0.7 + t * (0.15 + spaceBloomBoost) * (1.0 - spaceFactor * 0.4)
        bloomPass.threshold = 0.88 - t * (0.04 + spaceFactor * 0.04)
      } else {
        bloomPass.strength = 0.7
        bloomPass.threshold = 0.88
      }
    }

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

    // Horizon haze fades out early so its square edges don't show against the curved Earth
    if (horizonHaze) {
      const hazeFade = flight.altitude < 2000
        ? 1.0
        : flight.altitude < 15000 ? 1.0 - (flight.altitude - 2000) / 13000 : 0
      ;(horizonHaze.material as THREE.ShaderMaterial).uniforms.opacity.value = hazeFade
      horizonHaze.visible = hazeFade > 0.01
    }
    if (launchSiteGroup && !modelLoaded) {
      launchSiteGroup.visible = siteVisible
    }
    if (loadedPadGroup) {
      loadedPadGroup.visible = siteVisible
    }
    if (towerPivot) {
      towerPivot.visible = siteVisible
      // Rotate tower away after liftoff (rotates ~15° over a few seconds)
      if (phase === 'flying' && towerRotation < Math.PI / 12) {
        towerRotation += dt * 0.15
        towerPivot.rotation.z = Math.min(towerRotation, Math.PI / 12)
      }
    }
    if (passerellePivot) {
      passerellePivot.visible = siteVisible
      // Passerelle swings away on first press (audioStarted), continues through launch
      const maxAngle = Math.PI / 8 // ~22.5°
      if (audioStarted && passerelleRotation < maxAngle) {
        passerelleRotation += dt * 0.12
        passerellePivot.rotation.y = -Math.min(passerelleRotation, maxAngle)
      }
    }

    // Stars
    if (starsMesh) {
      const maxAlt = stage1Flight
        ? Math.max(flight.altitude, stage1Flight.altitude)
        : flight.altitude
      const starOpacity = Math.min(1, maxAlt / 120000)
      ;(starsMesh.material as THREE.PointsMaterial).opacity = starOpacity
      ;(starsMesh.material as THREE.PointsMaterial).transparent = true
    }
  }

  function updateCamera(flight: FlightData, visualAlt: number, isSplit: boolean = false, rocketX: number = 0, rocketZ: number = 0) {
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

    // Camera offset relative to rocket position (tracks downrange displacement)
    const targetX = rocketX + camDist * 0.6
    const targetZ = rocketZ + camDist * 0.8

    // In split mode, center on S2 body (~50 units above rocket base)
    const lookOffset = isSplit ? 50 : 30
    const lookDown = (!isSplit && alt > 2000) ? Math.min(300, (alt - 2000) * 0.003) : 0
    const lookY = visualAlt + lookOffset - lookDown
    const targetY = lookY + camHeight * 0.3

    const lerpSpeed = isSplit ? 0.04 : (countdownZoom > 0 ? 0.04 : 0.02)
    camera.position.x += (targetX - camera.position.x) * lerpSpeed
    camera.position.y += (targetY - camera.position.y) * lerpSpeed
    camera.position.z += (targetZ - camera.position.z) * lerpSpeed

    const lookTarget = new THREE.Vector3(rocketX, lookY, rocketZ)
    camera.lookAt(lookTarget)

    // Subtle camera shake during low-altitude powered flight
    if (flight.throttle > 0 && flight.altitude < 2000 && !isSplit) {
      shakeTime += 0.1
      const intensity = Math.max(0, 1 - flight.altitude / 2000) * 0.6
      const shakeX = Math.sin(shakeTime * 31.7) * intensity + Math.sin(shakeTime * 47.3) * intensity * 0.5
      const shakeY = Math.sin(shakeTime * 37.1) * intensity + Math.cos(shakeTime * 53.9) * intensity * 0.4
      camera.position.x += shakeX
      camera.position.y += shakeY
    }
  }

  function updateStage1Camera(stage1Flight: FlightData, missionTime: number, s1X: number = 0, s1Z: number = 0) {
    const stage1VisualAlt = altitudeToVisual(stage1Flight.altitude)
    const stage1Y = 0.5 + stage1VisualAlt

    // S1 center is ~18 units above its base (half of first stage height)
    const lookY = stage1Y + 18

    // After SES (~T+156), zoom out so stage 1 is fully visible with a slightly above angle
    const sesTime = 156
    const zoomOutProgress = Math.min(1, Math.max(0, (missionTime - sesTime) / 8))
    const t = zoomOutProgress * zoomOutProgress * (3 - 2 * zoomOutProgress) // smoothstep

    const camDist = 70 + t * 70       // 70 → 140
    const camHeightOffset = 10 + t * 35 // 10 → 45 (more above angle)

    const targetX = s1X + camDist * 0.5
    const targetY = lookY + camHeightOffset
    const targetZ = s1Z + camDist * 0.7

    stage1Camera.position.x += (targetX - stage1Camera.position.x) * 0.04
    stage1Camera.position.y += (targetY - stage1Camera.position.y) * 0.04
    stage1Camera.position.z += (targetZ - stage1Camera.position.z) * 0.04

    stage1Camera.lookAt(new THREE.Vector3(s1X, lookY, s1Z))
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
    // Start with small gap, animate it in updateScene
    separationOffset = 2

    // Freeze gravity turn state for separated stage 1
    stage1SepPitch = getGravityTurnPitch(_flight.missionTime)
    stage1SepOffsetX = rocketGroup.position.x
    stage1SepOffsetZ = rocketGroup.position.z

    if (modelLoaded && loadedRocketS1) {
      // Clone loaded S1 as separated piece
      separatedStage1 = loadedRocketS1.clone()
      const wrapper = new THREE.Group()
      wrapper.add(separatedStage1)
      separatedStage1 = wrapper
      separatedStage1.position.y = rocketGroup.position.y - separationOffset
      scene.add(separatedStage1)

      loadedRocketS1.visible = false
      flameGroup.position.y = s2NozzleLocalY
      flameGroup.position.x = -1.5
      flameMesh.position.y = -12

      stage1Camera.position.copy(camera.position)
      stage1Camera.quaternion.copy(camera.quaternion)
    } else if (stage1Group.visible) {
      separatedStage1 = stage1Group.clone()
      separatedStage1.position.y = rocketGroup.position.y - separationOffset
      scene.add(separatedStage1)

      stage1Group.visible = false
      flameGroup.position.y = 42
      flameGroup.position.x = -1.5
      flameMesh.position.y = -12

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
      const isMobile = w <= 768
      const gap = 4

      renderer.setScissorTest(true)
      renderer.autoClear = false
      renderer.setClearColor(0x000000)
      renderer.clear()

      if (isMobile) {
        // Mobile: top/bottom split
        const halfH = Math.floor((h - gap) / 2)

        // Top — Stage 2
        renderer.setViewport(0, halfH + gap, w, halfH)
        renderer.setScissor(0, halfH + gap, w, halfH)
        camera.aspect = w / halfH
        camera.updateProjectionMatrix()
        renderer.render(scene, camera)

        // Bottom — Stage 1
        renderer.setViewport(0, 0, w, halfH)
        renderer.setScissor(0, 0, w, halfH)
        stage1Camera.aspect = w / halfH
        stage1Camera.updateProjectionMatrix()
        renderer.render(scene, stage1Camera)
      } else {
        // Desktop: left/right split
        const halfW = Math.floor((w - gap) / 2)

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
      }

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
    if (sunBillboard) {
      sunBillboard.geometry.dispose()
      sunBillboardMaterial.dispose()
    }
    if (sunLensflare) {
      scene.remove(sunLensflare)
    }
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
