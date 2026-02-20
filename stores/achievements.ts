import { defineStore } from 'pinia'

export interface AchievementRecord {
  id: string
  unlockedAt: string // ISO date
}

export const useAchievementsStore = defineStore('achievements', () => {
  const unlocked = ref<AchievementRecord[]>([])

  const unlockedIds = computed(() => new Set(unlocked.value.map(a => a.id)))

  function has(id: string): boolean {
    return unlockedIds.value.has(id)
  }

  function unlock(id: string): boolean {
    if (has(id)) return false
    unlocked.value.push({ id, unlockedAt: new Date().toISOString() })
    return true
  }

  return {
    unlocked,
    unlockedIds,
    has,
    unlock,
  }
}, {
  persist: true,
})
