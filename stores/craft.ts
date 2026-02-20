import { defineStore } from 'pinia'
import type { CraftBlueprint } from '~/types/game'

export const useCraftStore = defineStore('craft', () => {
  // Currently loaded blueprint (in hangar or flight)
  const activeCraft = ref<CraftBlueprint | null>(null)

  // All saved blueprints
  const savedCrafts = ref<CraftBlueprint[]>([])

  function setActiveCraft(blueprint: CraftBlueprint) {
    activeCraft.value = blueprint
  }

  function saveCraft(blueprint: CraftBlueprint) {
    const existing = savedCrafts.value.findIndex(c => c.id === blueprint.id)
    if (existing >= 0) {
      savedCrafts.value[existing] = blueprint
    } else {
      savedCrafts.value.push(blueprint)
    }
  }

  function deleteCraft(id: string) {
    savedCrafts.value = savedCrafts.value.filter(c => c.id !== id)
  }

  function clearActiveCraft() {
    activeCraft.value = null
  }

  return {
    activeCraft,
    savedCrafts,
    setActiveCraft,
    saveCraft,
    deleteCraft,
    clearActiveCraft,
  }
}, {
  persist: true,
})
