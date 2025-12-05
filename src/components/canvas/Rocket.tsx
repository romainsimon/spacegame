import { useEffect, useMemo, useRef } from 'react';

import { useBox } from '@react-three/cannon';
import { useFBX } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Euler, Group, MathUtils, Mesh, Quaternion, Vector3 } from 'three';

import { useRocketInput } from '@/hooks/useRocketInput';
import { FUEL_BURN_RATE, MAX_THRUST, METERS_PER_UNIT } from '@/lib/constants';
import { estimateOrbitalParameters } from '@/lib/orbits';
import { useSimulationStore } from '@/state/useSimulationStore';

const tempVector = new Vector3();
const tempQuaternion = new Quaternion();
const tempEuler = new Euler();

const useRocketModel = () => {
  const fbx = useFBX('/3d/soyuz/Soyuz_TMA.fbx');
  return useMemo(() => {
    const clone = fbx.clone(true);
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [fbx]);
};

export const Rocket = () => {
  const rocketScene = useRocketModel();
  const consumeFuel = useSimulationStore((state) => state.consumeFuel);
  const setTelemetry = useSimulationStore((state) => state.setTelemetry);
  const setAttitude = useSimulationStore((state) => state.setAttitude);
  const setThrustPower = useSimulationStore((state) => state.setThrustPower);

  const velocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const smoothedThrottleRef = useRef(0);

  const [ref, api] = useBox<Group>(() => ({
    args: [2, 10, 2],
    mass: 26_000,
    position: [0, 8, 0],
    angularDamping: 0.7,
    linearDamping: 0.08,
  }));

  useEffect(() => {
    const unsubscribe = api.velocity.subscribe((velocity) => {
      velocityRef.current = velocity;
    });
    return unsubscribe;
  }, [api.velocity]);

  useRocketInput();

  useFrame((_, delta) => {
    const { throttle, fuel, stabilityAssist } = useSimulationStore.getState();
    const effectiveThrottle = fuel > 0 ? throttle : 0;
    const smoothing = 1 - Math.exp(-delta * 6);
    smoothedThrottleRef.current = MathUtils.lerp(
      smoothedThrottleRef.current,
      effectiveThrottle,
      smoothing
    );
    const thrustPower = smoothedThrottleRef.current;
    setThrustPower(thrustPower);
    const thrust = thrustPower * MAX_THRUST;

    if (thrust > 0) {
      api.applyForce([0, thrust, 0], [0, -4, 0]);
      consumeFuel(delta * thrustPower * FUEL_BURN_RATE);
    }

    if (stabilityAssist) {
      api.angularVelocity.set(0, 0, 0);
    }

    const worldPosition = ref.current?.getWorldPosition(tempVector);
    if (!worldPosition) return;

    const altitudeUnits = Math.max(0, worldPosition.y);
    const altitudeMeters = altitudeUnits * METERS_PER_UNIT;
    const velocityMeters =
      Math.hypot(...velocityRef.current) * METERS_PER_UNIT;
    const { apoapsis, periapsis } = estimateOrbitalParameters(altitudeMeters, velocityMeters);

    setTelemetry({
      altitude: altitudeMeters,
      velocity: velocityMeters,
      apoapsis,
      periapsis,
    });

    const worldQuaternion = ref.current?.getWorldQuaternion(tempQuaternion);
    if (worldQuaternion) {
      tempEuler.setFromQuaternion(worldQuaternion, 'YXZ');
      setAttitude({
        pitch: MathUtils.radToDeg(tempEuler.x),
        heading: (MathUtils.radToDeg(tempEuler.y) + 360) % 360,
        roll: MathUtils.radToDeg(tempEuler.z),
      });
    }
  });

  return (
    <group ref={ref} dispose={null}>
      <primitive object={rocketScene} scale={0.015} position={[0, -6, 0]} />
      <EnginePlume />
    </group>
  );
};

const EnginePlume = () => {
  const thrustPower = useSimulationStore((state) => state.thrustPower);
  return (
    <mesh position={[0, -10.5, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.8, 4, 32, 1, true]} />
      <meshBasicMaterial color="#ffb347" transparent opacity={0.25 + thrustPower * 0.55} />
    </mesh>
  );
};

useFBX.preload('/3d/soyuz/Soyuz_TMA.fbx');
