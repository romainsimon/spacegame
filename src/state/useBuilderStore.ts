import { create } from 'zustand';

import {
  Blueprint,
  BlueprintSection,
  DEFAULT_BLUEPRINT,
  DEFAULT_STACK,
  PART_LIBRARY,
  PartDefinition,
  PartId,
  createBlueprint,
  createPartInstance,
} from '@/lib/rocketParts';

const cloneSections = (sections: BlueprintSection[]) =>
  sections.map((section) => ({ ...section, instanceId: section.instanceId }));

type BuilderState = {
  library: PartDefinition[];
  parts: BlueprintSection[];
  selectedPart: PartId;
  blueprint: Blueprint;
  addPart: (partId: PartId) => void;
  removePart: (instanceId: string) => void;
  clear: () => void;
  setSelectedPart: (partId: PartId) => void;
  loadBlueprint: (blueprint: Blueprint) => void;
};

const initialParts = DEFAULT_BLUEPRINT.sections;

export const useBuilderStore = create<BuilderState>((set, get) => ({
  library: PART_LIBRARY,
  parts: cloneSections(initialParts),
  selectedPart: DEFAULT_STACK[1] ?? PART_LIBRARY[0].id,
  blueprint: DEFAULT_BLUEPRINT,
  addPart: (partId) => {
    const nextParts = [...get().parts, createPartInstance(partId)];
    set({ parts: nextParts, blueprint: createBlueprint(nextParts) });
  },
  removePart: (instanceId) => {
    const nextParts = get().parts.filter((part) => part.instanceId !== instanceId);
    set({ parts: nextParts, blueprint: createBlueprint(nextParts) });
  },
  clear: () => {
    const resetParts = cloneSections(DEFAULT_BLUEPRINT.sections);
    set({ parts: resetParts, blueprint: createBlueprint(resetParts) });
  },
  setSelectedPart: (partId) => set({ selectedPart: partId }),
  loadBlueprint: (blueprint) => {
    const cloned = cloneSections(blueprint.sections);
    set({ parts: cloned, blueprint: createBlueprint(cloned) });
  },
}));

export const getBlueprintFromBuilder = () => useBuilderStore.getState().blueprint;
export const resetBuilderToDefault = () => useBuilderStore.getState().clear();
