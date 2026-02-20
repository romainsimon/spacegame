<script setup lang="ts">
import { useGameStore } from '~/stores/game'
import { useAchievementsStore } from '~/stores/achievements'

const gameStore = useGameStore()
const achievementsStore = useAchievementsStore()

const gameDate = computed(() => {
  if (!gameStore.gameStartDate) return '—'
  return new Date(gameStore.gameStartDate).toISOString().slice(0, 19).replace('T', '  ') + ' UTC'
})

const kardashevDisplay = computed(() => gameStore.kardashevScore.toFixed(3))
</script>

<template>
  <div class="hub">
    <!-- Header bar -->
    <div class="hub-header">
      <div class="hub-header-left">
        <div class="hub-title">MISSION CONTROL</div>
        <div class="hub-date">{{ gameDate }}</div>
      </div>
      <div class="hub-header-right">
        <div class="kardashev">
          <span class="kardashev-label">KARDASHEV</span>
          <span class="kardashev-value">K-{{ kardashevDisplay }}</span>
        </div>
        <div class="era-badge">ERA 0 — FIRST STEPS</div>
      </div>
    </div>

    <!-- Main grid -->
    <div class="hub-body">
      <!-- Left: Solar system map placeholder -->
      <div class="hub-map">
        <div class="map-placeholder">
          <div class="map-label">SOLAR SYSTEM MAP</div>
          <div class="map-sublabel">Available in a future update</div>
        </div>
      </div>

      <!-- Right: Info panels -->
      <div class="hub-panels">
        <!-- Objectives -->
        <div class="panel">
          <div class="panel-title">CURRENT OBJECTIVES</div>
          <div class="panel-body">
            <div class="objective done">
              <span class="obj-icon">✓</span>
              <span class="obj-text">Achieve stable Earth orbit</span>
            </div>
            <div class="objective" :class="{ done: achievementsStore.has('first-orbit') }">
              <span class="obj-icon">►</span>
              <span class="obj-text">Land the Falcon 9 booster</span>
            </div>
            <div class="objective">
              <span class="obj-icon">·</span>
              <span class="obj-text">Deploy first satellite</span>
            </div>
          </div>
        </div>

        <!-- Next milestone -->
        <div class="panel">
          <div class="panel-title">NEXT MILESTONE</div>
          <div class="panel-body">
            <div class="milestone-name">Moon Landing — K-0.720</div>
            <div class="milestone-bar">
              <div class="milestone-fill" :style="{ width: `${((gameStore.kardashevScore - 0.700) / 0.020) * 100}%` }" />
            </div>
            <div class="milestone-pct">{{ Math.round(((gameStore.kardashevScore - 0.700) / 0.020) * 100) }}%</div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="panel">
          <div class="panel-title">NAVIGATION</div>
          <div class="panel-nav">
            <NuxtLink to="/" class="nav-btn primary">REPLAY PROLOGUE</NuxtLink>
            <button class="nav-btn disabled" disabled>HANGAR</button>
            <button class="nav-btn disabled" disabled>MAP</button>
            <button class="nav-btn disabled" disabled>TECH TREE</button>
            <button class="nav-btn disabled" disabled>CONTRACTS</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hub {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: #000;
  color: var(--spacex-text, #fff);
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  display: flex;
  flex-direction: column;
}

/* === HEADER === */
.hub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.hub-title {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.35em;
  color: rgba(255, 255, 255, 0.9);
}

.hub-date {
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
}

.hub-header-right {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kardashev {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.kardashev-label {
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.35);
}

.kardashev-value {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.9);
}

.era-badge {
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.45);
}

/* === BODY GRID === */
.hub-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.hub-map {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 400px;
}

.map-placeholder {
  text-align: center;
}

.map-label {
  font-size: 0.65rem;
  letter-spacing: 0.25em;
  color: rgba(255, 255, 255, 0.2);
  margin-bottom: 8px;
}

.map-sublabel {
  font-size: 0.55rem;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.12);
}

/* === PANELS === */
.hub-panels {
  display: flex;
  flex-direction: column;
}

.panel {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px 24px;
}

.panel-title {
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.25em;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 12px;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Objectives */
.objective {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
}

.objective.done {
  color: rgba(255, 255, 255, 0.75);
}

.obj-icon {
  font-size: 0.65rem;
  width: 14px;
  flex-shrink: 0;
}

/* Milestone */
.milestone-name {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 10px;
}

.milestone-bar {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.milestone-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.milestone-pct {
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 6px;
}

/* Navigation */
.panel-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-btn {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.25em;
  padding: 10px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  text-decoration: none;
  display: block;
  text-align: center;
  border-radius: 2px;
  transition: background 0.15s, border-color 0.15s;
}

.nav-btn.primary {
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
}

.nav-btn.primary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.nav-btn.disabled {
  opacity: 0.2;
  cursor: not-allowed;
}
</style>
