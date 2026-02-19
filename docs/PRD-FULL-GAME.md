# Product Requirements Document: Infinite Space Explorer — Full Game Vision

- **Version**: 2.0
- **Status**: Planning
- **Branch**: feature/progression-game-overhaul
- **Created**: 2026-02-19

---

## 1. Vision

You are the director of humanity's space program, starting in the present day with a single Falcon 9 rocket and ending — centuries later — as a Kardashev Type III civilisation spanning multiple galaxies. Every step is earned. Every technology is unlocked. Every milestone is felt.

The game begins with the current launch simulation as a scripted prologue. From that moment the clock is real, the physics are real, and the choices are yours.

---

## 2. Core Design Pillars

1. **Real time is sacred** — the game clock starts at the actual current date when the player launches for the first time. Fast-forwarding is possible but always visible and always consequential.
2. **Physics matter** — all flight, orbit insertion, transfer trajectories, and reentry are governed by real Newtonian / Keplerian physics. Players must learn delta-V budgets, launch windows, and gravity assists.
3. **Progression through mastery** — new capabilities (rocket parts, propulsion types, destinations) unlock only after the player successfully completes the prerequisite milestone. You cannot warp to Mars without first reaching Earth orbit.
4. **Two views, one truth** — a cinematic 3D view for the awe; a precise Map/Computer view for the planning. Both see the same simulation.
5. **Kardashev as the spine** — every achievement, every technology tier, every destination maps onto the Kardashev civilisation scale. The player internalises the scale as they play.

---

## 3. High-Level Progression Arc

```
PROLOGUE (current game)
└─ Scripted Falcon 9 launch · fixed timeline · SpaceX-style HUD
   └─ Player presses SPACE at key moments (MAX-Q, stage sep, SECO)
   └─ Success → "You are now in orbit. The real journey begins."

ERA 0 — First Steps (2020s–2030s)  [Kardashev ~0.70]
├─ Land the booster (boostback burn, entry burn, landing burn)
├─ Achieve stable Earth orbit (first free-flight mission)
├─ Build a simple rocket in the Hangar
├─ Deploy a satellite into a precise orbit
└─ Dock with the International Space Station

ERA 1 — Lunar Ambition (2030s–2040s)  [Kardashev ~0.72]
├─ Trans-Lunar Injection (TLI) burn
├─ Lunar orbit insertion
├─ Moon landing
├─ Lunar base (first permanent structure)
└─ In-situ resource utilization (ISRU) — water ice → fuel

ERA 2 — Red Planet (2040s–2060s)  [Kardashev ~0.74]
├─ Earth–Mars launch window planning (porkchop plot)
├─ 7-month transit, mid-course correction
├─ Mars aerobraking & orbit insertion
├─ Mars landing (EDL sequence)
├─ Mars base & fuel production (Sabatier reaction)
└─ First crewed Mars mission

ERA 3 — Outer Solar System (2060s–2150s)  [Kardashev ~0.78]
├─ Asteroid belt mining
├─ Jupiter flyby (gravity assist mastery)
├─ Jovian moon landings (Europa, Ganymede)
├─ Saturn system exploration (Titan atmosphere)
├─ Uranus & Neptune probes
└─ Kuiper Belt objects

ERA 4 — Leaving the Cradle (2150s–2300s)  [Kardashev ~0.85]
├─ Heliopause crossing
├─ First interstellar probe (Voyager-class, multi-century transit)
├─ Solar energy harvesting megastructures (Dyson swarm first ring)
├─ Relativistic propulsion research (nuclear pulse, laser sail)
└─ Alpha Centauri probe arrival

ERA 5 — Interstellar Civilisation (2300s–2800s)  [Kardashev ~1.5]
├─ First crewed interstellar mission (generation ship)
├─ Proxima Centauri colonisation
├─ FTL concepts (Alcubierre research)
├─ Multi-star energy network (Dyson sphere completion)
└─ Galactic survey begun

ERA 6 — Galactic Scale (2800s+)  [Kardashev ~2.0–3.0]
├─ Matrioshka brain construction
├─ Galaxy-scale communication network
├─ First contact protocols
└─ Post-scarcity civilisation — game end / prestige
```

---

## 4. Game Modes & Views

