import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { usePlane } from '@react-three/cannon';
import { memo } from 'react';
const LaunchPadComponent = () => {
    const [ref] = usePlane(() => ({
        rotation: [-Math.PI / 2, 0, 0],
        position: [0, 0, 0],
    }));
    return (_jsxs("group", { ref: ref, children: [_jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("circleGeometry", { args: [18, 64] }), _jsx("meshStandardMaterial", { color: "#303347", metalness: 0.35, roughness: 0.8 })] }), _jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, children: [_jsx("ringGeometry", { args: [18, 19.5, 64] }), _jsx("meshBasicMaterial", { color: "#5f6c9e" })] })] }));
};
export const LaunchPad = memo(LaunchPadComponent);
