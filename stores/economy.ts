import { defineStore } from 'pinia'

export const useEconomyStore = defineStore('economy', () => {
  // Funding in millions USD
  const funding = ref(500)

  // Reputation 0–5 stars
  const reputation = ref(3.0)

  // Energy capacity in terawatts (unlocks in Era 3+)
  const energyTW = ref(0)

  function addFunding(amount: number) {
    funding.value += amount
  }

  function spendFunding(amount: number): boolean {
    if (funding.value < amount) return false
    funding.value -= amount
    return true
  }

  function adjustReputation(delta: number) {
    reputation.value = Math.max(0, Math.min(5, reputation.value + delta))
  }

  function addEnergy(tw: number) {
    energyTW.value += tw
  }

  return {
    funding,
    reputation,
    energyTW,
    addFunding,
    spendFunding,
    adjustReputation,
    addEnergy,
  }
}, {
  persist: true,
})
