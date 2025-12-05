import { Suspense, useMemo } from 'react';

import { Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { Vector3 } from 'three';

import type { Blueprint } from '@/lib/rocketParts';

import { LaunchPad } from './LaunchPad';
import { LightingRig } from './LightingRig';
import { Planet } from './Planet';
import { Rocket } from './Rocket';
import { BuilderScene } from './BuilderScene';
import { useSimulationStore } from '@/state/useSimulationStore';

export const SpaceScene = () => {
  const phase = useSimulationStore((state) => state.phase);
  const blueprint = useSimulationStore((state) => state.blueprint);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [25, 18, 40], fov: 45, near: 0.1, far: 2000 }}>
      <color attach="background" args={[0.015, 0.02, 0.05]} />
      <fog attach="fog" args={[0x05060a, 80, 320]} />
      <Suspense fallback={null}>
        {phase === 'hangar' ? <BuilderScene /> : <FlightWorld blueprintKey={blueprint.signature} blueprint={blueprint} />}
      </Suspense>
      <CameraRig />
    </Canvas>
  );
};

const FlightWorld = ({ blueprint, blueprintKey }: { blueprint: Blueprint; blueprintKey: string }) => (
  <>
    <Planet />
    <Physics gravity={[0, -9.81, 0]} allowSleep={false} iterations={12} broadphase="SAP">
      <LaunchPad />
      <Rocket key={blueprintKey} blueprint={blueprint} />
    </Physics>
    <LightingRig />
    <Stars radius={400} depth={60} count={7000} factor={6} saturation={0} fade speed={0.5} />
  </>
);

const CameraRig = () => {
  const { camera } = useThree();
  const phase = useSimulationStore((state) => state.phase);
  const targetArray = useSimulationStore((state) => state.cameraTarget);

  const targetVector = useMemo(() => new Vector3(), []);
  const desiredPosition = useMemo(() => new Vector3(), []);
  const tempTarget = useMemo(() => new Vector3(), []);
  const followOffset = useMemo(() => new Vector3(18, 12, 20), []);
  const elevationOffset = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    if (phase === 'hangar') {
      tempTarget.set(0, 6, 0);
      targetVector.lerp(tempTarget, 1 - Math.exp(-delta * 3));
      desiredPosition.set(-18, 14, 24);
    } else {
      tempTarget.fromArray(targetArray);
      targetVector.lerp(tempTarget, 1 - Math.exp(-delta * 6));
      const altitudeBoost = Math.min(targetVector.y * 0.03, 45);
      elevationOffset.set(0, altitudeBoost, 0);
      desiredPosition.copy(targetVector).add(followOffset).add(elevationOffset);
    }

    camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 3));
    camera.lookAt(targetVector);
  });

  return null;
};
