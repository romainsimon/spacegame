import { Suspense } from 'react';

import { OrbitControls, Stars } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';

import { LaunchPad } from './LaunchPad';
import { LightingRig } from './LightingRig';
import { Planet } from './Planet';
import { Rocket } from './Rocket';

export const SpaceScene = () => (
  <Canvas
    shadows
    dpr={[1, 2]}
    camera={{ position: [35, 25, 45], fov: 45, near: 0.1, far: 1000 }}
  >
    <color attach="background" args={[0.015, 0.02, 0.05]} />
    <fog attach="fog" args={[0x05060a, 80, 260]} />
    <Suspense fallback={null}>
      <Planet />
      <Physics gravity={[0, -9.81, 0]} allowSleep={false} iterations={12} broadphase="SAP">
        <LaunchPad />
        <Rocket />
      </Physics>
    </Suspense>
    <LightingRig />
    <Stars radius={400} depth={60} count={7000} factor={6} saturation={0} fade speed={0.5} />
    <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={15} maxDistance={200} enablePan={false} />
  </Canvas>
);
