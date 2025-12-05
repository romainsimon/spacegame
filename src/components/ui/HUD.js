import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { formatDistance, formatPercent, formatVelocity } from '@/lib/formatters';
import { useSimulationStore } from '@/state/useSimulationStore';
import { MusicController } from './MusicController';
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
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "panel telemetry-panel", children: _jsxs("div", { className: "telemetry-grid", children: [_jsx(TelemetryCell, { label: "Altitude", value: formatDistance(telemetry.altitude) }), _jsx(TelemetryCell, { label: "Velocity", value: formatVelocity(telemetry.velocity) }), _jsx(TelemetryCell, { label: "Apoapsis", value: formatDistance(telemetry.apoapsis) }), _jsx(TelemetryCell, { label: "Periapsis", value: formatDistance(telemetry.periapsis) }), _jsx(TelemetryCell, { label: "Fuel", value: formatPercent(fuel) })] }) }), _jsxs("div", { className: "bottom-row", children: [_jsxs("div", { className: "panel controls-panel", children: [_jsxs("div", { className: "controls-header", children: [_jsx("span", { children: "Throttle" }), _jsxs("strong", { children: [Math.round(throttle * 100), "%"] })] }), _jsx("input", { className: "slider", type: "range", min: 0, max: 100, value: Math.round(throttle * 100), onChange: (event) => setThrottle(Number(event.target.value) / 100) }), _jsx("div", { className: "controls-footer", children: controls.map((control) => (_jsxs("div", { className: "control-pill", children: [_jsx("span", { children: control.key }), _jsx("small", { children: control.action })] }, control.key))) })] }), _jsx(MusicController, {})] })] }));
};
const TelemetryCell = ({ label, value }) => (_jsxs("div", { className: "telemetry-cell", children: [_jsx("label", { children: label }), _jsx("span", { children: value })] }));
