import { usePlane } from '@react-three/cannon';
import { memo } from 'react';

const LaunchPadComponent = () => {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
  }));

  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#303347" metalness={0.35} roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[18, 19.5, 64]} />
        <meshBasicMaterial color="#5f6c9e" />
      </mesh>
    </group>
  );
};

export const LaunchPad = memo(LaunchPadComponent);
