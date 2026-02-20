import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', () => {
  // Set when player first launches (prologue → hub transition)
  const gameStartDate = ref<string | null>(null)

  // In-game elapsed seconds (accumulated, respects warp)
  const inGameElapsedSeconds = ref(0)

  // Current time warp multiplier
  const warpRate = ref(1)

  // Current era (0–6)
  const era = ref(0)

  // Kardashev civilisation score
  const kardashevScore = ref(0.700)

  // Computed in-game date string
  const inGameDate = computed(() => {
    if (!gameStartDate.value) return null
    const start = new Date(gameStartDate.value)
    const ms = inGameElapsedSeconds.value * 1000
    return new Date(start.getTime() + ms).toISOString()
  })

  function setGameStartDate(date: string) {
    gameStartDate.value = date
  }

  function advanceTime(realDeltaSeconds: number) {
    inGameElapsedSeconds.value += realDeltaSeconds * warpRate.value
  }

  function setWarpRate(rate: number) {
    warpRate.value = rate
  }

  function updateKardashev(score: number) {
    if (score > kardashevScore.value) {
      kardashevScore.value = score
    }
  }

  function unlockEra(newEra: number) {
    if (newEra > era.value) {
      era.value = newEra
    }
  }

  return {
    gameStartDate,
    inGameElapsedSeconds,
    warpRate,
    era,
    kardashevScore,
    inGameDate,
    setGameStartDate,
    advanceTime,
    setWarpRate,
    updateKardashev,
    unlockEra,
  }
}, {
  persist: true,
})
