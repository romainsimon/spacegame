import { useEffect, useRef } from 'react';

import { useBox } from '@react-three/cannon';
import { useFrame } from '@react-three/fiber';
import { Euler, Group, MathUtils, Quaternion, Vector3 } from 'three';

import { useRocketInput } from '@/hooks/useRocketInput';
import { FUEL_BURN_RATE, METERS_PER_UNIT } from '@/lib/constants';
import { Blueprint } from '@/lib/rocketParts';
import { RocketVisual } from '@/components/canvas/RocketVisual';
import { estimateOrbitalParameters } from '@/lib/orbits';
import { useSimulationStore } from '@/state/useSimulationStore';

const tempVector = new Vector3();
const tempQuaternion = new Quaternion();
const tempEuler = new Euler();

type RocketProps = {
  blueprint: Blueprint;
};

export const Rocket = ({ blueprint }: RocketProps) => {
  const consumeFuel = useSimulationStore((state) => state.consumeFuel);
  const setTelemetry = useSimulationStore((state) => state.setTelemetry);
  const setAttitude = useSimulationStore((state) => state.setAttitude);
  const setThrustPower = useSimulationStore((state) => state.setThrustPower);
  const setCameraTarget = useSimulationStore((state) => state.setCameraTarget);

  const maxThrust = blueprint.maxThrust || 1_000_000;
  const dryMass = Math.max(10_000, blueprint.dryMass || 26_000);
  const hullHeight = Math.max(blueprint.height, 8);
  const hullRadius = Math.max(blueprint.maxRadius + 0.4, 1.1);
  const spawnHeight = hullHeight / 2 + 2;

  const velocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const smoothedThrottleRef = useRef(0);

  const [ref, api] = useBox<Group>(
    () => ({
      args: [hullRadius * 2, hullHeight, hullRadius * 2],
      mass: dryMass,
      position: [0, spawnHeight, 0],
      angularDamping: 0.7,
      linearDamping: 0.08,
    }),
    undefined,
    [hullRadius, hullHeight, dryMass, blueprint.signature]
  );

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
    const thrust = thrustPower * maxThrust;

    if (thrust > 0) {
      api.applyForce([0, thrust, 0], [0, -hullHeight / 2, 0]);
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

    setCameraTarget([worldPosition.x, worldPosition.y, worldPosition.z]);

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
      <RocketVisual sections={blueprint.sections} mode="centered" />
      <EnginePlume rocketHeight={blueprint.height} />
    </group>
  );
};

const EnginePlume = ({ rocketHeight }: { rocketHeight: number }) => {
  const thrustPower = useSimulationStore((state) => state.thrustPower);
  return (
    <mesh position={[0, -rocketHeight / 2 - 1.2, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.9, 5, 32, 1, true]} />
      <meshBasicMaterial color="#ffb347" transparent opacity={0.25 + thrustPower * 0.55} />
    </mesh>
  );
};