### 4.1 Prologue (Current Game — Unchanged)
The scripted Falcon 9 mission runs exactly as today. It is the tutorial. At mission success, a cinematic plays: "You are now in orbit. The clock has started." The game date is set to the real current date. Free play begins.

### 4.2 Hangar Mode (Rocket Builder)
Inspired by Space Flight Simulator / Spaceflight Simulator 2. Parts-based construction with real physics constraints.

**Core builder features:**
- Cylindrical stack assembly with radial attachments (boosters, fairings, fins)
- Part catalog organised by era/unlock tier
- Real mass/CoM/CoT indicators (center of mass vs center of thrust — must align for stable flight)
- Delta-V calculator using Tsiolkovsky rocket equation with staging
- Engine gimbal range indicator
- Payload fairing enclosure system
- Symmetry mode (2x, 3x, 4x, 6x, 8x radial)
- Craft blueprint save/load (localStorage + export JSON)
- Reusability settings per stage (disposable vs landing legs + grid fins)
- Launch site selector (KSC, Boca Chica, Kourou, Baikonur, New launch sites unlockable)

**Parts catalog (unlocks by era):**

| Category | Part | Era |
|----------|------|-----|
| Command | Crewed capsule, cargo pod, probe core | 0 |
| Command | Lunar lander module | 1 |
| Command | Mars habitat module | 2 |
| Propulsion | Merlin-class (kerosene/LOX) | 0 |
| Propulsion | Raptor-class (methane/LOX) | 0 |
| Propulsion | RL-10 vacuum engine | 0 |
| Propulsion | Nuclear thermal (NTR) | 3 |
| Propulsion | Ion thruster | 3 |
| Propulsion | Nuclear pulse (Orion) | 4 |
| Propulsion | Laser sail | 4 |
| Propulsion | Fusion drive | 5 |
| Propulsion | Alcubierre prototype | 6 |
| Tanks | Kerosene, LH2, LCH4, Xenon | by era |
| Structures | Decoupler, fairing, truss, adapter | 0 |
| Landing | Landing legs, grid fins, heat shield | 0 |
| Science | Telescope, spectrometer, seismic probe | 1+ |
| Habitat | Crew quarters, life support, greenhouse | 2+ |

### 4.3 Flight Mode (3D Cinematic View)
Full 3D physics simulation. Player controls the rocket in real time.

**Controls:**
- Pitch / Yaw / Roll (WASD + QE)
- Throttle (Shift / Ctrl)
- Stage (Space)
- SAS toggle (T) — hold prograde / retrograde / normal / radial
- RCS (R) — fine attitude control
- Camera modes: Chase, Free orbit, Surface, Map (M)
- Time warp: 1x / 5x / 10x / 50x / 100x / 1000x / 10000x / 100000x (comma/period)
- Time warp auto-limits near atmospheric entry or engine burns

**HUD elements:**
- Altitude (surface + sea level)
- Velocity (surface, orbital, vertical)
- Heading + pitch indicator
- Navball (horizon, prograde/retrograde/normal/antinormal/radial markers)
- Apoapsis / Periapsis with time to each
- Delta-V remaining (per stage + total)
- Fuel bars per stage
- Throttle percentage
- G-force meter
- TWR live readout
- Communication signal delay indicator (grows with distance)
- Current game date + time (always visible, top center)
- Mission elapsed time

### 4.4 Map / Computer View (Trajectory Planning)
A 2D/3D orbital map similar to KSP's map view or NASA's Eyes on the Solar System. This is where players plan manoeuvres.

**Features:**
- Solar system overview with all bodies drawn to scale (log scale option)
- Orbit paths for all tracked vessels
- Manoeuvre node editor: click on orbit → drag ΔV vector (prograde/retrograde/normal/radial)
- Predicted trajectory after node (ghost line)
- Closest approach indicators (for rendezvous)
- Time-to-node countdown
- Porkchop plot overlay for interplanetary transfers (Earth–Mars launch windows shown as colour gradient — green = efficient, red = expensive)
- SOI (sphere of influence) boundary circles
- Lagrange point markers (L1–L5)
- Gravity assist path preview (flyby trajectories)
- Transfer window calculator (next optimal window + ΔV cost)
- Delta-V map reference overlay (community-style map for the solar system)
- Toggle: show all vessels / show only active / show planned trajectories

