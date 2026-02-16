import * as THREE from 'three'
import type { FlightData } from '~/types/game'

const EARTH_VISUAL_RADIUS = 30000

// Scale: 1 unit = 1 meter at ground level, logarithmic compression at altitude
function altitudeToVisual(altitude: number): number {
  if (altitude < 1000) return altitude
  return 1000 + Math.log10(altitude / 1000) * 2000
}

export function useRenderer() {
  let renderer: THREE.WebGLRenderer
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let onResizeHandler: (() => void) | null = null

  // Scene objects
  let rocketGroup: THREE.Group
  let stage1Group: THREE.Group
  let stage2Group: THREE.Group
  let flameGroup: THREE.Group
  let flameMesh: THREE.Mesh
  let separatedStage1: THREE.Group | null = null
  let separatedStage1Velocity = 0
  let separatedStage1Y = 0

  // Earth
  let earthMesh: THREE.Mesh
  let atmosphereMesh: THREE.Mesh

  // Launch site
  let launchSiteGroup: THREE.Group

  // Sky & stars
  let skyMesh: THREE.Mesh
  let starsMesh: THREE.Points

  function init(container: HTMLElement) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    scene.fog = new THREE.FogExp2(0x0a1628, 0.00015)

    camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100000
    )
    camera.position.set(80, 30, 120)
    camera.lookAt(0, 30, 0)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x334466, 0.6)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffeedd, 2.0)
    sunLight.position.set(200, 300, 100)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 1000
    sunLight.shadow.camera.left = -100
    sunLight.shadow.camera.right = 100
    sunLight.shadow.camera.top = 100
    sunLight.shadow.camera.bottom = -100
    scene.add(sunLight)

    const fillLight = new THREE.DirectionalLight(0x6688aa, 0.4)
    fillLight.position.set(-100, 50, -100)
    scene.add(fillLight)

    // Build scene
    buildEarth()
    buildLaunchSite()
    buildRocket()
    buildSky()
    buildStars()

    onResizeHandler = () => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResizeHandler)
  }

  // ── Earth sphere with texture ──────────────────────────────────────
  function buildEarth() {
    const earthGeo = new THREE.SphereGeometry(EARTH_VISUAL_RADIUS, 128, 96)

    const textureLoader = new THREE.TextureLoader()
    const earthTexture = textureLoader.load('/textures/earth_daymap.jpg')
    earthTexture.colorSpace = THREE.SRGBColorSpace

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: earthTexture },
        sunDirection: { value: new THREE.Vector3(0.5, 0.3, 0.8).normalize() },
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

          // Lighting
          float diffuse = max(0.0, dot(vNormal, sunDirection));
          float ambient = 0.08;
          vec3 lit = texColor * (ambient + diffuse * 0.92);

          // Atmosphere rim glow
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
    // Rotate so the Atlantic/Americas face the camera at launch
    earthMesh.rotation.y = Math.PI * 0.8
    scene.add(earthMesh)

    // Atmosphere — separate glow sphere (visible from high altitude)
    const atmosGeo = new THREE.SphereGeometry(EARTH_VISUAL_RADIUS * 1.008, 64, 32)
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(0.5, 0.3, 0.8).normalize() },
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

  // ── Launch site (pad, tower, buildings on top of Earth) ───────────
  function buildLaunchSite() {
    launchSiteGroup = new THREE.Group()

    // Local ground disc around launch pad (covers sphere surface imperfection)
    const localGeo = new THREE.CircleGeometry(300, 64)
    const localMat = new THREE.MeshStandardMaterial({
      color: 0x2a3a2a,
      roughness: 0.9,
    })
    const localGround = new THREE.Mesh(localGeo, localMat)
    localGround.rotation.x = -Math.PI / 2
    localGround.position.y = 0.01
    localGround.receiveShadow = true
    launchSiteGroup.add(localGround)

    // Launch pad (concrete)
    const padGeo = new THREE.CylinderGeometry(20, 20, 0.5, 32)
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8,
      metalness: 0.1,
    })
    const pad = new THREE.Mesh(padGeo, padMat)
    pad.position.y = 0.25
    pad.receiveShadow = true
    launchSiteGroup.add(pad)

    // Pad markings
    const markGeo = new THREE.RingGeometry(8, 9, 32)
    const markMat = new THREE.MeshStandardMaterial({
      color: 0xcccc00,
      roughness: 0.5,
    })
    const marking = new THREE.Mesh(markGeo, markMat)
    marking.rotation.x = -Math.PI / 2
    marking.position.y = 0.52
    launchSiteGroup.add(marking)

    // Launch tower
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.6,
      metalness: 0.3,
    })
    const towerGeo = new THREE.BoxGeometry(3, 80, 3)
    const tower = new THREE.Mesh(towerGeo, towerMat)
    tower.position.set(25, 40, 0)
    tower.castShadow = true
    launchSiteGroup.add(tower)

    // Tower arm
    const armGeo = new THREE.BoxGeometry(20, 2, 2)
    const arm = new THREE.Mesh(armGeo, towerMat)
    arm.position.set(15, 55, 0)
    arm.castShadow = true
    launchSiteGroup.add(arm)

    // Small buildings
    for (let i = 0; i < 5; i++) {
      const bGeo = new THREE.BoxGeometry(
        8 + Math.random() * 12,
        4 + Math.random() * 6,
        8 + Math.random() * 12
      )
      const bMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.7,
      })
      const building = new THREE.Mesh(bGeo, bMat)
      const angle = (i / 5) * Math.PI * 2 + 0.5
      const dist = 80 + Math.random() * 60
      building.position.set(
        Math.cos(angle) * dist,
        building.geometry.parameters.height / 2,
        Math.sin(angle) * dist
      )
      building.castShadow = true
      launchSiteGroup.add(building)
    }

    scene.add(launchSiteGroup)
  }

  // ── Rocket ────────────────────────────────────────────────────────
  function buildRocket() {
    rocketGroup = new THREE.Group()
    stage1Group = new THREE.Group()
    stage2Group = new THREE.Group()
    flameGroup = new THREE.Group()

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.3,
      metalness: 0.1,
    })
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.4,
    })
    const interstgMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.4,
      metalness: 0.3,
    })

    // === STAGE 1 ===
    const s1BodyGeo = new THREE.CylinderGeometry(1.83, 1.83, 40, 24)
    const s1Body = new THREE.Mesh(s1BodyGeo, bodyMat)
    s1Body.position.y = 20
    s1Body.castShadow = true
    stage1Group.add(s1Body)

    // Landing legs
    for (let i = 0; i < 4; i++) {
      const legGeo = new THREE.BoxGeometry(0.2, 12, 0.4)
      const leg = new THREE.Mesh(legGeo, darkMat)
      const angle = (i / 4) * Math.PI * 2
      leg.position.set(Math.cos(angle) * 2.0, 6, Math.sin(angle) * 2.0)
      leg.rotation.z = Math.cos(angle) * 0.15
      leg.rotation.x = Math.sin(angle) * 0.15
      stage1Group.add(leg)
    }

    // Grid fins
    for (let i = 0; i < 4; i++) {
      const finGeo = new THREE.BoxGeometry(2.5, 1.5, 0.15)
      const fin = new THREE.Mesh(finGeo, darkMat)
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
      fin.position.set(Math.cos(angle) * 2.5, 37, Math.sin(angle) * 2.5)
      fin.rotation.y = angle
      stage1Group.add(fin)
    }

    // Engine nozzles (9 Merlin octaweb)
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

    // Interstage
    const interGeo = new THREE.CylinderGeometry(1.83, 1.83, 4, 24)
    const inter = new THREE.Mesh(interGeo, interstgMat)
    inter.position.y = 42
    stage1Group.add(inter)

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
    const fairingMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8e8,
      roughness: 0.35,
      metalness: 0.05,
    })
    const fairing = new THREE.Mesh(fairingGeo, fairingMat)
    fairing.position.y = 60
    fairing.castShadow = true
    stage2Group.add(fairing)

    rocketGroup.add(stage2Group)

    // === ENGINE FLAME ===
    const flameGeo = new THREE.ConeGeometry(1.2, 8, 16)
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.9,
    })
    flameMesh = new THREE.Mesh(flameGeo, flameMat)
    flameMesh.position.y = -5.5
    flameMesh.rotation.x = Math.PI
    flameMesh.visible = false
    flameGroup.add(flameMesh)

    const innerFlameGeo = new THREE.ConeGeometry(0.6, 5, 12)
    const innerFlameMat = new THREE.MeshBasicMaterial({
      color: 0x88bbff,
      transparent: true,
      opacity: 0.95,
    })
    const innerFlame = new THREE.Mesh(innerFlameGeo, innerFlameMat)
    innerFlame.position.y = -3.5
    innerFlame.rotation.x = Math.PI
    flameGroup.add(innerFlame)

    rocketGroup.add(flameGroup)
    rocketGroup.position.y = 0.5
    scene.add(rocketGroup)
  }

  // ── Sky dome ──────────────────────────────────────────────────────
  function buildSky() {
    const skyGeo = new THREE.SphereGeometry(50000, 32, 32)
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x000005) },
        bottomColor: { value: new THREE.Color(0x1a3a5c) },
        offset: { value: 0 },
        exponent: { value: 0.4 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
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

    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 30,
      sizeAttenuation: true,
    })
    starsMesh = new THREE.Points(starsGeo, starsMat)
    scene.add(starsMesh)
  }

  // Countdown camera zoom state
  let countdownZoom = 1 // 1 = zoomed out, 0 = normal

  // ── Scene update (per frame) ──────────────────────────────────────
  function updateScene(flight: FlightData, phase: string, countdown?: number, started?: boolean) {
    if (!rocketGroup) return

    // Update countdown zoom factor
    if (phase === 'pre-launch') {
      if (!started) {
        // Before player starts: fully zoomed out
        countdownZoom = 1
      } else if (countdown !== undefined && countdown > 0) {
        // During countdown: smoothly zoom in (16 → 0 maps to 1 → 0)
        countdownZoom = countdown / 16
      } else {
        countdownZoom = 0
      }
    } else {
      countdownZoom = 0
    }

    const visualAlt = altitudeToVisual(flight.altitude)

    // Rocket position
    rocketGroup.position.y = 0.5 + visualAlt

    // Flame
    const flameOn = flight.throttle > 0 && flight.fuel > 0
    flameGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh) child.visible = flameOn
    })
    if (flameOn) {
      const flicker = 0.85 + Math.random() * 0.3
      const throttleScale = 0.5 + flight.throttle * 0.5
      flameMesh.scale.set(
        throttleScale * flicker,
        throttleScale * flicker * (flight.stage === 1 ? 1.0 : 0.6),
        throttleScale * flicker
      )
      if (flight.stage === 2) {
        flameGroup.position.y = 42
        flameGroup.children.forEach((child, i) => {
          if (child instanceof THREE.Mesh) {
            child.position.y = i === 0 ? -3 : -2
          }
        })
      }
    }

    // Stage separation visual
    if (phase === 'stage2-flight' || phase === 'seco' || phase === 'orbit') {
      stage1Group.visible = false
      if (separatedStage1) {
        separatedStage1Velocity -= 9.81 * 0.016
        separatedStage1Y += separatedStage1Velocity * 0.016
        separatedStage1.position.y = separatedStage1Y
        if (separatedStage1Y < -500) {
          scene.remove(separatedStage1)
          separatedStage1 = null
        }
      }
    }

    // Camera
    updateCamera(flight, visualAlt)

    // Sky transition
    updateSky(flight.altitude)

    // Launch site fades at high altitude
    if (launchSiteGroup) {
      launchSiteGroup.visible = flight.altitude < 50000
    }

    // Stars fade in with altitude
    if (starsMesh) {
      const starOpacity = Math.min(1, flight.altitude / 80000)
      ;(starsMesh.material as THREE.PointsMaterial).opacity = starOpacity
      ;(starsMesh.material as THREE.PointsMaterial).transparent = true
    }
  }

  function updateCamera(flight: FlightData, visualAlt: number) {
    const alt = Math.max(1, flight.altitude)
    let camDist: number
    let camHeight: number

    if (alt < 500) {
      // Ground level — close up on pad
      camDist = 80 + alt * 0.15
      camHeight = 30 + alt * 0.3
    } else if (alt < 10000) {
      // Early flight — gentle pull back
      const t = (alt - 500) / 9500
      camDist = 155 + t * 300
      camHeight = 180 + t * 200
    } else {
      // High altitude — moderate distance, rocket stays visible
      const t = Math.min(1, Math.log10(alt / 10000) / 3)
      camDist = 455 + t * 400
      camHeight = 380 + t * 300
    }

    // Pre-launch zoom: start wide and zoom in during countdown
    // countdownZoom: 1 = zoomed out (before start / early countdown), 0 = normal
    const zoom = countdownZoom * countdownZoom // ease-in curve for smooth deceleration
    camDist += zoom * 160  // extra distance when zoomed out
    camHeight += zoom * 40 // slightly higher angle

    const targetX = camDist * 0.6
    const targetY = visualAlt + camHeight * 0.3
    const targetZ = camDist * 0.8

    // Use faster lerp before launch so the initial wide view snaps in quickly
    const lerpSpeed = countdownZoom > 0 ? 0.04 : 0.02
    camera.position.x += (targetX - camera.position.x) * lerpSpeed
    camera.position.y += (targetY - camera.position.y) * lerpSpeed
    camera.position.z += (targetZ - camera.position.z) * lerpSpeed

    // Gradually tilt down to reveal Earth curvature
    const lookDown = alt > 2000
      ? Math.min(300, (alt - 2000) * 0.003)
      : 0
    const lookTarget = new THREE.Vector3(0, visualAlt + 30 - lookDown, 0)
    camera.lookAt(lookTarget)
  }

  function updateSky(altitude: number) {
    if (!skyMesh) return
    const mat = skyMesh.material as THREE.ShaderMaterial

    const spaceTransition = Math.min(1, altitude / 100000)

    mat.uniforms.bottomColor.value = new THREE.Color().lerpColors(
      new THREE.Color(0x1a3a5c),
      new THREE.Color(0x000000),
      spaceTransition
    )
    mat.uniforms.topColor.value = new THREE.Color().lerpColors(
      new THREE.Color(0x000005),
      new THREE.Color(0x000000),
      spaceTransition
    )

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = 0.00015 * Math.max(0, 1 - altitude / 50000)
    }
  }

  function triggerStageSeparation(flight: FlightData) {
    if (stage1Group.visible) {
      separatedStage1 = stage1Group.clone()
      separatedStage1Y = rocketGroup.position.y
      separatedStage1.position.y = separatedStage1Y
      separatedStage1Velocity = flight.velocity * 0.3
      scene.add(separatedStage1)

      stage1Group.visible = false
      flameGroup.position.y = 42
    }
  }

  function render() {
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  function dispose() {
    if (onResizeHandler) {
      window.removeEventListener('resize', onResizeHandler)
      onResizeHandler = null
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
