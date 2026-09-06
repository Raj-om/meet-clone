"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const AURORA_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  void main() {
    vUv = uv;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AURORA_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uResolution;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  // Perlin noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec2 x = 2.0 * fract(p * C.www) - 1.0;
    vec2 h = abs(x) - 0.5;
    vec2 ox = floor(x + 0.5);
    vec2 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0.x * a0.x + a0.y * a0.y);
    vec2 g = vec2(a0.x * a0.x - a0.y * a0.y, 2.0 * a0.x * a0.y);
    vec2 tx = h * 2.0 + 0.5;
    vec2 ox2 = floor(tx);
    tx = tx - ox2;
    vec2 a1 = tx * tx - 0.25;
    vec2 g1 = tx * (2.0 * h - 1.0);
    vec2 g2 = a1 * (2.0 * h - 1.0);
    vec3 gx = g.xxx * vec3(1.0, g1.x, g2.x);
    vec3 gy = g.yyy * vec3(1.0, g1.y, g2.y);
    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec3 g000 = vec3(g00, 0.0);
    vec3 g100 = vec3(g10, 0.0);
    vec3 g010 = vec3(g01, 0.0);
    return 130.0 * dot(m, vec3(dot(g000, vec3(x0, 0.0)), dot(g100, vec3(x12.xy, 0.0)), dot(g010, vec3(x12.zw, 0.0))));
  }
  
  // Fractal Brownian Motion
  float fbm(vec2 p, float time) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      value += amplitude * snoise(p * frequency + vec2(time * 0.05, time * 0.03));
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }
  
  // Curl noise for flowing motion
  vec2 curlNoise(vec2 p, float time) {
    float eps = 0.001;
    float n1 = fbm(p + vec2(eps, 0.0), time);
    float n2 = fbm(p - vec2(eps, 0.0), time);
    float n3 = fbm(p + vec2(0.0, eps), time);
    float n4 = fbm(p - vec2(0.0, eps), time);
    return vec2(n1 - n2, n3 - n4) / (2.0 * eps);
  }
  
  void main() {
    vec2 uv = vUv;
    float time = uTime * 0.3;
    
    // Mouse influence
    vec2 mouseUv = uMouse / uResolution;
    float mouseDist = length(uv - mouseUv);
    float mouseInfluence = smoothstep(0.5, 0.0, mouseDist) * 0.3;
    
    // Multiple layers of aurora
    float layer1 = fbm(uv * 3.0 + vec2(time * 0.1, time * 0.05), time);
    float layer2 = fbm(uv * 5.0 - vec2(time * 0.08, time * 0.12), time) * 0.6;
    float layer3 = fbm(uv * 8.0 + vec2(time * 0.15, -time * 0.07), time) * 0.35;
    
    // Curl noise distortion
    vec2 curl = curlNoise(uv * 2.0, time) * 0.15;
    uv += curl;
    
    // Vertical gradient mask (aurora appears in upper portion)
    float verticalMask = smoothstep(0.3, 0.8, uv.y) * smoothstep(1.0, 0.6, uv.y);
    
    // Combine layers
    float aurora = (layer1 + layer2 + layer3) * verticalMask;
    aurora = smoothstep(0.3, 0.7, aurora);
    aurora += mouseInfluence;
    
    // Color mixing
    vec3 color = mix(uColorA, uColorB, uv.y);
    color = mix(color, uColorC, layer3 * 2.0);
    
    // Add shimmer
    float shimmer = sin(uv.x * 50.0 + time * 5.0) * 0.02 + 0.98;
    color *= shimmer;
    
    // Final alpha
    float alpha = aurora * uIntensity * verticalMask;
    alpha *= smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
    
    gl_FragColor = vec4(color, alpha);
  }
`;

interface AuroraShaderProps {
  intensity?: number;
  colorA?: THREE.ColorRepresentation;
  colorB?: THREE.ColorRepresentation;
  colorC?: THREE.ColorRepresentation;
  position?: [number, number, number];
  scale?: number;
  enabled?: boolean;
}

export function AuroraShader({
  intensity = 1.0,
  colorA = "#7c3aed",
  colorB = "#06b6d4",
  colorC = "#e11d48",
  position = [0, 8, -10],
  scale = 60,
  enabled = true,
}: AuroraShaderProps) {
  const { viewport } = useThree();
  const [mouse, setMouse] = useState([0, 0]);
  const timeRef = useRef(0);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: AURORA_VERTEX_SHADER,
      fragmentShader: AURORA_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uResolution: { value: new THREE.Vector2(viewport.width, viewport.height) },
        uIntensity: { value: intensity },
        uColorA: { value: new THREE.Color(colorA) },
        uColorB: { value: new THREE.Color(colorB) },
        uColorC: { value: new THREE.Color(colorC) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, [viewport.width, viewport.height, intensity, colorA, colorB, colorC]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(scale, scale, 1, 1), [scale]);

  useFrame((_, delta) => {
    if (!enabled) return;
    timeRef.current += delta;
    if (material) {
      material.uniforms.uTime.value = timeRef.current;
      material.uniforms.uMouse.value.set(mouse[0], mouse[1]);
    }
  });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setMouse([e.clientX, viewport.height - e.clientY]);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [viewport.height]);

  if (!enabled) return null;

  return (
    <mesh
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      material={material}
    />
  );
}

import { useState, useRef, useEffect } from "react";