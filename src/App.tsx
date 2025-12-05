import { SpaceScene } from '@/components/canvas/SpaceScene';
import { HUD } from '@/components/ui/HUD';
import { LoaderOverlay } from '@/components/ui/LoaderOverlay';
import { BUILD_ID, HANGAR_NAME } from '@/lib/constants';
import { useSimulationStore } from '@/state/useSimulationStore';

const App = () => {
  const phase = useSimulationStore((state) => state.phase);
  const phaseLabel = phase === 'hangar' ? 'Phase 0 · Hangar assembly' : 'Phase 0 · Launch sandbox';

  return (
    <div className="app-shell">
      <header>
        <div>
          <div className="logo">{HANGAR_NAME}</div>
          <small>Prototype build · {BUILD_ID}</small>
        </div>
        <div className="build-number">{phaseLabel}</div>
      </header>
      <main className="main-stage">
        <div className="canvas-wrapper">
          <SpaceScene />
        </div>
        <LoaderOverlay />
        <div className="hud-wrapper">
          <HUD />
        </div>
      </main>
    </div>
  );
};

export default App;
