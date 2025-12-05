import { create } from 'zustand';

import { clamp } from '@/lib/math';

export type Telemetry = {
  altitude: number;
  velocity: number;
  apoapsis: number;
  periapsis: number;
};

export type Attitude = {
  pitch: number;
  roll: number;
  heading: number;
};

type Phase = 'hangar' | 'launch' | 'orbit';

type SimulationState = {
  throttle: number;
  thrustPower: number;
  fuel: number; // 0-1 normalized
  phase: Phase;
  telemetry: Telemetry;
  attitude: Attitude;
  stabilityAssist: boolean;
  setPhase: (phase: Phase) => void;
  setThrottle: (value: number) => void;
  nudgeThrottle: (delta: number) => void;
  setThrustPower: (value: number) => void;
  setTelemetry: (telemetry: Partial<Telemetry>) => void;
  setAttitude: (attitude: Partial<Attitude>) => void;
  setStabilityAssist: (value: boolean) => void;
  toggleStabilityAssist: () => void;
  consumeFuel: (amount: number) => void;
  refill: () => void;
};

const initialTelemetry: Telemetry = {
  altitude: 0,
  velocity: 0,
  apoapsis: 0,
  periapsis: 0,
};

const initialAttitude: Attitude = {
  pitch: 0,
  roll: 0,
  heading: 0,
};

export const useSimulationStore = create<SimulationState>((set) => ({
  throttle: 0,
  thrustPower: 0,
  fuel: 1,
  phase: 'launch',
  telemetry: initialTelemetry,
  attitude: initialAttitude,
  stabilityAssist: true,
  setPhase: (phase) => set({ phase }),
  setThrottle: (value) => set({ throttle: clamp(value) }),
  nudgeThrottle: (delta) => set((state) => ({ throttle: clamp(state.throttle + delta) })),
  setThrustPower: (value) => set({ thrustPower: clamp(value) }),
  setTelemetry: (telemetry) => set((state) => ({ telemetry: { ...state.telemetry, ...telemetry } })),
  setAttitude: (attitude) => set((state) => ({ attitude: { ...state.attitude, ...attitude } })),
  setStabilityAssist: (value) => set({ stabilityAssist: value }),
  toggleStabilityAssist: () => set((state) => ({ stabilityAssist: !state.stabilityAssist })),
  consumeFuel: (amount) =>
    set((state) => ({ fuel: Math.max(0, state.fuel - Math.abs(amount)) })),
  refill: () => set({ fuel: 1 }),
}));
