import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { Color } from 'three';
import { PLANET_RADIUS_UNITS } from '@/lib/constants';
const PlanetComponent = () => {
    const texture = useTexture('/textures/earth.jpg');
    const atmosphereColor = useMemo(() => new Color('#7ed5ff'), []);
    return (_jsxs("group", { position: [0, -PLANET_RADIUS_UNITS - 4, 0], children: [_jsxs("mesh", { receiveShadow: true, children: [_jsx("sphereGeometry", { args: [PLANET_RADIUS_UNITS, 128, 128] }), _jsx("meshStandardMaterial", { map: texture, metalness: 0.1, roughness: 0.8 })] }), _jsxs("mesh", { scale: 1.03, children: [_jsx("sphereGeometry", { args: [PLANET_RADIUS_UNITS, 64, 64] }), _jsx("meshBasicMaterial", { color: atmosphereColor, transparent: true, opacity: 0.12 })] })] }));
};
export const Planet = memo(PlanetComponent);
