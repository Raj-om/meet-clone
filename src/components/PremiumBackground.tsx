"use client";

import { useEffect, useRef } from "react";

export default function PremiumBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let W = window.innerWidth;
    let H = window.innerHeight;
    let t = 0;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener("resize", resize);
    resize();

    // ── 1. PARTICLE FIELD ──────────────────────────────────────────────────
    const NUM_PARTICLES = 200;
    const particles = Array.from({ length: NUM_PARTICLES }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: Math.random() * 2 + 0.2,        // depth 0.2–2.2
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.8 + 0.4,
      hue: Math.random() > 0.5 ? 190 : 270, // cyan or violet
    }));

    // ── 2. HEXAGONAL GRID ─────────────────────────────────────────────────
    const HEX_SIZE = 44;
    const hexCols = Math.ceil(W / (HEX_SIZE * 1.73)) + 2;
    const hexRows = Math.ceil(H / (HEX_SIZE * 1.5)) + 2;

    const drawHex = (cx: number, cy: number, size: number, alpha: number, pulse: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
      grd.addColorStop(0, `rgba(0, 220, 255, ${alpha * 0.08 * pulse})`);
      grd.addColorStop(1, `rgba(0, 220, 255, 0)`);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = `rgba(0, 200, 255, ${alpha * 0.18 * pulse})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    };

    // ── 3. ENERGY BEAMS ────────────────────────────────────────────────────
    const BEAMS = 7;
    const beams = Array.from({ length: BEAMS }, (_, i) => ({
      x: (W / BEAMS) * i + W / (BEAMS * 2),
      speed: 0.0004 + Math.random() * 0.0006,
      phase: Math.random() * Math.PI * 2,
      color: i % 2 === 0 ? [0, 200, 255] : [140, 0, 255],
    }));

    // ── 4. BIG NEBULA ORBS ─────────────────────────────────────────────────
    const orbs = [
      { x: 0.15, y: 0.2, r: 0.45, hue: 200, speed: 0.00015 },
      { x: 0.85, y: 0.75, r: 0.40, hue: 270, speed: 0.00013 },
      { x: 0.5,  y: 0.5,  r: 0.55, hue: 230, speed: 0.0001  },
    ];

    // ── 5. LIGHTNING ARCS ──────────────────────────────────────────────────
    let lightningTimer = 0;
    const drawLightning = (x1: number, y1: number, x2: number, y2: number, alpha: number) => {
      const segments = 12;
      const dx = (x2 - x1) / segments;
      const dy = (y2 - y1) / segments;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < segments; i++) {
        const nx = x1 + dx * i + (Math.random() - 0.5) * 40;
        const ny = y1 + dy * i + (Math.random() - 0.5) * 40;
        ctx.lineTo(nx, ny);
      }
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(120, 200, 255, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "#00cfff";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    // ── MOUSE PARALLAX ─────────────────────────────────────────────────────
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;
    
    const onMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / W - 0.5) * 2; // -1 to 1
      targetMouseY = (e.clientY / H - 0.5) * 2; // -1 to 1
    };
    window.addEventListener("mousemove", onMouseMove);

    // ── MAIN DRAW ──────────────────────────────────────────────────────────
    const draw = () => {
      t += 1;
      
      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Deep space background
      ctx.fillStyle = "#020818";
      ctx.fillRect(0, 0, W, H);

      // ── Nebula Orbs (Slow Parallax) ──
      orbs.forEach((orb, i) => {
        const ox = (orb.x + Math.sin(t * orb.speed + i) * 0.08 - mouseX * 0.1 * orb.r) * W;
        const oy = (orb.y + Math.cos(t * orb.speed + i * 1.3) * 0.06 - mouseY * 0.1 * orb.r) * H;
        const radius = orb.r * Math.min(W, H);
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, radius);
        g.addColorStop(0,   `hsla(${orb.hue}, 100%, 50%, 0.12)`);
        g.addColorStop(0.4, `hsla(${orb.hue}, 80%,  40%, 0.06)`);
        g.addColorStop(1,   `hsla(${orb.hue}, 60%,  20%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Hexagonal Grid (Medium Parallax) ──
      for (let row = -1; row < hexRows; row++) {
        for (let col = -1; col < hexCols; col++) {
          const cx = col * HEX_SIZE * 1.73 + (row % 2 === 0 ? 0 : HEX_SIZE * 0.866) - mouseX * 20;
          const cy = row * HEX_SIZE * 1.5 - mouseY * 20;
          const dist = Math.hypot(cx - W / 2, cy - H / 2) / Math.max(W, H);
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.018 + dist * 8);
          const alpha = Math.max(0, 0.6 - dist * 1.2);
          drawHex(cx, cy, HEX_SIZE - 2, alpha, pulse);
        }
      }

      // ── Energy Beams (vertical light columns, fixed) ──
      beams.forEach((beam) => {
        const phase = t * beam.speed + beam.phase;
        const bx = beam.x + Math.sin(phase * 3) * 80 - mouseX * 10;
        const alpha = 0.4 + 0.4 * Math.sin(phase * 5);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0,   `rgba(${beam.color.join(",")}, 0)`);
        g.addColorStop(0.3, `rgba(${beam.color.join(",")}, ${alpha * 0.5})`);
        g.addColorStop(0.5, `rgba(${beam.color.join(",")}, ${alpha})`);
        g.addColorStop(0.7, `rgba(${beam.color.join(",")}, ${alpha * 0.5})`);
        g.addColorStop(1,   `rgba(${beam.color.join(",")}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(bx, H / 2, 3 + alpha * 4, H / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // glow
        ctx.shadowColor = `rgb(${beam.color.join(",")})`;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.ellipse(bx, H / 2, 1.5, H / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${beam.color.join(",")}, ${alpha * 0.3})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // ── Particle Field (Deep Parallax) ──
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        
        // Wrap logic for base coordinates
        if (p.x < 0) p.x += W;
        if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H;
        if (p.y > H) p.y -= H;

        // Apply parallax for drawing
        const drawX = p.x - mouseX * 100 * p.z;
        const drawY = p.y - mouseY * 100 * p.z;

        const brightness = 0.5 + 0.5 * Math.sin(t * 0.04 + p.x * 0.01);
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.r * p.z, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 80%, ${brightness * p.z * 0.7})`;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 70%)`;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Store draw coords for connection lines
        (p as any)._drawX = drawX;
        (p as any)._drawY = drawY;
      });

      // ── Connect nearby particles with energy lines ──
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const px1 = (particles[i] as any)._drawX;
          const py1 = (particles[i] as any)._drawY;
          const px2 = (particles[j] as any)._drawX;
          const py2 = (particles[j] as any)._drawY;
          
          const dx = px1 - px2;
          const dy = py1 - py2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 90) {
            const alpha = (1 - dist / 90) * 0.2;
            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(px2, py2);
            ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // ── Random Lightning Arcs ──
      lightningTimer++;
      if (lightningTimer > 90 && Math.random() < 0.04) {
        lightningTimer = 0;
        const x1 = Math.random() * W;
        const y1 = Math.random() * H * 0.4;
        const x2 = x1 + (Math.random() - 0.5) * 300;
        const y2 = y1 + Math.random() * 200 + 100;
        drawLightning(x1, y1, x2, y2, 0.6 + Math.random() * 0.4);
      }

      // ── Scanline Vignette ──
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100%", height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