**Computer panel (right sidebar):**
- Orbital elements: semi-major axis, eccentricity, inclination, RAAN, argument of periapsis
- Time of flight estimates
- Burn duration calculator (given TWR)
- Hohmann transfer wizard (select origin/destination orbit → auto-generates nodes)
- Interplanetary transfer wizard (with launch window picker)

### 4.5 Mission Control View (Optional — Era 2+)
A top-down or side-on schematic view inspired by real NASA mission control screens. Shows multiple simultaneous missions. Useful when managing multiple active vessels.

---

## 5. Physics Simulation

### 5.1 Core Physics Engine
All physics run in a deterministic fixed-step loop at 60 Hz, decoupled from render.

**Implemented physics:**
- Newtonian gravity: `F = GMm/r²`, multi-body where relevant
- Patched conics: rocket is always in exactly one body's SOI, orbit computed analytically
- N-body approximation for Lagrange point accuracy (Era 3+)
- Rocket thrust: Tsiolkovsky mass flow, altitude-corrected ISP
- Atmospheric drag: exponential density model per body (each planet has its own atmosphere profile)
- Aerodynamic lift (for winged vehicles, Era 0 with Space Shuttle unlock)
- Reentry heating: stagnation heat flux model, ablative heat shield depletion
- Landing gear contact physics (simplified impulse response)
- RCS torque for attitude control
- Gravity turn steering (SAS autopilot option)

### 5.2 Celestial Body Database

| Body | Radius (km) | Gravity (m/s²) | Atmosphere | SOI (km) |
|------|-------------|-----------------|------------|---------|
| Sun | 695,700 | 274 | Corona | ∞ |
| Mercury | 2,440 | 3.7 | None | 112,000 |
| Venus | 6,051 | 8.87 | Yes (96% CO₂, 93 bar) | 616,000 |
| Earth | 6,371 | 9.81 | Yes (standard) | 924,000 |
| Moon | 1,737 | 1.62 | None | 66,000 |
| Mars | 3,390 | 3.72 | Thin (0.6% of Earth) | 577,000 |
| Phobos | 11 | 0.006 | None | 23 |
| Deimos | 6 | 0.003 | None | 16 |
| Ceres | 473 | 0.27 | None | 77,000 |
| Jupiter | 71,492 | 24.8 | Gas (no surface) | 48,200,000 |
| Io | 1,822 | 1.80 | Thin SO₂ | 7,200 |
| Europa | 1,561 | 1.31 | Very thin | 9,720 |
| Ganymede | 2,634 | 1.43 | Trace O₂ | 24,000 |
| Callisto | 2,410 | 1.24 | Trace CO₂ | 37,200 |
| Saturn | 60,268 | 10.4 | Gas | 54,800,000 |
| Titan | 2,575 | 1.35 | Dense N₂ (1.5 bar) | 53,000 |
| Uranus | 25,559 | 8.87 | Gas | 51,700,000 |
| Neptune | 24,764 | 11.2 | Gas | 86,600,000 |
| Triton | 1,353 | 0.78 | Trace N₂ | 14,900 |
| Pluto | 1,188 | 0.62 | Thin N₂ | 3,100 |
| Proxima Centauri b | 6,900 est. | 10.9 est. | Unknown | unlocked Era 5 |

### 5.3 Atmosphere Profiles
Each atmospheric body has a unique density/temperature curve affecting drag, heating, and engine efficiency. Titan's thick atmosphere enables parachute use; Mars requires both parachutes and retropropulsion; Venus is hostile to all structures without heat shielding.

---

## 6. Time System

### 6.1 Game Clock
- **Game time starts** at the exact real-world date/time when the player first presses SPACE in the Prologue (e.g., "2026-02-19 14:32:07 UTC").
- The clock is always visible in the top-center of every view.
- Format: `YYYY-MM-DD HH:MM:SS UTC` in the Map view; compact `Yr YYYY Dy DDD` in flight HUD.

