import React, { useEffect, useRef } from 'react';

interface MicroDotFieldProps {
  isDark: boolean;
}

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export const MicroDotField: React.FC<MicroDotFieldProps> = ({ isDark }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const darkRef = useRef(isDark);
  darkRef.current = isDark;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    let width = 0;
    let height = 0;
    let dots: Dot[] = [];

    const initDots = (w: number, h: number) => {
      const count = Math.min(54, Math.max(24, Math.floor((w * h) / 22000)));
      const next: Dot[] = [];
      for (let i = 0; i < count; i++) {
        next.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: 1.5 + (i % 2) * 0.4
        });
      }
      dots = next;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextW = Math.floor(rect.width);
      const nextH = Math.floor(rect.height);
      if (nextW <= 0 || nextH <= 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = nextW;
      height = nextH;
      canvas.width = Math.floor(nextW * dpr);
      canvas.height = Math.floor(nextH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (dots.length === 0) {
        initDots(width, height);
      }
    };

    resize();

    const drawFrame = () => {
      if (width <= 0 || height <= 0) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = darkRef.current ? '#93C5FD' : '#1E3A8A';

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (!prefersReduced) {
          d.x += d.vx;
          d.y += d.vy;
          if (d.x < 0) d.x = width;
          else if (d.x > width) d.x = 0;
          if (d.y < 0) d.y = height;
          else if (d.y > height) d.y = 0;
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawFrame();

    const tick = () => {
      if (!document.hidden) {
        drawFrame();
      }
      animId = window.requestAnimationFrame(tick);
    };

    if (!prefersReduced) {
      animId = window.requestAnimationFrame(tick);
    }

    const handleResize = () => {
      resize();
      if (prefersReduced) {
        drawFrame();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animId) window.cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.18]"
    />
  );
};
