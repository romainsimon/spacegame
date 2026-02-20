# PRD: Gameplay Screens & Version-by-Version Roadmap

## Self-Clarification

1. **Problem/Goal:** The game needs to grow from a single-screen scripted Falcon 9 experience into a full multi-mode space exploration game. We need detailed screen-by-screen definitions so each mode can be built independently, and a version-by-version task list so work can be sequenced without blocking.

2. **Core Functionality:** (a) Define the exact UI layout, state, and interactions for each game screen; (b) Break the full-game PRD into shippable versions with concrete tasks; (c) Ensure each version is independently playable and delivers a new gameplay loop.

3. **Scope/Boundaries:** This PRD covers screen architecture, UI elements, user interactions, and routing. It does NOT define physics equations (covered in PRD-FULL-GAME.md), art assets, or backend services.

4. **Success Criteria:** Each version ships a playable build with zero regressions. Each screen section contains enough detail for an engineer to implement without asking follow-up questions.

5. **Constraints:** Web browser (Three.js + Vue/Nuxt). All screens share the same codebase and Three.js canvas. Physics stays in composables. State in Pinia. The existing Prologue code must not be broken by any version.

---

## Introduction

This document defines:
1. Every game screen — its purpose, layout, components, state, and transitions
2. A concrete task list organized by version (v0.1 through v2.0)

The existing game (scripted Falcon 9 mission) becomes the **Prologue** and is preserved intact. Every new screen is additive.

---

## Part 1: Screen Definitions

---

### Screen 1: Prologue (Existing — Do Not Modify Core)

**Route:** `/` (current `pages/index.vue`)
**Purpose:** Scripted Falcon 9 launch. Teaches timing mechanics. Ends the game session or transitions to the Hub.

**Current state:** Complete and shipping.

**v0.1 Addition — Booster Landing extension:**
After the current "ORBIT ACHIEVED" result screen, instead of just showing retry, show a second phase prompt: "STAGE 1 LANDING SEQUENCE INITIATED" and run the booster landing simulation.

**Prologue → Hub Transition:**
After successful booster landing (or after orbit achieved if landing fails), show a full-bleed cinematic overlay:

```
┌─────────────────────────────────────────────┐
│                                             │
│         ORBIT ACHIEVED                      │
│                                             │
│  The Falcon 9 has delivered its payload.    │
│  Stage 1 has returned home.                 │
│                                             │
│  Mission date recorded:                     │
│  ► 2026-02-20  14:32:07 UTC                 │
│                                             │
│  The clock has started.                     │
│  The solar system awaits.                   │
│                                             │
│         [ BEGIN ]                           │
│                                             │
└─────────────────────────────────────────────┘
```

Pressing BEGIN:
- Stores `gameStartDate = Date.now()` in Pinia / localStorage
- Navigates to `/hub`

---

### Screen 2: Mission Hub

**Route:** `/hub`
**File:** `pages/hub.vue`
**Purpose:** Central navigation screen. Player sees their progress, current era, Kardashev score, and chooses what to do next (go to Hangar, review Map, check Technology, view Contracts).

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  MISSION CONTROL          2026-02-20  14:32:07  UTC      │
│  Kardashev: K-0.700       ERA 0 — FIRST STEPS            │
├────────────────────────┬────────────────────────────────┤
│                        │  CURRENT OBJECTIVES             │
│   [SOLAR SYSTEM MAP]   │  ► Land the Falcon 9 booster   │
│   (background visual)  │  ► Achieve stable Earth orbit  │
│                        │  ► Deploy first satellite       │
│                        ├────────────────────────────────┤
│                        │  NEXT MILESTONE                 │
│                        │  Moon Landing — K-0.720         │
│                        │  [===========·---------] 60%    │
│                        ├────────────────────────────────┤
│                        │  ACTIVE MISSIONS               │
│                        │  • No active missions          │
│                        ├────────────────────────────────┤
│                        │  NAVIGATION                    │
│                        │  [HANGAR]  [MAP]               │
│                        │  [TECH]    [CONTRACTS]         │
├────────────────────────┴────────────────────────────────┤
│  [CREDITS]                                   [SETTINGS] │
└─────────────────────────────────────────────────────────┘
```

**State from Pinia:**
- `game.kardashevScore` (number, e.g. 0.700)
- `game.era` (0–6)
- `game.inGameDate` (computed from real elapsed time × warp)
- `game.objectives` (array of current era objectives with completion status)
- `fleet.activeMissions` (array of in-progress missions)

**Interactions:**
- Click HANGAR → navigate to `/hangar`
- Click MAP → navigate to `/map`
- Click TECH → navigate to `/tech`
- Click CONTRACTS → navigate to `/contracts`
- Click objective → shows objective detail modal

---

### Screen 3: Hangar (Rocket Builder)

**Route:** `/hangar`
**File:** `pages/hangar.vue`
**Purpose:** Build, modify, and save rocket designs. Launch into flight.

**Layout:**

```
┌──────────┬─────────────────────────────────┬─────────────────┐
│  PARTS   │                                 │  CRAFT STATS    │
│          │                                 │  Mass: 549,054  │
│ [Search] │      3D BUILDER VIEWPORT        │  TWR:  1.38     │
│          │    (orbit controls, part        │  ΔV:   9,200    │
│ COMMAND  │     highlight on hover)         │                 │
│ ┌──────┐ │                                 │  STAGING        │
│ │ Pod  │ │                                 │  ┌───────────┐  │
│ │      │ │                                 │  │  STAGE 1  │  │
│ └──────┘ │                                 │  │  Merlin×9 │  │
│          │         [ROCKET]                │  │  ΔV:6,900 │  │
│ ENGINES  │                                 │  └───────────┘  │
│ ┌──────┐ │                                 │  ┌───────────┐  │
│ │Merlin│ │                                 │  │  STAGE 2  │  │
│ └──────┘ │                                 │  │  Merlin V │  │
│          │                                 │  │  ΔV:2,300 │  │
│ TANKS    │                                 │  └───────────┘  │
│ ┌──────┐ │                                 │                 │
│ │ LOX  │ │                                 │  CoM ●  CoT ▲  │
│ └──────┘ │                                 │  [OFFSET: 0.2m] │
├──────────┴─────────────────────────────────┴─────────────────┤
│  [← HUB]  [NEW] [SAVE] [LOAD]  [SYM: 2×]    [LAUNCH ►]     │
└──────────────────────────────────────────────────────────────┘
```

**Part Catalog Component:**
- Scrollable vertical list, grouped by category
- Each part shows: 3D thumbnail, name, mass (t), thrust (kN) or capacity
- Locked parts shown greyed out with "Unlock: Era X" tooltip
- Search/filter by name

**3D Viewport:**
- Three.js canvas, orbit controls (right-click drag = rotate, scroll = zoom)
- Selected part highlighted with outline shader
- Attachment points shown as glowing blue dots when a part is held
- Grid floor (1m increments)
- CoM indicator (red sphere at center of mass)
- CoT indicator (blue arrow at thrust direction)
- Symmetry ghost renders (transparent clones for 2×/4× symmetry)

**Stats Panel:**
- Total wet mass (kg)
- Dry mass (kg)
- Max thrust (kN)
- TWR at sea level (must be > 1.0 to launch — shows warning if not)
- Total ΔV (Tsiolkovsky, all stages summed)
- Staging list: each stage shows parts, engines, ΔV contribution

**Bottom Bar:**
- New craft (clears current)
- Save (name dialog → localStorage)
- Load (grid of saved crafts with thumbnails)
- Symmetry toggle (off / 2× / 4× / 8×)
- Launch → validates craft → navigates to `/flight` with craft blueprint in Pinia

**Craft Validation before Launch:**
- Must have: at least one engine, at least one command module, TWR > 1.0
- Warnings: CoM/CoT offset > 0.5 m (unstable), no heat shield for crewed missions
- Blocking errors shown as red toast; warnings as yellow

---

### Screen 4: Flight Mode

**Route:** `/flight`
**File:** `pages/flight.vue`
**Purpose:** Free-flight 3D physics simulation. Player pilots the rocket from launch to destination.

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  2026-02-20 14:47:23 UTC      T+00:14:03      [MAP VIEW: M] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     3D SCENE                                │
│                  (Three.js canvas)                          │
│                                                             │
│        AP: 250.4 km    PE: 144.2 km    INC: 28.5°          │
│                                                             │
│          ┌──────────┐                                       │
│          │ NAVBALL  │  ← 3D sphere, horizon + markers       │
│          └──────────┘                                       │
│                                                             │
├───────┬────────┬───────────────────────────┬───────────────┤
│ SPEED │  ALT   │  ████████ THROTTLE 82%    │  FUEL  88%   │
│ 7,823 │ 175 km │  [ENGINES: STAGE 2 — ON]  │  ΔV:1,844ms  │
│  m/s  │        │  TWR: 0.62                │  STG: 2      │
├───────┴────────┴───────────────────────────┴───────────────┤
│ [←HUB] [SAS:PRO] [RCS:OFF]  1× 5× [10×] 50×   [STAGE:SPC]│
└─────────────────────────────────────────────────────────────┘
```

