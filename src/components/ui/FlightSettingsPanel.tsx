import { useSimulationStore } from '@/state/useSimulationStore';

export const FlightSettingsPanel = () => {
  const stabilityAssist = useSimulationStore((state) => state.stabilityAssist);
  const toggleStabilityAssist = useSimulationStore((state) => state.toggleStabilityAssist);
  const thrustPower = useSimulationStore((state) => state.thrustPower);

  return (
    <div className="panel settings-panel">
      <div className="settings-header">
        <span>Flight Assist</span>
        <small>Proto v0.1</small>
      </div>
      <button
        type="button"
        className={`chip ${stabilityAssist ? 'active' : ''}`}
        onClick={toggleStabilityAssist}
      >
        {stabilityAssist ? 'Stability assist · active' : 'Stability assist · standby'}
      </button>
      <div className="thrust-meter">
        <div className="thrust-meter-fill" style={{ width: `${Math.round(thrustPower * 100)}%` }} />
      </div>
      <small className="thrust-label">Thrust output</small>
    </div>
  );
};
