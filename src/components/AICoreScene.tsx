"use client"

import { useRef, useMemo, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { MeshDistortMaterial, Sparkles, Stars, Float } from "@react-three/drei"
import * as THREE from "three"
import CyberSolarSystem from "./CyberSolarSystem"

// ── Biological Blood Rings ────────────────────────────────────────────────────
function BloodRing({ radius, tube, color, speed, tiltX, tiltZ }: {
    radius: number; tube: number; color: string; speed: number; tiltX: number; tiltZ: number
}) {
    const ref = useRef<THREE.Mesh>(null)
    useFrame((state) => {
        if (!ref.current) return
        ref.current.rotation.y += speed
        ref.current.rotation.x = tiltX + Math.sin(state.clock.elapsedTime * 0.4) * 0.08
        ref.current.rotation.z = tiltZ + Math.cos(state.clock.elapsedTime * 0.3) * 0.05
    })
    return (
        <mesh ref={ref}>
            <torusGeometry args={[radius, tube, 8, 120]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={3.5}
                transparent
                opacity={0.7}
                wireframe={false}
            />
        </mesh>
    )
}

// ── Floating Cell Particles ───────────────────────────────────────────────────
function CellParticle({ angle, radius, color, speed, size }: {
    angle: number; radius: number; color: string; speed: number; size: number
}) {
    const ref = useRef<THREE.Mesh>(null)
    const startAngle = useRef(angle)
    useFrame((state) => {
        if (!ref.current) return
        startAngle.current += speed
        ref.current.position.x = Math.cos(startAngle.current) * radius
        ref.current.position.z = Math.sin(startAngle.current) * radius
        ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.8 + angle) * 0.5
        ref.current.rotation.x += 0.01
        ref.current.rotation.y += 0.02
    })
    return (
        <mesh ref={ref}>
            <icosahedronGeometry args={[size, 1]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
        </mesh>
    )
}

// ── Touch-Reactive Spinal Cord ────────────────────────────────────────────────
function NeuralSpine() {
    const matRef = useRef<any>(null)
    const coreMatRef = useRef<any>(null)
    const [hovered, setHovered] = useState(false)
    const { pointer } = useThree()

    // Smoothly interpolate material properties based on hover state
    const currentDistort = useRef(0.25)
    const currentSpeed = useRef(1.5)
    const currentScale = useRef(1)

    useFrame((state, delta) => {
        const t = state.clock.elapsedTime

        // Target values based on touch/hover
        const targetDistort = hovered ? 1.6 : 0.3
        const targetSpeed = hovered ? 7.0 : 1.8
        const targetScale = hovered ? 1.05 : 1.0

        // Lerp towards targets
        currentDistort.current += (targetDistort - currentDistort.current) * (hovered ? 0.2 : 0.05)
        currentSpeed.current += (targetSpeed - currentSpeed.current) * (hovered ? 0.2 : 0.02)
        currentScale.current += (targetScale - currentScale.current) * 0.1

        if (matRef.current) {
            matRef.current.distort = currentDistort.current
            matRef.current.speed = currentSpeed.current
            // Make the outer shell throb
            matRef.current.opacity = hovered ? 0.95 : 0.8 + Math.sin(t * 1.5) * 0.1
        }
        
        if (coreMatRef.current) {
            coreMatRef.current.distort = currentDistort.current * 0.8
            coreMatRef.current.speed = currentSpeed.current * 1.2
            // Core intensely brightens on touch
            coreMatRef.current.emissiveIntensity = hovered ? 4.0 : 2.0 + Math.sin(t * 2) * 0.5
        }
    })

    return (
        <group scale={currentScale.current}>
            {/* The Outer Spinal Cord / Membrane */}
            <mesh 
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                {/* A tall capsule like a spine, highly segmented for liquid distortion */}
                <capsuleGeometry args={[0.9, 3.2, 64, 128]} />
                <MeshDistortMaterial
                    ref={matRef}
                    color="#1a0000" // Dark blood red
                    emissive="#9f1239" // Crimson glow
                    emissiveIntensity={0.8}
                    distort={0.3}
                    speed={1.5}
                    roughness={0.1}
                    metalness={0.8}
                    transparent
                    opacity={0.85}
                />
            </mesh>

            {/* The Inner Glowing Plasma Core */}
            <mesh>
                <capsuleGeometry args={[0.6, 2.8, 64, 128]} />
                <MeshDistortMaterial
                    ref={coreMatRef}
                    color="#4c0519"
                    emissive="#e11d48" // Bright neon blood
                    emissiveIntensity={2.0}
                    distort={0.2}
                    speed={1.8}
                    roughness={0}
                    metalness={0.1}
                />
            </mesh>
        </group>
    )
}

// ── Cyber Snow (Falling background particles) ─────────────────────────────────
function CyberSnow({ count = 800 }) {
    const pointsRef = useRef<THREE.Points>(null)
    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            // Spread wide and deep behind the solar system
            pos[i * 3] = (Math.random() - 0.5) * 40
            pos[i * 3 + 1] = Math.random() * 40 - 20
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 10
        }
        return pos
    }, [count])

    useFrame((state, delta) => {
        if (!pointsRef.current) return
        const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array
        for (let i = 0; i < count; i++) {
            // Fall downwards
            posArray[i * 3 + 1] -= delta * (1.5 + Math.random() * 0.5)
            // Gently sway horizontally
            posArray[i * 3] += Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.01
            
            // Loop back to top when they fall too low
            if (posArray[i * 3 + 1] < -20) {
                posArray[i * 3 + 1] = 20
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true
    })

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            {/* Cyber blue/white snow */}
            <pointsMaterial size={0.08} color="#00f0ff" transparent opacity={0.4} />
        </points>
    )
}

