import { formatDistance, formatPercent, formatVelocity } from '@/lib/formatters';
import { useBuilderStore } from '@/state/useBuilderStore';
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
  const phase = useSimulationStore((state) => state.phase);
  return phase === 'hangar' ? <BuilderHUD /> : <FlightHUD />;
};

const FlightHUD = () => {
  const telemetry = useSimulationStore((state) => state.telemetry);
  const throttle = useSimulationStore((state) => state.throttle);
  const fuel = useSimulationStore((state) => state.fuel);
  const setThrottle = useSimulationStore((state) => state.setThrottle);
  const setPhase = useSimulationStore((state) => state.setPhase);
  const refill = useSimulationStore((state) => state.refill);

  const backToHangar = () => {
    setThrottle(0);
    refill();
    setPhase('hangar');
  };

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
          <button type="button" className="ghost-btn" onClick={backToHangar}>
            Return to hangar
          </button>
        </div>
        <FlightSettingsPanel />
        <MusicController />
      </div>
    </>
  );
};

const BuilderHUD = () => {
  const library = useBuilderStore((state) => state.library);
  const selectedPart = useBuilderStore((state) => state.selectedPart);
  const setSelectedPart = useBuilderStore((state) => state.setSelectedPart);
  const addPart = useBuilderStore((state) => state.addPart);
  const removePart = useBuilderStore((state) => state.removePart);
  const parts = useBuilderStore((state) => state.parts);
  const blueprint = useBuilderStore((state) => state.blueprint);
  const loadBlueprint = useBuilderStore((state) => state.loadBlueprint);

  const setBlueprint = useSimulationStore((state) => state.setBlueprint);
  const setPhase = useSimulationStore((state) => state.setPhase);
  const refill = useSimulationStore((state) => state.refill);
  const setThrottle = useSimulationStore((state) => state.setThrottle);

  const hasEngine = blueprint.sections.some((section) => section.kind === 'engine');
  const hasCommand = blueprint.sections.some((section) => section.kind === 'command');
  const canRollOut = hasEngine && hasCommand;
  const twr = blueprint.maxThrust / (Math.max(blueprint.dryMass, 1) * 9.81);

  const handleRollOut = () => {
    setBlueprint(blueprint);
    setThrottle(0);
    refill();
    setPhase('launch');
  };

  const handleLoadFlightBlueprint = () => {
    const flightBlueprint = useSimulationStore.getState().blueprint;
    loadBlueprint(flightBlueprint);
  };

  const removeLast = () => {
    const last = parts[parts.length - 1];
    if (last) removePart(last.instanceId);
  };

  return (
    <div className="builder-hud">
      <div className="panel builder-library">
        <div className="builder-header">
          <div>
            <span className="eyebrow">Part Catalog</span>
            <h2>Snap modules together</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={handleLoadFlightBlueprint}>
            Load current rocket
          </button>
        </div>
        <div className="parts-grid">
          {library.map((part) => (
            <button
              key={part.id}
              type="button"
              className={`part-card ${selectedPart === part.id ? 'selected' : ''}`}
              onClick={() => setSelectedPart(part.id)}
            >
              <div className="part-color" style={{ background: part.color }} />
              <div>
                <strong>{part.name}</strong>
                <p>{part.description}</p>
              </div>
              <span>{part.kind}</span>
            </button>
          ))}
        </div>
        <button type="button" className="theme" onClick={() => addPart(selectedPart)}>
          Add selected part
        </button>
      </div>

      <div className="panel builder-stack">
        <div className="builder-stack-header">
          <div>
            <span className="eyebrow">Stack</span>
            <h3>{parts.length} segments</h3>
          </div>
          <button type="button" className="ghost-btn" onClick={removeLast}>
            Remove last
          </button>
        </div>
        <ul>
          {parts.map((part) => (
            <li key={part.instanceId}>
              <span>{part.name}</span>
              <button type="button" onClick={() => removePart(part.instanceId)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel builder-summary">
        <div className="summary-row">
          <div>
            <label>Dry mass</label>
            <strong>{Math.round(blueprint.dryMass).toLocaleString()} kg</strong>
          </div>
          <div>
            <label>Max thrust</label>
            <strong>{(blueprint.maxThrust / 1000).toFixed(1)} kN</strong>
          </div>
          <div>
            <label>TWR (sea level)</label>
            <strong>{twr > 0 ? twr.toFixed(2) : '—'}</strong>
          </div>
        </div>
        <button type="button" className="theme" disabled={!canRollOut} onClick={handleRollOut}>
          Roll out to launchpad
        </button>
        {!canRollOut && <small className="warning">Add a command pod and engine to launch.</small>}
      </div>
    </div>
  );
};

const TelemetryCell = ({ label, value }: { label: string; value: string }) => (
  <div className="telemetry-cell">
    <label>{label}</label>
    <span>{value}</span>
  </div>
);
