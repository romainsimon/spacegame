import { formatDistance, formatPercent, formatVelocity } from '@/lib/formatters';
import { useSimulationStore } from '@/state/useSimulationStore';

import { FlightSettingsPanel } from './FlightSettingsPanel';
import { MusicController } from './MusicController';
import { Navball } from './Navball';

const controls = [
  { key: 'W / ↑', action: 'Increase throttle' },
  { key: 'S / ↓', action: 'Decrease throttle' },
  { key: 'Space', action: 'Cut engines' },
];

export const HUD = () => {
  const telemetry = useSimulationStore((state) => state.telemetry);
  const throttle = useSimulationStore((state) => state.throttle);
  const fuel = useSimulationStore((state) => state.fuel);
  const setThrottle = useSimulationStore((state) => state.setThrottle);

  return (
    <>
      <div className="top-row">
        <div className="panel telemetry-panel">
          <div className="telemetry-grid">
            <TelemetryCell label="Altitude" value={formatDistance(telemetry.altitude)} />
            <TelemetryCell label="Velocity" value={formatVelocity(telemetry.velocity)} />
            <TelemetryCell label="Apoapsis" value={formatDistance(telemetry.apoapsis)} />
            <TelemetryCell label="Periapsis" value={formatDistance(telemetry.periapsis)} />
            <TelemetryCell label="Fuel" value={formatPercent(fuel)} />
          </div>
        </div>
        <Navball />
      </div>

      <div className="bottom-row">
        <div className="panel controls-panel">
          <div className="controls-header">
            <span>Throttle</span>
            <strong>{Math.round(throttle * 100)}%</strong>
          </div>
          <input
            className="slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(throttle * 100)}
            onChange={(event) => setThrottle(Number(event.target.value) / 100)}
          />
          <div className="controls-footer">
            {controls.map((control) => (
              <div key={control.key} className="control-pill">
                <span>{control.key}</span>
                <small>{control.action}</small>
              </div>
            ))}
          </div>
        </div>
        <FlightSettingsPanel />
        <MusicController />
      </div>
    </>
  );
};

const TelemetryCell = ({ label, value }: { label: string; value: string }) => (
  <div className="telemetry-cell">
    <label>{label}</label>
    <span>{value}</span>
  </div>
);
