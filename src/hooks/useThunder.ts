"use client";

import { useRef, useCallback } from "react";

export interface ThunderController {
  triggerThunder: (x: number, y: number, callback: () => void) => void;
}

export function useThunder(): ThunderController {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(false);

  // Lazily create the overlay canvas
  const getCanvas = useCallback((): HTMLCanvasElement => {
    if (canvasRef.current) return canvasRef.current;
    const c = document.createElement("canvas");
    c.style.cssText = `
      position: fixed; inset: 0; width: 100%; height: 100%;
      z-index: 9999; pointer-events: none;
    `;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    document.body.appendChild(c);
    canvasRef.current = c;
    return c;
  }, []);

  const triggerThunder = useCallback((ox: number, oy: number, callback: () => void) => {
    if (activeRef.current) return;
    activeRef.current = true;

    const canvas = getCanvas();
    const ctx = canvas.getContext("2d")!;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    let startTime: number | null = null;
    const DURATION = 900;

    // ── Branching lightning generator ────────────────────────────────────
    interface Bolt { x1: number; y1: number; x2: number; y2: number; alpha: number; width: number }
    const bolts: Bolt[] = [];

    const buildLightning = (
      x1: number, y1: number, x2: number, y2: number,
      depth: number, alpha: number, width: number
    ) => {
      if (depth === 0 || alpha < 0.05) return;
      const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 80;
      const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 80;
      bolts.push({ x1, y1, x2: midX, y2: midY, alpha, width });
      bolts.push({ x1: midX, y1: midY, x2, y2, alpha, width });
      if (Math.random() < 0.45) {
        buildLightning(midX, midY, midX + (Math.random() - 0.5) * 200,
          midY + Math.random() * 200, depth - 1, alpha * 0.6, width * 0.6);
      }
      buildLightning(x1, y1, midX, midY, depth - 1, alpha * 0.7, width * 0.7);
      buildLightning(midX, midY, x2, y2, depth - 1, alpha * 0.7, width * 0.7);
    };

    // Spawn 8 bolts toward screen edges
    const targets = [
      [0, 0], [W / 2, 0], [W, 0],
      [W, H / 2], [W, H], [W / 2, H],
      [0, H], [0, H / 2],
    ];
    targets.forEach(([tx, ty]) => {
      buildLightning(ox, oy, tx, ty, 4, 1, 2.5);
    });

    // ── Shockwave rings ──────────────────────────────────────────────────
    const rings = [
      { delay: 0,   speed: 3.5, maxR: Math.max(W, H) * 0.7, color: "0,200,255" },
      { delay: 60,  speed: 2.8, maxR: Math.max(W, H) * 0.5, color: "160,80,255" },
      { delay: 120, speed: 4.0, maxR: Math.max(W, H) * 0.4, color: "255,255,255" },
    ];
    const ringState = rings.map(r => ({ r: 0, started: false, delay: r.delay }));

    // ── Spark particles ──────────────────────────────────────────────────
    interface Spark { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number; hue: number }
    const sparks: Spark[] = Array.from({ length: 120 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 12;
      return {
        x: ox, y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 3,
        life: 1,
        maxLife: 0.4 + Math.random() * 0.6,
        r: 1.5 + Math.random() * 3,
        hue: Math.random() > 0.5 ? 50 : 200, // yellow-orange or cyan
      };
    });

    // ── Main animation frame ─────────────────────────────────────────────
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      ctx.clearRect(0, 0, W, H);

      // Phase 1: Flash (0–150ms)
      if (elapsed < 200) {
        const flashAlpha = elapsed < 80
          ? (elapsed / 80) * 0.85
          : Math.max(0, 0.85 - ((elapsed - 80) / 120) * 0.85);
        ctx.fillStyle = `rgba(160, 220, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Phase 2: Lightning bolts (80–400ms)
      if (elapsed > 60 && elapsed < 450) {
        const boltAlpha = elapsed < 150
          ? (elapsed - 60) / 90
          : Math.max(0, 1 - (elapsed - 150) / 300);
        bolts.forEach(bolt => {
          ctx.beginPath();
          ctx.moveTo(bolt.x1, bolt.y1);
          ctx.lineTo(bolt.x2, bolt.y2);
          ctx.shadowColor = "#00cfff";
          ctx.shadowBlur = 18;
          ctx.strokeStyle = `rgba(255,255,255,${bolt.alpha * boltAlpha})`;
          ctx.lineWidth = bolt.width;
          ctx.stroke();
          // Glow pass
          ctx.strokeStyle = `rgba(0,200,255,${bolt.alpha * boltAlpha * 0.5})`;
          ctx.lineWidth = bolt.width * 3;
          ctx.stroke();
          ctx.shadowBlur = 0;
        });
      }

      // Phase 3: Shockwave rings (0–700ms)
      rings.forEach((ring, i) => {
        const state = ringState[i];
        if (elapsed < ring.delay) return;
        if (!state.started) state.started = true;
        state.r += ring.speed;
        if (state.r > ring.maxR) return;
        const ringAlpha = Math.max(0, (1 - state.r / ring.maxR) * 0.7);
        ctx.beginPath();
        ctx.arc(ox, oy, state.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${ring.color},${ringAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = `rgb(${ring.color})`;
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Inner fill pulse
        ctx.beginPath();
        ctx.arc(ox, oy, state.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${ring.color},${ringAlpha * 0.03})`;
        ctx.fill();
      });

      // Phase 4: Sparks (100–800ms)
      if (elapsed > 80) {
        sparks.forEach(spark => {
          spark.vy += 0.2; // gravity
          spark.x += spark.vx;
          spark.y += spark.vy;
          spark.life = Math.max(0, spark.life - 0.022 / spark.maxLife);
          if (spark.life <= 0) return;
          const grad = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, spark.r * 2);
          grad.addColorStop(0, `hsla(${spark.hue}, 100%, 80%, ${spark.life})`);
          grad.addColorStop(1, `hsla(${spark.hue}, 100%, 60%, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.r * 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Phase 5: Electric crackle (200–550ms)
      if (elapsed > 180 && elapsed < 560) {
        const crackleAlpha = elapsed < 350
          ? ((elapsed - 180) / 170) * 0.12
          : Math.max(0, 0.12 - ((elapsed - 350) / 210) * 0.12);
        if (crackleAlpha > 0) {
          for (let i = 0; i < 60; i++) {
            const cx = Math.random() * W;
            const cy = Math.random() * H;
            const len = 20 + Math.random() * 60;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (Math.random() - 0.5) * len, cy + (Math.random() - 0.5) * len);
            ctx.strokeStyle = `rgba(100, 200, 255, ${crackleAlpha * Math.random()})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Phase 6: Fade-to-dark (650–900ms)
      if (elapsed > 620) {
        const fadeAlpha = Math.min(1, (elapsed - 620) / 280);
        ctx.fillStyle = `rgba(0,0,0,${fadeAlpha * 0.92})`;
        ctx.fillRect(0, 0, W, H);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, W, H);
        activeRef.current = false;
        callback();
      }
    };

    requestAnimationFrame(animate);
  }, [getCanvas]);

  return { triggerThunder };
}