**Top Bar:**
- Current game date/time (always visible, real clock + warp)
- Mission elapsed time (T+ format)
- [M] key / button → switches to Map view without leaving simulation

**3D Scene:**
- Rocket chase camera (smooth follow, slight lag for cinematic feel)
- Free camera (F key): player-controlled orbit camera
- Surface camera (S key): locked to surface, horizon visible
- Earth, atmosphere, stars rendered (same as prologue, but now procedural based on craft position)
- Planet surface texture transitions as altitude changes (cloud layer, horizon haze)
- Engine flame particle system (throttle-proportional)
- Trajectory ghost line (predicted orbit path, updated every frame)

**Navball:**
- 3D rendered sphere, always visible bottom-center
- Brown hemisphere = ground, blue = sky
- Velocity vector marker (prograde/retrograde) moves on sphere as attitude changes
- SAS target marker (yellow crosshair) when SAS is active
- Manoeuvre node direction (cyan crosshair) when a node is set

**Orbital Information Bar (above navball):**
- Apoapsis (AP), Periapsis (PE) — updated every 0.25 s
- Inclination (INC)
- Time to Ap / Pe toggle (click to switch)
- SOI name (e.g., "EARTH SOI")

**Bottom Bar (always visible):**
- Speed (m/s) — surface and orbital toggleable
- Altitude (km) — surface and sea-level toggleable
- Throttle bar + percentage
- Fuel remaining (current stage)
- ΔV remaining (current stage + total in brackets)
- Current stage number
- SAS mode button (OFF / PRO / RETRO / NORM / RAD)
- RCS toggle
- Time warp buttons (current warp highlighted)
- STAGE button (same as SPACE) — pulses when a staging event is available

**Keyboard Controls:**
```
WASD      — Pitch/Yaw
QE        — Roll
Shift     — Throttle up (+10%/s)
Ctrl      — Throttle down (-10%/s)
Z         — Full throttle
X         — Cut throttle
Space     — Stage
T         — Toggle SAS (cycles modes)
R         — Toggle RCS
M         — Switch to Map view
,/.       — Decrease/increase time warp
F5        — Quicksave
F9        — Quickload
Esc       — Pause menu
```

**Pause Menu:**
```
┌──────────────────────┐
│      PAUSED          │
│  [RESUME]            │
│  [RETURN TO HUB]     │
│  [SAVE MISSION]      │
│  [SETTINGS]          │
│  [QUIT]              │
└──────────────────────┘
```

**In-Flight Events (non-scripted):**
- SOI transition notification: "Entering MOON SOI" (banner at top)
- Apoapsis/Periapsis warning: "Approaching Ap — 60 seconds" (auto-warp stop)
- Manoeuvre node warning: "Node — 45 seconds" (auto-warp stop)
- Atmosphere warning: "Entering atmosphere at 80 km" (auto-warp stop if > 5×)
- Low fuel warning: "< 10% fuel remaining" (persistent red indicator)
- Reentry heat warning: "WARNING: HEAT SHIELD REQUIRED" (if no shield and velocity > 3000 m/s in atmosphere)

**Mission End Conditions:**
- Orbit achieved (AP > 80 km + PE > 80 km Earth) → achievement popup
- Body reached (SOI entered for first time) → discovery overlay
- Landing detected (surface contact + velocity < 5 m/s) → landing result
- Crash (surface contact + velocity > 5 m/s) → explosion + mission failed
- Fuel exhausted in transit → "Mission lost — no fuel for orbital insertion"

---

### Screen 5: Map / Computer View

**Route:** Overlay on `/flight` OR standalone `/map`
**File:** `components/MapView.vue` (rendered as full-screen overlay or standalone page)
**Purpose:** Orbital mechanics planning. Shows all bodies, orbits, vessels, and lets player place manoeuvre nodes.

**Layout:**

