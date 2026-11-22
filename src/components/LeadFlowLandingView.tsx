import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Globe,
  Inbox,
  KeyRound,
  Layers,
  Lock,
  Mail,
  MapPin,
  Moon,
  Palette,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Workflow,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LeadFlowLandingViewProps {
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
  onEnterWorkspace?: () => void;
}

type BrandThemeMode = 'brand' | 'light' | 'dark';
type NexusModuleKey = 'portal' | 'outreach' | 'pipeline' | 'vault';
type LegalModalType = 'privacy' | 'terms' | null;

type InquiryFocus =
  | 'On-Demand Data Intelligence'
  | 'Managed Outbound Growth'
  | 'NexusFlow Platform Access'
  | 'B2B Lead Generation & Verified Decision-Maker Intelligence'
  | 'Custom Data Intelligence, Web Scraping & Account Enrichment'
  | 'Automated Outbound Pipeline Systems'
  | 'AI-Powered Customer Response & CRM Automation Workflows';

interface InquiryFormState {
  name: string;
  email: string;
  companyWebsite: string;
  focus: InquiryFocus;
  notes: string;
}

const ALM_NEXUS_LOGO_PATH = '/assets/aistudio/1771048398683_15e1bf38.jpg';

const OFFICIAL_SOCIAL_LINKS = [
  {
    name: 'LinkedIn',
    href: 'https://www.linkedin.com/company/almnexus/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
      </svg>
    )
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/almnexus/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    )
  },
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/share/1CPfabuMZf/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
      </svg>
    )
  },
  {
    name: 'X',
    href: 'https://x.com/almnexus50408',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  },
  {
    name: 'GitHub',
    href: 'https://github.com/ARtechahad',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    )
  }
];

const AlmNexusEmblemFallback: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#062B3D" stroke="#06B6D4" strokeWidth="1.2" />
    <path
      d="M9 22L16 8.5L23 22"
      stroke="#FFFFFF"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M11.6 17.5H20.4" stroke="#06B6D4" strokeWidth="1.9" strokeLinecap="round" />
    <circle cx="16" cy="8.5" r="2" fill="#FFFFFF" />
    <circle cx="9" cy="22" r="1.75" fill="#005B9F" />
    <circle cx="23" cy="22" r="1.75" fill="#06B6D4" />
  </svg>
);

const AlmNexusLogoMark: React.FC<{
  surfaceIsDark: boolean;
  className?: string;
}> = ({ surfaceIsDark, className = 'h-8' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return <AlmNexusEmblemFallback className="w-8 h-8 shrink-0" />;
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 transition-all ${
        surfaceIsDark
          ? 'bg-white px-2.5 py-1 rounded-lg shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <img
        src={ALM_NEXUS_LOGO_PATH}
        alt="ALM Nexus Logo"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`${className} w-auto object-contain`}
      />
    </span>
  );
};

/* IntersectionObserver scroll-reveal helper */
const RevealBlock: React.FC<{ children: React.ReactNode; className?: string; delayMs?: number }> = ({
  children,
  className = '',
  delayMs = 0
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
    >
      {children}
    </div>
  );
};

