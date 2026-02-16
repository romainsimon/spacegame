# Product Requirements Document: Infinite Space Explorer MVP

## Document Info
- **Version**: 1.0
- **Status**: Draft
- **Created**: 2026-01-16
- **Author**: Claude (AI Assistant)

---

## 1. Executive Summary

### 1.1 Product Vision
Infinite Space Explorer is a web-based 3D space exploration sandbox where players build rockets and explore an infinite procedurally generated universe. The MVP focuses on proving the core loop: **build a rocket, launch it, achieve orbit, and land safely**.

### 1.2 MVP Goal
Deliver a playable vertical slice where a player can:
1. Assemble a simple rocket in a hangar
2. Launch from a pad on a planet surface
3. Achieve stable orbit around the planet
4. Re-enter and land (or crash spectacularly)

### 1.3 Success Criteria
- Player can build a functional rocket in under 5 minutes
- Physics feel satisfying and believable
- Orbit mechanics are visually understandable
- Game runs at 60fps on modern browsers
- Core loop is engaging enough for 15+ minute play sessions

---

## 2. Target Audience

### 2.1 Primary Users
- **Space enthusiasts** who enjoy games like Kerbal Space Program, Spaceflight Simulator
- **Casual builders** who like assembling things (Minecraft, Lego games)
- **Exploration gamers** drawn to discovery and procedural worlds

### 2.2 Technical Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- WebGL 2.0 support
- Desktop recommended (keyboard + mouse)
- No account required for MVP

---

## 3. Feature Requirements

### 3.1 Game Modes

| Mode | Description | MVP Scope |
|------|-------------|-----------|
| Hangar | Build and customize rockets | Yes |
| Flight | Pilot rockets in 3D space | Yes |
| Map | Orbital view and planning | Phase 2 |
| Research | Tech tree progression | Phase 4 |

### 3.2 Hangar Mode (Rocket Builder)

#### 3.2.1 Core Functionality
- **Grid-based placement**: Parts snap to a 3D grid for easy alignment
- **Part catalog**: Sidebar showing available parts with stats
- **Drag and drop**: Click to select, click to place parts
- **Symmetry mode**: Mirror parts across vertical axis (toggle on/off)
- **Staging stack**: Define separation order for multi-stage rockets
- **Validation**: Visual warnings for invalid builds (no engine, unbalanced thrust)

#### 3.2.2 MVP Parts Catalog

| Part | Mass (kg) | Function | Properties |
|------|-----------|----------|------------|
| Command Pod | 500 | Required crew/control module | 1 attachment point (bottom) |
| Small Fuel Tank | 200 (empty), 1200 (full) | Stores fuel | 2 attachment points (top/bottom) |
| Medium Fuel Tank | 400 (empty), 2400 (full) | Stores more fuel | 2 attachment points (top/bottom) |
| Basic Engine | 300 | Provides thrust | 800 kN thrust, 280s Isp |
| Decoupler | 50 | Separates stages | 2 attachment points, triggers on staging |
| Fins (x4) | 100 | Aerodynamic stability | 4 attachment points (radial) |

#### 3.2.3 UI Elements
- Part catalog panel (left side)
- 3D viewport with orbit camera controls
- Stats panel showing: total mass, dry mass, delta-V estimate, TWR
- Staging stack (right side) - drag to reorder
- Action buttons: New, Save, Load, Launch

#### 3.2.4 Acceptance Criteria
- [ ] Player can place at least 6 different part types
- [ ] Parts visually snap to grid and to other parts
- [ ] Symmetry mode mirrors parts correctly
- [ ] Stats update in real-time as parts are added/removed
- [ ] Invalid rockets show clear warning indicators
- [ ] Craft saves to browser localStorage as JSON

### 3.3 Flight Mode