```
┌────────────────────────────────────────────────────┬────────────┐
│                                                    │  COMPUTER  │
│                   MAP VIEWPORT                     │            │
│              (Three.js, orthographic)              │  VESSEL    │
│                                                    │  Falcon 9  │
│        · MOON SOI                                  │  ─────────  │
│              ____                                  │  Alt: 175km │
│      Earth  /    \        ✦ VESSEL                 │  Vel: 7823  │
│      (blue) \____/        [MANOEUVRE NODE]         │  Ap: 250km  │
│              ↑                                     │  Pe: 144km  │
│         [DRAG TO PLAN]                             │  Inc: 28.5° │
│                                                    │  ─────────  │
│                                                    │  BURN      │
│  [+ZOOM]  [-ZOOM]  [FOCUS: EARTH]  [SHOW: ALL]    │  ΔV: +452  │
│                                                    │  Dur: 3:24  │
│                                                    │  In: 12:07  │
└────────────────────────────────────────────────────┴────────────┘
│  2026-02-20 14:47:23 UTC    [RETURN TO FLIGHT: M]  [EXECUTE: N]│
└────────────────────────────────────────────────────────────────┘
```

**Map Viewport:**
- All visible celestial bodies: circle sized to relative radius (log scale toggle)
- SOI boundaries: semi-transparent dashed circles
- Active vessel: glowing dot on its orbit path
- Orbit path: white ellipse (current orbit) + orange ellipse (planned orbit after node)
- Ghost trajectory: dashed line showing full predicted path including SOI changes
- Closest approach markers: two triangles on rendezvous trajectories
- Manoeuvre node: blue diamond on orbit, placed by clicking orbit path

**Manoeuvre Node Editor (appears on click):**
- Prograde/Retrograde handle: drag horizontally → +/- prograde ΔV
- Normal/Antinormal handle: drag vertically → +/- normal ΔV
- Radial handle: drag tangentially → +/- radial ΔV
- Node info box: shows total ΔV, burn duration, time to node
- Delete button on node

**Computer Panel (right sidebar):**
- Current orbital elements (semi-major axis, e, i, RAAN, ω)
- Time to AP / PE
- Active manoeuvre node details (ΔV, burn duration, time to start)
- Quick actions:
  - [HOHMANN] → auto-generates a two-node Hohmann transfer to a selected target orbit (input target AP)
  - [CIRCULARIZE AP] → generates a prograde burn at current AP to circularize
  - [CIRCULARIZE PE] → generates a retrograde burn at current PE to circularize

**Controls:**
- Scroll = zoom
- Click + drag = pan
- Click on orbit = place manoeuvre node
- Click on vessel = focus camera on vessel
- Click on body = focus camera on body
- M key (or button) = return to flight 3D view
- N key = execute next manoeuvre node (starts burn)

---

### Screen 6: Technology Tree

**Route:** `/tech`
**File:** `pages/tech.vue`
**Purpose:** Spend Science Points to unlock new rocket parts and capabilities.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  TECHNOLOGY RESEARCH            Science: ◆ 1,240         │
├────────┬─────────────────────────────────────────────────┤
│ FILTER │                                                  │
│ [All]  │   ERA 0      ERA 1      ERA 2      ERA 3         │
│ [Prop] │                                                  │
│ [Strct]│  [MERLIN] → [RAPTOR] → [NTR]  → [ION]          │
│ [Habs] │    ✓          ✓         ◆800      ◆ ◆           │
│ [Sci]  │                                                  │
│        │  [GRID FIN]→ [ADV HEAT]→ [ISRU]  → [MINING]    │
│        │    ✓            ◆ 200    ◆ 600    locked        │
│        │                                                  │
│        │  [SOLAR]  → [RTG]   → [FISSION]→ [FUSION]      │
│        │    ✓          ✓         ◆ 400    locked          │
└────────┴─────────────────────────────────────────────────┘
│  Selected: Nuclear Thermal Propulsion                     │
│  Cost: ◆ 800 | Unlocks: NTR Engine part (Isp: 900s)      │
│  Requires: Mars Base (Era 2)                              │
│                                    [RESEARCH — ◆ 800]    │
└──────────────────────────────────────────────────────────┘
```

**State:** Pinia `technology` store — tree of nodes with `{ id, name, cost, unlocked, requires[] }`

**Interactions:**
- Click node → select and show detail in bottom bar
- Click RESEARCH → deduct science, mark unlocked, unlock part in Hangar catalog
- Locked (requires unmet era) → node shown with lock icon, tooltip explains requirement
- Already researched → node shows green checkmark, no button

---

### Screen 7: Contracts

**Route:** `/contracts`
**File:** `pages/contracts.vue`
**Purpose:** Accept missions to earn funding and science.

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  CONTRACTS              Funding: $124.5M  Rep: ★★★★☆   │
├─────────────────────────┬───────────────────────────────┤
│  AVAILABLE (6)          │  CONTRACT DETAIL              │
│  ─────────────────────  │                               │
│  ► GovSat-12 Deployment │  GovSat-12 Deployment        │
│    $12.4M | ◆ 20        │  Launch satellite to GEO.     │
│    Deadline: 45 days     │                               │
│  ─────────────────────  │  Target orbit:                │
│  ► ISS Resupply          │  AP: 35,786 km               │
│    $8.1M  | ◆ 30        │  Inc: 0° (equatorial)        │
│    Deadline: 120 days    │                               │
│  ─────────────────────  │  Reward:                      │
│  ► Lunar Survey          │  $12,400,000                  │
│    $45.0M | ◆ 200       │  ◆ 20 science points          │
│    Deadline: 600 days    │  +0.5 reputation              │
│                         │                               │
│  ACTIVE (1)             │  Penalty if missed:           │
│  ─────────────────────  │  -$2M, -1.0 rep               │
│  ◉ Starlink Batch 47    │                               │
│    Progress: 12/60 sats  │              [ACCEPT]        │
└─────────────────────────┴───────────────────────────────┘
```

---

### Screen 8: Achievements / Kardashev Progress

