import { Grid, PresentationControls } from '@react-three/drei';

import { RocketVisual } from '@/components/canvas/RocketVisual';
import { useBuilderStore } from '@/state/useBuilderStore';

export const BuilderScene = () => {
  const sections = useBuilderStore((state) => state.parts);
  const blueprint = useBuilderStore((state) => state.blueprint);

  return (
    <group>
      <ambientLight intensity={0.85} />
      <directionalLight position={[20, 30, 10]} intensity={1.2} castShadow />
      <directionalLight position={[-25, 20, -10]} intensity={0.4} color={0x88aaff} />
      <PresentationControls
        global
        rotation={[0, Math.PI / 6, 0]}
        polar={[-0.1, Math.PI / 5]}
        azimuth={[-Math.PI / 4, Math.PI / 4]}
      >
        <group position={[0, 0, 0]}>
          <RocketVisual sections={sections} mode="grounded" />
          <LaunchTable />
        </group>
      </PresentationControls>
      <Grid args={[80, 80]} sectionSize={2} sectionColor={0x2a2a3b} cellColor={0x1b1b24} fadeDistance={60} infiniteGrid />
      <FloorPlate />
      <Halo height={blueprint.height} />
    </group>
  );
};

const LaunchTable = () => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <cylinderGeometry args={[7, 7, 0.3, 64]} />
      <meshStandardMaterial color="#202332" roughness={0.8} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
      <cylinderGeometry args={[5, 5.5, 0.4, 32]} />
      <meshStandardMaterial color="#3c415e" roughness={0.6} metalness={0.2} />
    </mesh>
  </group>
);

const FloorPlate = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
    <planeGeometry args={[200, 200]} />
    <meshStandardMaterial color="#0c0f1d" />
  </mesh>
);

const Halo = ({ height }: { height: number }) => (
  <mesh position={[0, height + 4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[6, 6.2, 64]} />
    <meshBasicMaterial color="#52ffa8" transparent opacity={0.15} />
  </mesh>
);
