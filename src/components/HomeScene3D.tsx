"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Float, MeshDistortMaterial, Sphere, Torus, Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";

/* ─── Floating glowing orb ─── */
function GlowOrb({ position, color, scale = 1, speed = 1 }: {
  position: [number, number, number]; color: string; scale?: number; speed?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * speed * 0.3;
    meshRef.current.rotation.y = state.clock.elapsedTime * speed * 0.5;
  });
  return (
    <Float speed={speed * 1.5} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={0.55}
          speed={speed * 2}
          roughness={0}
          metalness={0.1}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* Inner glow core */}
      <mesh position={position} scale={scale * 0.6}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
    </Float>
  );
}

/* ─── Rotating torus ring ─── */
function GlowRing({ position, color, radius = 2, tube = 0.04, speed = 1, rotX = 1, rotY = 0 }: {
  position: [number, number, number]; color: string; radius?: number; tube?: number; speed?: number; rotX?: number; rotY?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * speed * rotX;
    ref.current.rotation.y = state.clock.elapsedTime * speed * rotY;
  });
  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[radius, tube, 16, 100]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  );
}

/* ─── Particle field ─── */
function ParticleField() {
  const count = 3500;
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color("#7c3aed"),
      new THREE.Color("#4f46e5"),
      new THREE.Color("#0ea5e9"),
      new THREE.Color("#10b981"),
      new THREE.Color("#a78bfa"),
      new THREE.Color("#ffffff"),
    ];
    for (let i = 0; i < count; i++) {
      const r = 12 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.025;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} vertexColors transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}

/* ─── DNA Helix ─── */
function DNAHelix() {
  const group = useRef<THREE.Group>(null);
  const { strands1, strands2 } = useMemo(() => {
    const pts1: [number, number, number][] = [];
    const pts2: [number, number, number][] = [];
    for (let i = 0; i < 60; i++) {
      const t = (i / 60) * Math.PI * 6;
      const y = (i / 60) * 10 - 5;
      pts1.push([Math.cos(t) * 0.9, y, Math.sin(t) * 0.9]);
      pts2.push([Math.cos(t + Math.PI) * 0.9, y, Math.sin(t + Math.PI) * 0.9]);
    }
    return { strands1: pts1, strands2: pts2 };
  }, []);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.elapsedTime * 0.3;
      group.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.4;
    }
  });

  return (
    <group ref={group} position={[4.5, 0, -3]}>
      {strands1.map((pos, i) => (
        <mesh key={`s1-${i}`} position={pos}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#7c3aed" transparent opacity={0.8} />
        </mesh>
      ))}
      {strands2.map((pos, i) => (
        <mesh key={`s2-${i}`} position={pos}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#0ea5e9" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Mouse-reactive camera ─── */
function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef([0, 0]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouse.current = [
        (e.clientX / window.innerWidth  - 0.5) * 2,
        (e.clientY / window.innerHeight - 0.5) * 2,
      ];
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  useFrame(() => {
    camera.position.x += (mouse.current[0] * 1.5 - camera.position.x) * 0.04;
    camera.position.y += (-mouse.current[1] * 1.0 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ─── Root exported component ─── */
export default function HomeScene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 65 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={3} color="#7c3aed" distance={20} />
      <pointLight position={[6, 4, -6]} intensity={2} color="#0ea5e9" distance={18} />
      <pointLight position={[-6, -4, 4]} intensity={1.5} color="#10b981" distance={15} />

      {/* Star field */}
      <Stars radius={80} depth={50} count={6000} factor={3} saturation={0.4} fade speed={0.5} />

      {/* Particle cloud */}
      <ParticleField />

      {/* Main hero orbs */}
      <GlowOrb position={[0, 0, 0]}    color="#7c3aed" scale={2.0} speed={0.4} />
      <GlowOrb position={[-5, 2, -4]}  color="#4f46e5" scale={1.2} speed={0.7} />
      <GlowOrb position={[5, -2, -5]}  color="#0ea5e9" scale={1.0} speed={0.6} />
      <GlowOrb position={[-3, -3, -2]} color="#10b981" scale={0.7} speed={0.9} />
      <GlowOrb position={[3, 3.5, -3]} color="#a78bfa" scale={0.55} speed={1.1} />

      {/* Rotating rings */}
      <GlowRing position={[0,  0,  0]} color="#7c3aed" radius={3.5} tube={0.018} speed={0.18} rotX={0.5} rotY={0.3} />
      <GlowRing position={[0,  0,  0]} color="#4f46e5" radius={4.5} tube={0.012} speed={0.12} rotX={0.3} rotY={0.6} />
      <GlowRing position={[0,  0,  0]} color="#0ea5e9" radius={5.8} tube={0.008} speed={0.08} rotX={0.7} rotY={0.2} />

      {/* DNA helix */}
      <DNAHelix />

      {/* Camera follows mouse */}
      <CameraRig />
    </Canvas>
  );
}