### 6.2 Time Warp
| Warp Rate | Label | Use Case |
|-----------|-------|----------|
| 1x | Real time | Launches, landings, burns |
| 5x | 5× | Low orbit coasting |
| 10x | 10× | Short coast phases |
| 100x | 100× | LEO to Moon transit |
| 1,000x | 1k× | Earth-Mars transit (~7 months in ~5 hours) |
| 10,000x | 10k× | Outer planet transits |
| 100,000x | 100k× | Kuiper belt / heliopause |
| 1,000,000x | 1M× | Interstellar transit (centuries) |

**Warp constraints:**
- Cannot warp above 10× while inside atmosphere (< 80 km Earth)
- Warp auto-pauses at: SOI change, closest approach, manoeuvre node -60 s, collision warning
- Warp slows during physics-sensitive events (aerobraking, landing)
- At 1M×, a decade passes in ~5 minutes of real time — players feel the scale of interstellar space

### 6.3 Real-World Calendar Consequences
- Launch windows to Mars are only available every ~26 months (real synodic period). If you miss a window, you wait.
- Jupiter conjunctions, opposition events, and grand tours (Voyager-style) are computed from real orbital parameters. Players must watch for rare alignment opportunities.
- Technology development takes in-game months/years of real simulated time. Fast-forwarding through R&D periods is allowed.

---

## 7. Kardashev Progression & Achievements

### 7.1 Kardashev Scale
The Kardashev number is the primary progression metric — displayed prominently on the main screen, growing as civilisation expands.

| K Score | Milestone |
|---------|-----------|
| 0.70 | First orbital satellite |
| 0.71 | Crewed orbit |
| 0.72 | Moon landing |
| 0.73 | Lunar base |
| 0.74 | Mars orbit |
| 0.75 | Mars landing |
| 0.76 | Mars base |
| 0.77 | Asteroid mining operational |
| 0.78 | Jupiter flyby |
| 0.80 | Jovian moon base |
| 0.82 | Saturn system explored |
| 0.85 | Heliopause crossed |
| 0.90 | Solar energy harvesting > 0.01% of Sun |
| 1.00 | Full solar system colonised |
| 1.20 | Dyson swarm 10% complete |
| 1.50 | Interstellar presence |
| 2.00 | Dyson sphere complete — full stellar energy |
| 2.50 | Multi-star systems under civilisation control |
| 3.00 | Galactic-scale energy utilization |

### 7.2 Achievement Categories

**Navigation Achievements**
- First Orbit — achieve stable LEO
- First EVA — simulate spacewalk (milestone event)
- Orbital Rendezvous — dock two vessels
- Trans-Lunar Injection — leave Earth's SOI
- Moonwalker — land on the Moon
- Red Rover — land on Mars
- Grand Tour — visit Jupiter, Saturn, Uranus, Neptune in one mission
- Voyager — cross the heliopause
- Pale Blue Dot — photograph Earth from Neptune distance
- Alpha — first interstellar probe arrives at Alpha Centauri

**Engineering Achievements**
- Perfect Landing — land booster with < 1 m/s touchdown velocity
- Fuel Miser — reach orbit with > 50% fuel remaining
- Delta-V King — construct a rocket with > 10,000 m/s ΔV
- Heavy Lifter — launch > 100 t to LEO in one mission
- Gravity Master — complete a gravity assist within 10 km of planned periapsis

**Civilisation Achievements**
- Colony Founded — establish first permanent off-world base
- ISRU Online — produce first fuel off-Earth
- Dyson Ring — complete first ring of Dyson swarm
- Type I — reach Kardashev 1.0
- Type II — reach Kardashev 2.0
- Type III — reach Kardashev 3.0

**Hidden / Prestige Achievements**
- Signal — receive an anomalous signal from deep space (triggers after heliopause crossing)
- First Light — discover evidence of extraterrestrial microbial life on Europa
- The Long Game — accumulate 100 years of game time
- Pale Fire — ignite a Dyson swarm segment and observe the Sun's corona change
- Ouroboros — return crewed vessel from interstellar mission to Earth (round trip)

---

## 8. Resource & Economy System

### 8.1 Currencies
- **Funding (USD/credits)** — earned from satellite deployments, government contracts, science data returned. Used for: new parts, launch sites, R&D projects.
- **Science Points** — earned from first contacts with each body, deployed instruments, anomaly discoveries. Used to unlock new technologies on the tech tree.
- **Reputation** — tracks mission success rate. High reputation → more contract offers. Low reputation → funding cuts.
- **Energy (TW)** — appears in Era 3+. Total energy harvesting capacity. Gating resource for megastructures and advanced propulsion.

