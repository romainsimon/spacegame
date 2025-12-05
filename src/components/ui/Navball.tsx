import { useMemo } from 'react';

import { useSimulationStore } from '@/state/useSimulationStore';

const wrapHeading = (heading: number) => {
  if (!Number.isFinite(heading)) return 0;
  const normalized = heading % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

export const Navball = () => {
  const attitude = useSimulationStore((state) => state.attitude);
  const telemetry = useSimulationStore((state) => state.telemetry);

  const heading = wrapHeading(attitude.heading);
  const pitch = attitude.pitch || 0;
  const roll = attitude.roll || 0;

  const altitudeKilometers = useMemo(() => telemetry.altitude / 1000, [telemetry.altitude]);

  return (
    <div className="panel navball-panel">
      <div className="navball">
        <div
          className="navball-horizon"
          style={{ transform: `rotate(${roll.toFixed(1)}deg) translateY(${pitch * 0.7}px)` }}
        />
        <div className="navball-heading" style={{ transform: `rotate(${-heading}deg)` }}>
          <span>{heading.toFixed(0)}°</span>
        </div>
        <div className="navball-center" />
      </div>
      <div className="navball-readouts">
        <div>
          <label>Pitch</label>
          <span>{pitch.toFixed(1)}°</span>
        </div>
        <div>
          <label>Roll</label>
          <span>{roll.toFixed(1)}°</span>
        </div>
        <div>
          <label>Altitude</label>
          <span>{altitudeKilometers.toFixed(1)} km</span>
        </div>
      </div>
    </div>
  );
};
