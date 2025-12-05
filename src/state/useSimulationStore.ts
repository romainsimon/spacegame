import { create } from 'zustand';

import { clamp } from '@/lib/math';

export type Telemetry = {
  altitude: number;
  velocity: number;
  apoapsis: number;
  periapsis: number;
};

type Phase = 'hangar' | 'launch' | 'orbit';

type SimulationState = {
  throttle: number;
  fuel: number; // 0-1 normalized
  phase: Phase;
  telemetry: Telemetry;
  setPhase: (phase: Phase) => void;
  setThrottle: (value: number) => void;
  nudgeThrottle: (delta: number) => void;
  setTelemetry: (telemetry: Partial<Telemetry>) => void;
  consumeFuel: (amount: number) => void;
  refill: () => void;
};

const initialTelemetry: Telemetry = {
  altitude: 0,
  velocity: 0,
  apoapsis: 0,
  periapsis: 0,
};

export const useSimulationStore = create<SimulationState>((set) => ({
  throttle: 0,
  fuel: 1,
  phase: 'launch',
  telemetry: initialTelemetry,
  setPhase: (phase) => set({ phase }),
  setThrottle: (value) => set({ throttle: clamp(value) }),
  nudgeThrottle: (delta) => set((state) => ({ throttle: clamp(state.throttle + delta) })),
  setTelemetry: (telemetry) => set((state) => ({ telemetry: { ...state.telemetry, ...telemetry } })),
  consumeFuel: (amount) =>
    set((state) => ({ fuel: Math.max(0, state.fuel - Math.abs(amount)) })),
  refill: () => set({ fuel: 1 }),
}));