### 8.2 Contracts System
Players receive contracts that provide funding and science:
- **Commercial** — launch satellite to specific orbit (GEO, MEO, SSO, Molniya)
- **Government** — crewed mission, scientific survey, planetary landing
- **Exploration** — reach a new body for the first time (large science bonus)
- **Construction** — build space station module, extend a base
- **Emergency** — rescue stranded crew (appears after other players or NPC events)

---

## 9. Technology Tree

A branching research tree gated by Science Points and era progress. Players choose which branches to prioritise.

### Era 0 Tier (unlocked from start)
- Kerosene/LOX propulsion → Methane/LOX upgrade
- Grid fins & landing legs (booster recovery)
- Basic heat shields (LEO reentry)
- Deployable solar panels
- Basic comm relay satellites

### Era 1 Tier (requires: first orbit)
- Cryogenic upper stages (LH2/LOX — high ISP)
- Lunar-rated heat shield
- Life support systems (ECLSS)
- In-orbit refueling (docking + propellant transfer)
- Space station modules

### Era 2 Tier (requires: Moon landing)
- Methane ISRU (Mars fuel production)
- Advanced crew habitat
- Deep space comm (DSN dishes)
- Mars-entry aeroshell
- Nuclear power (RTG → small fission reactor)

### Era 3 Tier (requires: Mars base)
- Nuclear Thermal Propulsion (NTR — 900s ISP)
- Ion propulsion (Xenon — 3000+ ISP, low thrust)
- Asteroid mining rigs
- Space-rated manufacturing (fabricate parts in-situ)
- Closed-loop life support (multi-year crewed missions)

### Era 4 Tier (requires: Jupiter system)
- Nuclear Pulse Drive (Orion — massive ΔV)
- Laser sail propulsion
- Solar power satellites (MW-scale)
- Fusion power research
- Heliopause probe technology

### Era 5 Tier (requires: heliopause crossed)
- Fusion Drive (10,000+ ISP)
- Dyson swarm construction tech
- Generation ship habitats (centuries of life support)
- Relativistic shielding
- First FTL theoretical research

### Era 6 Tier (requires: Dyson ring complete)
- Alcubierre prototype
- Matrioshka brain components
- Galactic-scale comm arrays

---

## 10. Communication Delay System

As vessels travel further from Earth, radio signals take longer. This adds tension and forces players to plan autonomously.

| Distance | One-Way Delay |
|----------|--------------|
| Earth orbit | ~0.3 s |
| Moon | 1.3 s |
| Mars (close) | 3 min |
| Mars (far) | 22 min |
| Jupiter | 35–52 min |
| Saturn | 68–84 min |
| Neptune | 4 h |
| Heliopause | 17+ h |
| Alpha Centauri | 4.3 years |

**Gameplay effect:**
- At high delay, SAS must fly autonomously using pre-programmed manoeuvre nodes
- Players must "upload" a burn sequence and then wait for confirmation
- Signal loss (behind planet) triggers autonomous abort-or-hold decisions
- Creates realistic mission planning tension: you can't micromanage distant probes

---

## 11. Additional Feature Ideas

### 11.1 Gravity Assist Calculator
A dedicated UI mode that shows Jupiter/Saturn's gravity well and lets players interactively design flyby trajectories, seeing the ΔV gain from the assist in real time.

### 11.2 Anomalies & Lore
Hidden events that trigger as milestones are reached:
- Monolith near Jupiter's L4 (2001 reference)
- Strange radio burst from beyond the heliopause
- Ice geysers on Europa revealing subsurface traces
- Each discovery adds a "mission log" entry with narrative flavour text

### 11.3 Photo Mode
Pause the simulation at any point → enter a free camera mode to compose and export screenshots. Timestamps and Kardashev score overlaid optionally. Generated screenshots are shareable.

### 11.4 Mission Replay
After a successful mission, play a condensed 60-second cinematic replay using recorded telemetry data — like watching a SpaceX webcast highlight reel. Shareable as a URL-encoded replay file.

