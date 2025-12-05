import { SpaceScene } from '@/components/canvas/SpaceScene';
import { HUD } from '@/components/ui/HUD';
import { LoaderOverlay } from '@/components/ui/LoaderOverlay';
import { BUILD_ID, HANGAR_NAME } from '@/lib/constants';

const App = () => (
  <div className="app-shell">
    <header>
      <div>
        <div className="logo">{HANGAR_NAME}</div>
        <small>Prototype build · {BUILD_ID}</small>
      </div>
      <div className="build-number">Phase 0 · Launch sandbox</div>
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

export default App;
