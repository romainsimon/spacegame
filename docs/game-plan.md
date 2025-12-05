# Infinite Space Exploration Game — Specification & Roadmap

## 1. Vision & Player Fantasy
- **You are mission control + chief engineer** gradually advancing humanity from the dawn of the Space Age (1960s) to far-future interstellar tech (2500s).
- **Build and fly** bespoke rockets assembled from parts à la Spaceflight Simulator & Mars First Logistics: clamp, rotate, weld, and test in a tactile hangar.
- **Explore an infinite universe** inspired by Minecraft and No Man’s Sky: handcrafted inner solar system transitioning into procedurally generated outer systems and galaxies.
- **Feel the awe of Outer Wilds**: realistic gravity, orbital mechanics, and musical cues that react to discoveries.

## 2. Guiding Pillars
1. **Player agency through construction** — building vehicles should be playful and forgiving, yet physically grounded.
2. **Incremental mastery** — technology tree reveals future capabilities slowly; players do not know interstellar travel exists until they earn it.
3. **Science-forward simulation** — simplified but believable Newtonian physics, patched conics for orbits, N-body approximations for special moments.
4. **Endless destinations** — procedural generation layered on top of authored landmarks to keep exploration fresh.
5. **Cozy wonder** — soft colors, diegetic UI, dynamic soundtrack blending mellow synths with instrumentation similar to Outer Wilds.

## 3. Core Feature Breakdown
| System | Goals | Notes |
| --- | --- | --- |
| Rocket Builder | Grid-based assembly, snapping, symmetry, structural validation, center of mass/thrust indicators. | Hangar scene with cute clay-like art; parts unlock via tech tree. |
| Physics & Flight | Thrust, mass, drag, heat, stage separation, RCS, N-body gravity (simplified). | Start with 2D planar physics for MVP, move to 3D later. |
| World Generation | Hand-authored inner solar system; procedural outer planets, moons, asteroid belts, nebulae, alien systems. | Uses seeded noise + deterministic orbits to keep saves reproducible. |
| Tech Progression | Era-based tree (1960s chemical rockets → 2500s FTL concepts). Gate parts, fuels, instruments, navigation aids. | Provide narrative “missions” per era to hint next goals. |
| Exploration Loop | Contracts/missions, scanning, resource collection, base building hooks. | Data collected funds research; new anomalies unlock lore snippets. |
| Presentation | Stylized PBR materials, volumetric lighting, HUD projected on spacecraft glass. | Keep art simple but cohesive early; allow improvement later. |
| Music & Tone | Adaptive layers referencing Deep Space Exploration.mp3 seed track. | Each celestial biome has motif; success/failure cues. |

## 4. Technology Stack (initial proposal)
- **Engine**: Web-based stack (Vite + React + TypeScript) with `react-three-fiber` for Three.js rendering.
- **Physics**: `cannon-es` (rigid bodies) + custom orbital mechanics solver for patched conics.
- **State**: Zustand or Redux Toolkit for predictable sim state snapshots and replay.
- **Procedural Generation**: deterministic seeds stored per system; use `simplex-noise` and custom orbital parameter generators.
- **Tooling**: ESLint, Prettier, Vitest for unit tests, Playwright for future E2E flight tests.

> Rationale: Browser delivery keeps prototype friction low, leverages existing Three.js ecosystem, and still allows export to desktop via Electron later.

## 5. Gameplay Progression Structure
1. **1960s – Chemical Era**
   - Parts: basic fuel tanks, engines, primitive avionics.
   - Missions: suborbital hops, orbital insertions, early lunar flybys.
2. **1980s – Shuttle Era**
   - Unlock modular cargo bays, docking ports, solar panels, simple autopilot assists.
   - Introduce reusable stages and planetary probes.
3. **2040s – Fusion Era**
   - High-efficiency drives, in-situ resource utilization, large habitats.
   - Player notices hints about outer systems via mysterious signals.
4. **2200s – Relativistic Era**
   - Laser sails, antimatter containment, advanced navigation AI.
   - Procedural star systems become reachable; players begin interstellar survey.
5. **2500s – Far Future**
   - Exotic propulsion (Alcubierre-inspired), civilization-scale projects, collaborative missions.
   - Gameplay shifts toward galactic-scale logistics while preserving hands-on piloting for smaller craft.

