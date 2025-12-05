export const LightingRig = () => (
  <>
    <ambientLight intensity={0.4} />
    <directionalLight
      castShadow
      position={[50, 120, 30]}
      intensity={1.5}
      color={0xb4d1ff}
      shadow-camera-near={1}
      shadow-camera-far={400}
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
    />
    <directionalLight position={[-80, 40, -40]} intensity={0.4} color={0xffc8a2} />
    <pointLight position={[0, 30, 80]} intensity={0.25} />
  </>
);