#### 3.3.1 Core Functionality
- **Throttle control**: 0-100% thrust (keyboard: Shift/Ctrl or Z/X)
- **Rotation**: Pitch, Yaw, Roll via WASDQE keys
- **Staging**: Spacebar triggers next stage event
- **Time warp**: Speed up time for long orbital maneuvers (1x, 5x, 10x, 50x)
- **Camera modes**: Chase cam, free orbit cam, cockpit view

#### 3.3.2 Physics Simulation

| Property | Implementation |
|----------|----------------|
| Gravity | Spherical gravity toward planet center, realistic falloff (GM/r²) |
| Thrust | Applied along engine facing direction, proportional to throttle |
| Mass | Decreases as fuel burns (mass flow rate) |
| Drag | Simplified atmospheric drag (exponential falloff with altitude) |
| Rotation | Torque from offset thrust and control inputs |

#### 3.3.3 Environment
- **Planet**: Earth-like body (6,371 km radius, 9.81 m/s² surface gravity)
- **Atmosphere**: 100 km height, exponential density falloff
- **Skybox**: Stars and space backdrop
- **Terrain**: Simple procedural or textured sphere (no landing detail in MVP)
- **Launch pad**: Fixed starting position on planet surface

#### 3.3.4 HUD Elements
- Altitude (meters/kilometers)
- Velocity (m/s, surface-relative and orbital)
- Apoapsis and Periapsis (estimated from current trajectory)
- Throttle indicator
- Fuel remaining (percentage)
- Current stage indicator
- Time warp indicator
- Navball (simplified - shows prograde/retrograde markers)

#### 3.3.5 Acceptance Criteria
- [ ] Rocket lifts off when thrust > weight
- [ ] Gravity pulls rocket toward planet center
- [ ] Fuel depletes proportionally to thrust
- [ ] Staging separates parts and activates next stage engines
- [ ] Orbit is achievable with correct velocity at correct altitude
- [ ] Atmospheric drag slows rockets at low altitude
- [ ] HUD displays accurate real-time telemetry
- [ ] Time warp accelerates simulation without breaking physics

### 3.4 Audio

#### 3.4.1 Music
- Background track: `Deep Space Exploration.mp3`
- Crossfade between hangar (mellow) and flight (intense) variants
- Volume control in settings

#### 3.4.2 Sound Effects (MVP - Optional)
- Engine rumble (throttle-proportional)
- Stage separation click/bang
- Atmospheric whoosh (velocity-dependent)
- Collision/crash sound

### 3.5 Save System

#### 3.5.1 Data Persistence
- **Craft blueprints**: Save/load rocket designs to localStorage
- **Flight state**: No mid-flight saves in MVP (restart from launch)
- **Settings**: Volume, controls preferences

#### 3.5.2 Data Format
```typescript
interface CraftBlueprint {
  id: string;
  name: string;
  createdAt: number;
  parts: PartInstance[];
  stages: StageDefinition[];
}

interface PartInstance {
  partId: string;
  position: [number, number, number];
  rotation: [number, number, number, number]; // quaternion
  resources: Record<string, number>;
}

interface StageDefinition {
  order: number;
  partIds: string[];
  actions: ('activate' | 'decouple')[];
}
```

---

## 4. Technical Requirements

### 4.1 Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Nuxt | 3.x |
| UI Framework | Vue | 3.x |
| Language | TypeScript | 5.x |
| 3D Rendering | Three.js + TresJS | 0.181.x / 4.x |
| Physics | cannon-es + custom orbital solver | 0.20.x |
| State | Pinia | 2.x |
| Testing | Vitest + Vue Test Utils | 4.x |

### 4.2 Architecture Overview

