import { useMemo } from 'react';

import type { BlueprintSection } from '@/lib/rocketParts';

const computeSectionPositions = (sections: BlueprintSection[]) => {
  const positions: number[] = [];
  let cursor = 0;
  sections.forEach((section) => {
    const center = cursor + section.height / 2;
    positions.push(center);
    cursor += section.height;
  });
  return { positions, totalHeight: cursor };
};

type RocketVisualProps = {
  sections: BlueprintSection[];
  mode?: 'grounded' | 'centered';
  accent?: boolean;
};

export const RocketVisual = ({ sections, mode = 'grounded', accent = true }: RocketVisualProps) => {
  const { positions, totalHeight } = useMemo(() => computeSectionPositions(sections), [sections]);

  const adjustedPositions = useMemo(() => {
    if (mode === 'grounded') return positions;
    const offset = totalHeight / 2;
    return positions.map((pos) => pos - offset);
  }, [mode, positions, totalHeight]);

  return (
    <group>
      {sections.map((section, index) => (
        <SectionMesh
          key={section.instanceId}
          section={section}
          positionY={adjustedPositions[index]}
          accent={accent}
        />
      ))}
    </group>
  );
};

type SectionMeshProps = {
  section: BlueprintSection;
  positionY: number;
  accent: boolean;
};

const SectionMesh = ({ section, positionY, accent }: SectionMeshProps) => {
  const { kind, color, accentColor, height, radiusTop, radiusBottom } = section;

  if (kind === 'engine') {
    return (
      <group position={[0, positionY, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[radiusTop, radiusTop, height * 0.6, 32]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, -height * 0.4, 0]} castShadow>
          <coneGeometry args={[radiusBottom, height * 0.8, 32]} />
          <meshStandardMaterial color={accentColor} metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  if (kind === 'command') {
    return (
      <group position={[0, positionY, 0]}>
        <mesh castShadow receiveShadow position={[0, height * 0.2, 0]}>
          <cylinderGeometry args={[radiusBottom, radiusBottom, height * 0.6, 48]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh castShadow position={[0, -height * 0.1, 0]}>
          <coneGeometry args={[radiusBottom, height * 0.8, 48]} />
          <meshStandardMaterial color={accentColor} metalness={0.3} roughness={0.4} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, positionY, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radiusTop, radiusBottom, height, 48]} />
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.6} />
      </mesh>
      {accent && (
        <mesh castShadow position={[0, height * 0.4, 0]}>
          <torusGeometry args={[radiusTop, 0.05, 8, 48]} />
          <meshStandardMaterial color={accentColor} metalness={0.2} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
};