### 11.5 Navball
A dedicated 3D sphere indicator showing:
- Horizon line (blue = sky, brown = ground)
- Velocity vector markers (prograde ○, retrograde ⊗, normal ⊕, antinormal ⊖, radial ⊞, antiradial ⊟)
- Manoeuvre node direction (cyan crosshair)
- SAS target direction (yellow crosshair)

### 11.6 Orbital Decay
Satellites in very low orbits (< 200 km Earth) slowly decay and must be reboosted or they reenter. Adds ongoing maintenance to the game economy.

### 11.7 Crew System
- Named crew members with specialisations (pilot, scientist, engineer, medic)
- Experience levels improve mission efficiency
- Crew lost on failed missions is permanent (Ironman option)
- Memorial monument buildable at any base

### 11.8 News Feed
An in-game news ticker reacts to your milestones in real time:
- "SpaceX competitor achieves first lunar landing!"
- "Government funding increased following Mars mission success"
- "Scientists confirm liquid water on Europa"
Tone shifts as Kardashev scale rises: early headlines are terrestrial; later headlines are galactic-scale.

### 11.9 Dyson Swarm Builder
A separate macro-engineering mode (Era 5+) for designing and deploying Dyson swarm segments. Each segment is a massive solar sail / collector that must be launched, positioned at L4/L5, and maintained. The swarm grows over in-game years, visibly changing the star's light output.

### 11.10 Multiplayer (Future)
- Shared leaderboard: compare Kardashev scores and mission dates globally
- Co-op: share a save file where two players manage different vessel fleets
- Asynchronous: "challenge" — both players launch on the same game date, see who reaches Mars first

---

## 12. Technical Architecture

### 12.1 Renderer Modes

| Mode | Rendering | Camera |
|------|-----------|--------|
| Prologue | Three.js + postprocessing (current) | Fixed cinematic |
| Flight | Three.js, full 3D, chase/free | Player-controlled |
| Map | Three.js, orthographic + lines | Zoomable, pannable |
| Hangar | Three.js, orbit controls | Builder-focused |

### 12.2 Physics Architecture
```
PhysicsEngine (fixed 60 Hz)
├── OrbitalMechanics (patched conics solver)
│   ├── computeOrbit(state) → OrbitalElements
│   ├── propagateKeplerian(elements, dt) → position
│   └── findSOITransition(trajectory) → {body, time}
├── AtmosphericModel (per-body)
│   ├── density(altitude, body) → kg/m³
│   ├── temperature(altitude, body) → K
│   └── heatFlux(velocity, density, noseRadius) → W/m²
├── RocketPhysics
│   ├── thrust(throttle, stage, altitude) → N
│   ├── massFlow(throttle, stage) → kg/s
│   └── attitude(input, rcs, sas) → torque
└── ManoeuvreNode
    ├── burnDuration(deltaV, TWR) → seconds
    └── executeNode(state, node) → FlightData
```

### 12.3 State Management (Pinia)
```
stores/
├── game.ts          — global time, Kardashev score, era
├── fleet.ts         — all vessel states
├── craft.ts         — current craft blueprint (hangar)
├── trajectory.ts    — active manoeuvre nodes, predictions
├── technology.ts    — unlocked parts, research queue
├── economy.ts       — funding, science, reputation, energy
└── achievements.ts  — unlocked achievements, progress
```

### 12.4 Map View Technical
- All orbital paths computed analytically (conic sections rendered as `THREE.EllipseCurve`)
- Bodies positioned from real ephemeris data (VSOP87 simplified)
- SOI spheres as transparent THREE.Mesh
- Manoeuvre node gizmo: custom draggable arrow handles

### 12.5 Save System
```
SaveSlot {
  metadata: {
    gameDate: ISO8601,         // real date when player launched
    inGameDate: ISO8601,       // current in-game date
    kardashevScore: number,
    era: 0–6,
    totalMissionTime: seconds,
    screenshot: base64 thumbnail
  }
  fleet: VesselState[],
  technology: TechTree,
  economy: EconomyState,
  achievements: string[],     // achievement IDs
  crafts: CraftBlueprint[],   // saved rocket designs
  colonies: ColonyState[],
  anomaliesFound: string[]
}
```
- Auto-save every 5 in-game minutes
- 3 manual save slots
- Export/import as JSON file