// ── Full Scene ────────────────────────────────────────────────────────────────
function Scene() {
    const groupRef = useRef<THREE.Group>(null)
    const { pointer } = useThree()

    useFrame(() => {
        if (!groupRef.current) return
        groupRef.current.rotation.y += (pointer.x * 0.15 - groupRef.current.rotation.y) * 0.04
        groupRef.current.rotation.x += (-pointer.y * 0.1 - groupRef.current.rotation.x) * 0.04
    })

    const cells = useMemo(() =>
        Array.from({ length: 24 }, (_, i) => ({
            angle: (i / 24) * Math.PI * 2,
            radius: 2.2 + Math.random() * 1.5,
            color: ["#ff007f", "#00f0ff", "#f3e600", "#ff003c"][i % 4],
            speed: 0.003 + Math.random() * 0.005,
            size: 0.03 + Math.random() * 0.04
        })), []
    )

    return (
        <>
            {/* Cinematic Cyberpunk Lighting */}
            <ambientLight intensity={0.2} color="#050510" />
            <pointLight position={[0, 0, 0]} intensity={12} color="#ff007f" distance={15} />
            <pointLight position={[6, 4, 3]} intensity={5} color="#00f0ff" distance={20} />
            <pointLight position={[-6, -4, -3]} intensity={4} color="#f3e600" distance={20} />

            {/* Deep background stars */}
            <Stars radius={80} depth={60} count={3000} factor={3} saturation={1} fade speed={0.2} />

            {/* Falling Cyber Snow */}
            <CyberSnow count={1200} />

            {/* Floating cyber particles */}
            <Sparkles count={150} scale={12} size={1.5} speed={0.4} color="#ff007f" opacity={0.5} />
            <Sparkles count={100} scale={8} size={2.5} speed={0.6} color="#00f0ff" opacity={0.7} />

            {/* Main interactive group */}
            <group ref={groupRef}>
                {/* Orbiting cyber rings */}
                <BloodRing radius={2.2} tube={0.012} color="#ff007f" speed={0.008} tiltX={Math.PI / 5} tiltZ={0} />
                <BloodRing radius={2.7} tube={0.008} color="#00f0ff" speed={-0.006} tiltX={Math.PI / 4} tiltZ={Math.PI / 6} />
                <BloodRing radius={3.2} tube={0.006} color="#f3e600" speed={0.004} tiltX={Math.PI / 3} tiltZ={Math.PI / 3} />

                {/* The Interactive Solar System */}
                <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
                    <CyberSolarSystem />
                </Float>

                {/* Orbiting cells */}
                {cells.map((c, i) => (
                    <CellParticle key={i} {...c} />
                ))}
            </group>
        </>
    )
}

// ── Exported Canvas Wrapper ───────────────────────────────────────────────────
export default function AICoreScene() {
    return (
        <Canvas
            camera={{ position: [0, 0, 8], fov: 60 }}
            style={{ position: "absolute", inset: 0 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            dpr={[1, 2]}
        >
            <Scene />
        </Canvas>
    )
}
