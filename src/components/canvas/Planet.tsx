import { memo, useMemo } from 'react';

import { useTexture } from '@react-three/drei';
import { Color } from 'three';

import { PLANET_RADIUS_UNITS } from '@/lib/constants';

const PlanetComponent = () => {
  const texture = useTexture('/textures/earth.jpg');
  const atmosphereColor = useMemo(() => new Color('#7ed5ff'), []);

  return (
    <group position={[0, -PLANET_RADIUS_UNITS - 4, 0]}>
      <mesh receiveShadow>
        <sphereGeometry args={[PLANET_RADIUS_UNITS, 128, 128]} />
        <meshStandardMaterial map={texture} metalness={0.1} roughness={0.8} />
      </mesh>
      <mesh scale={1.03}>
        <sphereGeometry args={[PLANET_RADIUS_UNITS, 64, 64]} />
        <meshBasicMaterial color={atmosphereColor} transparent opacity={0.12} />
      </mesh>
    </group>
  );
};

export const Planet = memo(PlanetComponent);
