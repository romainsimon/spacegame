import { nanoid } from 'nanoid/non-secure';

export type PartKind = 'command' | 'fuel' | 'engine' | 'utility';
export type PartId =
  | 'command-vanguard'
  | 'tank-orbit-lt'
  | 'tank-orbit-xl'
  | 'engine-ursa'
  | 'engine-vector'
  | 'adapter-truss';

export type PartDefinition = {
  id: PartId;
  name: string;
  description: string;
  kind: PartKind;
  height: number;
  radiusTop: number;
  radiusBottom: number;
  mass: number;
  fuelCapacity?: number;
  thrust?: number;
  color: string;
  accentColor: string;
};

export type BlueprintSection = PartDefinition & {
  instanceId: string;
};

export type Blueprint = {
  sections: BlueprintSection[];
  dryMass: number;
  fuelCapacity: number;
  maxThrust: number;
  height: number;
  maxRadius: number;
  signature: string;
};

export const PART_LIBRARY: PartDefinition[] = [
  {
    id: 'command-vanguard',
    name: 'Vanguard Command Pod',
    description: '3-crew capsule with integrated RCS.',
    kind: 'command',
    height: 3,
    radiusTop: 0.5,
    radiusBottom: 1,
    mass: 2_400,
    color: '#f7b267',
    accentColor: '#ffe1c7',
  },
  {
    id: 'tank-orbit-lt',
    name: 'Orbit Fuel Tank LT',
    description: 'Light tank for orbital injection stages.',
    kind: 'fuel',
    height: 4,
    radiusTop: 1,
    radiusBottom: 1,
    mass: 4_600,
    fuelCapacity: 6_000,
    color: '#7fb7be',
    accentColor: '#cfe5ea',
  },
  {
    id: 'tank-orbit-xl',
    name: 'Orbit Fuel Tank XL',
    description: 'Heavy cryogenic tank for lift stages.',
    kind: 'fuel',
    height: 6,
    radiusTop: 1.2,
    radiusBottom: 1.2,
    mass: 7_200,
    fuelCapacity: 12_500,
    color: '#5c7cfa',
    accentColor: '#d1d7ff',
  },
  {
    id: 'adapter-truss',
    name: 'Truss Adapter',
    description: 'Structural spacer with instrumentation.',
    kind: 'utility',
    height: 2,
    radiusTop: 1.1,
    radiusBottom: 0.9,
    mass: 1_200,
    color: '#3c415e',
    accentColor: '#8e99c8',
  },
  {
    id: 'engine-ursa',
    name: 'Ursa Chemical Engine',
    description: 'Reliable sea-level chemical engine.',
    kind: 'engine',
    height: 2.5,
    radiusTop: 0.9,
    radiusBottom: 0.6,
    mass: 1_800,
    thrust: 1_400_000,
    color: '#ff8360',
    accentColor: '#ffd29d',
  },
  {
    id: 'engine-vector',
    name: 'Vector Vacuum Engine',
    description: 'High-efficiency upper stage engine.',
    kind: 'engine',
    height: 2.8,
    radiusTop: 0.8,
    radiusBottom: 0.4,
    mass: 1_400,
    thrust: 950_000,
    color: '#ffb347',
    accentColor: '#ffe29d',
  },
];

export const DEFAULT_STACK: PartId[] = ['command-vanguard', 'tank-orbit-lt', 'tank-orbit-xl', 'engine-ursa'];

export const findPartDefinition = (id: PartId) => PART_LIBRARY.find((part) => part.id === id);

export const createPartInstance = (id: PartId): BlueprintSection => {
  const definition = findPartDefinition(id);
  if (!definition) {
    throw new Error(`Unknown part id ${id}`);
  }
  return {
    ...definition,
    instanceId: nanoid(8),
  };
};

export const createBlueprint = (sections: BlueprintSection[]): Blueprint => {
  const dryMass = sections.reduce((total, section) => total + section.mass, 0);
  const fuelCapacity = sections.reduce(
    (total, section) => total + (section.fuelCapacity ?? 0),
    0
  );
  const maxThrust = sections.reduce((total, section) => total + (section.thrust ?? 0), 0);
  const height = sections.reduce((total, section) => total + section.height, 0);
  const maxRadius = sections.reduce(
    (current, section) =>
      Math.max(current, section.radiusTop ?? 0, section.radiusBottom ?? 0),
    0
  );

  return {
    sections,
    dryMass,
    fuelCapacity,
    maxThrust,
    height,
    maxRadius,
    signature: sections.map((section) => section.instanceId).join('-') || 'empty',
  };
};

export const createBlueprintFromPartIds = (ids: PartId[]): Blueprint => {
  const sections = ids.map((id) => createPartInstance(id));
  return createBlueprint(sections);
};

export const DEFAULT_BLUEPRINT = createBlueprintFromPartIds(DEFAULT_STACK);
