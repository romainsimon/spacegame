# PRD: SpaceX Launch Simulator

## Overview

A browser-based 3D rocket launch game that recreates the SpaceX webcast experience. The player launches a two-stage rocket from the ground to orbit by timing key events (ignition, stage separation, MECO, SECO). No menus — the game starts immediately on the launch pad.

## Core Experience

The player sees a Falcon 9-style rocket on a launch pad. The camera is close, slightly angled. A SpaceX-style telemetry overlay shows altitude, speed, and mission clock. Press SPACE to ignite. The rocket lifts off. As it climbs, the camera smoothly zooms out. At specific moments (marked by time windows on the HUD), the player presses SPACE again to trigger stage separation, second engine start, etc. Miss the window = mission failure. Nail all events = successful orbit insertion.

## Visual Style

- **SpaceX webcast aesthetic**: Dark background, clean white rocket, blue/orange engine flames
- **Telemetry HUD**: Bottom bar with mission clock (T+00:00), altitude, speed — styled like the real SpaceX overlay (white text on semi-transparent dark bar)
- **Camera**: Starts close on launch pad, gradually pulls back as altitude increases. At high altitude, Earth curvature becomes visible
- **Sky**: Blue gradient near ground that fades to black at altitude
- **Ground**: Simple textured pad with tower structure
- **Particles**: Engine exhaust flame, stage separation debris

## Game Flow

### Phase 1: Pre-Launch (T-10s)
- Camera shows rocket on pad, mission clock counting down from T-10
- HUD displays "PRESS SPACE TO LAUNCH" prompt
- Atmospheric: slight camera sway, ambient sound

### Phase 2: Liftoff (T+0s)
- Player presses SPACE → engines ignite, T+0 starts
- Rocket begins vertical ascent
- Camera slowly starts pulling back
- Telemetry shows altitude/speed climbing
- Engine flame visible at base

### Phase 3: Max-Q (T+~60s)
- HUD indicator shows "MAX-Q" when reaching max dynamic pressure
- Visual: slight vibration effect
- Informational only, no player action needed

### Phase 4: MECO + Stage Separation (T+~150s)
- HUD shows a "STAGE SEP" prompt with a timing window (green bar that shrinks)
- Player presses SPACE within the window
- First stage engines cut off
- Visual: stages separate, small puff of gas, first stage falls away
- Second stage engine ignites
- Miss the window → mission failure

### Phase 5: SECO - Orbit Insertion (T+~480s)
- Rocket is now very high, camera very far back, Earth visible below
- HUD shows "SECO" prompt with timing window
- Player presses SPACE to cut engines at the right moment
- Success = stable orbit achieved → victory screen with orbital parameters
- Miss = failure

### Phase 6: Result
- Success: "ORBIT ACHIEVED" overlay with stats (max altitude, max speed, accuracy rating)
- Failure: "MISSION FAILED" with reason + "PRESS R TO RETRY"
- Press R to restart from pre-launch

## Technical Architecture

### Stack
- **Nuxt 3** — kept as the app shell (already configured)
- **Three.js** — direct usage via composable (not TresJS)
- **No physics engine** — simplified custom physics (gravity + thrust + drag)
- **Pinia** — game state management

### File Structure (clean slate)
```
app.vue                    — just <NuxtPage />
pages/
  index.vue                — the game (single page, no routing)
composables/
  useGame.ts               — game state machine & event timing
  usePhysics.ts            — simplified rocket physics
  useRenderer.ts           — Three.js scene setup & render loop
  useCamera.ts             — camera zoom-out logic
  useHUD.ts                — telemetry data formatting
types/
  game.ts                  — TypeScript interfaces
assets/
  css/main.css             — global styles + SpaceX fonts
```

### Key Technical Decisions

1. **Single page**: No routing. `pages/index.vue` is the entire game
2. **Direct Three.js**: Use Three.js directly in a composable, not TresJS wrapper. More control over the scene
3. **Game state machine**: Pre-launch → Launch → Flying → Stage events → Orbit/Fail
4. **Simplified physics**: 1D vertical flight (altitude only). Gravity decreases with altitude, thrust from engines, drag in atmosphere. No orbital mechanics for MVP
5. **Timing windows**: Each event has a center time and a window width (e.g., ±3 seconds). Accuracy within the window affects score
6. **Camera**: Logarithmic zoom-out based on altitude. Start at ~50m from rocket, end at ~50km showing Earth curve

### Rocket Model (Procedural)
- Built from Three.js primitives (cylinders, cones)
- Two-stage: First stage (tall cylinder + 9 engine bells), interstage, second stage (shorter cylinder + 1 engine bell), fairing/payload on top
- White body, dark gray engines, SpaceX-gray interstage
- Engine flame: animated cone with emissive orange/blue material

### Telemetry HUD (HTML overlay)
- Bottom center bar, SpaceX-style layout:
  - Left: STAGE 1 / STAGE 2 indicator
  - Center: Mission clock T+MM:SS
  - Right: SPEED (km/h) and ALTITUDE (km)
- Event prompts appear center screen with timing bar
- All HTML/CSS, not rendered in 3D

### Physics Model (simplified)
- Altitude-based (1D vertical)
- `altitude += velocity * dt`
- `velocity += (thrust/mass - gravity - drag) * dt`
- Gravity: `g = 9.81 * (R/(R+alt))²`
- Drag: `0.5 * rho * v² * Cd * A / mass` where `rho` decreases exponentially with altitude
- Mass decreases as fuel burns
- Stage 1: high thrust, burns for ~150s
- Stage 2: lower thrust, burns for ~330s

## Cleanup Required

Remove all existing game files:
- `pages/index.vue` (menu)
- `pages/hangar.vue` (builder)
- `pages/flight.vue` (old flight)
- `components/` (all builder components)
- `composables/` (old composables)
- `stores/` (old stores)
- `types/` (old types)
- `data/` (old part data)
- `AGENTS.md`

Remove TresJS dependencies:
- `@tresjs/core`, `@tresjs/cientos`, `@tresjs/nuxt`
- `cannon-es`

Keep:
- Nuxt 3 core
- Three.js + @types/three
- Pinia
- Global CSS (modified)

## Success Criteria

1. Game loads directly to launch pad — no menu
2. Pressing SPACE launches the rocket
3. Camera smoothly zooms out as altitude increases
4. SpaceX-style telemetry overlay updates in real-time
5. Stage separation requires timed SPACE press
6. Successful orbit or failure with retry
7. Feels like watching a SpaceX webcast, but you're in control