```
├── nuxt.config.ts           # Nuxt configuration
├── app.vue                  # Root Vue component
├── pages/
│   ├── index.vue            # Main menu
│   ├── hangar.vue           # Rocket builder page
│   └── flight.vue           # Flight simulation page
├── components/
│   ├── ui/                  # Reusable UI components
│   ├── hud/                 # Flight HUD elements
│   ├── builder/             # Hangar builder components
│   └── three/               # TresJS 3D components
├── composables/
│   ├── usePhysics.ts        # Physics simulation logic
│   ├── useOrbit.ts          # Orbital mechanics
│   └── useParts.ts          # Part management
├── stores/
│   ├── game.ts              # Global game state (Pinia)
│   ├── craft.ts             # Current craft state
│   └── flight.ts            # Flight simulation state
├── server/                  # Server routes (if needed)
├── utils/                   # Helper functions
├── types/                   # TypeScript interfaces
└── public/                  # Static assets (3D models, textures, audio)
```

### 4.3 Performance Targets
- 60 FPS on mid-range hardware (GTX 1060 / M1 Mac equivalent)
- < 3 second initial load time
- Physics step: fixed 60Hz independent of render
- Memory usage: < 500MB

### 4.4 Browser Support
- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

---

## 5. User Interface

### 5.1 Screen Flow

```
┌─────────────┐
│  Main Menu  │
│  [New Game] │
│  [Continue] │
│  [Settings] │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Hangar    │────▶│   Flight    │
│  (Builder)  │     │ (Simulation)│
│  [Launch]   │     │  [Return]   │
└─────────────┘◀────└─────────────┘
```

### 5.2 Hangar Layout

```
┌────────────────────────────────────────────────────────────┐
│ [Menu]  Infinite Space Explorer - Hangar    [Settings]     │
├──────────┬─────────────────────────────────┬───────────────┤
│          │                                 │ STAGING       │
│ PARTS    │                                 │ ┌───────────┐ │
│ ┌──────┐ │         3D VIEWPORT             │ │ Stage 1   │ │
│ │ Pod  │ │                                 │ │  Engine   │ │
│ └──────┘ │      [Rocket Preview]           │ └───────────┘ │
│ ┌──────┐ │                                 │ ┌───────────┐ │
│ │ Tank │ │                                 │ │ Stage 2   │ │
│ └──────┘ │                                 │ │  Decouple │ │
│ ┌──────┐ │                                 │ └───────────┘ │
│ │Engine│ │                                 │               │
│ └──────┘ │                                 │ STATS         │
│ ...      │                                 │ Mass: 2400kg  │
│          │                                 │ TWR: 1.8      │
│          │                                 │ ΔV: 3200 m/s  │
├──────────┴─────────────────────────────────┴───────────────┤
│ [New] [Save] [Load]        [Symmetry: ON]        [LAUNCH]  │
└────────────────────────────────────────────────────────────┘
```

### 5.3 Flight HUD Layout