/* Theme-Aware Interactive 3D Rotating B2B Intelligence Sphere on HTML5 Canvas */
const InteractiveIntelligenceGlobe: React.FC<{ themeMode: BrandThemeMode }> = ({ themeMode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef<BrandThemeMode>(themeMode);
  themeRef.current = themeMode;

  const dragRef = useRef<{
    isDragging: boolean;
    lastX: number;
    lastY: number;
    rotY: number;
    rotX: number;
    hoverX: number;
    hoverY: number;
  }>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    rotY: 0.45,
    rotX: 0.22,
    hoverX: 0,
    hoverY: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    interface SphereNode {
      x: number;
      y: number;
      z: number;
      hubLabel?: string;
      variant: 'cyan' | 'royal' | 'navy';
    }

    const nodes: SphereNode[] = [];
    const totalPoints = 108;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    const regionalHubs: Record<number, { label: string; variant: SphereNode['variant'] }> = {
      10: { label: 'US · New York', variant: 'cyan' },
      28: { label: 'UK · London', variant: 'royal' },
      48: { label: 'EU · Berlin', variant: 'cyan' },
      68: { label: 'UAE · Dubai', variant: 'royal' },
      86: { label: 'PK · Islamabad HQ', variant: 'cyan' }
    };

    for (let i = 0; i < totalPoints; i++) {
      const y = 1 - (i / (totalPoints - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      const hub = regionalHubs[i];
      nodes.push({
        x,
        y,
        z,
        hubLabel: hub?.label,
        variant: hub ? hub.variant : i % 3 === 0 ? 'cyan' : i % 2 === 0 ? 'royal' : 'navy'
      });
    }

    const arcs: Array<{ from: number; to: number; speed: number; offset: number }> = [
      { from: 86, to: 68, speed: 0.42, offset: 0.0 },
      { from: 68, to: 28, speed: 0.36, offset: 0.25 },
      { from: 28, to: 10, speed: 0.38, offset: 0.5 },
      { from: 86, to: 48, speed: 0.34, offset: 0.7 },
      { from: 48, to: 10, speed: 0.31, offset: 0.85 }
    ];

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };

    resize();
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    }

    let rafId = 0;
    const startTime = performance.now();

    const renderFrame = (now: number) => {
      const elapsed = (now - startTime) * 0.001;
      if (!dragRef.current.isDragging && !prefersReduced) {
        dragRef.current.rotY += 0.0032;
      }

      const mode = themeRef.current;
      const isLight = mode === 'light';

      const rx = dragRef.current.rotX + dragRef.current.hoverY * 0.16;
      const ry = dragRef.current.rotY + dragRef.current.hoverX * 0.18;

      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const sphereRadius = Math.min(width, height) * 0.36;
      const fov = sphereRadius * 3.1;

      // Ambient radial glow behind the 3D sphere adapted per theme
      const glow = ctx.createRadialGradient(cx, cy, sphereRadius * 0.15, cx, cy, sphereRadius * 1.45);
      if (isLight) {
        glow.addColorStop(0, 'rgba(0, 91, 159, 0.14)');
        glow.addColorStop(0.55, 'rgba(6, 182, 212, 0.08)');
        glow.addColorStop(1, 'rgba(248, 250, 252, 0)');
      } else if (mode === 'brand') {
        glow.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
        glow.addColorStop(0.55, 'rgba(0, 91, 159, 0.16)');
        glow.addColorStop(1, 'rgba(6, 43, 61, 0)');
      } else {
        glow.addColorStop(0, 'rgba(0, 91, 159, 0.26)');
        glow.addColorStop(0.55, 'rgba(6, 182, 212, 0.12)');
        glow.addColorStop(1, 'rgba(5, 8, 17, 0)');
      }
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Subtle orbital rings
      ctx.strokeStyle = isLight ? 'rgba(11, 37, 69, 0.12)' : 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, sphereRadius * 1.18, sphereRadius * 0.34, -0.22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = isLight ? 'rgba(0, 91, 159, 0.18)' : 'rgba(6, 182, 212, 0.18)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, sphereRadius * 1.06, sphereRadius * 0.98, 0.4, 0, Math.PI * 2);
      ctx.stroke();

      const projected = nodes.map((n, idx) => {
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.z * cosY + n.x * sinY;
        const y2 = n.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + n.y * sinX;

        const px = x1 * sphereRadius;
        const py = y2 * sphereRadius;
        const pz = z2 * sphereRadius;

        const scale = fov / (fov + pz);
        let color = '#06B6D4';
        if (isLight) {
          color = n.variant === 'cyan' ? '#0891B2' : n.variant === 'royal' ? '#005B9F' : '#0B2545';
        } else {
          color = n.variant === 'cyan' ? '#06B6D4' : n.variant === 'royal' ? '#38BDF8' : '#005B9F';
        }

        return {
          idx,
          sx: cx + px * scale,
          sy: cy + py * scale,
          pz,
          scale,
          depth: (1 - z2) * 0.5,
          hubLabel: n.hubLabel,
          color
        };
      });

      // Sparse neural mesh edges
      ctx.lineWidth = 0.8;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        if (a.depth < 0.25) continue;
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j];
          if (b.depth < 0.25) continue;
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const distSq = dx * dx + dy * dy;
          const maxDist = sphereRadius * 0.44;
          if (distSq < maxDist * maxDist) {
            const alpha = (1 - Math.sqrt(distSq) / maxDist) * (isLight ? 0.26 : 0.24) * Math.min(a.depth, b.depth);
            ctx.strokeStyle = isLight
              ? `rgba(0, 91, 159, ${alpha.toFixed(3)})`
              : `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      // Data-pulse arcs between regional hubs
      arcs.forEach((arc) => {
        const from = projected[arc.from];
        const to = projected[arc.to];
        if (!from || !to) return;

        const midX = (from.sx + to.sx) * 0.5;
        const midY = (from.sy + to.sy) * 0.5;
        const ctrlX = cx + (midX - cx) * 1.28;
        const ctrlY = cy + (midY - cy) * 1.28;

        const avgDepth = (from.depth + to.depth) * 0.5;
        ctx.strokeStyle = isLight
          ? `rgba(0, 91, 159, ${(0.22 + avgDepth * 0.34).toFixed(3)})`
          : `rgba(6, 182, 212, ${(0.2 + avgDepth * 0.34).toFixed(3)})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(from.sx, from.sy);
        ctx.quadraticCurveTo(ctrlX, ctrlY, to.sx, to.sy);
        ctx.stroke();

        const t = prefersReduced ? 0.5 : (elapsed * arc.speed + arc.offset) % 1;
        const inv = 1 - t;
        const px = inv * inv * from.sx + 2 * inv * t * ctrlX + t * t * to.sx;
        const py = inv * inv * from.sy + 2 * inv * t * ctrlY + t * t * to.sy;

        ctx.fillStyle = isLight ? '#005B9F' : '#E0F2FE';
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isLight ? 'rgba(6, 182, 212, 0.35)' : 'rgba(6, 182, 212, 0.4)';
        ctx.beginPath();
        ctx.arc(px, py, 6.2, 0, Math.PI * 2);
        ctx.fill();
      });

      const sorted = [...projected].sort((a, b) => b.pz - a.pz);

      sorted.forEach((p) => {
        const isHub = Boolean(p.hubLabel);
        const alpha = Math.max(0.2, Math.min(1, p.depth * 0.95 + 0.15));
        const r = (isHub ? 4.3 : 2.15) * p.scale;

        if (isHub) {
          ctx.fillStyle = isLight
            ? `rgba(0, 91, 159, ${(alpha * 0.22).toFixed(3)})`
            : `rgba(6, 182, 212, ${(alpha * 0.3).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();

        if (isHub && p.depth > 0.48 && p.hubLabel) {
          ctx.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
          const textW = ctx.measureText(p.hubLabel).width;
          const tagX = p.sx + 10;
          const tagY = p.sy - 9;

          ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(6, 43, 61, 0.9)';
          ctx.strokeStyle = isLight ? 'rgba(11, 37, 69, 0.16)' : 'rgba(6, 182, 212, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, textW + 12, 18, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isLight ? '#0B2545' : '#F8FAFC';
          ctx.fillText(p.hubLabel, tagX + 6, tagY + 12.5);
        }
        ctx.globalAlpha = 1;
      });

      if (!prefersReduced) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [themeMode]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.isDragging = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current.hoverX = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    dragRef.current.hoverY = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;

    if (dragRef.current.isDragging) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.rotY += dx * 0.008;
      dragRef.current.rotX = Math.max(-0.85, Math.min(0.85, dragRef.current.rotX + dy * 0.006));
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.isDragging = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const isLight = themeMode === 'light';
  const containerClass = isLight
    ? 'border-slate-200 bg-[#F8FAFC]'
    : themeMode === 'brand'
      ? 'border-cyan-400/20 bg-[#052231]/85'
      : 'border-white/10 bg-[#070B16]/90';

  const hudClass = isLight
    ? 'border-slate-200 bg-white/90 text-[#0B2545] shadow-sm'
    : 'border-white/15 bg-[#062B3D]/80 text-white backdrop-blur-md';

  const hudSubtleClass = isLight ? 'text-slate-600' : 'text-slate-300';

  return (
    <div className={`relative w-full h-[420px] sm:h-[470px] rounded-2xl border overflow-hidden transition-colors ${containerClass}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          dragRef.current.isDragging = false;
          dragRef.current.hoverX = 0;
          dragRef.current.hoverY = 0;
        }}
        aria-label="Interactive 3D Global B2B Intelligence Sphere"
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Floating Glassmorphic Telemetry Badges */}
      <div className={`pointer-events-none absolute top-4 left-4 rounded-xl border px-3.5 py-2.5 ${hudClass}`}>
        <div className={`text-[11px] font-mono font-semibold ${isLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
          Multi-Layer SMTP/MX Verified
        </div>
        <div className={`text-xs font-medium mt-0.5 ${hudSubtleClass}`}>Bounce-Protected Delivery</div>
      </div>

      <div className={`pointer-events-none hidden sm:block absolute top-4 right-4 rounded-xl border px-3.5 py-2.5 text-right ${hudClass}`}>
        <div className={`text-[11px] font-mono font-semibold ${isLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
          ICP Signal Enrichment
        </div>
        <div className={`text-xs font-medium mt-0.5 ${hudSubtleClass}`}>Founders · C-Suite · VPs</div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
        <div className={`rounded-xl border px-3.5 py-2 ${hudClass}`}>
          <div className={`text-[11px] font-mono font-semibold ${isLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
            NexusFlow Pipeline Sync
          </div>
          <div className={`text-xs font-medium mt-0.5 ${hudSubtleClass}`}>US · UK · UAE · Europe</div>
        </div>
        <div
          className={`rounded-xl border px-3 py-1.5 text-[11px] font-mono ${
            isLight
              ? 'border-slate-200 bg-white/85 text-slate-600'
              : 'border-white/12 bg-[#062B3D]/70 text-slate-300 backdrop-blur-md'
          }`}
        >
          Drag to rotate 3D globe
        </div>
      </div>
    </div>
  );
};

/* Theme-Aware 3D Mouse-Tracking Tilt + Cursor-Following Radial Spotlight Card */
const TiltSpotlightCard: React.FC<{
  children: React.ReactNode;
  surfaceMode: 'light' | 'dark' | 'teal';
  className?: string;
}> = ({ children, surfaceMode, className = '' }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(1, rect.width);
    const py = (e.clientY - rect.top) / Math.max(1, rect.height);
    setTilt({
      rx: (0.5 - py) * 6.5,
      ry: (px - 0.5) * 6.5,
      mx: px * 100,
      my: py * 100,
      active: true
    });
  };

  const handleMouseLeave = () => {
    setTilt((prev) => ({ ...prev, rx: 0, ry: 0, active: false }));
  };

  const surfaceStyles =
    surfaceMode === 'light'
      ? 'border-slate-200 bg-white hover:border-[#005B9F]/40 shadow-[0_1px_3px_rgba(11,37,69,0.05)]'
      : surfaceMode === 'teal'
        ? 'border-cyan-400/20 bg-[#073348]/85 hover:border-cyan-400/50'
        : 'border-white/10 bg-[#0B1120]/90 hover:border-cyan-400/40';

  const spotlightColor =
    surfaceMode === 'light'
      ? 'rgba(0, 91, 159, 0.08)'
      : 'rgba(6, 182, 212, 0.16)';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: tilt.active
          ? 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)'
          : 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      className={`relative rounded-2xl border overflow-hidden will-change-transform transition-colors ${surfaceStyles} ${className}`}
    >
      <div
        aria-hidden="true"
        style={{
          opacity: tilt.active ? 1 : 0,
          background: `radial-gradient(500px circle at ${tilt.mx}% ${tilt.my}%, ${spotlightColor}, transparent 68%)`
        }}
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};

export const LeadFlowLandingView: React.FC<LeadFlowLandingViewProps> = ({
  onOpenSignIn,
  onOpenSignUp,
  onEnterWorkspace
}) => {
  const { currentUser, setActiveTab, showToast } = useApp();

  // Default to Brand Signature ('brand')
  const [themeMode, setThemeMode] = useState<BrandThemeMode>('brand');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activePipelineStage, setActivePipelineStage] = useState<number>(0);
  const [activeNexusModule, setActiveNexusModule] = useState<NexusModuleKey>('portal');
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const [inquiryForm, setInquiryForm] = useState<InquiryFormState>({
    name: '',
    email: '',
    companyWebsite: '',
    focus: 'On-Demand Data Intelligence',
    notes: ''
  });
  const [inquiryError, setInquiryError] = useState<string | null>(null);
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'ALM Nexus — AI Lead Generation & Automation | NexusFlow';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const updateScroll = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      setScrollProgress(Math.min(1, Math.max(0, window.scrollY / maxScroll)));
    };
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isInquiryModalOpen) setIsInquiryModalOpen(false);
        if (legalModal) setLegalModal(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInquiryModalOpen, legalModal]);

  const handleClientSignIn = () => {
    if (currentUser) {
      if (onEnterWorkspace) onEnterWorkspace();
      else setActiveTab('overview');
    } else if (onOpenSignIn) {
      onOpenSignIn();
    }
  };

  const handleLaunchWorkspace = () => {
    if (currentUser) {
      if (onEnterWorkspace) onEnterWorkspace();
      else setActiveTab('overview');
    } else if (onOpenSignUp) {
      onOpenSignUp();
    } else if (onOpenSignIn) {
      onOpenSignIn();
    }
  };

  const openInquiryModal = (focus: InquiryFocus = 'On-Demand Data Intelligence') => {
    setInquiryForm((prev) => ({ ...prev, focus }));
    setInquiryError(null);
    setInquirySubmitted(false);
    setIsInquiryModalOpen(true);
  };

  const buildBriefText = () => {
    return [
      `ALM Nexus Inquiry — ${inquiryForm.focus}`,
      `Name: ${inquiryForm.name.trim()}`,
      `Work Email: ${inquiryForm.email.trim()}`,
      `Company Website: ${inquiryForm.companyWebsite.trim() || 'Not specified'}`,
      `Service / Engagement Model: ${inquiryForm.focus}`,
      `Target ICP & Notes: ${inquiryForm.notes.trim()}`
    ].join('\n');
  };

  const buildMailtoHref = () => {
    const subject = encodeURIComponent(
      `[almnexus.tech] ${inquiryForm.focus} — ${inquiryForm.companyWebsite.trim() || inquiryForm.name.trim()}`
    );
    const body = encodeURIComponent(buildBriefText());
    return `mailto:almnexus26@gmail.com?cc=contact@abdulahadrana.me&subject=${subject}&body=${body}`;
  };

  const handleSubmitInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryError(null);

    const trimmedName = inquiryForm.name.trim();
    const trimmedEmail = inquiryForm.email.trim();
    const trimmedNotes = inquiryForm.notes.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setInquiryError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setInquiryError('Please enter a valid work email address.');
      return;
    }
    if (!trimmedNotes || trimmedNotes.length < 10) {
      setInquiryError('Please outline your target ICP, industry, or outbound goals.');
      return;
    }

    setInquirySubmitted(true);
    if (showToast) {
      showToast('Consultation brief prepared for almnexus26@gmail.com.', 'success');
    }
  };

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard.writeText(buildBriefText());
      setCopiedBrief(true);
      if (showToast) showToast('Inquiry brief copied to clipboard.', 'success');
      setTimeout(() => setCopiedBrief(false), 2500);
    } catch {
      if (showToast) showToast('Clipboard copy failed. Please copy the text manually.', 'error');
    }
  };

  // Theme flags per section
  // Brand Signature: Hero, Header, NexusFlow Stage, Footer = Teal-Navy dark; Middle editorial sections = Crisp White
  const isFullLight = themeMode === 'light';
  const isFullDark = themeMode === 'dark';
  const isBrand = themeMode === 'brand';

  const headerIsDark = isBrand || isFullDark;
  const heroIsDark = isBrand || isFullDark;
  const contentSectionsLight = isBrand || isFullLight;
  const nexusStageIsDark = isBrand || isFullDark;
  const footerIsDark = isBrand || isFullDark;
  const modalIsDark = !isFullLight;

  const pipelineStages = [
    {
      step: '01',
      title: 'Smart Prospecting & Scraping',
      protocol: 'Python Extraction + ICP Filtering',
      description:
        'Automated Python web scraping and analyst-guided ICP discovery assemble clean target accounts across niche directories, registries, and buying signals.',
      outputs: ['Executive & decision-maker targeting', 'Off-market & niche data extraction', 'Industry, headcount & regional filtering']
    },
    {
      step: '02',
      title: 'Multi-Layer MX / SMTP Verification',
      protocol: 'Syntax · DNS · Mailbox Handshake',
      description:
        'Every prospect record undergoes syntax inspection, domain MX resolution, catch-all screening, and live SMTP mailbox verification before delivery.',
      outputs: ['Bounce-protected corporate email lists', 'Invalid & trap domain elimination', 'Transparent verification audit trail']
    },
    {
      step: '03',
      title: 'AI Data Enrichment',
      protocol: 'Schema Normalization & Deduplication',
      description:
        'Accounts are enriched with role intelligence, firmographic metadata, and strict cross-batch deduplication ready for personalized outbound.',
      outputs: ['CRM-ready HubSpot / Salesforce schemas', 'Account-level personalization triggers', 'Zero duplicate contact records']
    },
    {
      step: '04',
      title: 'Automated Multi-Channel Outreach',
      protocol: 'NexusFlow Sequences & Reply Triage',
      description:
        'Verified datasets deploy directly into authenticated sending infrastructure and multi-step sequences—tracked live inside your NexusFlow workspace.',
      outputs: ['SPF, DKIM & DMARC domain alignment', 'Multi-step cold email & follow-up cadences', 'Centralized reply & pipeline tracking']
    }
  ];

  const servicePillars: Array<{
    index: string;
    title: string;
    focusValue: InquiryFocus;
    icon: React.ReactNode;
    summary: string;
    deliverables: string[];
  }> = [
    {
      index: '01.',
      title: 'B2B Lead Generation & Verified Decision-Maker Intelligence',
      focusValue: 'B2B Lead Generation & Verified Decision-Maker Intelligence',
      icon: <Users className="w-4 h-4" />,
      summary:
        'Founder, C-Suite, VP, and Director targeting mapped to your exact ICP—verified through multi-step syntax, MX, and SMTP bounce-protected validation.',
      deliverables: [
        'Executive & buying-committee contact mapping',
        'Multi-layer MX & SMTP bounce-protected verification',
        'Filtered by headcount, vertical & growth signals'
      ]
    },
    {
      index: '02.',
      title: 'Custom Data Intelligence, Web Scraping & Account Enrichment',
      focusValue: 'Custom Data Intelligence, Web Scraping & Account Enrichment',
      icon: <Database className="w-4 h-4" />,
      summary:
        'Automated Python web scraping, niche and off-market data extraction, account mapping, and deduplicated CRM enrichment built to specification.',
      deliverables: [
        'Automated Python scraping pipelines for niche sources',
        'Account mapping & firmographic enrichment',
        'Deduplicated exports ready for HubSpot, Salesforce, or NexusFlow'
      ]
    },
    {
      index: '03.',
      title: 'Automated Outbound Pipeline Systems (Cold Email & Multi-Channel)',
      focusValue: 'Automated Outbound Pipeline Systems',
      icon: <Send className="w-4 h-4" />,
      summary:
        'Dedicated sending domain and DNS deliverability architecture, personalized multi-step sequences, automated follow-ups, and structured reply triage.',
      deliverables: [
        'Dedicated sending domains with SPF, DKIM & DMARC',
        'Personalized multi-step cold email sequences',
        'Automated follow-ups & positive-reply triage'
      ]
    },
    {
      index: '04.',
      title: 'AI-Powered Customer Response & CRM Automation Workflows',
      focusValue: 'AI-Powered Customer Response & CRM Automation Workflows',
      icon: <Workflow className="w-4 h-4" />,
      summary:
        'AI reply intent classification, automated lead qualification and routing, plus custom webhook and CRM workflow automation.',
      deliverables: [
        'AI-assisted reply intent classification',
        'Automated lead qualification & team routing',
        'Signed webhook & CRM workflow automation'
      ]
    }
  ];

  const targetVerticals = [
    'B2B SaaS',
    'Growth Agencies',
    'Real Estate Investors',
    'FinTech',
    'Enterprise Services'
  ];

  const nexusModules: Record<
    NexusModuleKey,
    {
      label: string;
      badge: string;
      title: string;
      description: string;
      icon: React.ReactNode;
      specs: Array<{ key: string; value: string }>;
      capabilities: string[];
    }
  > = {
    portal: {
      label: 'Client Portal',
      badge: 'Multi-Tenant RBAC',
      title: 'Multi-Tenant Client Portal & Isolated Workspaces',
      description:
        'Give every client organization isolated multi-company workspaces with strict department-level RBAC, structured onboarding, and live deliverable visibility.',
      icon: <ShieldCheck className="w-4 h-4" />,
      specs: [
        { key: 'Tenant Isolation', value: 'Company-Scoped Workspaces' },
        { key: 'Access Control', value: 'Per-Department Module Locks' },
        { key: 'Client Visibility', value: 'Live Deliverable Portal' }
      ],
      capabilities: [
        'Company Owners configure allowed modules per department',
        'Department Heads & specialists operate within strict scoped tools',
        'Clients review delivered prospect batches & milestones directly'
      ]
    },
    outreach: {
      label: 'Automated Outreach',
      badge: 'Resend & SMTP',
      title: 'Automated Outreach Engine & Unified Inbox',
      description:
        'Connect Resend or business SMTP mailboxes to launch multi-step email sequences, automate follow-ups, and manage all prospect replies inside one centralized inbox.',
      icon: <Inbox className="w-4 h-4" />,
      specs: [
        { key: 'Mail Transport', value: 'Resend API & Custom SMTP' },
        { key: 'Sequence Engine', value: 'Multi-Step Follow-Ups' },
        { key: 'Reply Workflow', value: 'Unified Prospect Inbox' }
      ],
      capabilities: [
        'Verify custom business sending domains in minutes',
        'Launch multi-stage campaigns straight from verified ICP lists',
        'Triage inbound prospect replies from a unified team inbox'
      ]
    },
    pipeline: {
      label: 'CRM & Pipeline',
      badge: 'Operations Suite',
      title: 'CRM, Deal Pipeline & Departmental Operations',
      description:
        'Manage accounts from raw lead intake to closed deals with structured deal stages, departmental sprint tasks, and clear operational accountability.',
      icon: <Layers className="w-4 h-4" />,
      specs: [
        { key: 'Deal Lifecycle', value: 'Lead-to-Close Stages' },
        { key: 'Task Ops', value: 'Departmental Sprint Boards' },
        { key: 'Team Sync', value: 'Private Department Chat' }
      ],
      capabilities: [
        'Move qualified replies directly into structured deal stages',
        'Assign tasks across Research, Data Engineering & Outbound units',
        'Maintain clear accountability across every active engagement'
      ]
    },
    vault: {
      label: 'AI & BYOK Vault',
      badge: 'Encrypted Vault',
      title: 'AI Intelligence & Encrypted Integrations Vault (BYOK)',
      description:
        'Built-in AI prospect enrichment paired with an encrypted Bring Your Own Key vault supporting Resend, Apollo, Hunter, Stripe, and custom webhooks.',
      icon: <KeyRound className="w-4 h-4" />,
      specs: [
        { key: 'Key Storage', value: 'Encrypted BYOK Vault' },
        { key: 'Integrations', value: 'Resend · Apollo · Hunter · Stripe' },
        { key: 'Automation', value: 'Signed Inbound Webhooks' }
      ],
      capabilities: [
        'Store provider API credentials isolated per client company',
        'Enrich prospect domains & classify replies with AI assistance',
        'Connect external scrapers & n8n workflows via signed webhooks'
      ]
    }
  };

  const operationalStandards = [
    {
      code: '01',
      title: 'Multi-Layer SMTP & MX Verification',
      detail:
        'Every prospect email undergoes syntax inspection, domain MX resolution, and live SMTP verification before delivery—protecting your domain reputation.'
    },
    {
      code: '02',
      title: '100% Custom-Sourced ICP Lists',
      detail:
        'Zero recycled databases. Every list is researched and extracted fresh against your exact decision-maker titles, firmographics, and regional criteria.'
    },
    {
      code: '03',
      title: '48–72 Hour Sprint Turnaround',
      detail:
        'Structured research and Python extraction sprints deliver audited, CRM-ready B2B datasets on a predictable 48 to 72 hour turnaround.'
    },
    {
      code: '04',
      title: 'Live Portal Transparency in NexusFlow',
      detail:
        'Every engagement operates through NexusFlow so your team has full real-time visibility into deliverables, sequences, and pipeline activity.'
    }
  ];

  const engagementModels = [
    {
      index: '01.',
      title: 'On-Demand Data Intelligence',
      fit: 'For sales teams needing verified target accounts fast',
      description:
        'Custom ICP decision-maker lists, automated Python web scraping, and CRM-ready enrichment delivered on a rapid 48–72 hour sprint cycle.',
      scope: [
        'Founder, C-Suite & VP contact mapping by exact ICP',
        'Multi-layer MX & SMTP bounce-protected verification',
        'Deduplicated CSV, Sheets, or webhook delivery'
      ],
      ctaLabel: 'Request Custom Data Sample',
      action: () => openInquiryModal('On-Demand Data Intelligence'),
      primary: false
    },
    {
      index: '02.',
      title: 'Managed Outbound Growth',
      fit: 'For B2B founders & agencies scaling qualified pipeline',
      description:
        'End-to-end B2B lead generation, sending infrastructure, sequence execution, and reply management operated directly by the ALM Nexus team.',
      scope: [
        'Continuous custom ICP sourcing & AI enrichment',
        'Dedicated sending domains, DNS & copywriting',
        'Live campaign transparency in NexusFlow Client Portal'
      ],
      ctaLabel: 'Book Strategy Call',
      action: () => openInquiryModal('Managed Outbound Growth'),
      primary: false
    },
    {
      index: '03.',
      title: 'NexusFlow Platform Access',
      fit: 'For agencies & B2B teams running their own operations',
      description:
        'Direct SaaS workspace access to run multi-tenant client portals, Resend/SMTP outreach sequences, deal pipelines, and encrypted BYOK integrations.',
      scope: [
        'Multi-company workspaces with department RBAC',
        'Automated Outreach Engine & Unified Inbox',
        'AI enrichment & encrypted BYOK Integrations Vault'
      ],
      ctaLabel: 'Launch NexusFlow / Create Workspace',
      action: handleLaunchWorkspace,
      primary: true
    }
  ];

  const currentPipeline = pipelineStages[activePipelineStage];
  const activeModule = nexusModules[activeNexusModule];

  const rootBg = isFullDark
    ? 'bg-[#050811] text-slate-100'
    : 'bg-white text-[#0B2545]';

  const headerClasses = isBrand
    ? 'bg-[#062B3D]/95 border-white/15 text-white'
    : isFullDark
      ? 'bg-[#050811]/90 border-white/10 text-white'
      : 'bg-white/95 border-slate-200 text-[#0B2545]';

  const heroSectionClasses = isBrand
    ? 'bg-gradient-to-br from-[#062B3D] via-[#08394F] to-[#0E4D64] text-white border-b border-white/10'
    : isFullDark
      ? 'bg-[#050811] text-white border-b border-white/10'
      : 'bg-white text-[#0B2545] border-b border-slate-200';

  const contentSectionBg = contentSectionsLight
    ? 'bg-white text-[#0B2545] border-b border-slate-200'
    : 'bg-[#050811] text-slate-100 border-b border-white/10';

  const altContentSectionBg = contentSectionsLight
    ? 'bg-[#F8FAFC] text-[#0B2545] border-b border-slate-200'
    : 'bg-[#070B16] text-slate-100 border-b border-white/10';

  const nexusSectionClasses = isBrand
    ? 'bg-gradient-to-br from-[#062B3D] via-[#083A50] to-[#0E4D64] text-white border-b border-white/10'
    : isFullDark
      ? 'bg-[#060913] text-white border-b border-white/10'
      : 'bg-[#F8FAFC] text-[#0B2545] border-b border-slate-200';

  const footerClasses = isBrand
    ? 'bg-[#062B3D] text-slate-200 border-t border-white/15'
    : isFullDark
      ? 'bg-[#050811] text-slate-400 border-t border-white/10'
      : 'bg-[#F8FAFC] text-slate-600 border-t border-slate-200';

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-[#005B9F] selection:text-white relative overflow-x-hidden transition-colors duration-200 ${rootBg}`}>
      <style>{`
        @keyframes almBeamFlow {
          0% { stroke-dashoffset: 36; }
          100% { stroke-dashoffset: 0; }
        }
        .alm-beam-animate {
          stroke-dasharray: 6 6;
          animation: almBeamFlow 1.4s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .alm-beam-animate {
            animation: none;
          }
        }
      `}</style>

      {/* Scroll-Reactive Glowing Top Progress Beam */}
      <div aria-hidden="true" className="fixed top-0 left-0 right-0 h-[2px] z-50 pointer-events-none">
        <div
          style={{ transform: `scaleX(${scrollProgress})`, transformOrigin: '0% 50%' }}
          className="h-full w-full bg-gradient-to-r from-[#005B9F] via-[#06B6D4] to-[#38BDF8] shadow-[0_0_10px_rgba(6,182,212,0.75)] transition-transform duration-75"
        />
      </div>

      {/* FLOATING GLASSMORPHIC NAVBAR WITH 3-THEME SWITCHER */}
      <header className={`sticky top-0 z-40 w-full backdrop-blur-xl border-b transition-colors duration-200 ${headerClasses}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Uploaded ALM Nexus Logo + Wordmark */}
          <a
            href="#"
            className="inline-flex items-center gap-2.5 text-base sm:text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0"
          >
            <AlmNexusLogoMark surfaceIsDark={headerIsDark} className="h-7" />
            <span className={headerIsDark ? 'text-white' : 'text-[#0B2545]'}>ALM Nexus</span>
          </a>

          {/* Zone 2: Concise Single-Line Section Links */}
          <nav
            aria-label="Primary Navigation"
            className={`hidden xl:flex items-center gap-6 text-sm font-medium ${
              headerIsDark ? 'text-slate-200' : 'text-slate-600'
            }`}
          >
            <a href="#pipeline" className={`transition-colors whitespace-nowrap shrink-0 ${headerIsDark ? 'hover:text-cyan-300' : 'hover:text-[#005B9F]'}`}>
              Pipeline
            </a>
            <a href="#services" className={`transition-colors whitespace-nowrap shrink-0 ${headerIsDark ? 'hover:text-cyan-300' : 'hover:text-[#005B9F]'}`}>
              Services
            </a>
            <a href="#nexusflow" className={`transition-colors whitespace-nowrap shrink-0 ${headerIsDark ? 'hover:text-cyan-300' : 'hover:text-[#005B9F]'}`}>
              NexusFlow
            </a>
            <a href="#standards" className={`transition-colors whitespace-nowrap shrink-0 ${headerIsDark ? 'hover:text-cyan-300' : 'hover:text-[#005B9F]'}`}>
              Standards
            </a>
            <a href="#contact" className={`transition-colors whitespace-nowrap shrink-0 ${headerIsDark ? 'hover:text-cyan-300' : 'hover:text-[#005B9F]'}`}>
              Contact
            </a>
          </nav>

          {/* Zone 3: 3-Theme Switcher + Auth Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Segmented 3-Theme Switcher */}
            <div
              role="group"
              aria-label="Color Theme Switcher"
              className={`inline-flex items-center p-0.5 rounded-lg border text-[11px] font-semibold shrink-0 ${
                headerIsDark
                  ? 'border-white/15 bg-black/25'
                  : 'border-slate-200 bg-slate-100'
              }`}
            >
              {(
                [
                  { id: 'brand', label: 'Brand', icon: <Palette className="w-3 h-3" /> },
                  { id: 'light', label: 'White', icon: <Sun className="w-3 h-3" /> },
                  { id: 'dark', label: 'Dark', icon: <Moon className="w-3 h-3" /> }
                ] as const
              ).map((item) => {
                const active = themeMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setThemeMode(item.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? headerIsDark
                          ? 'bg-[#005B9F] text-white shadow-xs'
                          : 'bg-white text-[#0B2545] shadow-xs'
                        : headerIsDark
                          ? 'text-slate-300 hover:text-white'
                          : 'text-slate-600 hover:text-[#0B2545]'
                    }`}
                  >
                    {item.icon}
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleClientSignIn}
              className={`hidden md:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                headerIsDark
                  ? 'border-white/20 text-white hover:bg-white/10'
                  : 'border-slate-300 text-[#0B2545] hover:bg-slate-100'
              }`}
            >
              {currentUser ? 'Open Workspace' : 'Client Sign In'}
            </button>

            <button
              type="button"
              onClick={handleLaunchWorkspace}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#005B9F] hover:bg-[#004A82] text-white shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{currentUser ? 'Enter NexusFlow' : 'Launch NexusFlow'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 1. HERO SECTION — Split Enterprise Layout + 3D Canvas Sphere */}
        <section className={`relative py-16 sm:py-24 overflow-hidden transition-colors duration-200 ${heroSectionClasses}`}>
          {/* Subtle Brand Ambient Glow */}
          {heroIsDark && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_75%_25%,rgba(6,182,212,0.16),transparent_65%)]"
            />
          )}

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
              {/* Left Proposition Column */}
              <div className="lg:col-span-6 space-y-7">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${
                        heroIsDark
                          ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-300'
                          : 'border-[#005B9F]/25 bg-[#005B9F]/5 text-[#005B9F]'
                      }`}
                    >
                      Connect. Automate. Grow.
                    </span>
                    <span className={`text-xs font-mono ${heroIsDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      AI Lead Generation &amp; Automation
                    </span>
                  </div>

                  <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono ${heroIsDark ? 'text-cyan-200/90' : 'text-slate-600'}`}>
                    <span>almnexus.tech</span>
                    <span aria-hidden="true">·</span>
                    <span>Islamabad, Pakistan</span>
                    <span aria-hidden="true">·</span>
                    <span>Serving US, UK, UAE &amp; Europe</span>
                  </div>

                  <h1 className={`text-[clamp(2.2rem,4vw,3.45rem)] font-extrabold tracking-[-0.03em] leading-[1.07] text-balance ${heroIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    AI Lead Generation &amp; Automation — Powered by Proprietary Technology.
                  </h1>

                  <p className={`text-base sm:text-lg leading-[1.65] max-w-xl ${heroIsDark ? 'text-slate-200' : 'text-slate-600'}`}>
                    ALM Nexus builds hand-verified B2B decision-maker intelligence, custom Python data pipelines, and automated multi-channel outbound systems—backed by our proprietary SaaS platform,{' '}
                    <span className={`font-semibold ${heroIsDark ? 'text-white' : 'text-[#0B2545]'}`}>NexusFlow</span>.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => openInquiryModal('On-Demand Data Intelligence')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[#005B9F] hover:bg-[#004A82] text-white shadow-[0_8px_24px_-6px_rgba(0,91,159,0.5)] transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>Book Strategy Call / Request Sample</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleLaunchWorkspace}
                      className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        heroIsDark
                          ? 'border-white/25 bg-white/5 hover:bg-white/10 text-white'
                          : 'border-slate-300 bg-white hover:bg-slate-50 text-[#0B2545]'
                      }`}
                    >
                      <span>{currentUser ? 'Open NexusFlow' : 'Launch NexusFlow'}</span>
                    </button>
                  </div>

                  <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-1 ${heroIsDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span>Client Portal:</span>
                    <button
                      type="button"
                      onClick={handleClientSignIn}
                      className={`font-semibold hover:underline cursor-pointer ${heroIsDark ? 'text-cyan-300' : 'text-[#005B9F]'}`}
                    >
                      Sign in to NexusFlow
                    </button>
                    <span aria-hidden="true">·</span>
                    <a
                      href="mailto:almnexus26@gmail.com"
                      className={`font-mono transition-colors ${heroIsDark ? 'hover:text-white' : 'hover:text-[#0B2545]'}`}
                    >
                      almnexus26@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Right Interactive 3D Canvas Network */}
              <div className="lg:col-span-6">
                <InteractiveIntelligenceGlobe themeMode={themeMode} />
              </div>
            </div>
          </div>
        </section>

        {/* 2. ANIMATED DATA PIPELINE ARCHITECTURE STRIP */}
        <section id="pipeline" className={`py-20 sm:py-24 transition-colors duration-200 ${altContentSectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <RevealBlock className="max-w-2xl space-y-3">
              <p className={`text-xs font-mono font-semibold ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                Data Pipeline Architecture
              </p>
              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] text-balance ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                From raw ICP signals to verified multi-channel pipeline
              </h2>
              <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Click or hover any pipeline stage below to trace how ALM Nexus sources, verifies, enriches, and operationalizes B2B intelligence.
              </p>
            </RevealBlock>

            <RevealBlock delayMs={70} className="space-y-6">
              <div className="relative grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
                {pipelineStages.map((stage, idx) => {
                  const isActive = activePipelineStage === idx;
                  const isPassed = idx <= activePipelineStage;
                  return (
                    <div key={stage.step} className="relative flex items-stretch">
                      <button
                        type="button"
                        onClick={() => setActivePipelineStage(idx)}
                        onMouseEnter={() => setActivePipelineStage(idx)}
                        className={`w-full text-left rounded-xl border p-5 transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                          contentSectionsLight
                            ? isActive
                              ? 'border-[#005B9F] bg-white shadow-[0_10px_30px_-12px_rgba(0,91,159,0.22)]'
                              : isPassed
                                ? 'border-[#005B9F]/35 bg-white'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            : isActive
                              ? 'border-[#06B6D4] bg-[#0B1120] shadow-[0_0_24px_rgba(6,182,212,0.18)]'
                              : isPassed
                                ? 'border-[#005B9F]/50 bg-[#0B1120]'
                                : 'border-white/10 bg-[#090E1A] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-mono">
                          <span
                            className={
                              isActive
                                ? contentSectionsLight
                                  ? 'text-[#005B9F] font-bold'
                                  : 'text-[#06B6D4] font-bold'
                                : contentSectionsLight
                                  ? 'text-slate-500'
                                  : 'text-slate-400'
                            }
                          >
                            {stage.step}. Stage
                          </span>
                          <span className={`text-[11px] ${contentSectionsLight ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isActive ? 'Active' : 'Inspect'}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className={`text-sm font-bold leading-snug ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                            {stage.title}
                          </div>
                          <div className={`text-xs font-mono ${contentSectionsLight ? 'text-[#005B9F]' : 'text-cyan-300'}`}>
                            {stage.protocol}
                          </div>
                        </div>
                      </button>

                      {/* Animated SVG Connector Beam */}
                      {idx < pipelineStages.length - 1 && (
                        <div aria-hidden="true" className="hidden md:flex items-center justify-center w-6 -mx-1 z-20 shrink-0">
                          <svg viewBox="0 0 28 16" className="w-7 h-4 overflow-visible">
                            <line
                              x1="0"
                              y1="8"
                              x2="24"
                              y2="8"
                              stroke={
                                idx < activePipelineStage
                                  ? contentSectionsLight
                                    ? '#005B9F'
                                    : '#06B6D4'
                                  : contentSectionsLight
                                    ? '#CBD5E1'
                                    : 'rgba(148,163,184,0.35)'
                              }
                              strokeWidth="1.8"
                              className={idx < activePipelineStage ? 'alm-beam-animate' : ''}
                            />
                            <polygon
                              points="22,4 28,8 22,12"
                              fill={
                                idx < activePipelineStage
                                  ? contentSectionsLight
                                    ? '#005B9F'
                                    : '#06B6D4'
                                  : contentSectionsLight
                                    ? '#94A3B8'
                                    : 'rgba(148,163,184,0.45)'
                              }
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Stage Technical Inspector Panel */}
              <div
                className={`rounded-2xl border p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ${
                  contentSectionsLight
                    ? 'border-slate-200 bg-white'
                    : 'border-white/10 bg-[#0B1120]'
                }`}
              >
                <div className="lg:col-span-7 space-y-3">
                  <div className={`text-xs font-mono font-semibold ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                    {currentPipeline.step}. {currentPipeline.protocol}
                  </div>
                  <h3 className={`text-xl font-bold tracking-tight ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                    {currentPipeline.title}
                  </h3>
                  <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    {currentPipeline.description}
                  </p>
                </div>

                <div
                  className={`lg:col-span-5 space-y-2.5 border-t lg:border-t-0 lg:border-l pt-5 lg:pt-0 lg:pl-8 ${
                    contentSectionsLight ? 'border-slate-200' : 'border-white/10'
                  }`}
                >
                  <div className={`text-xs font-mono mb-3 ${contentSectionsLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Stage Technical Deliverables
                  </div>
                  {currentPipeline.outputs.map((out) => (
                    <div
                      key={out}
                      className={`flex items-start gap-2.5 text-xs sm:text-sm ${contentSectionsLight ? 'text-[#0B2545]' : 'text-slate-200'}`}
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`} />
                      <span>{out}</span>
                    </div>
                  ))}
                </div>
              </div>
            </RevealBlock>
          </div>
        </section>

        {/* 3. 3D TILT SPOTLIGHT CARDS — 4 CORE ALM NEXUS AGENCY SERVICES */}
        <section id="services" className={`py-20 sm:py-28 transition-colors duration-200 ${contentSectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <RevealBlock className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl space-y-3">
                <p className={`text-xs font-mono font-semibold ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                  Core Agency Pillars · ALM Nexus
                </p>
                <h2 className={`text-2xl sm:text-4xl font-extrabold tracking-[-0.025em] leading-[1.12] text-balance ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                  Four specialized B2B lead intelligence &amp; automation pillars
                </h2>
                <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Serving growth organizations across the US, UK, UAE, and Europe from our Islamabad headquarters—replacing generic list brokers with verified intelligence and outbound systems.
                </p>
              </div>

              <div
                className={`text-xs space-y-1.5 border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 lg:pl-6 shrink-0 ${
                  contentSectionsLight ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-300'
                }`}
              >
                <div className={`font-semibold ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                  Target Verticals &amp; Markets
                </div>
                <div>{targetVerticals.join(' · ')}</div>
                <div className={`font-mono font-semibold ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                  US · UK · UAE · Europe
                </div>
              </div>
            </RevealBlock>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {servicePillars.map((pillar, idx) => (
                <RevealBlock key={pillar.index} delayMs={idx * 60}>
                  <TiltSpotlightCard
                    surfaceMode={contentSectionsLight ? 'light' : 'dark'}
                    className="h-full p-7 sm:p-8 flex flex-col justify-between"
                  >
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="inline-flex items-center gap-2.5">
                          <span
                            className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center ${
                              contentSectionsLight
                                ? 'border-slate-200 bg-[#F8FAFC] text-[#005B9F]'
                                : 'border-white/12 bg-white/[0.04] text-[#06B6D4]'
                            }`}
                          >
                            {pillar.icon}
                          </span>
                          <span className={`text-xs font-mono font-bold tabular-nums ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                            {pillar.index}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => openInquiryModal(pillar.focusValue)}
                          className={`text-xs font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                            contentSectionsLight ? 'text-[#005B9F]' : 'text-cyan-300'
                          }`}
                        >
                          <span>Scope Service</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className={`text-lg sm:text-xl font-bold tracking-tight ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                        {pillar.title}
                      </h3>

                      <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {pillar.summary}
                      </p>

                      <ul
                        className={`space-y-2.5 pt-4 border-t ${
                          contentSectionsLight ? 'border-slate-200' : 'border-white/10'
                        }`}
                      >
                        {pillar.deliverables.map((item) => (
                          <li
                            key={item}
                            className={`text-xs flex items-start gap-2.5 leading-relaxed ${
                              contentSectionsLight ? 'text-slate-600' : 'text-slate-300'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'
                              }`}
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TiltSpotlightCard>
                </RevealBlock>
              ))}
            </div>
          </div>
        </section>

        {/* 4. 3D ELEVATED STAGE FOR FLAGSHIP PRODUCT: NEXUSFLOW */}
        <section id="nexusflow" className={`relative py-20 sm:py-28 overflow-hidden transition-colors duration-200 ${nexusSectionClasses}`}>
          {nexusStageIsDark && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_45%_at_50%_0%,rgba(6,182,212,0.16),transparent)]"
            />
          )}

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <RevealBlock className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
              <div className="lg:col-span-7 space-y-3">
                <p className={`text-xs font-mono font-semibold ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                  Flagship Proprietary Product · Engineered In-House by ALM Nexus
                </p>
                <h2 className={`text-2xl sm:text-4xl font-extrabold tracking-[-0.025em] leading-[1.12] text-balance ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                  NexusFlow: Built for our own agency operations—now powering modern B2B teams.
                </h2>
              </div>

              <div className="lg:col-span-5 space-y-5">
                <p className={`text-sm leading-[1.65] ${nexusStageIsDark ? 'text-slate-200' : 'text-slate-600'}`}>
                  Every ALM Nexus client receives dedicated portal access inside NexusFlow to track deliverables and campaigns—or launch your own multi-tenant B2B operations workspace directly.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleLaunchWorkspace}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#005B9F] hover:bg-[#004A82] text-white shadow-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>{currentUser ? 'Open Workspace' : 'Launch NexusFlow / Create Workspace'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClientSignIn}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      nexusStageIsDark
                        ? 'border-white/20 bg-white/5 hover:bg-white/10 text-white'
                        : 'border-slate-300 bg-white hover:bg-slate-50 text-[#0B2545]'
                    }`}
                  >
                    <span>Client Sign In</span>
                  </button>
                </div>
              </div>
            </RevealBlock>

            {/* 3D Perspective Stage */}
            <RevealBlock delayMs={80}>
              <div style={{ perspective: '1400px' }} className="relative">
                <div
                  className={`rounded-2xl p-[1px] ${
                    nexusStageIsDark
                      ? 'bg-gradient-to-b from-cyan-400/45 via-[#005B9F]/35 to-white/15 shadow-[0_24px_70px_-20px_rgba(6,182,212,0.28)]'
                      : 'bg-slate-200 shadow-[0_20px_50px_-20px_rgba(11,37,69,0.12)]'
                  }`}
                >
                  <div className={`rounded-2xl overflow-hidden ${nexusStageIsDark ? 'bg-[#051F2E]' : 'bg-white'}`}>
                    {/* Tab Header */}
                    <div
                      className={`px-4 sm:px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-4 ${
                        nexusStageIsDark ? 'border-white/12 bg-[#041824]' : 'border-slate-200 bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="NexusFlow Core Modules">
                        {(Object.keys(nexusModules) as NexusModuleKey[]).map((key) => {
                          const isSelected = activeNexusModule === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              role="tab"
                              aria-selected={isSelected}
                              onClick={() => setActiveNexusModule(key)}
                              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                isSelected
                                  ? 'bg-[#005B9F] text-white shadow-sm'
                                  : nexusStageIsDark
                                    ? 'text-slate-300 hover:text-white hover:bg-white/10'
                                    : 'text-slate-600 hover:text-[#0B2545] hover:bg-slate-200/70'
                              }`}
                            >
                              {nexusModules[key].icon}
                              <span>{nexusModules[key].label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <span className={`text-xs font-mono whitespace-nowrap ${nexusStageIsDark ? 'text-cyan-300' : 'text-[#005B9F]'}`}>
                        {activeModule.badge}
                      </span>
                    </div>

                    {/* Split Stage Content */}
                    <div
                      className={`grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x ${
                        nexusStageIsDark ? 'divide-white/12' : 'divide-slate-200'
                      }`}
                    >
                      <div className={`lg:col-span-6 p-6 sm:p-9 space-y-6 ${nexusStageIsDark ? 'bg-[#062738]' : 'bg-white'}`}>
                        <div className="space-y-3">
                          <h3 className={`text-xl sm:text-2xl font-bold tracking-tight ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                            {activeModule.title}
                          </h3>
                          <p className={`text-sm leading-[1.65] ${nexusStageIsDark ? 'text-slate-200' : 'text-slate-600'}`}>
                            {activeModule.description}
                          </p>
                        </div>

                        <ul className="space-y-3">
                          {activeModule.capabilities.map((cap) => (
                            <li
                              key={cap}
                              className={`flex items-start gap-2.5 text-sm ${nexusStageIsDark ? 'text-slate-100' : 'text-[#0B2545]'}`}
                            >
                              <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`} />
                              <span>{cap}</span>
                            </li>
                          ))}
                        </ul>

                        <div className={`divide-y border-y pt-1 ${nexusStageIsDark ? 'divide-white/10 border-white/10' : 'divide-slate-200 border-slate-200'}`}>
                          {activeModule.specs.map((spec) => (
                            <div key={spec.key} className="py-3 flex items-center justify-between gap-4 text-xs">
                              <span className={nexusStageIsDark ? 'text-slate-300' : 'text-slate-500'}>{spec.key}</span>
                              <span className={`font-mono font-semibold text-right tabular-nums ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                                {spec.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Module UI Preview Card */}
                      <div className={`lg:col-span-6 p-6 sm:p-9 flex flex-col justify-between space-y-6 ${nexusStageIsDark ? 'bg-[#041D2B]' : 'bg-[#F8FAFC]'}`}>
                        {activeNexusModule === 'portal' && (
                          <div
                            className={`rounded-xl border p-5 space-y-4 ${
                              nexusStageIsDark ? 'border-white/12 bg-[#062B3D]/80' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className={`flex items-center justify-between border-b pb-3 ${nexusStageIsDark ? 'border-white/10' : 'border-slate-200'}`}>
                              <div>
                                <div className={`text-xs font-semibold ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                                  Multi-Tenant Workspace Matrix
                                </div>
                                <div className={`text-[11px] font-mono ${nexusStageIsDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                  Company-Isolated RBAC
                                </div>
                              </div>
                              <span className={`text-[11px] font-mono font-semibold ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                                Role Enforced
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {[
                                { dept: 'Lead Research Unit', role: 'Department Head', access: 'Operations · Chat' },
                                { dept: 'Outbound Delivery', role: 'Campaign Lead', access: 'Outreach · Unified Inbox' },
                                { dept: 'External Client View', role: 'Portal Guest', access: 'Verified Deliverables Only' }
                              ].map((row) => (
                                <div
                                  key={row.dept}
                                  className={`rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs ${
                                    nexusStageIsDark ? 'border-white/10 bg-[#041A26]' : 'border-slate-200 bg-[#F8FAFC]'
                                  }`}
                                >
                                  <div>
                                    <div className={`font-semibold ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>{row.dept}</div>
                                    <div className={`text-[11px] ${nexusStageIsDark ? 'text-slate-300' : 'text-slate-500'}`}>{row.role}</div>
                                  </div>
                                  <span className={`font-mono text-[11px] text-right ${nexusStageIsDark ? 'text-cyan-300' : 'text-[#005B9F]'}`}>
                                    {row.access}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeNexusModule === 'outreach' && (
                          <div
                            className={`rounded-xl border p-5 space-y-4 ${
                              nexusStageIsDark ? 'border-white/12 bg-[#062B3D]/80' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className={`flex items-center justify-between border-b pb-3 ${nexusStageIsDark ? 'border-white/10' : 'border-slate-200'}`}>
                              <div>
                                <div className={`text-xs font-semibold ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                                  Outbound Sequence &amp; Unified Inbox
                                </div>
                                <div className={`text-[11px] font-mono ${nexusStageIsDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                  Resend API · Custom SMTP
                                </div>
                              </div>
                              <span className={`text-[11px] font-mono font-semibold ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                                Cadence Engine
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {[
                                { step: 'Step 01', subject: 'Personalized ICP Signal Opener', channel: 'Primary Domain' },
                                { step: 'Step 02', subject: 'Custom Sample Dataset Follow-Up', channel: 'Auto Day +3' },
                                { step: 'Inbox', subject: 'Positive Prospect Reply Triage', channel: 'Unified Thread' }
                              ].map((item) => (
                                <div
                                  key={item.step}
                                  className={`rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs ${
                                    nexusStageIsDark ? 'border-white/10 bg-[#041A26]' : 'border-slate-200 bg-[#F8FAFC]'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className={`font-mono text-[11px] shrink-0 ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                                      {item.step}
                                    </span>
                                    <span className={`font-semibold truncate ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                                      {item.subject}
                                    </span>
                                  </div>
                                  <span className={`font-mono text-[11px] shrink-0 ${nexusStageIsDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {item.channel}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeNexusModule === 'pipeline' && (
                          <div
                            className={`rounded-xl border p-5 space-y-4 ${
                              nexusStageIsDark ? 'border-white/12 bg-[#062B3D]/80' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className={`flex items-center justify-between border-b pb-3 ${nexusStageIsDark ? 'border-white/10' : 'border-slate-200'}`}>
                              <div>
                                <div className={`text-xs font-semibold ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                                  CRM Deal Pipeline &amp; Sprint Ops
                                </div>
                                <div className={`text-[11px] font-mono ${nexusStageIsDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                  Kanban · Departmental Tasks
                                </div>
                              </div>
                              <span className={`text-[11px] font-mono font-semibold ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                                Milestone Sync
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5 text-xs">
                              {[
                                { col: 'ICP Scoped', items: ['US SaaS Series A', 'UK FinTech VP'] },
                                { col: 'Enriching', items: ['MX / SMTP QA', 'CRM Dedupe'] },
                                { col: 'Handover', items: ['Client Portal', 'Webhook Sync'] }
                              ].map((lane) => (
                                <div
                                  key={lane.col}
                                  className={`rounded-lg border p-3 space-y-2 ${
                                    nexusStageIsDark ? 'border-white/10 bg-[#041A26]' : 'border-slate-200 bg-[#F8FAFC]'
                                  }`}
                                >
                                  <div className={`font-mono text-[11px] font-semibold ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                                    {lane.col}
                                  </div>
                                  {lane.items.map((card) => (
                                    <div
                                      key={card}
                                      className={`rounded border px-2 py-1.5 text-[11px] ${
                                        nexusStageIsDark ? 'border-white/10 bg-white/5 text-slate-100' : 'border-slate-200 bg-white text-[#0B2545]'
                                      }`}
                                    >
                                      {card}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeNexusModule === 'vault' && (
                          <div
                            className={`rounded-xl border p-5 space-y-4 ${
                              nexusStageIsDark ? 'border-white/12 bg-[#062B3D]/80' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className={`flex items-center justify-between border-b pb-3 ${nexusStageIsDark ? 'border-white/10' : 'border-slate-200'}`}>
                              <div className="flex items-center gap-2">
                                <Lock className={`w-3.5 h-3.5 ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`} />
                                <div className={`text-xs font-semibold ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                                  Encrypted BYOK Integrations Vault
                                </div>
                              </div>
                              <span className={`text-[11px] font-mono font-semibold ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                                Tenant Isolated
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 text-xs">
                              {[
                                { name: 'Resend / SMTP', role: 'Outbound Transport' },
                                { name: 'Apollo / Hunter', role: 'Contact Enrichment' },
                                { name: 'Stripe Billing', role: 'Milestone Invoices' },
                                { name: 'Signed Webhooks', role: 'Scraper & CRM Sync' }
                              ].map((connector) => (
                                <div
                                  key={connector.name}
                                  className={`rounded-lg border p-3 space-y-1 ${
                                    nexusStageIsDark ? 'border-white/10 bg-[#041A26]' : 'border-slate-200 bg-[#F8FAFC]'
                                  }`}
                                >
                                  <div className={`font-semibold ${nexusStageIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                                    {connector.name}
                                  </div>
                                  <div className={`text-[11px] font-mono ${nexusStageIsDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {connector.role}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className={`flex flex-wrap items-center justify-between gap-4 pt-2 text-xs ${nexusStageIsDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          <span className="inline-flex items-center gap-1.5">
                            <Sparkles className={`w-3.5 h-3.5 ${nexusStageIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`} />
                            <span>Email OTP Auth &amp; Multi-Company Switcher</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleClientSignIn}
                              className={`font-semibold cursor-pointer whitespace-nowrap ${
                                nexusStageIsDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-[#0B2545]'
                              }`}
                            >
                              Client Sign In
                            </button>
                            <button
                              type="button"
                              onClick={handleLaunchWorkspace}
                              className={`font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                nexusStageIsDark ? 'text-[#06B6D4] hover:text-cyan-200' : 'text-[#005B9F] hover:underline'
                              }`}
                            >
                              <span>Create Workspace</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </RevealBlock>
          </div>
        </section>

        {/* 5. OPERATIONAL STANDARDS (Zero Fake Testimonials or Fake Client Logos) */}
        <section id="standards" className={`py-20 sm:py-28 transition-colors duration-200 ${contentSectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <RevealBlock className="max-w-2xl space-y-3">
              <p className={`text-xs font-mono font-semibold ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                Operational Standards &amp; Guarantees
              </p>
              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] text-balance ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                Audited execution discipline on every dataset and campaign
              </h2>
              <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Zero recycled databases and zero unverified claims—governed strictly by technical validation, custom ICP research, and transparent sprint cycles.
              </p>
            </RevealBlock>

            <RevealBlock delayMs={60}>
              <div
                className={`grid grid-cols-1 md:grid-cols-2 border rounded-2xl overflow-hidden divide-y md:divide-y-0 ${
                  contentSectionsLight
                    ? 'border-slate-200 bg-[#F8FAFC] divide-slate-200'
                    : 'border-white/10 bg-[#090E1A] divide-white/10'
                }`}
              >
                {operationalStandards.map((std, idx) => (
                  <div
                    key={std.code}
                    className={`p-6 sm:p-9 space-y-3 ${
                      contentSectionsLight ? 'border-slate-200' : 'border-white/10'
                    } ${idx % 2 === 0 ? 'md:border-r' : ''} ${idx < 2 ? 'md:border-b' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className={contentSectionsLight ? 'text-[#005B9F] font-semibold' : 'text-[#06B6D4] font-semibold'}>
                        Standard {std.code}
                      </span>
                      <span className={contentSectionsLight ? 'text-slate-500' : 'text-slate-400'}>
                        Verified Protocol
                      </span>
                    </div>
                    <h3 className={`text-base sm:text-lg font-bold tracking-tight ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                      {std.title}
                    </h3>
                    <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      {std.detail}
                    </p>
                  </div>
                ))}
              </div>
            </RevealBlock>
          </div>
        </section>

        {/* 6. ENGAGEMENT MODELS (3 Custom-Scoped Cards, Zero Hardcoded Dollar Prices) */}
        <section id="engagement" className={`py-20 sm:py-28 transition-colors duration-200 ${altContentSectionBg}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <RevealBlock className="max-w-2xl space-y-3">
              <p className={`text-xs font-mono font-semibold ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                Engagement Models
              </p>
              <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] text-balance ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                Three structured ways to work with ALM Nexus
              </h2>
              <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Commission custom B2B intelligence sprints, deploy a fully managed outbound program, or operate directly inside NexusFlow.
              </p>
            </RevealBlock>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {engagementModels.map((model, idx) => (
                <RevealBlock key={model.title} delayMs={idx * 70}>
                  <TiltSpotlightCard
                    surfaceMode={contentSectionsLight ? 'light' : 'dark'}
                    className="h-full p-6 sm:p-8 flex flex-col justify-between space-y-6"
                  >
                    <div className="space-y-4">
                      <div className={`flex items-center justify-between text-xs font-mono tabular-nums ${contentSectionsLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span>Model {model.index}</span>
                        <span>Custom Scope</span>
                      </div>

                      <h3 className={`text-lg font-bold tracking-tight ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                        {model.title}
                      </h3>

                      <p className={`text-xs font-semibold ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                        {model.fit}
                      </p>

                      <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {model.description}
                      </p>

                      <ul className={`space-y-2.5 pt-3 border-t ${contentSectionsLight ? 'border-slate-200' : 'border-white/10'}`}>
                        {model.scope.map((point) => (
                          <li
                            key={point}
                            className={`text-xs flex items-start gap-2 leading-relaxed ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}
                          >
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`} />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={model.action}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        model.primary
                          ? 'bg-[#005B9F] hover:bg-[#004A82] text-white shadow-sm'
                          : contentSectionsLight
                            ? 'border border-slate-300 bg-[#F8FAFC] hover:bg-slate-100 text-[#0B2545]'
                            : 'border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white'
                      }`}
                    >
                      <span>{model.ctaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </TiltSpotlightCard>
                </RevealBlock>
              ))}
            </div>
          </div>
        </section>

        {/* 7. STRATEGY CALL & CUSTOM DATA SAMPLE DESK */}
        <section id="contact" className={`py-20 sm:py-28 transition-colors duration-200 ${contentSectionsLight ? 'bg-white text-[#0B2545]' : 'bg-[#050811] text-slate-100'}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              <div className="lg:col-span-5 space-y-6">
                <p className={`text-xs font-mono font-semibold ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`}>
                  Strategy Call &amp; Custom Data Sample Desk
                </p>
                <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] leading-[1.15] text-balance ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                  Book a strategy call or request a custom B2B data sample
                </h2>
                <p className={`text-sm leading-[1.65] ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Share your target industry, geography, and decision-maker titles. Our research desk in Islamabad will prepare a verified sample slice and clear outbound scope directly for your team.
                </p>

                <div className={`border-t pt-5 space-y-3.5 text-sm ${contentSectionsLight ? 'border-slate-200' : 'border-white/10'}`}>
                  <div className="flex items-start gap-3">
                    <Mail className={`w-4 h-4 shrink-0 mt-0.5 ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`} />
                    <div className="space-y-0.5">
                      <div className={`text-[11px] font-semibold ${contentSectionsLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Primary Agency Email
                      </div>
                      <a
                        href="mailto:almnexus26@gmail.com"
                        className={`font-mono text-xs sm:text-sm font-semibold transition-colors block ${
                          contentSectionsLight ? 'text-[#0B2545] hover:text-[#005B9F]' : 'text-white hover:text-[#06B6D4]'
                        }`}
                      >
                        almnexus26@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className={`w-4 h-4 shrink-0 mt-0.5 ${contentSectionsLight ? 'text-slate-500' : 'text-blue-400'}`} />
                    <div className="space-y-0.5">
                      <div className={`text-[11px] font-semibold ${contentSectionsLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Direct / Founder Email
                      </div>
                      <a
                        href="mailto:contact@abdulahadrana.me"
                        className={`font-mono text-xs sm:text-sm transition-colors block ${
                          contentSectionsLight ? 'text-slate-700 hover:text-[#005B9F]' : 'text-slate-200 hover:text-[#06B6D4]'
                        }`}
                      >
                        contact@abdulahadrana.me
                      </a>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    <MapPin className={`w-4 h-4 shrink-0 ${contentSectionsLight ? 'text-[#005B9F]' : 'text-[#06B6D4]'}`} />
                    <span className="text-xs sm:text-sm">Islamabad, Pakistan · Serving US, UK, UAE &amp; Europe</span>
                  </div>
                </div>

                <div className={`border-t pt-5 space-y-3 ${contentSectionsLight ? 'border-slate-200' : 'border-white/10'}`}>
                  <div className={`text-xs font-semibold ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                    Official Social Channels
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                    {OFFICIAL_SOCIAL_LINKS.map((social) => (
                      <a
                        key={social.name}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          contentSectionsLight
                            ? 'text-slate-600 hover:text-[#005B9F]'
                            : 'text-slate-300 hover:text-[#06B6D4]'
                        }`}
                      >
                        {social.icon}
                        <span>{social.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div
                  className={`rounded-2xl border p-6 sm:p-8 ${
                    contentSectionsLight
                      ? 'border-slate-200 bg-[#F8FAFC]'
                      : 'border-white/10 bg-[#0B1120]'
                  }`}
                >
                  {inquirySubmitted ? (
                    <div className="space-y-5">
                      <div className={`flex items-center gap-2.5 text-sm font-bold ${contentSectionsLight ? 'text-[#0B2545]' : 'text-white'}`}>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <span>Brief Ready for almnexus26@gmail.com</span>
                      </div>
                      <p className={`text-sm leading-relaxed ${contentSectionsLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        Send your structured brief directly via your email client (routed to almnexus26@gmail.com &amp; contact@abdulahadrana.me) or copy the formatted brief below.
                      </p>
                      <pre
                        className={`p-4 rounded-xl border text-xs font-mono whitespace-pre-wrap ${
                          contentSectionsLight
                            ? 'border-slate-200 bg-white text-[#0B2545]'
                            : 'border-white/10 bg-[#050811] text-slate-200'
                        }`}
                      >
                        {buildBriefText()}
                      </pre>
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={buildMailtoHref()}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#005B9F] hover:bg-[#004A82] text-white transition-colors whitespace-nowrap"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Send via Email Client</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyBrief}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                            contentSectionsLight
                              ? 'border-slate-300 bg-white hover:bg-slate-50 text-[#0B2545]'
                              : 'border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white'
                          }`}
                        >
                          {copiedBrief ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedBrief ? 'Brief Copied' : 'Copy Brief'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInquirySubmitted(false)}
                          className={`text-xs font-semibold hover:underline cursor-pointer px-2 ${
                            contentSectionsLight ? 'text-slate-600' : 'text-slate-400'
                          }`}
                        >
                          Edit Brief
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitInquiry} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="landing-inquiry-name" className={`block text-xs font-semibold mb-1.5 ${contentSectionsLight ? 'text-[#0B2545]' : 'text-slate-200'}`}>
                            Full Name
                          </label>
                          <input
                            id="landing-inquiry-name"
                            type="text"
                            value={inquiryForm.name}
                            onChange={(e) => setInquiryForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Your full name"
                            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#005B9F] ${
                              contentSectionsLight
                                ? 'border-slate-300 bg-white text-[#0B2545] placeholder:text-slate-400'
                                : 'border-white/12 bg-[#050811] text-white placeholder:text-slate-500'
                            }`}
                          />
                        </div>

                        <div>
                          <label htmlFor="landing-inquiry-email" className={`block text-xs font-semibold mb-1.5 ${contentSectionsLight ? 'text-[#0B2545]' : 'text-slate-200'}`}>
                            Work Email
                          </label>
                          <input
                            id="landing-inquiry-email"
                            type="email"
                            value={inquiryForm.email}
                            onChange={(e) => setInquiryForm((prev) => ({ ...prev, email: e.target.value }))}
                            placeholder="you@company.com"
                            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#005B9F] ${
                              contentSectionsLight
                                ? 'border-slate-300 bg-white text-[#0B2545] placeholder:text-slate-400'
                                : 'border-white/12 bg-[#050811] text-white placeholder:text-slate-500'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="landing-inquiry-website" className={`block text-xs font-semibold mb-1.5 ${contentSectionsLight ? 'text-[#0B2545]' : 'text-slate-200'}`}>
                            Company Website
                          </label>
                          <input
                            id="landing-inquiry-website"
                            type="text"
                            value={inquiryForm.companyWebsite}
                            onChange={(e) => setInquiryForm((prev) => ({ ...prev, companyWebsite: e.target.value }))}
                            placeholder="https://company.com"
                            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#005B9F] ${
                              contentSectionsLight
                                ? 'border-slate-300 bg-white text-[#0B2545] placeholder:text-slate-400'
                                : 'border-white/12 bg-[#050811] text-white placeholder:text-slate-500'
                            }`}
                          />
                        </div>

                        <div>
                          <label htmlFor="landing-inquiry-focus" className={`block text-xs font-semibold mb-1.5 ${contentSectionsLight ? 'text-[#0B2545]' : 'text-slate-200'}`}>
                            Service / Engagement Model
                          </label>
                          <select
                            id="landing-inquiry-focus"
                            value={inquiryForm.focus}
                            onChange={(e) =>
                              setInquiryForm((prev) => ({ ...prev, focus: e.target.value as InquiryFocus }))
                            }
                            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#005B9F] ${
                              contentSectionsLight
                                ? 'border-slate-300 bg-white text-[#0B2545]'
                                : 'border-white/12 bg-[#050811] text-white'
                            }`}
                          >
                            <option value="On-Demand Data Intelligence">On-Demand Data Intelligence</option>
                            <option value="Managed Outbound Growth">Managed Outbound Growth</option>
                            <option value="NexusFlow Platform Access">NexusFlow Platform Access</option>
                            <option value="B2B Lead Generation & Verified Decision-Maker Intelligence">
                              B2B Lead Generation &amp; Decision-Maker Intelligence
                            </option>
                            <option value="Custom Data Intelligence, Web Scraping & Account Enrichment">
                              Custom Data Intelligence &amp; Web Scraping
                            </option>
                            <option value="Automated Outbound Pipeline Systems">
                              Automated Outbound Pipeline Systems
                            </option>
                            <option value="AI-Powered Customer Response & CRM Automation Workflows">
                              AI Customer Response &amp; CRM Automation
                            </option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="landing-inquiry-notes" className={`block text-xs font-semibold mb-1.5 ${contentSectionsLight ? 'text-[#0B2545]' : 'text-slate-200'}`}>
                          Target ICP Notes &amp; Objectives
                        </label>
                        <textarea
                          id="landing-inquiry-notes"
                          rows={3}
                          value={inquiryForm.notes}
                          onChange={(e) => setInquiryForm((prev) => ({ ...prev, notes: e.target.value }))}
                          placeholder="e.g. Series A B2B SaaS or FinTech firms in US & UK, 25–200 employees, targeting Founders and VPs of Sales."
                          className={`w-full px-3.5 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#005B9F] ${
                            contentSectionsLight
                              ? 'border-slate-300 bg-white text-[#0B2545] placeholder:text-slate-400'
                              : 'border-white/12 bg-[#050811] text-white placeholder:text-slate-500'
                          }`}
                        />
                      </div>

                      {inquiryError && (
                        <p className={`text-xs font-medium ${contentSectionsLight ? 'text-rose-600' : 'text-rose-400'}`}>
                          {inquiryError}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                        <span className={`text-xs ${contentSectionsLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Routed to almnexus26@gmail.com &amp; contact@abdulahadrana.me
                        </span>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#005B9F] hover:bg-[#004A82] text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>Prepare Request</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 8. CORPORATE FOOTER WITH ALL 5 SOCIAL LINKS & LEGAL MODALS */}
      <footer className={`py-12 text-xs transition-colors duration-200 ${footerClasses}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className={`flex flex-wrap items-center gap-2.5 ${footerIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                <AlmNexusLogoMark surfaceIsDark={footerIsDark} className="h-7" />
                <span className="font-extrabold text-sm tracking-tight">ALM Nexus</span>
                <span className="opacity-40" aria-hidden="true">·</span>
                <span className="font-mono text-xs opacity-80">almnexus.tech</span>
                <span className="opacity-40" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-xs opacity-85">
                  <Globe className={`w-3.5 h-3.5 ${footerIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`} />
                  <span>Islamabad, Pakistan</span>
                </span>
              </div>
              <p className={`text-xs ${footerIsDark ? 'text-slate-300' : 'text-slate-600'}`}>
                AI Lead Generation &amp; Automation · Connect. Automate. Grow. · Serving US, UK, UAE &amp; Europe.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href="#services" className={`transition-colors whitespace-nowrap ${footerIsDark ? 'hover:text-white' : 'hover:text-[#0B2545]'}`}>
                Services
              </a>
              <a href="#nexusflow" className={`transition-colors whitespace-nowrap ${footerIsDark ? 'hover:text-white' : 'hover:text-[#0B2545]'}`}>
                NexusFlow
              </a>
              <a
                href="mailto:almnexus26@gmail.com"
                className={`font-mono font-semibold transition-colors whitespace-nowrap ${
                  footerIsDark ? 'text-white hover:text-[#06B6D4]' : 'text-[#0B2545] hover:text-[#005B9F]'
                }`}
              >
                almnexus26@gmail.com
              </a>
              <a
                href="mailto:contact@abdulahadrana.me"
                className={`font-mono transition-colors whitespace-nowrap ${
                  footerIsDark ? 'hover:text-[#06B6D4]' : 'hover:text-[#005B9F]'
                }`}
              >
                contact@abdulahadrana.me
              </a>
              <button
                type="button"
                onClick={handleClientSignIn}
                className={`px-3.5 py-2 rounded-lg border font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  footerIsDark
                    ? 'border-white/20 bg-white/5 hover:bg-white/10 text-white'
                    : 'border-slate-300 bg-white hover:bg-slate-100 text-[#0B2545]'
                }`}
              >
                {currentUser ? 'Open Workspace' : 'Client Sign In'}
              </button>
            </div>
          </div>

          <div
            className={`pt-5 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              footerIsDark ? 'border-white/15' : 'border-slate-200'
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
              {OFFICIAL_SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    footerIsDark
                      ? 'text-slate-200 hover:text-[#06B6D4]'
                      : 'text-slate-600 hover:text-[#005B9F]'
                  }`}
                >
                  {social.icon}
                  <span>{social.name}</span>
                </a>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-5 text-xs">
              <span>&copy; {new Date().getFullYear()} ALM Nexus (almnexus.tech). All rights reserved.</span>
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className={`transition-colors cursor-pointer whitespace-nowrap ${footerIsDark ? 'hover:text-white' : 'hover:text-[#0B2545]'}`}
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className={`transition-colors cursor-pointer whitespace-nowrap ${footerIsDark ? 'hover:text-white' : 'hover:text-[#0B2545]'}`}
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL: STRATEGY CALL / CUSTOM DATA SAMPLE REQUEST */}
      {isInquiryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsInquiryModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-modal-title"
        >
          <div
            className={`relative w-full max-w-lg rounded-2xl border p-6 sm:p-7 space-y-5 my-auto shadow-2xl ${
              modalIsDark
                ? 'border-white/15 bg-[#062B3D] text-white'
                : 'border-slate-200 bg-white text-[#0B2545]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-start justify-between gap-4 border-b pb-4 ${modalIsDark ? 'border-white/15' : 'border-slate-200'}`}>
              <div>
                <p className={`text-xs font-mono ${modalIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                  ALM Nexus · almnexus.tech
                </p>
                <h3 id="inquiry-modal-title" className="text-lg font-bold mt-0.5">
                  Book Strategy Call / Request Custom Data Sample
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInquiryModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  modalIsDark ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-[#0B2545] hover:bg-slate-100'
                }`}
                aria-label="Close Inquiry Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inquirySubmitted ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Brief Ready for almnexus26@gmail.com</span>
                </div>
                <pre
                  className={`p-3.5 rounded-xl border text-xs font-mono whitespace-pre-wrap ${
                    modalIsDark ? 'border-white/15 bg-[#041D2A] text-slate-100' : 'border-slate-200 bg-[#F8FAFC] text-[#0B2545]'
                  }`}
                >
                  {buildBriefText()}
                </pre>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={buildMailtoHref()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#005B9F] hover:bg-[#004A82] text-white transition-colors whitespace-nowrap"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send via Email Client</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyBrief}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                      modalIsDark ? 'border-white/20 bg-white/5 text-white' : 'border-slate-300 bg-white text-[#0B2545]'
                    }`}
                  >
                    {copiedBrief ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedBrief ? 'Copied' : 'Copy Brief'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="modal-inquiry-name" className="block text-xs font-semibold mb-1">
                      Full Name
                    </label>
                    <input
                      id="modal-inquiry-name"
                      type="text"
                      value={inquiryForm.name}
                      onChange={(e) => setInquiryForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Your full name"
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4] ${
                        modalIsDark
                          ? 'border-white/15 bg-[#041D2A] text-white placeholder:text-slate-400'
                          : 'border-slate-300 bg-[#F8FAFC] text-[#0B2545] placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-inquiry-email" className="block text-xs font-semibold mb-1">
                      Work Email
                    </label>
                    <input
                      id="modal-inquiry-email"
                      type="email"
                      value={inquiryForm.email}
                      onChange={(e) => setInquiryForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="you@company.com"
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4] ${
                        modalIsDark
                          ? 'border-white/15 bg-[#041D2A] text-white placeholder:text-slate-400'
                          : 'border-slate-300 bg-[#F8FAFC] text-[#0B2545] placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="modal-inquiry-website" className="block text-xs font-semibold mb-1">
                      Company Website
                    </label>
                    <input
                      id="modal-inquiry-website"
                      type="text"
                      value={inquiryForm.companyWebsite}
                      onChange={(e) => setInquiryForm((prev) => ({ ...prev, companyWebsite: e.target.value }))}
                      placeholder="https://company.com"
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4] ${
                        modalIsDark
                          ? 'border-white/15 bg-[#041D2A] text-white placeholder:text-slate-400'
                          : 'border-slate-300 bg-[#F8FAFC] text-[#0B2545] placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-inquiry-focus" className="block text-xs font-semibold mb-1">
                      Service / Model
                    </label>
                    <select
                      id="modal-inquiry-focus"
                      value={inquiryForm.focus}
                      onChange={(e) =>
                        setInquiryForm((prev) => ({ ...prev, focus: e.target.value as InquiryFocus }))
                      }
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4] ${
                        modalIsDark ? 'border-white/15 bg-[#041D2A] text-white' : 'border-slate-300 bg-[#F8FAFC] text-[#0B2545]'
                      }`}
                    >
                      <option value="On-Demand Data Intelligence">On-Demand Data Intelligence</option>
                      <option value="Managed Outbound Growth">Managed Outbound Growth</option>
                      <option value="NexusFlow Platform Access">NexusFlow Platform Access</option>
                      <option value="B2B Lead Generation & Verified Decision-Maker Intelligence">
                        B2B Lead Generation &amp; Decision-Maker Intelligence
                      </option>
                      <option value="Custom Data Intelligence, Web Scraping & Account Enrichment">
                        Custom Data Intelligence &amp; Web Scraping
                      </option>
                      <option value="Automated Outbound Pipeline Systems">
                        Automated Outbound Pipeline Systems
                      </option>
                      <option value="AI-Powered Customer Response & CRM Automation Workflows">
                        AI Customer Response &amp; CRM Automation
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="modal-inquiry-notes" className="block text-xs font-semibold mb-1">
                    Target ICP Notes
                  </label>
                  <textarea
                    id="modal-inquiry-notes"
                    rows={3}
                    value={inquiryForm.notes}
                    onChange={(e) => setInquiryForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Specify decision-maker roles, industry vertical, region (US, UK, UAE, EU), and volume needed."
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4] ${
                      modalIsDark
                        ? 'border-white/15 bg-[#041D2A] text-white placeholder:text-slate-400'
                        : 'border-slate-300 bg-[#F8FAFC] text-[#0B2545] placeholder:text-slate-400'
                    }`}
                  />
                </div>

                {inquiryError && <p className="text-xs font-medium text-rose-400">{inquiryError}</p>}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <a
                    href="mailto:almnexus26@gmail.com"
                    className={`text-xs font-mono transition-colors truncate ${
                      modalIsDark ? 'text-cyan-300 hover:text-white' : 'text-[#005B9F] hover:underline'
                    }`}
                  >
                    almnexus26@gmail.com
                  </a>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsInquiryModalOpen(false)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        modalIsDark ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#005B9F] hover:bg-[#004A82] text-white transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>Prepare Request</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: PRIVACY POLICY & TERMS OF SERVICE */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onClick={() => setLegalModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <div
            className={`relative w-full max-w-2xl rounded-2xl border p-6 sm:p-8 space-y-5 my-auto shadow-2xl ${
              modalIsDark
                ? 'border-white/15 bg-[#062B3D] text-white'
                : 'border-slate-200 bg-white text-[#0B2545]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-start justify-between gap-4 border-b pb-4 ${modalIsDark ? 'border-white/15' : 'border-slate-200'}`}>
              <div>
                <p className={`text-xs font-mono ${modalIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                  ALM Nexus · almnexus.tech
                </p>
                <h3 id="legal-modal-title" className="text-lg font-bold mt-0.5">
                  {legalModal === 'privacy'
                    ? 'Privacy Policy & B2B Data Compliance'
                    : 'Terms of Service'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  modalIsDark ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-[#0B2545] hover:bg-slate-100'
                }`}
                aria-label="Close Legal Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {legalModal === 'privacy' ? (
              <div className={`space-y-4 text-xs sm:text-sm leading-relaxed max-h-[65vh] overflow-y-auto pr-1 ${modalIsDark ? 'text-slate-200' : 'text-slate-600'}`}>
                <div>
                  <h4 className={`font-bold mb-1 ${modalIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    1. Scope &amp; Corporate Controller
                  </h4>
                  <p>
                    ALM Nexus (almnexus.tech), headquartered in Islamabad, Pakistan, operates B2B data intelligence services and the NexusFlow SaaS workspace.
                  </p>
                </div>
                <div>
                  <h4 className={`font-bold mb-1 ${modalIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    2. B2B Data Compliance (GDPR &amp; CAN-SPAM Alignment)
                  </h4>
                  <p>
                    All B2B research and outbound infrastructure built by ALM Nexus adheres to legitimate corporate interest standards under GDPR Article 6(1)(f), UK GDPR, and US CAN-SPAM transparency obligations, focusing strictly on corporate roles and business email systems with immediate opt-out compliance.
                  </p>
                </div>
                <div>
                  <h4 className={`font-bold mb-1 ${modalIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    3. Client Dataset Isolation &amp; BYOK Security
                  </h4>
                  <p>
                    Custom-built prospect lists, scraped pipelines, and NexusFlow BYOK integration keys are strictly isolated per client organization. ALM Nexus never resells, shares, or recycles client-commissioned datasets.
                  </p>
                </div>
                <div>
                  <h4 className={`font-bold mb-1 ${modalIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    4. Data Requests &amp; Opt-Out Inquiries
                  </h4>
                  <p>
                    Contact{' '}
                    <a href="mailto:almnexus26@gmail.com" className={`font-mono underline ${modalIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                      almnexus26@gmail.com
                    </a>{' '}
                    or{' '}
                    <a href="mailto:contact@abdulahadrana.me" className={`font-mono underline ${modalIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                      contact@abdulahadrana.me
                    </a>
                    .
                  </p>
                </div>
              </div>
            ) : (
              <div className={`space-y-4 text-xs sm:text-sm leading-relaxed max-h-[65vh] overflow-y-auto pr-1 ${modalIsDark ? 'text-slate-200' : 'text-slate-600'}`}>
                <div>
                  <h4 className={`font-bold mb-1 ${modalIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    1. Engagement Scope &amp; Delivery
                  </h4>
                  <p>
                    ALM Nexus provides custom B2B lead generation, Python data extraction, managed outbound systems, and NexusFlow platform access pursuant to mutually agreed project scopes.
                  </p>
                </div>
                <div>
                  <h4 className={`font-bold mb-1 ${modalIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    2. Custom Data Ownership &amp; Acceptable Use
                  </h4>
                  <p>
                    Delivered custom prospect datasets are dedicated to the commissioning client&apos;s internal revenue operations and must be used in compliance with applicable commercial communication laws in the US, UK, UAE, and EU.
                  </p>
                </div>
                <div>
                  <h4 className={`font-bold mb-1 ${modalIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    3. NexusFlow Workspace Security
                  </h4>
                  <p>
                    Workspace administrators govern departmental RBAC permissions, user invitations, and third-party API credentials stored inside their tenant BYOK Integrations Vault.
                  </p>
                </div>
                <div>
                  <h4 className={`font-bold mb-1 ${modalIsDark ? 'text-white' : 'text-[#0B2545]'}`}>
                    4. Contact &amp; Governance
                  </h4>
                  <p>
                    For enterprise agreements or compliance documentation, email{' '}
                    <a href="mailto:almnexus26@gmail.com" className={`font-mono underline ${modalIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                      almnexus26@gmail.com
                    </a>{' '}
                    or{' '}
                    <a href="mailto:contact@abdulahadrana.me" className={`font-mono underline ${modalIsDark ? 'text-[#06B6D4]' : 'text-[#005B9F]'}`}>
                      contact@abdulahadrana.me
                    </a>
                    .
                  </p>
                </div>
              </div>
            )}

            <div className={`pt-3 border-t flex justify-end ${modalIsDark ? 'border-white/15' : 'border-slate-200'}`}>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#005B9F] hover:bg-[#004A82] text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
