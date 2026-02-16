import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useParticles } from './useParticles'
import type { FlightData, GameState } from '~/types/game'

const EARTH_VISUAL_RADIUS = 150000

// Falcon 9 model constants
const MODEL_SCALE = 2.25
const MODEL_INTERSTAGE_Y = 12    // Y in model coords where S1/S2 split
const MODEL_ROCKET_BASE_Y = 0.5  // Y of rocket base in model coords
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
  let shakeTime = 0
  let separationOffset = 0

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
    fireLight = new THREE.PointLight(0xffaa33, 0, 250)
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
      0.7,  // strength — subtle bloom, not washed out
      0.4,  // radius
      0.88, // threshold — only the very brightest HDR fire blooms
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
        const float ATMOS_R = 6531e3;  // 160 km atmosphere for gradual fade
        const vec3 BETA_R = vec3(5.5e-6, 13.0e-6, 22.4e-6);
        const float BETA_M = 21e-6;
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

    // Auto-compute interstage split: Falcon 9 S1 is ~61% of total height
    const rocketHeight = rocketMaxY - rocketMinY
    const interstageY = rocketMinY + rocketHeight * 0.61
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
        // Y-based: mesh center above interstage → S2, otherwise → S1
        if (info.center.y >= interstageY) {
          s2Group.add(clone)
          if (info.box.min.y < s2MinY) s2MinY = info.box.min.y
        } else {
          s1Group.add(clone)
        }
      } else {
        padGroup.add(clone)
      }
    }

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
      flameGroup.position.x = -1.2
      flameMesh.position.y = -19.5
      separationOffset = 0
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

      if (flight.stage === 1) {
        flameMesh.scale.set(
          throttleScale * flicker,
          throttleScale * flicker,
          throttleScale * flicker,
        )
      } else {
        // MVac: single engine, narrower nozzle, vacuum-expanded plume
        flameMesh.scale.set(
          throttleScale * flicker * 0.4,
          throttleScale * flicker * 0.5,
          throttleScale * flicker * 0.4,
        )
        const s2FlameY = modelLoaded ? s2NozzleLocalY : 42
        flameGroup.position.y = s2FlameY
        flameGroup.position.x = 0
        flameMesh.position.y = -10
      }

      ;(flameMesh.material as THREE.ShaderMaterial).uniforms.time.value += dt
    }

    // ── Fire light ──
    if (flameOn) {
      const fireLightY = flight.stage === 1 ? -1.5 : (modelLoaded ? s2NozzleLocalY : 41.5)
      fireLight.position.set(0, rocketGroup.position.y + fireLightY, 0)
      const flicker = 0.8 + Math.random() * 0.4
      fireLight.intensity = flight.throttle * (flight.stage === 1 ? 12 : 4) * flicker
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
      const stage1VisualAlt = altitudeToVisual(stage1Flight.altitude)
      separatedStage1.position.y = 0.5 + stage1VisualAlt - separationOffset
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
      const starOpacity = Math.min(1, maxAlt / 120000)
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
    // Instant visual separation gap
    separationOffset = 15

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
      flameGroup.position.x = 0
      flameMesh.position.y = -10

      stage1Camera.position.copy(camera.position)
      stage1Camera.quaternion.copy(camera.quaternion)
    } else if (stage1Group.visible) {
      separatedStage1 = stage1Group.clone()
      separatedStage1.position.y = rocketGroup.position.y - separationOffset
      scene.add(separatedStage1)

      stage1Group.visible = false
      flameGroup.position.y = 42
      flameGroup.position.x = 0
      flameMesh.position.y = -10

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
