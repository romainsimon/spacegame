import { useEffect } from 'react';
import { useSimulationStore } from '@/state/useSimulationStore';
export const useRocketInput = () => {
    const nudgeThrottle = useSimulationStore((state) => state.nudgeThrottle);
    const setThrottle = useSimulationStore((state) => state.setThrottle);
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.repeat)
                return;
            switch (event.code) {
                case 'KeyW':
                case 'ArrowUp':
                    nudgeThrottle(0.05);
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    nudgeThrottle(-0.05);
                    break;
                case 'Space':
                    setThrottle(0);
                    break;
                default:
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nudgeThrottle, setThrottle]);
};