## 6. MVP Slice (Playable at Every Step)
- **Goal**: Ship a vertical slice where the player can build a small rocket, launch from a pad, achieve orbit around a single planet, and re-enter.
- **Minimum Features**:
  1. Hangar scene with drag/drop part placement, mass/thrust readouts, staging stack UI.
  2. Simple 3D planet + skybox + lighting.
  3. Physics loop with gravity + thrust, autopause when alt-tabbed.
  4. Basic HUD (altitude, velocity, apoapsis/periapsis estimation using patched conics).
  5. Music loop that transitions from hangar to flight.
- **Player Value**: Even before procedural galaxies, they can experiment with vehicle design and master launch/orbit routines.

## 7. Technical Roadmap (First 6 Iterations)
1. **Phase 0 — Engine & Scene Scaffolding**
   - Set up Vite + React + TypeScript + react-three-fiber skeleton.
   - Implement global state, camera controls, placeholder planet, and UI overlay.
   - Load sample assets (`Soyuz_TMA.fbx`, `earth.jpg`, `Deep Space Exploration.mp3`).
2. **Phase 1 — Builder Prototype**
   - Create hangar viewport with grid, snapping, symmetry, and part catalog (fuel tank, engine, decoupler).
   - Serialize craft to JSON blueprint.
3. **Phase 2 — Flight Physics MVP**
   - Instantiate craft from blueprint, attach rigid bodies, apply thrust/drag/torque.
   - Implement planar gravity + patched conic predictor for one body (Earth analog).
4. **Phase 3 — Orbital Navigation & Telemetry**
   - Add navball, orbit lines, stage manager, autopilot assists (hold prograde, retrograde).
   - Track achievements + data logs awarding science currency.
5. **Phase 4 — Tech Tree & Progression Loop**
   - Build research UI, missions, currency economy; gate parts by era.
   - Add first procedural outer-planet mission tease.
6. **Phase 5 — Procedural Worlds Expansion**
   - Generate additional planets/moons using seeds, add interplanetary map.
   - Introduce exploration instruments, anomalies, dynamic soundtrack layers.

Each phase ends with integration tests + playable build to ensure constant functionality.

## 8. Fun Enhancements & Future Suggestions
- **Vehicle fractures**: Soft-body-inspired failure where parts crumple rather than vanish.
- **Instruments-as-minigames**: e.g., tune radio frequencies to find anomalies, à la Outer Wilds.
- **Crew stories**: Kerbal-style kerbonaut logs with personalities affecting mission bonuses.
- **Shared discoveries**: Optional asynchronous sharing of star seeds with friends.
- **Photo mode & journaling**: Promote sense of wonder; snapshots tagged with music cues.
- **Dynamic weather**: Jet streams, solar storms affecting launches.

## 9. Risks & Mitigations
- **Physics complexity** → start 2D planar + simplified patched conics before expanding.
- **Procedural monotony** → mix handcrafted landmarks with seeded noise templates.
- **Scope creep** → ship phase milestones before introducing new mechanics.
- **Performance** → chunk simulation by regions, use fixed-step physics loop decoupled from render, leverage instancing.

## 10. Immediate Next Steps
1. Lock tech stack (Vite/React/TypeScript/RTF/cannon-es/Zustand).
2. Implement Phase 0 scaffolding.
3. Create placeholder parts & UI to prove builder → flight data flow.
4. Establish save system + deterministic random seeds per save slot.

## 11. Near-Term Iteration Plan
1. **Phase 0.1 — Feel & Feedback**
   - Add configurable gravity/atmosphere profiles, throttle smoothing, audio cues for staging, and richer HUD readouts (navball mock).
2. **Phase 0.2 — Builder Loop**
   - Stand up hangar grid, basic part palette (command pod, tank, engine, decoupler), craft serialization, and a validation checklist to keep rockets flyable.
3. **Phase 0.3 — Mission Hooks**
   - Add goal-driven tutorials (orbit, rendezvous), research currency, and an early glimpse of the tech tree so players sense long-term progression.
4. **Phase 1.0 — Solar Neighborhood**
   - Expand to multi-body navigation (Moon, Mars analogs), map view, and telemetry logging for science payouts, while seeding future procedural generations.