**Route:** `/achievements`
**File:** `pages/achievements.vue`
**Purpose:** View all achievements, milestones, and Kardashev progression.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  CIVILISATION PROGRESS                                    │
│                                                          │
│  ██████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  K-0.714 ─────────────────────────────────────── K-3.0  │
│                     Kardashev 0.714                      │
│                                                          │
│  Next milestone: Moon Landing (K-0.720)                  │
├──────────────────────────────────────────────────────────┤
│  NAVIGATION          ENGINEERING        CIVILISATION     │
│  ✓ First Orbit       ✓ Perfect Landing  ✓ First Orbit    │
│  ✓ First EVA         ○ Fuel Miser       ○ Colony Founded  │
│  ○ Rendezvous        ○ Delta-V King     ○ ISRU Online    │
│  ○ Trans-Lunar Inj.  ○ Heavy Lifter     ○ Dyson Ring     │
│  ○ Moonwalker        ○ Gravity Master   ○ Type I         │
│  ○ Red Rover         ○ ...              ○ Type II        │
│  ○ Grand Tour                           ○ Type III       │
│  ○ Voyager                                               │
│  ○ Alpha                                                 │
├──────────────────────────────────────────────────────────┤
│  Game started: 2026-02-20 14:32:07 UTC                   │
│  In-game date: 2027-03-15                                 │
│  Real play time: 4h 32m                                  │
└──────────────────────────────────────────────────────────┘
```

---

### Screen 9: Result Overlays (In-Flight)

These are full-bleed overlays appearing on top of the 3D scene during significant moments.

**Landing Success:**
```
┌──────────────────────────────────────┐
│                                      │
│    TOUCHDOWN                         │
│    Stage 1 — Autonomous Landing      │
│                                      │
│    Touchdown velocity:  0.8 m/s  ✓   │
│    Remaining fuel:      4.2%         │
│    Landing accuracy:    +12 m        │
│    Score:               ★★★★★       │
│                                      │
│    Achievement unlocked:             │
│    ► PERFECT LANDING                 │
│                                      │
│         [CONTINUE]                   │
│                                      │
└──────────────────────────────────────┘
```

**Orbit Achieved:**
```
┌──────────────────────────────────────┐
│                                      │
│    STABLE ORBIT ACHIEVED             │
│    Earth Low Orbit                   │
│                                      │
│    Apoapsis:   248.7 km              │
│    Periapsis:  181.3 km              │
│    Inclination: 28.4°                │
│    Period:     1h 29m                │
│                                      │
│    Achievement unlocked:             │
│    ► FIRST ORBIT                     │
│    Kardashev: K-0.700 → K-0.701      │
│                                      │
│    [CONTINUE IN ORBIT]  [RETURN HUB] │
│                                      │
└──────────────────────────────────────┘
```

**New Body Discovered:**
```
┌──────────────────────────────────────┐
│  ✦  DISCOVERY  ✦                     │
│                                      │
│    MOON                              │
│    First human contact: Era 1        │
│                                      │
│    Distance from Earth: 384,400 km   │
│    Surface gravity: 1.62 m/s²        │
│    Atmosphere: None                  │
│                                      │
│    Science collected: ◆ +150         │
│    Kardashev: K-0.709 → K-0.720      │
│                                      │
│    ► ERA 1 UNLOCKED: Lunar Ambition  │
│                                      │
│         [AMAZING]                    │
│                                      │
└──────────────────────────────────────┘
```

---

## Part 2: Version-by-Version Task List

---

### Version 0.1 — Booster Landing

**Goal:** Complete the Prologue with a Stage 1 landing sequence. Add Prologue → Hub transition.

**Deliverable:** Playable prologue with booster landing and entry into the Hub (placeholder Hub).

---

#### T-001: Stage 1 Boostback Burn Event
**Description:** Add a new scripted event after stage separation: "BOOSTBACK BURN". Stage 1 fires 3 Merlin engines for ~25 seconds to reverse trajectory toward launch site.

**Acceptance Criteria:**
- [ ] New event added to `MISSION_EVENTS` array in `useGame.ts` with `id: 'boostback'`, `requiresInput: true`, window ±5 s around T+185
- [ ] Player must press SPACE during the window — timing bar shows on event prompt
- [ ] If player hits the window: stage 1 throttle set to 0.33 (3 engines), `stage1Flight.velocity` reversal begins in physics
- [ ] If player misses: stage 1 is marked as "lost — no boostback" (no score loss, mission continues)
- [ ] Timeline bar updated to show: `LIFTOFF → MAX-Q → MECO → SEP → SES-1 → SECO → BOOSTBACK`

#### T-002: Stage 1 Entry Burn Event
**Description:** Auto-event at T+350 — stage 1 fires 3 engines briefly to slow down before reentry.

**Acceptance Criteria:**
- [ ] Auto-event (no input) fires at T+350 in mission events: sets stage 1 throttle to 0.33 for 15 s then 0
- [ ] "ENTRY BURN" label flashes on timeline at the correct position
- [ ] Stage 1 telemetry in split-screen shows velocity decrease during this burn

#### T-003: Stage 1 Landing Burn Event
**Description:** Player-input event at T+420 — stage 1 fires landing burn. Player must press SPACE to ignite at the right altitude (<3000 m indicated on left panel).

**Acceptance Criteria:**
- [ ] New event `id: 'landing-burn'`, `requiresInput: true`, triggered when `stage1Flight.altitude < 3500` m (altitude-based, not time-based)
- [ ] Left split-screen panel shows pulsing altitude readout when below 4000 m
- [ ] If player hits within threshold: `stage1Flight` enters landing state, `stage1Flight.throttle = 1.0`
- [ ] Stage 1 physics modified: landing throttle decelerates to < 3 m/s at altitude 0
- [ ] "TOUCHDOWN" detection: `stage1Flight.altitude <= 0 && stage1Flight.velocity <= 3`

#### T-004: Stage 1 Landing Result
**Description:** Show a landing result overlay on Stage 1 side of split screen.

**Acceptance Criteria:**
- [ ] On touchdown detected: show `TOUCHDOWN ✓` or `RUD ✗` in bottom-left of Stage 1 panel
- [ ] Stats shown: touchdown velocity (m/s), fuel remaining (%), landing score (1–5 stars based on velocity < 1 m/s = 5★)
- [ ] If Stage 2 is still flying: overlay appears only on Stage 1 side, Stage 2 continues
- [ ] Achievement: "PERFECT LANDING" if touchdown velocity < 1 m/s (store in Pinia achievements)

#### T-005: Prologue → Hub Transition
**Description:** After orbit is achieved (and landing resolved), show the game-start cinematic overlay and navigate to Hub.

**Acceptance Criteria:**
- [ ] After `state.phase === 'orbit'` for 5 seconds AND landing resolved (landed or failed): show cinematic overlay
- [ ] Overlay shows: "The clock has started." + real current date/time as game start date
- [ ] Pressing [BEGIN] stores `gameStartDate = new Date().toISOString()` in `game` Pinia store + localStorage
- [ ] Navigate to `/hub`

#### T-006: Hub Page (Placeholder)
**Description:** Create a minimal `/hub` page that confirms game has started and lets player retry prologue.

**Acceptance Criteria:**
- [ ] `pages/hub.vue` exists and is accessible at `/hub`
- [ ] Displays game start date from Pinia store
- [ ] Displays "ERA 0 — FIRST STEPS" and placeholder Kardashev K-0.700
- [ ] Has a [REPLAY PROLOGUE] button that navigates back to `/` (for testing)
- [ ] Styled in same monospace dark theme as prologue

---

### Version 0.2 — Free Flight Physics

**Goal:** Player can fly a hardcoded simple rocket (no builder yet) with free controls, and achieve a stable Earth orbit.

**Deliverable:** `/flight` page with full 3D free flight, HUD, and navball. Orbit detection working.

---

#### T-007: Pinia Stores Setup
**Description:** Create all core Pinia stores needed by the game.

**Acceptance Criteria:**
- [ ] `stores/game.ts`: `kardashevScore`, `era`, `inGameDate`, `gameStartDate`, `achievements[]`
- [ ] `stores/craft.ts`: `activeCraft` (blueprint JSON), `savedCrafts[]`
- [ ] `stores/fleet.ts`: `vessels[]` (each vessel has full physics state)
- [ ] `stores/technology.ts`: `unlockedParts[]`, `sciencePoints`
- [ ] `stores/economy.ts`: `funding`, `reputation`
- [ ] All stores persist to localStorage via Pinia persist plugin

#### T-008: 2D Orbital Mechanics Composable
**Description:** Create `composables/useOrbit.ts` implementing patched conics orbital mechanics for a single body (Earth).

**Acceptance Criteria:**
- [ ] `computeOrbitalElements(position: Vec2, velocity: Vec2, mu: number): OrbitalElements` — returns `{ semiMajorAxis, eccentricity, apoapsis, periapsis, period, inclination }`
- [ ] `propagateOrbit(elements, dt): Vec2` — returns new position after dt seconds (Keplerian propagation)
- [ ] `isStableOrbit(elements): boolean` — returns true if periapsis > 80 km (Earth atmosphere cleared)
- [ ] Unit tested with known values: circular orbit at 400 km → apoapsis = periapsis = 400 km ± 0.1 km

#### T-009: 3D Physics Extension
**Description:** Extend `usePhysics.ts` to support 2D planar flight with user-controlled pitch (gravity-turn capable).

**Acceptance Criteria:**
- [ ] `FlightData` type extended with: `positionX`, `positionY` (km from Earth center), `velocityX`, `velocityY`, `pitchAngle` (deg)
- [ ] `update()` uses vector gravity (toward Earth center, not just vertical)
- [ ] Thrust applied along `pitchAngle` direction
- [ ] Drag applied opposing velocity vector
- [ ] Existing Prologue physics (`altitude`, `velocity` scalars) still works unchanged (backward compatible)

#### T-010: Flight Page
**Description:** Create `pages/flight.vue` with full free-flight mode using Three.js scene.

**Acceptance Criteria:**
- [ ] Route `/flight` accessible
- [ ] Loads hardcoded "starter rocket" blueprint (Falcon 9 equivalent) from constants if no craft in Pinia
- [ ] Game loop: `requestAnimationFrame` → physics update → renderer update
- [ ] WASD pitch/yaw control changes `flightData.pitchAngle`
- [ ] Shift/Ctrl throttle up/down (capped 0–100%)
- [ ] Space = stage (triggers stage separation from Pinia craft blueprint)
- [ ] Render: rocket mesh tracked to `positionX/Y`, camera follows rocket

#### T-011: Flight HUD
**Description:** Create the flight HUD component matching the screen definition.

**Acceptance Criteria:**
- [ ] Speed display (m/s, surface velocity magnitude)
- [ ] Altitude display (km above sea level)
- [ ] Throttle bar + percentage
- [ ] Fuel bar (current stage)
- [ ] Stage number indicator
- [ ] AP / PE readout (computed from `useOrbit.computeOrbitalElements`)
- [ ] Time warp buttons (1×, 5×, 10×, 50×, 100×) — each scales `dt` multiplier
- [ ] Game date/time in top bar (computed from `gameStartDate + elapsed * warpAccumulator`)
- [ ] [M] button visible (navigates to `/map` — placeholder for now)

#### T-012: Navball Component
**Description:** Create a `components/Navball.vue` — a 3D rendered sphere showing orientation.

**Acceptance Criteria:**
- [ ] Sphere rendered with Three.js in an offscreen 128×128 canvas (or inline SVG approximation)
- [ ] Brown lower hemisphere (ground), blue upper hemisphere (sky), white horizon line
- [ ] Prograde marker (yellow circle) positioned based on velocity vector direction
- [ ] Retrograde marker (yellow ×) on opposite side
- [ ] Rotates correctly as rocket pitches/yaws
- [ ] Embedded in flight HUD, always visible

#### T-013: Orbit Detection & Achievement
**Description:** Detect when the player achieves a stable orbit and show result overlay.

**Acceptance Criteria:**
- [ ] Poll orbital elements every 5 physics frames
- [ ] Stable orbit = `periapsis > 80 km && apoapsis < 2000 km` (LEO)
- [ ] On first stable orbit detection: show "STABLE ORBIT ACHIEVED" overlay with orbital stats
- [ ] Achievement `first-orbit` stored in `game.achievements`
- [ ] Kardashev score updated: `kardashevScore = max(kardashevScore, 0.701)`
- [ ] Overlay has buttons: [CONTINUE IN ORBIT] (dismisses overlay) and [RETURN TO HUB]

---

### Version 0.3 — Hangar Builder

**Goal:** Player can build a custom rocket in the Hangar, launch it into flight.

**Deliverable:** Functional `/hangar` page with part placement, stats calculation, save/load, and launch.

---

#### T-014: Part Data Definitions
**Description:** Define all Era 0 parts as TypeScript constants.

**Acceptance Criteria:**
- [ ] `data/parts.ts` exports `PARTS: PartDefinition[]`
- [ ] Each part: `{ id, name, category, mass, dryMass, thrust?, isp?, fuelCapacity?, attachTop, attachBottom, attachRadial, era }`
- [ ] Minimum 12 parts: Command pod, Crew capsule, Probe core, Small tank, Medium tank, Large tank, Merlin engine, Merlin Vacuum, Small decoupler, Large decoupler, Landing legs, Grid fins, Heat shield, Basic fin
- [ ] All Era 0 parts unlocked by default; Era 1+ locked

#### T-015: Hangar Page Layout
**Description:** Create `pages/hangar.vue` with three-panel layout (parts, 3D viewport, stats).

**Acceptance Criteria:**
- [ ] Three-column layout renders correctly at 1280×800 and 1920×1080
- [ ] Part catalog panel: scrollable list of `PARTS`, grouped by category, locked parts greyed
- [ ] Stats panel: mass, TWR, total ΔV (empty values shown as "—" if no craft)
- [ ] Bottom bar: buttons (New, Save, Load, Symmetry, Launch)
- [ ] Navigates to `/hub` on back button

#### T-016: Part Placement in 3D Viewport
**Description:** Implement click-to-place parts in the 3D hangar viewport.

**Acceptance Criteria:**
- [ ] Three.js scene initialized with floor grid (10×10 m, 1 m cells)
- [ ] Clicking a part in catalog "holds" it — a ghost mesh follows mouse in viewport
- [ ] Clicking in the viewport places the part at the snapped position
- [ ] Parts stack vertically: new part snaps to top or bottom attachment point of existing parts
- [ ] Selected part highlighted with outline / emissive tint
- [ ] Backspace/Delete removes selected part
- [ ] Orbit controls (right-click drag = rotate, scroll = zoom) when no part is held

#### T-017: Center of Mass & Thrust Indicators
**Description:** Show CoM and CoT overlaid on the 3D viewport.

**Acceptance Criteria:**
- [ ] `computeCoM(parts): Vector3` — weighted average of all part positions by mass
- [ ] `computeCoT(parts): Vector3` — average thrust vector direction from all engines
- [ ] CoM shown as red sphere in viewport (updates live as parts are placed/removed)
- [ ] CoT shown as blue arrow from bottom engine
- [ ] CoM/CoT offset distance displayed in stats panel in meters
- [ ] Yellow warning in stats if offset > 0.5 m

#### T-018: Delta-V Calculator
**Description:** Compute and display ΔV per stage and total.

**Acceptance Criteria:**
- [ ] `computeDeltaV(stages: Stage[]): number[]` — uses Tsiolkovsky: `ΔV = Isp × g₀ × ln(wetMass / dryMass)`
- [ ] Staging auto-computed: parts below a decoupler form a stage; decoupler fires separates it
- [ ] Stats panel shows ΔV per stage and total ΔV
- [ ] TWR at sea level shown per stage and at liftoff
- [ ] Warning shown if total ΔV < 9400 m/s (Earth orbit minimum)

#### T-019: Save / Load Craft
**Description:** Save and load craft blueprints to localStorage.

**Acceptance Criteria:**
- [ ] Save: name prompt → stores `CraftBlueprint` JSON in Pinia `craft.savedCrafts` (auto-persisted)
- [ ] Load: shows grid of saved crafts (name, ΔV, mass, date saved); click to load into viewport
- [ ] New: confirms if unsaved changes → clears viewport
- [ ] Craft blueprint format matches `CraftBlueprint` interface from PRD-FULL-GAME.md

#### T-020: Launch Validation & Transition
**Description:** Validate craft before launch and transition to flight with blueprint.

**Acceptance Criteria:**
- [ ] Validation checks: has engine, has command module, TWR > 1.0, has fuel
- [ ] Blocking errors shown as red toast (cannot launch)
- [ ] Warnings shown as yellow toast (can launch with confirmation)
- [ ] On launch: stores `craft.activeCraft = blueprint` in Pinia
- [ ] Navigates to `/flight` — flight page loads craft from `craft.activeCraft`
- [ ] Flight physics initialized from craft blueprint (mass, engine count, fuel, staging)

---

### Version 0.4 — Map View & Manoeuvre Nodes

**Goal:** Full orbital map with trajectory visualization and manoeuvre node planning.

**Deliverable:** `/map` overlay on flight page with node editing and burn execution.

---

#### T-021: Map View Component
**Description:** Create `components/MapView.vue` — a full-screen orbital map overlay.

**Acceptance Criteria:**
- [ ] Press M in flight → MapView overlays on top of 3D scene (same route, CSS overlay)
- [ ] Press M again or click [RETURN TO FLIGHT] → MapView hides
- [ ] Three.js canvas in MapView is separate from flight canvas (uses CSS `pointer-events`)
- [ ] Earth rendered as circle sized to visual radius with label
- [ ] Moon rendered at correct relative position with label
- [ ] Active vessel rendered as glowing dot on its orbit

#### T-022: Orbit Path Rendering
**Description:** Render conic section orbit paths in the map view.

**Acceptance Criteria:**
- [ ] `computeOrbitPoints(elements, numPoints=360): Vec2[]` — samples the orbit ellipse
- [ ] Orbit rendered as `THREE.Line` with white color for active vessel
- [ ] Orbit updates every 0.5 s based on current physics state
- [ ] If orbit is hyperbolic (escape trajectory): renders as open arc (parabola approximation)
- [ ] SOI boundary circle rendered for Earth and Moon as dashed circles

#### T-023: Manoeuvre Node Placement
**Description:** Let player click on their orbit path to place a manoeuvre node.

**Acceptance Criteria:**
- [ ] Raycasting from mouse click to orbit path (within 10 px tolerance)
- [ ] Click on orbit → places manoeuvre node at that orbital position (stored in Pinia `trajectory.nodes[]`)
- [ ] Node rendered as blue diamond on the orbit path
- [ ] Only one node allowed at a time in v0.4

#### T-024: Node ΔV Editor (Drag Handles)
**Description:** Drag handles on the manoeuvre node to set ΔV components.

**Acceptance Criteria:**
- [ ] Three drag handles at the node position: prograde (yellow), normal (green), radial (purple)
- [ ] Dragging prograde handle: increments `node.prograde` by drag distance × sensitivity
- [ ] Predicted orbit (orange ellipse) recomputes in real time as handles are dragged
- [ ] Node info panel shows: prograde ΔV, total ΔV, burn duration, time to node
- [ ] Burn duration computed: `burnTime = (ΔV × mass) / thrust` (using current stage TWR)

#### T-025: Computer Panel (Sidebar)
**Description:** Right sidebar in Map view with orbital elements and quick-action buttons.

**Acceptance Criteria:**
- [ ] Shows current orbital elements: AP, PE, inclination, period, eccentricity
- [ ] Shows active node details when a node is placed
- [ ] [CIRCULARIZE AT AP] button: auto-places a prograde node at current apoapsis with correct ΔV to circularize
- [ ] [HOHMANN] button + target altitude input: auto-places two nodes for a Hohmann transfer
- [ ] All buttons disabled if no active vessel in flight

#### T-026: Manoeuvre Node Execution
**Description:** Player can execute a manoeuvre node — SAS aligns to burn direction, engine fires.

**Acceptance Criteria:**
- [ ] Press N in flight view → "Node Execute" mode
- [ ] Flight view shows countdown to node: "NODE IN 01:23"
- [ ] When < 60 s to node: SAS auto-aligns to prograde burn direction (if SAS on)
- [ ] At node time: engine fires automatically at appropriate throttle
- [ ] Burn progress bar shows in HUD: "BURN: 45% complete"
- [ ] Node auto-completes when ΔV spent = node ΔV (± 5% tolerance)
- [ ] Node removed from Pinia after completion

---

### Version 0.5 — Game Clock & Time System

**Goal:** Implement the full time system: real start date, in-game time tracking, all warp rates, calendar consequences.

**Deliverable:** Game clock visible everywhere, time warp functional at all rates, launch windows calculable.

---

#### T-027: Game Clock System
**Description:** Implement the in-game clock that starts at player's real launch date and advances at warp rate.

**Acceptance Criteria:**
- [ ] `game.gameStartDate`: ISO8601 string stored in Pinia when prologue completes
- [ ] `game.inGameDate`: computed = `gameStartDate + (realElapsedMs × warpRate)` — updated every frame
- [ ] `game.warpRate`: current warp multiplier (1, 5, 10, 50, 100, 1000, 10000, 100000, 1000000)
- [ ] `game.missionElapsedSeconds`: total simulated seconds since game start
- [ ] Game date displayed in Hub, Flight, and Map views in format `YYYY-MM-DD HH:MM:SS UTC`

#### T-028: Warp Rate Controls & Constraints
**Description:** Implement all warp rates with automatic constraint enforcement.

**Acceptance Criteria:**
- [ ] Warp rates: 1×, 5×, 10×, 50×, 100×, 1k×, 10k×, 100k×, 1M×
- [ ] Keyboard: `.` increases warp one step, `,` decreases one step
- [ ] Visual: current warp rate highlighted in HUD bottom bar
- [ ] Auto-limit: warp cannot exceed 10× if altitude < 80 km (atmosphere) — show warning toast
- [ ] Auto-pause at: upcoming SOI change (< 30 s), manoeuvre node (< 60 s), atmospheric entry
- [ ] At 1M×: physics sub-stepped (100 steps per frame max) to prevent instability

#### T-029: Time-Scaled Physics
**Description:** Ensure all physics, animations, and audio correctly scale with warp rate.

**Acceptance Criteria:**
- [ ] Physics `dt` multiplied by current warp rate (max per-frame dt capped to prevent explosion)
- [ ] Engine flame particle speed and opacity scale with warp
- [ ] Audio paused at warp > 10× (no high-pitched engine sounds at warp)
- [ ] Game date in top bar updates visibly fast at high warp (clearly shows time passing)
- [ ] Orbital decay (if any) accumulates correctly at all warp rates

---

### Version 1.0 — Moon Campaign

**Goal:** Player can plan and execute a Moon mission: TLI, lunar orbit insertion, landing, return.

**Deliverable:** Moon body in physics/renderer, TLI wizard, lunar landing, "Moonwalker" achievement.

---

#### T-030: Moon Body
**Description:** Add the Moon as a real physics body with SOI, gravity, and visual.

**Acceptance Criteria:**
- [ ] Moon added to `CELESTIAL_BODIES` constant: `{ radius: 1737000, mu: 4.9e12, soi: 66e6, parent: 'earth' }`
- [ ] Moon orbits Earth at 384,400 km with correct period (27.3 days) computed from real start date
- [ ] Moon rendered in 3D scene (sphere, textured, visible from Earth orbit at correct position)
- [ ] Moon rendered in Map view at correct position relative to Earth
- [ ] SOI boundary shown in Map view (66,000 km circle around Moon)

#### T-031: SOI Transitions
**Description:** Implement sphere-of-influence transitions — vessel switches gravitational parent when it crosses a SOI boundary.

**Acceptance Criteria:**
- [ ] `checkSOITransition(vessel, bodies)` runs every physics frame
- [ ] When vessel enters Moon SOI: `vessel.parentBody` switches from `earth` to `moon`
- [ ] Orbital elements recomputed relative to Moon after transition
- [ ] Notification shown: "ENTERING MOON SOI" banner at top of screen
- [ ] Map view automatically switches focus to Moon when in its SOI

#### T-032: TLI Hohmann Wizard
**Description:** "Transfer to Moon" button in Map view that auto-plans a Trans-Lunar Injection trajectory.

**Acceptance Criteria:**
- [ ] [TRANSFER TO MOON] button appears in Map computer panel when in Earth orbit
- [ ] Computes correct TLI burn: prograde burn at current orbit AP to reach Moon intercept
- [ ] Places node at optimal position on current orbit
- [ ] Shows predicted trajectory arc that intersects Moon SOI (dashed orange line)
- [ ] Estimated flight time shown (approx 3–5 days depending on orbit)

#### T-033: Lunar Landing
**Description:** Implement landing on the Moon's surface with appropriate physics (no atmosphere).

**Acceptance Criteria:**
- [ ] Moon surface detection: vessel altitude relative to Moon center vs Moon radius
- [ ] No drag on Moon (atmosphere density = 0)
- [ ] Landing legs must be deployed (L key) before touchdown — legs lower mesh visually
- [ ] Touchdown at < 5 m/s: "MOON LANDING" success overlay
- [ ] Touchdown at > 5 m/s: crash (vessel destroyed, mission failed)
- [ ] Achievement: "MOONWALKER" stored in Pinia if first successful Moon landing

#### T-034: Era 1 Unlock & Discovery Overlay
**Description:** Show discovery overlay on first Moon SOI entry and unlock Era 1 tech + objectives.

**Acceptance Criteria:**
- [ ] One-time trigger: first time `vessel.parentBody === 'moon'` → show Discovery overlay
- [ ] Overlay shows: Moon stats, science earned (◆ 150), Kardashev update to K-0.720
- [ ] "ERA 1 UNLOCKED: LUNAR AMBITION" shown in overlay
- [ ] Era 1 parts unlocked in technology store (Lunar-rated heat shield, LH2 tanks, etc.)
- [ ] Era 1 objectives added to Hub objectives list

---

### Version 1.5 — Mars Campaign

**Goal:** Player can plan an Earth–Mars transfer using porkchop plot, execute EDL, land on Mars.

**Deliverable:** Mars in system, porkchop plot UI, aerobraking, Mars landing, Mars-specific achievements.

---

#### T-035: Mars Body & Solar System Scale
**Description:** Add Mars and scale the simulation to the full inner solar system.

**Acceptance Criteria:**
- [ ] Mars added to `CELESTIAL_BODIES`: `{ radius: 3390000, mu: 4.28e13, soi: 577e6, parent: 'sun' }`
- [ ] Sun added as gravitational center (mu: 1.327e20)
- [ ] Earth and Mars orbit the Sun using real semi-major axes and eccentricities
- [ ] Solar system Map view shows Earth + Mars orbits around Sun (zoomable from Earth-scale to solar-scale)
- [ ] Mars rendered in 3D scene (textured sphere, visible as a dot from Earth orbit)

#### T-036: Porkchop Plot UI
**Description:** Transfer window calculator with porkchop plot visualization for Earth–Mars.

**Acceptance Criteria:**
- [ ] [PLAN MARS TRANSFER] button in Map computer panel when in Earth orbit
- [ ] Opens a full-screen "Transfer Calculator" overlay
- [ ] Grid shows launch date (X axis, next 36 months) vs arrival date (Y axis)
- [ ] Each cell colored: green = low ΔV, yellow = medium, red = high ΔV
- [ ] Click any cell → shows: departure date, arrival date, total ΔV, flight time
- [ ] [USE THIS WINDOW] → auto-generates departure and arrival manoeuvre nodes

#### T-037: Atmospheric Aerobraking (Mars)
**Description:** Mars thin atmosphere slows the vessel during periapsis pass — aerobraking.

**Acceptance Criteria:**
- [ ] Mars atmosphere defined: scale height 11 km, sea level density 0.015 kg/m³
- [ ] When vessel enters Mars atmosphere (< 200 km): drag applied using Mars atmosphere profile
- [ ] Heat flux computed; if no heat shield equipped and velocity > 4000 m/s in atmosphere: vessel destroyed
- [ ] Aerobraking pass changes orbit (reduces AP) — player can do multiple passes to gradually capture
- [ ] Heat indicator in HUD during aerobraking (shield integrity %)

#### T-038: Mars Landing & EDL
**Description:** Full Entry-Descent-Landing sequence on Mars with parachute and retropropulsion.

**Acceptance Criteria:**
- [ ] Parachute part available (Era 2 unlock): deploys at < 400 m/s and < 30 km altitude (Mars atmosphere)
- [ ] Parachute gives drag: slows from ~400 m/s to ~60 m/s at ~5 km altitude
- [ ] Retropropulsion from ~5 km altitude to touchdown (player controls throttle)
- [ ] Landing legs required for touchdown
- [ ] Touchdown < 3 m/s: "MARS LANDING" success + "RED ROVER" achievement + K-0.750
- [ ] Achievement: "RED ROVER" — first Mars landing

---

### Version 2.0 — Outer Solar System & Kardashev Spine

**Goal:** All planets accessible, gravity assists functional, Kardashev score visible and meaningful, asteroid mining, tech tree fully functional.

**Deliverable:** Full solar system, gravity assist calculator, full tech tree UI, Kardashev progression visible end-to-end.

---

#### T-039: All Solar System Bodies
- [ ] Add Jupiter, Saturn (with rings), Uranus, Neptune with correct orbits
- [ ] Add major moons: Io, Europa, Ganymede, Callisto, Titan, Triton
- [ ] Each body has: radius, mu, SOI, atmosphere profile (or none), surface texture
- [ ] All bodies shown in solar-scale Map view
- [ ] Discovery overlay triggers on first SOI entry for each body

#### T-040: Gravity Assist Trajectories
- [ ] `computeGravityAssist(inbound, body): { outbound, deltaV }` — computes slingshot result
- [ ] Map view shows predicted post-flyby trajectory (orange dashed arc through body SOI)
- [ ] Achievement: "GRAVITY MASTER" for first successful gravity assist within 50 km of planned periapsis

#### T-041: Tech Tree Page (Full)
- [ ] All 6 era tiers rendered as branching graph
- [ ] Science points earned from: first body contact, returning samples, deploying science instruments
- [ ] Research takes in-game time (24 hours to 5 years depending on tech tier) — progress bar
- [ ] Unlocking a tech: new parts appear in Hangar catalog immediately

#### T-042: Kardashev Score UI & Milestones
- [ ] Kardashev score shown prominently in Hub (large display)
- [ ] Score updates in real time as milestones are achieved
- [ ] Milestones trigger full-bleed cinematic overlay: "K-0.720 — LUNAR AMBITION BEGINS"
- [ ] Progress bar in Hub from current K to next milestone

#### T-043: Asteroid Mining
- [ ] Asteroid belt procedurally generated in orbital band between Mars and Jupiter
- [ ] Mining rig part (Era 3): if landed on asteroid, produces resources over time (in-game days)
- [ ] Resources: water (fuel precursor), metals (construction), rare elements (tech unlock catalyst)
- [ ] Achievement: resource shipped back to Earth orbit first time

#### T-044: Communication Delay System
- [ ] `computeSignalDelay(vesselPosition): seconds` — returns one-way light travel time
- [ ] Delay displayed in HUD for all vessels beyond Moon distance
- [ ] At delay > 60 s: SAS must be in autonomous mode (player cannot manually steer)
- [ ] "SIGNAL LOST" indicator when vessel is behind a planet (line-of-sight blocked)

---

## Functional Requirements

- FR-1: Game clock starts at exact real-world date when player first launches and is always visible
- FR-2: All screen transitions preserve game state (Pinia persisted to localStorage)
- FR-3: Player cannot access Era N+1 screens/parts until Era N milestone is achieved
- FR-4: Physics simulation must maintain < 16 ms frame time on mid-range hardware
- FR-5: Manoeuvre node burns execute within ±5% of planned ΔV
- FR-6: Each new celestial body first contact triggers a discovery overlay (one-time)
- FR-7: All achievements are stored in Pinia and survive page reloads
- FR-8: Time warp auto-pauses within 60 seconds of: SOI transition, manoeuvre node, atmospheric entry
- FR-9: The Prologue (current game) must function identically after all changes
- FR-10: The Hangar builder must show a launch-blocking warning if TWR < 1.0 at liftoff

---

## Non-Goals

- Multiplayer or leaderboards (future)
- Mobile / touch support
- Procedural star systems beyond the real solar system
- VR mode
- Modding API
- Real-time weather or dynamic clouds on Earth
- Crew EVA gameplay (milestone events only)
- Voice acting or localization

---

## Technical Considerations

- All new pages added to Nuxt router; existing `/` (prologue) untouched
- Three.js scenes must be properly disposed on route change to prevent memory leaks
- Pinia stores use `persist: true` with localStorage adapter
- Physics loop decoupled from render loop (fixed 60 Hz physics, variable render)
- Orbital mechanics solver must handle all eccentricities 0 < e < 1 (elliptic) and e ≥ 1 (hyperbolic escape)
- Time warp > 1000× requires sub-stepped physics (multiple physics ticks per render frame)

---

## Success Metrics

- v0.1: Player can complete booster landing and reach Hub in a single session
- v0.2: Player can achieve stable LEO orbit with custom controls in < 15 minutes
- v0.3: Player can build and launch a rocket in Hangar in < 5 minutes
- v0.4: Player can plan and execute a Hohmann transfer using Map view
- v1.0: Player can land on the Moon without prior external knowledge
- v1.5: Player can execute an Earth–Mars transfer using the porkchop plot
- v2.0: Kardashev score visible and advancing in real time with player actions

---

## Open Questions

1. Should the hangar use 3D part meshes from day one or start with primitive geometry (cylinders/cones) and upgrade later?
2. At v0.2, should free flight be 2D (equatorial plane only) or full 3D? 3D is more realistic but much harder to control.
3. Should the porkchop plot be precomputed for fixed years (2026–2040) or computed dynamically from the game start date?
4. How do we handle the case where the player's game clock diverges significantly from real time due to time warp?
