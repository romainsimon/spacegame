import { defineStore } from 'pinia'

export interface VesselState {
  id: string
  name: string
  parentBody: string        // e.g. 'earth', 'moon', 'mars'
  altitude: number          // meters above surface
  positionX: number         // km from parent center
  positionY: number         // km from parent center
  velocityX: number         // m/s
  velocityY: number         // m/s
  mass: number              // kg
  fuel: number              // 0-1
  status: 'active' | 'landed' | 'lost'
  craftId: string           // reference to CraftBlueprint id
  missionElapsed: number    // seconds
}

export const useFleetStore = defineStore('fleet', () => {
  const vessels = ref<VesselState[]>([])
  const activeVesselId = ref<string | null>(null)

  const activeVessel = computed(() =>
    vessels.value.find(v => v.id === activeVesselId.value) ?? null,
  )

  function addVessel(vessel: VesselState) {
    vessels.value.push(vessel)
  }

  function updateVessel(id: string, update: Partial<VesselState>) {
    const idx = vessels.value.findIndex(v => v.id === id)
    if (idx >= 0) {
      vessels.value[idx] = { ...vessels.value[idx], ...update }
    }
  }

  function setActiveVessel(id: string) {
    activeVesselId.value = id
  }

  function removeVessel(id: string) {
    vessels.value = vessels.value.filter(v => v.id !== id)
    if (activeVesselId.value === id) activeVesselId.value = null
  }

  return {
    vessels,
    activeVesselId,
    activeVessel,
    addVessel,
    updateVessel,
    setActiveVessel,
    removeVessel,
  }
}, {
  persist: true,
})
