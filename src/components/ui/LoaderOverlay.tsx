import { useProgress } from '@react-three/drei';

export const LoaderOverlay = () => {
  const { active, progress } = useProgress();

  if (!active) return null;

  return (
    <div className="loader-overlay panel">
      <p>Initializing hangar...</p>
      <strong>{progress.toFixed(0)}%</strong>
    </div>
  );
};
