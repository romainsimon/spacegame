import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useProgress } from '@react-three/drei';
export const LoaderOverlay = () => {
    const { active, progress } = useProgress();
    if (!active)
        return null;
    return (_jsxs("div", { className: "loader-overlay panel", children: [_jsx("p", { children: "Initializing hangar..." }), _jsxs("strong", { children: [progress.toFixed(0), "%"] })] }));
};
