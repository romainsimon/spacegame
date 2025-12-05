import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SpaceScene } from '@/components/canvas/SpaceScene';
import { HUD } from '@/components/ui/HUD';
import { LoaderOverlay } from '@/components/ui/LoaderOverlay';
import { BUILD_ID, HANGAR_NAME } from '@/lib/constants';
const App = () => (_jsxs("div", { className: "app-shell", children: [_jsxs("header", { children: [_jsxs("div", { children: [_jsx("div", { className: "logo", children: HANGAR_NAME }), _jsxs("small", { children: ["Prototype build \u00B7 ", BUILD_ID] })] }), _jsx("div", { className: "build-number", children: "Phase 0 \u00B7 Launch sandbox" })] }), _jsxs("main", { className: "main-stage", children: [_jsx("div", { className: "canvas-wrapper", children: _jsx(SpaceScene, {}) }), _jsx(LoaderOverlay, {}), _jsx("div", { className: "hud-wrapper", children: _jsx(HUD, {}) })] })] }));
export default App;