---

## 13. UX & UI Principles

### 13.1 Progressive Disclosure
Players are not shown the full solar system map on day one. The Map view starts zoomed to Earth's SOI. As new destinations are reached, the zoom-out reveals more. The galactic map is literally black until the right Kardashev tier.

### 13.2 Tutorials & Hints
- Each Era starts with a "Mission Briefing" screen: text + diagram explaining the new mechanic
- Contextual hints appear the first time a new UI element is relevant ("You're approaching the SOI boundary — switch to Map view to plan your orbit insertion")
- Skippable for experienced players

### 13.3 Consistent Visual Language
- SpaceX-style HUD: white on black, monospace font, minimal chrome — maintained from the Prologue
- Map view: NASA-inspired dark blue/navy, soft glow orbital lines
- Hangar: warm grey, clay-like part renders with subtle ambient occlusion
- Achievement pop-ups: full-bleed cinematic moment, not just a toast notification

---

## 14. Development Phases

### Phase 1 — Prologue + Booster Landing (4–6 weeks)
- [ ] Stage 1 boostback burn event (new scripted event in existing system)
- [ ] Stage 1 entry burn event
- [ ] Stage 1 landing burn + drone ship landing detection
- [ ] "TOUCHDOWN" result screen variant
- [ ] Prologue end sequence: "Game Date Set. Begin." transition

### Phase 2 — Free Flight & Hangar (8–10 weeks)
- [ ] Hangar mode (Vue page, 3D builder, part catalog MVP)
- [ ] Free-flight physics (player controls pitch/yaw/roll)
- [ ] 2D orbital mechanics (patched conics, single body)
- [ ] Basic HUD: navball, altitude, velocity, ΔV readout
- [ ] Stable orbit achievement → unlocks Era 1

### Phase 3 — Map View & Manoeuvre Nodes (6–8 weeks)
- [ ] Map view (orthographic, Earth + Moon visible)
- [ ] Orbit line rendering (conic section curves)
- [ ] Manoeuvre node editor (drag ΔV vectors)
- [ ] Burn execution: SAS holds node direction, execute burn
- [ ] Time warp system (all rates up to 10,000×)
- [ ] Game clock system (real start date, always visible)

### Phase 4 — Moon Campaign (6–8 weeks)
- [ ] Moon body (physics, visuals, surface)
- [ ] Trans-Lunar Injection wizard
- [ ] Lunar orbit insertion
- [ ] Moon landing with landing legs
- [ ] Achievement: Moonwalker
- [ ] ISRU basic (water ice → fuel on Moon surface)

### Phase 5 — Mars Campaign (8–10 weeks)
- [ ] Mars body + thin atmosphere (EDL physics)
- [ ] Porkchop plot UI (transfer window calculator)
- [ ] Mars aerobraking
- [ ] Mars landing sequence
- [ ] Mars base construction
- [ ] Communication delay system (> 3 min delay)

### Phase 6 — Outer System & Kardashev Spine (ongoing)
- [ ] Remaining solar system bodies
- [ ] Gravity assist calculator
- [ ] Technology tree UI
- [ ] Economy / contracts system
- [ ] Achievements system full build-out
- [ ] Anomalies and lore events
- [ ] Kardashev score display + progression

---

## 15. Out of Scope (This Document)
- Multiplayer / co-op (future)
- Procedural star systems beyond the real solar system (Era 5+ placeholder)
- Mobile / touch support
- VR mode
- Modding API

---

## 16. Open Questions

1. **2D vs 3D orbits from the start?** — 3D is more correct but much harder to control. Start with 2D equatorial plane and unlock inclination changes in Era 1?
2. **Autopilot balance** — How much should SAS/autopilot assist vs. requiring manual skill? KSP struck this well: SAS holds attitude, player still manages burns.
3. **Economy pacing** — How long should a player spend in each era before unlocking the next? A single Moon mission or a full lunar base?
4. **Interstellar time scale** — At 1M× warp, interstellar missions still take tens of minutes. Is that acceptable or do we abstract them?
5. **First contact** — Do we include alien life / intelligence, or keep it grounded in "anomalies with scientific explanations"?

---

*Built 100% vibecoded using Claude Code.*
