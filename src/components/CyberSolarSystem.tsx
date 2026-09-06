"use client"

import React, { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { Sphere, MeshDistortMaterial } from "@react-three/drei"

// ── Data Stream (Particles on Orbit) ─────────────────────────────────────────
function DataStream({ radius, color, count, speed, direction = 1, size = 0.08 }: { radius: number, color: string, count: number, speed: number, direction?: number, size?: number }) {
    const pointsRef = useRef<THREE.Points>(null)
    const angles = useMemo(() => Array.from({ length: count }, () => Math.random() * Math.PI * 2), [count])
    const positions = useMemo(() => new Float32Array(count * 3), [count])

    useFrame((_, delta) => {
        if (!pointsRef.current) return
        const pos = pointsRef.current.geometry.attributes.position.array as Float32Array
        for (let i = 0; i < count; i++) {
            angles[i] += speed * direction * delta
            pos[i * 3] = Math.cos(angles[i]) * radius
            pos[i * 3 + 1] = (Math.random() - 0.5) * 0.1 // slight vertical jitter
            pos[i * 3 + 2] = Math.sin(angles[i]) * radius
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true
    })

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={size} color={color} transparent opacity={1} blending={THREE.AdditiveBlending} />
        </points>
    )
}

// ── Holographic Orbit Ring ───────────────────────────────────────────────────
function OrbitRing({ radius, color, hasData = true }: { radius: number; color: string; hasData?: boolean }) {
    return (
        <group>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[radius - 0.015, radius + 0.015, 128]} />
                <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
            </mesh>
            {hasData && (
                <>
                    <DataStream radius={radius} color={color} count={Math.floor(radius * 15)} speed={0.4 / (radius * 0.2)} direction={1} />
                    <DataStream radius={radius} color="#ffffff" count={Math.floor(radius * 3)} speed={1.2 / (radius * 0.2)} direction={-1} size={0.12} />
                </>
            )}
        </group>
    )
}

// ── Planet ───────────────────────────────────────────────────────────────────
function Planet({ radius, speed, size, color, startAngle }: {
    radius: number; speed: number; size: number; color: string; startAngle: number
}) {
    const groupRef = useRef<THREE.Group>(null)
    const planetRef = useRef<THREE.Mesh>(null)

    useFrame((state) => {
        if (!groupRef.current) return
        // Orbit rotation
        groupRef.current.rotation.y = startAngle + state.clock.elapsedTime * speed
        
        if (planetRef.current) {
            // Self rotation
            planetRef.current.rotation.y += 0.02
        }
    })

    return (
        <group ref={groupRef}>
            <mesh ref={planetRef} position={[radius, 0, 0]}>
                <sphereGeometry args={[size, 32, 32]} />
                <meshStandardMaterial 
                    color={color} 
                    emissive={color} 
                    emissiveIntensity={2.5}
                    metalness={0.8}
                    roughness={0.2}
                />
            </mesh>
            {/* Glowing Aura for Planet */}
            <mesh position={[radius, 0, 0]}>
                <sphereGeometry args={[size * 1.5, 32, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
            </mesh>
        </group>
    )
}

// ── Solar Flares (Radiant Energy) ────────────────────────────────────────────
function SolarFlares({ count = 300, color = "#ff007f" }) {
    const pointsRef = useRef<THREE.Points>(null)
    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 0.5
            pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5
            pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5
        }
        return pos
    }, [count])

    const velocities = useMemo(() => {
        const vel = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            vel[i * 3] = (Math.random() - 0.5) * 3
            vel[i * 3 + 1] = (Math.random() - 0.5) * 3
            vel[i * 3 + 2] = (Math.random() - 0.5) * 3
        }
        return vel
    }, [count])

    useFrame((_, delta) => {
        if (!pointsRef.current) return
        const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array
        for (let i = 0; i < count; i++) {
            posArray[i * 3] += velocities[i * 3] * delta
            posArray[i * 3 + 1] += velocities[i * 3 + 1] * delta
            posArray[i * 3 + 2] += velocities[i * 3 + 2] * delta

            const dist = Math.sqrt(
                posArray[i * 3]**2 + 
                posArray[i * 3 + 1]**2 + 
                posArray[i * 3 + 2]**2
            )
            // Radiate outwards then reset
            if (dist > 1.5 + Math.random() * 1.5) {
                posArray[i * 3] = (Math.random() - 0.5) * 0.2
                posArray[i * 3 + 1] = (Math.random() - 0.5) * 0.2
                posArray[i * 3 + 2] = (Math.random() - 0.5) * 0.2
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true
    })

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial size={0.06} color={color} transparent opacity={0.8} blending={THREE.AdditiveBlending} />
        </points>
    )
}

