"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function Wheel({
  position,
  radius,
  width,
  spin,
}: {
  position: [number, number, number];
  radius: number;
  width: number;
  spin: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.x += delta * spin.current;
  });
  return (
    <group ref={ref} position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, width, 28]} />
        <meshStandardMaterial color="#26261f" roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh position={[0, width / 2 + 0.005, 0]}>
        <cylinderGeometry args={[radius * 0.55, radius * 0.55, 0.02, 24]} />
        <meshStandardMaterial color="#e2c88c" roughness={0.6} />
      </mesh>
      <mesh position={[0, width / 2 + 0.02, 0]}>
        <cylinderGeometry args={[radius * 0.2, radius * 0.2, 0.04, 16]} />
        <meshStandardMaterial color="#8f3f20" roughness={0.5} />
      </mesh>
      {Array.from({ length: 6 }).map((_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * radius * 0.38, width / 2 + 0.02, Math.sin(angle) * radius * 0.38]}
          >
            <boxGeometry args={[radius * 0.18, 0.03, radius * 0.09]} />
            <meshStandardMaterial color="#6f5a32" roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

function Tractor() {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(1.1);

  useFrame((state) => {
    if (!group.current) return;
    const scroll =
      typeof window !== "undefined"
        ? Math.min(1, window.scrollY / Math.max(1, window.innerHeight))
        : 0;
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      -0.35 + scroll * 1.15,
      0.04,
    );
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.035 - 0.02;
  });

  return (
    <group ref={group} position={[0, -0.35, 0]} scale={1.02}>
      {/* chassis */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[3.35, 0.34, 1.25]} />
        <meshStandardMaterial color="#1e4a34" roughness={0.55} metalness={0.15} />
      </mesh>
      {/* bonnet */}
      <mesh position={[1.02, 1.12, 0]} castShadow>
        <boxGeometry args={[1.3, 0.62, 1.06]} />
        <meshStandardMaterial color="#23543d" roughness={0.42} metalness={0.2} />
      </mesh>
      <mesh position={[1.03, 1.46, 0]} castShadow>
        <boxGeometry args={[1.16, 0.1, 0.92]} />
        <meshStandardMaterial color="#e2c88c" roughness={0.5} />
      </mesh>
      {/* grille */}
      <mesh position={[1.68, 1.08, 0]}>
        <boxGeometry args={[0.06, 0.46, 0.8]} />
        <meshStandardMaterial color="#2a2b26" roughness={0.6} />
      </mesh>
      {[-0.24, 0, 0.24].map((z) => (
        <mesh key={z} position={[1.72, 1.08, z]}>
          <boxGeometry args={[0.04, 0.34, 0.05]} />
          <meshStandardMaterial color="#e2c88c" roughness={0.4} />
        </mesh>
      ))}
      {/* cabin */}
      <group position={[-0.62, 1.36, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.18, 1.02, 1.16]} />
          <meshStandardMaterial color="#1b4633" roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <boxGeometry args={[1.02, 0.5, 1.18]} />
          <meshStandardMaterial color="#cfe0d2" roughness={0.15} metalness={0.1} transparent opacity={0.55} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[1.22, 0.12, 1.2]} />
          <meshStandardMaterial color="#e2c88c" roughness={0.5} />
        </mesh>
        <mesh position={[0.42, 0.18, 0.6]}>
          <boxGeometry args={[0.04, 0.44, 0.04]} />
          <meshStandardMaterial color="#e2c88c" />
        </mesh>
      </group>
      {/* exhaust */}
      <mesh position={[0.92, 1.78, 0.34]} castShadow>
        <cylinderGeometry args={[0.055, 0.07, 1.05, 12]} />
        <meshStandardMaterial color="#2b2b24" roughness={0.55} metalness={0.45} />
      </mesh>
      <mesh position={[0.92, 2.3, 0.34]}>
        <cylinderGeometry args={[0.09, 0.07, 0.12, 12]} />
        <meshStandardMaterial color="#2b2b24" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* headlights */}
      {[-0.34, 0.34].map((z) => (
        <mesh key={z} position={[1.73, 1.28, z]}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 16]} />
          <meshStandardMaterial color="#ffe9b0" emissive="#ffd77a" emissiveIntensity={0.55} />
        </mesh>
      ))}
      {/* wheels */}
      <Wheel position={[-0.82, 0.86, 0.78]} radius={0.86} width={0.4} spin={spin} />
      <Wheel position={[-0.82, 0.86, -0.78]} radius={0.86} width={0.4} spin={spin} />
      <Wheel position={[1.16, 0.55, 0.66]} radius={0.55} width={0.28} spin={spin} />
      <Wheel position={[1.16, 0.55, -0.66]} radius={0.55} width={0.28} spin={spin} />
      {/* seat */}
      <mesh position={[-0.32, 1.35, 0]}>
        <boxGeometry args={[0.34, 0.42, 0.5]} />
        <meshStandardMaterial color="#6f5a32" roughness={0.9} />
      </mesh>
      {/* steering */}
      <mesh position={[0.06, 1.52, 0]} rotation={[0.5, 0, 0]}>
        <torusGeometry args={[0.16, 0.03, 8, 20]} />
        <meshStandardMaterial color="#2a2b26" roughness={0.6} />
      </mesh>
    </group>
  );
}

function SoilRows() {
  const rows = useMemo(() => Array.from({ length: 9 }, (_, i) => -3.4 + i * 0.85), []);
  return (
    <group position={[0, -0.62, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 64]} />
        <meshStandardMaterial color="#8a6647" roughness={1} />
      </mesh>
      {rows.map((x) => (
        <mesh key={x} position={[x, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.18, 9.4]} />
          <meshStandardMaterial color="#6f4f35" roughness={1} />
        </mesh>
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[-3.8 + i * 1.25, 0.02, 3.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.35 + (i % 3) * 0.08, 12]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#55703f" : "#6b8450"} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Dust() {
  const points = useMemo(() => {
    // Deterministic scatter keeps the scene stable across re-renders and hydration.
    const rand = (seed: number) => {
      const value = Math.sin(seed * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    };
    const positions = new Float32Array(70 * 3);
    for (let i = 0; i < 70; i++) {
      positions[i * 3] = (rand(i + 1) - 0.5) * 9;
      positions[i * 3 + 1] = rand(i + 101) * 3.4;
      positions[i * 3 + 2] = (rand(i + 201) - 0.5) * 7;
    }
    return positions;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.03;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#f2dfb4" size={0.035} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export default function TractorScene() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows
      camera={{ position: [5.4, 3.3, 6.4], fov: 36 }}
      gl={{ antialias: true, alpha: true }}
      style={{ touchAction: "pan-y" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#f7f2e6", "#6f4f35", 0.8]} />
        <directionalLight
          position={[5, 8, 4]}
          intensity={2.1}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <pointLight position={[-4, 3, -2]} intensity={12} color="#e2c88c" distance={10} />
        <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.28}>
          <Tractor />
        </Float>
        <SoilRows />
        <Dust />
        <mesh position={[0, -0.65, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[5.1, 64]} />
          <shadowMaterial opacity={0.24} />
        </mesh>
      </Suspense>
    </Canvas>
  );
}
