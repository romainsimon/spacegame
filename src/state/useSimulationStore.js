import { create } from 'zustand';
import { clamp } from '@/lib/math';
const initialTelemetry = {
    altitude: 0,
    velocity: 0,
    apoapsis: 0,
    periapsis: 0,
};
export const useSimulationStore = create((set) => ({
    throttle: 0,
    fuel: 1,
    phase: 'launch',
    telemetry: initialTelemetry,
    setPhase: (phase) => set({ phase }),
    setThrottle: (value) => set({ throttle: clamp(value) }),
    nudgeThrottle: (delta) => set((state) => ({ throttle: clamp(state.throttle + delta) })),
    setTelemetry: (telemetry) => set((state) => ({ telemetry: { ...state.telemetry, ...telemetry } })),
    consumeFuel: (amount) => set((state) => ({ fuel: Math.max(0, state.fuel - Math.abs(amount)) })),
    refill: () => set({ fuel: 1 }),
}));
