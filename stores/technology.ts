import { defineStore } from 'pinia'

export const useTechnologyStore = defineStore('technology', () => {
  const sciencePoints = ref(0)

  // IDs of unlocked tech nodes
  const unlockedTech = ref<string[]>([
    // Era 0 defaults — available from the start
    'merlin-engine',
    'basic-fuel-tank',
    'command-pod',
    'basic-decoupler',
    'basic-fin',
    'landing-legs',
    'grid-fins',
    'basic-heat-shield',
  ])

  // IDs of unlocked part definitions (may overlap with tech nodes)
  const unlockedParts = ref<string[]>([
    'merlin-engine',
    'basic-fuel-tank',
    'command-pod',
    'basic-decoupler',
    'basic-fin',
    'landing-legs',
    'grid-fins',
    'basic-heat-shield',
  ])

  function addScience(amount: number) {
    sciencePoints.value += amount
  }

  function unlockTech(id: string, cost: number): boolean {
    if (sciencePoints.value < cost) return false
    if (unlockedTech.value.includes(id)) return false
    sciencePoints.value -= cost
    unlockedTech.value.push(id)
    return true
  }

  function unlockPart(id: string) {
    if (!unlockedParts.value.includes(id)) {
      unlockedParts.value.push(id)
    }
  }

  function hasTech(id: string): boolean {
    return unlockedTech.value.includes(id)
  }

  function hasPart(id: string): boolean {
    return unlockedParts.value.includes(id)
  }

  return {
    sciencePoints,
    unlockedTech,
    unlockedParts,
    addScience,
    unlockTech,
    unlockPart,
    hasTech,
    hasPart,
  }
}, {
  persist: true,
})