// ── Main Solar System ────────────────────────────────────────────────────────
export default function CyberSolarSystem() {
    const sunRef = useRef<THREE.Mesh>(null)
    const sunGlowRef = useRef<THREE.Mesh>(null)

    useFrame((state) => {
        if (sunRef.current) {
            sunRef.current.rotation.y += 0.005
        }
        if (sunGlowRef.current) {
            // Pulsate the sun's glow
            const scale = 1.3 + Math.sin(state.clock.elapsedTime * 3) * 0.15
            sunGlowRef.current.scale.set(scale, scale, scale)
        }
    })

    const planets = useMemo(() => [
        { radius: 1.8, speed: 0.8, size: 0.1, color: "#00f0ff", startAngle: 0 },
        { radius: 2.6, speed: 0.5, size: 0.15, color: "#ff007f", startAngle: Math.PI / 3 },
        { radius: 3.4, speed: 0.3, size: 0.2, color: "#f3e600", startAngle: Math.PI },
        { radius: 4.4, speed: 0.15, size: 0.12, color: "#00ff66", startAngle: Math.PI * 1.5 },
    ], [])

    // Generate many outer orbital rings for the data flow effect
    const outerRings = useMemo(() => {
        const rings = []
        for (let r = 5.2; r < 15; r += 0.8) {
            const colors = ["#00f0ff", "#ff007f", "#7c3aed", "#14b8a6"]
            rings.push({
                radius: r + (Math.random() * 0.2 - 0.1),
                color: colors[Math.floor(Math.random() * colors.length)]
            })
        }
        return rings
    }, [])

    return (
        <group rotation={[Math.PI / 6, 0, -Math.PI / 8]}>
            {/* The Central "Sun" / Neural Core */}
            <mesh ref={sunRef}>
                <sphereGeometry args={[0.7, 64, 64]} />
                <MeshDistortMaterial 
                    color="#ff007f" 
                    emissive="#00f0ff"
                    emissiveIntensity={3.5}
                    distort={0.8}
                    speed={5.0}
                    roughness={0.0}
                    metalness={1.0}
                />
            </mesh>
            
            {/* Sun Glow */}
            <mesh ref={sunGlowRef}>
                <sphereGeometry args={[0.7, 32, 32]} />
                <meshBasicMaterial 
                    color="#00f0ff" 
                    transparent 
                    opacity={0.3} 
                    blending={THREE.AdditiveBlending} 
                />
            </mesh>

            {/* Radiant Solar Flares */}
            <SolarFlares count={400} color="#00f0ff" />
            <SolarFlares count={200} color="#ff007f" />

            {/* Core Planets */}
            {planets.map((p, i) => (
                <React.Fragment key={`planet-${i}`}>
                    <OrbitRing radius={p.radius} color={p.color} />
                    <Planet {...p} />
                </React.Fragment>
            ))}

            {/* Deep Outer Data Rings (The Sync Network Effect) */}
            {outerRings.map((r, i) => (
                <OrbitRing key={`outer-${i}`} radius={r.radius} color={r.color} hasData={true} />
            ))}
        </group>
    )
}
