"use client";

import { useEffect, useRef } from "react";

/**
 * Concentric dotted rings that breathe like a live phone call.
 * The amplitude follows a fake speech envelope (syllables inside phrases),
 * and dots near the pointer get pushed away.
 */
export function VoiceField({ className, centerX = 0.68, centerY = 0.48 }: { className?: string; centerX?: number; centerY?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const mouse = { x: -9999, y: -9999 };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    window.addEventListener("pointermove", onMove);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const RINGS = 24;

    const envelope = (t: number) => {
      const syllable = Math.max(0, Math.sin(t * 7.3)) * Math.max(0, Math.sin(t * 2.1 + 1.2));
      const phrase = Math.max(0, Math.sin(t * 0.55));
      return 0.18 + 0.82 * syllable * (0.35 + 0.65 * phrase);
    };

    const draw = (now: number) => {
      raf = 0;
      if (!visible) return;
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const mobile = w < 768;
      const cx = w * (mobile ? 0.5 : centerX);
      const cy = h * (mobile ? 0.36 : centerY);
      const maxR = Math.max(w, h) * 0.62;
      const env = reduce ? 0.3 : envelope(t);

      for (let i = 0; i < RINGS; i++) {
        const k = i / (RINGS - 1);
        const base = 34 + k * k * maxR * 0.9 + k * maxR * 0.25;
        const n = Math.floor(base * 0.32) + 14;
        const fade = 1 - k;
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2 + i * 0.07;
          const wob =
            Math.sin(a * 3 + t * 1.4 + i * 0.45) * Math.sin(a * 5 - t * 0.8) * env * (10 + i * 1.6) +
            Math.sin(t * 2 - i * 0.5) * env * 4;
          const r = base + wob;
          let x = cx + Math.cos(a) * r;
          let y = cy + Math.sin(a) * r * 0.92;
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 19600) {
            const d = Math.sqrt(d2) || 1;
            const f = (140 - d) / 140;
            x += (dx / d) * f * f * 46;
            y += (dy / d) * f * f * 46;
          }
          const hot = (j * 13 + i * 7) % 53 === 0;
          ctx.globalAlpha = hot ? 0.95 : 0.12 + fade * 0.62;
          ctx.fillStyle = hot ? "#ff5a1f" : "#eee9df";
          const s = hot ? 2.4 : 1.5;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(draw);
    });
    io.observe(canvas);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [centerX, centerY]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