```
┌────────────────────────────────────────────────────────────┐
│ ALT: 125.4 km    VEL: 2,847 m/s    AP: 250 km  PE: 120 km │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│                    3D FLIGHT VIEW                          │
│                                                            │
│                         ┌─────────┐                        │
│                         │ NAVBALL │                        │
│                         │    ↑    │                        │
│                         └─────────┘                        │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ THROTTLE  ████████░░ 80%    FUEL ██████░░░░ 62%   STG: 2  │
│                                           [1x] [5x] [10x] │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Controls

### 6.1 Hangar Controls

| Action | Input |
|--------|-------|
| Rotate camera | Right-click drag / Middle-click drag |
| Zoom | Scroll wheel |
| Pan camera | Shift + Right-click drag |
| Select part | Left-click |
| Place part | Left-click on attachment point |
| Delete part | Backspace / Delete |
| Toggle symmetry | S |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |

### 6.2 Flight Controls

| Action | Primary | Alternative |
|--------|---------|-------------|
| Throttle up | Shift | Z |
| Throttle down | Ctrl | X |
| Full throttle | Z (hold) | - |
| Cut throttle | X (hold) | - |
| Pitch up | S | - |
| Pitch down | W | - |
| Yaw left | A | - |
| Yaw right | D | - |
| Roll left | Q | - |
| Roll right | E | - |
| Stage | Space | - |
| Toggle map | M | - |
| Time warp + | . | - |
| Time warp - | , | - |
| Pause | Esc / P | - |

---

## 7. Development Phases

### Phase 0: Foundation (Current)
**Goal**: Get a basic scene rendering with placeholder content

- [x] Project scaffolding (Vite, React, TypeScript)
- [ ] TresJS Canvas setup
- [ ] Basic 3D scene with lighting
- [ ] Camera controls (orbit)
- [ ] Load and display Soyuz model as placeholder
- [ ] Planet sphere with Earth texture
- [ ] Starfield skybox
- [ ] Pinia store initialization
- [ ] Background music player

### Phase 0.1: Hangar MVP
**Goal**: Functional rocket builder

- [ ] Part data definitions (JSON/TypeScript)
- [ ] 3D part models (simple primitives initially)
- [ ] Grid system for part placement
- [ ] Attachment point detection
- [ ] Part catalog UI
- [ ] Staging stack UI
- [ ] Craft stats calculation
- [ ] Save/load to localStorage
- [ ] Launch button transition to flight

### Phase 0.2: Flight MVP
**Goal**: Flyable physics simulation

- [ ] Craft instantiation from blueprint
- [ ] Gravity implementation
- [ ] Thrust application
- [ ] Fuel consumption
- [ ] Basic drag model
- [ ] Rotation controls
- [ ] Staging system
- [ ] Ground collision detection
- [ ] Basic HUD (altitude, velocity, fuel)

### Phase 0.3: Orbital Mechanics
**Goal**: Achievable orbit with visual feedback

- [ ] Patched conic orbit predictor
- [ ] Apoapsis/periapsis calculation
- [ ] Orbit line visualization
- [ ] Navball implementation
- [ ] Time warp system
- [ ] Improved HUD with orbital elements

### Phase 1.0: Polish & Playtest
**Goal**: Playable MVP ready for feedback

- [ ] Sound effects
- [ ] Improved part models
- [ ] Tutorial/hints for new players
- [ ] Settings menu (audio, controls)
- [ ] Bug fixes from playtesting
- [ ] Performance optimization

---

## 8. Out of Scope (MVP)

The following features are intentionally excluded from MVP:

- Multiple celestial bodies (Moon, other planets)
- Procedural world generation
- Tech tree and progression system
- Multiplayer
- Account system / cloud saves
- Landing legs and surface interaction
- Docking and rendezvous
- Resource mining
- Base building
- Advanced autopilot
- Realistic thermal/stress simulation
- Mobile/touch support

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Physics too complex | High | Start with 2D planar, upgrade to 3D incrementally |
| Performance issues | Medium | Fixed physics timestep, LOD, instancing |
| Orbital mechanics hard to understand | Medium | Clear visual feedback, tutorials, autopilot assists |
| Scope creep | High | Strict phase gates, MVP-first mentality |
| Browser compatibility | Low | Use well-supported Three.js features only |

---

## 10. Open Questions

1. **Part visuals**: Use primitive geometry (cylinders, cones) or invest in low-poly models early?
2. **Terrain detail**: How detailed should planet surface be for MVP? (Affects landing gameplay)
3. **Failure states**: Should rockets explode on crash or just stop? (Polish vs. development time)
4. **Tutorial approach**: In-game hints, separate tutorial mission, or learn-by-doing?

---

## 11. Appendix

### A. Reference Games
- Kerbal Space Program (physics, building)
- Spaceflight Simulator (mobile building UX)
- Outer Wilds (exploration feel, music)
- SimpleRockets 2 (web-friendly inspiration)

### B. Key Formulas

**Orbital velocity for circular orbit:**
```
v = sqrt(GM / r)
```

**Thrust-to-weight ratio:**
```
TWR = thrust / (mass * g)
```

**Delta-V (Tsiolkovsky):**
```
ΔV = Isp * g * ln(m_wet / m_dry)
```

**Atmospheric density:**
```
ρ = ρ_0 * e^(-h / H)
where H = scale height (~8.5 km for Earth)
```
