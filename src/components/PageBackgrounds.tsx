"use client";
import { useEffect, useRef } from "react";

// 🔥 LOGIN: Deep magenta/violet lava-lamp effect with rising orbs + grid
export function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number, t = 0;
    let W = window.innerWidth, H = window.innerHeight;
    const resize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; };
    window.addEventListener("resize", resize); resize();

    // Lava orbs
    const orbs = Array.from({ length: 8 }, (_, i) => ({
      x: Math.random() * W, y: H + Math.random() * H,
      r: 80 + Math.random() * 160,
      speed: 0.2 + Math.random() * 0.5,
      hue: 270 + Math.random() * 60, // violet to magenta
      phase: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      t++;
      ctx.fillStyle = "#0a0010";
      ctx.fillRect(0, 0, W, H);

      // Rising lava orbs
      orbs.forEach(orb => {
        orb.y -= orb.speed;
        orb.x += Math.sin(t * 0.008 + orb.phase) * 1.2;
        if (orb.y + orb.r < 0) { orb.y = H + orb.r; orb.x = Math.random() * W; }
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        g.addColorStop(0, `hsla(${orb.hue}, 100%, 60%, 0.25)`);
        g.addColorStop(0.5, `hsla(${orb.hue}, 80%, 40%, 0.12)`);
        g.addColorStop(1, `hsla(${orb.hue}, 60%, 20%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2); ctx.fill();
      });

      // Dot grid
      const spacing = 40;
      for (let x = 0; x < W; x += spacing) {
        for (let y = 0; y < H; y += spacing) {
          const pulse = 0.3 + 0.3 * Math.sin(t * 0.02 + x * 0.05 + y * 0.05);
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 100, 255, ${pulse * 0.5})`;
          ctx.fill();
        }
      }

      // Vignette
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.15, W/2, H/2, H);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, width:"100%", height:"100%", zIndex:0, pointerEvents:"none" }} />;
}

// ✨ REGISTER: Emerald/teal aurora with floating star particles
export function RegisterBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number, t = 0;
    let W = window.innerWidth, H = window.innerHeight;
    const resize = () => { W = window.innerWidth; H = window.innerHeight; canvas.width = W; canvas.height = H; };
    window.addEventListener("resize", resize); resize();

    // Star particles
    const stars = Array.from({ length: 250 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.5 + Math.random() * 2,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.02,
    }));

    // Aurora wave bands
    const bands = [
      { y: 0.25, hue: 160, amp: 60, speed: 0.003 },
      { y: 0.45, hue: 180, amp: 80, speed: 0.002 },
      { y: 0.60, hue: 140, amp: 50, speed: 0.004 },
    ];

    const draw = () => {
      t++;
      ctx.fillStyle = "#000d08";
      ctx.fillRect(0, 0, W, H);

      // Aurora bands
      bands.forEach(band => {
        for (let x = 0; x < W; x += 2) {
          const wave = Math.sin(x * 0.005 + t * band.speed) * band.amp;
          const cy = band.y * H + wave;
          const g = ctx.createLinearGradient(0, cy - 120, 0, cy + 120);
          g.addColorStop(0, `hsla(${band.hue}, 100%, 50%, 0)`);
          g.addColorStop(0.4, `hsla(${band.hue}, 100%, 50%, 0.12)`);
          g.addColorStop(0.5, `hsla(${band.hue}, 100%, 60%, 0.18)`);
          g.addColorStop(0.6, `hsla(${band.hue}, 100%, 50%, 0.12)`);
          g.addColorStop(1, `hsla(${band.hue}, 100%, 50%, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x, cy - 120, 2, 240);
        }
      });

      // Twinkling stars
      stars.forEach(star => {
        star.twinkle += star.speed;
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin(star.twinkle));
        ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150, 255, 220, ${alpha})`;
        ctx.shadowColor = "#00ffcc"; ctx.shadowBlur = 4;
        ctx.fill(); ctx.shadowBlur = 0;
      });

      // Floating rising motes
      stars.forEach(star => { star.y -= 0.05; if (star.y < 0) star.y = H; });

      // Vignette
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,20,0.8)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, width:"100%", height:"100%", zIndex:0, pointerEvents:"none" }} />;
}
