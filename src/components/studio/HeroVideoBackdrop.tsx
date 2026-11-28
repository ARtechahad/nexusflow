import React, { useEffect, useRef, useState } from 'react';

interface HeroVideoClip {
  id: string;
  src: string;
  label: string;
}

// Looping dark-mode abstract technology clips with per-clip error handling and instant canvas fallback
const DARK_TECH_VIDEOS: HeroVideoClip[] = [
  {
    id: 'network-nodes',
    src: 'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-futuristic-devices-99790-large.mp4',
    label: 'Abstract technology network nodes'
  },
  {
    id: 'server-matrix',
    src: 'https://assets.mixkit.co/videos/preview/mixkit-software-developer-working-on-code-screen-close-up-1728-large.mp4',
    label: 'Engineering code stream backdrop'
  },
  {
    id: 'cyber-grid',
    src: 'https://assets.mixkit.co/videos/preview/mixkit-blue-and-purple-abstract-wave-background-32510-large.mp4',
    label: 'Deep atmospheric wave geometry'
  }
];

export const HeroVideoBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedIds, setLoadedIds] = useState<Record<string, boolean>>({});
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [activeVideoIndex, setActiveVideoIndex] = useState<number>(0);
  const [isClientReady, setIsClientReady] = useState<boolean>(false);

  const playableClips = DARK_TECH_VIDEOS.filter(
    (clip) => loadedIds[clip.id] && !failedIds[clip.id]
  );

  useEffect(() => {
    setIsClientReady(true);
  }, []);

  // Crossfade cleanly across clips that loaded successfully
  useEffect(() => {
    if (playableClips.length <= 1) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveVideoIndex((prev) => (prev + 1) % playableClips.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [playableClips.length]);

  // Animated dark engineering node-grid canvas fallback (always active behind/without video)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let animationFrameId = 0;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
    }

    const particles: Particle[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = parent ? parent.clientWidth : window.innerWidth;
      height = parent ? parent.clientHeight : 720;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      particles.length = 0;
      const count = Math.min(42, Math.max(18, Math.floor((width * height) / 34000)));
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: ((i * 197.3) % 1) * width || Math.random() * width,
          y: ((i * 313.7) % 1) * height || Math.random() * height,
          vx: ((i % 2 === 0 ? 1 : -1) * (0.14 + (i % 5) * 0.04)),
          vy: ((i % 3 === 0 ? 1 : -1) * (0.1 + (i % 4) * 0.035)),
          r: (i % 3) * 0.55 + 1.1
        });
      }
    };

    const drawFrame = (stepMotion: boolean) => {
      ctx.clearRect(0, 0, width, height);

      // Subtle hairline architectural grid
      const gridStep = 64;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Animate network particles & edges
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (stepMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        for (let j = i + 1; j < particles.length; j += 1) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 155) {
            const alpha = (1 - dist / 155) * 0.18;
            ctx.strokeStyle = `rgba(59, 130, 246, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = 'rgba(96, 165, 250, 0.42)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    resize();
    if (prefersReduced) {
      drawFrame(false);
    } else {
      const loop = () => {
        drawFrame(true);
        animationFrameId = window.requestAnimationFrame(loop);
      };
      animationFrameId = window.requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-[#0B0F17] select-none pointer-events-none"
    >
      {/* Ambient architectural gradient glow fallback */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 75% 55% at 50% 15%, rgba(37, 99, 235, 0.18) 0%, rgba(79, 70, 229, 0.08) 42%, rgba(11, 15, 23, 0) 75%)'
        }}
      />

      {/* Animated dark tech canvas grid + connected nodes */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-90" />

      {/* Multi-clip looping muted dark tech videos rendered strictly client-side with graceful crossfade */}
      {isClientReady &&
        DARK_TECH_VIDEOS.map((clip) => {
          if (failedIds[clip.id]) return null;
          const activeIndexInPlayable = playableClips.findIndex((c) => c.id === clip.id);
          const isVisible =
            loadedIds[clip.id] &&
            playableClips.length > 0 &&
            activeIndexInPlayable === activeVideoIndex % playableClips.length;

          return (
            <video
              key={clip.id}
              src={clip.src}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={clip.label}
              onCanPlay={() =>
                setLoadedIds((prev) => (prev[clip.id] ? prev : { ...prev, [clip.id]: true }))
              }
              onError={() =>
                setFailedIds((prev) => (prev[clip.id] ? prev : { ...prev, [clip.id]: true }))
              }
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-out ${
                isVisible ? 'opacity-35' : 'opacity-0'
              }`}
            />
          );
        })}

      {/* Deep #0B0F17 contrast scrim guaranteeing WCAG AA readability over all video/canvas frames */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(11, 15, 23, 0.72) 0%, rgba(11, 15, 23, 0.62) 48%, rgba(11, 15, 23, 0.96) 95%, #0B0F17 100%)'
        }}
      />
    </div>
  );
};
