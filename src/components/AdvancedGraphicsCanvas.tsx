"use client"

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

function ParticleSwarm() {
    const ref = useRef<THREE.Points>(null)
    
    // Generate 5000 random points in a sphere
    const sphere = useMemo(() => {
        const temp = new Float32Array(5000 * 3)
        for (let i = 0; i < 5000; i++) {
            const r = 20 * Math.cbrt(Math.random())
            const theta = Math.random() * 2 * Math.PI
            const phi = Math.acos(2 * Math.random() - 1)
            temp[i * 3] = r * Math.sin(phi) * Math.cos(theta)
            temp[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
            temp[i * 3 + 2] = r * Math.cos(phi)
        }
        return temp
    }, [])

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 10
            ref.current.rotation.y -= delta / 15
        }
    })

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false}>
                <PointMaterial transparent color="#a78bfa" size={0.05} sizeAttenuation={true} depthWrite={false} blending={THREE.AdditiveBlending} />
            </Points>
        </group>
    )
}

function CyberGrid() {
    const gridRef = useRef<THREE.GridHelper>(null)

    useFrame((state, delta) => {
        if (gridRef.current) {
            // Move grid towards camera to create illusion of forward motion
            gridRef.current.position.z = (gridRef.current.position.z + delta * 2) % 10
        }
    })

    return (
        <group position={[0, -5, 0]}>
            <gridHelper ref={gridRef} args={[100, 100, "#7c3aed", "#312e81"]} position={[0, 0, -10]} />
            <gridHelper args={[100, 100, "#7c3aed", "#312e81"]} position={[0, 0, -20]} />
        </group>
    )
}

export default function AdvancedGraphicsCanvas() {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: -10, // Stay behind all UI
            pointerEvents: 'none', // Do not block clicks on UI
            background: 'linear-gradient(to bottom, #09090b, #000000)',
            opacity: 0.8 // Blend slightly
        }}>
            <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
                {/* Ambient lighting */}
                <ambientLight intensity={0.5} />
                
                {/* Fog for cinematic depth */}
                <fog attach="fog" args={['#000', 5, 25]} />
                
                {/* The 3D elements */}
                <ParticleSwarm />
                <CyberGrid />
            </Canvas>
        </div>
    )
}
