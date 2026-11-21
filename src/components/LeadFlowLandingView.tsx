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
  Send,
  ShieldCheck,
  Sparkles,
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
    <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#0F172A" stroke="rgba(96,165,250,0.45)" />
    <path
      d="M9 22L16 8.5L23 22"
      stroke="#FFFFFF"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M11.6 17.5H20.4" stroke="#06B6D4" strokeWidth="1.9" strokeLinecap="round" />
    <circle cx="16" cy="8.5" r="2" fill="#FFFFFF" />
    <circle cx="9" cy="22" r="1.75" fill="#60A5FA" />
    <circle cx="23" cy="22" r="1.75" fill="#06B6D4" />
  </svg>
);

const AlmNexusLogoMark: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return <AlmNexusEmblemFallback className={className} />;
  }

  return (
    <span
      className={`${className} rounded-lg border border-white/15 bg-white overflow-hidden inline-flex items-center justify-center shrink-0`}
    >
      <img
        src={ALM_NEXUS_LOGO_PATH}
        alt="ALM Nexus"
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-contain p-0.5"
      />
    </span>
  );
};

/* IntersectionObserver scroll-reveal wrapper */
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

/* Scale AI-Inspired Interactive 3D Rotating B2B Intelligence Globe / Neural Network on HTML5 Canvas */
const InteractiveIntelligenceGlobe: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
    rotY: 0.4,
    rotX: 0.24,
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
      color: string;
    }

    const nodes: SphereNode[] = [];
    const totalPoints = 104;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    const regionalHubs: Record<number, { label: string; color: string }> = {
      10: { label: 'US · New York', color: '#06B6D4' },
      28: { label: 'UK · London', color: '#60A5FA' },
      48: { label: 'EU · Berlin', color: '#818CF8' },
      68: { label: 'UAE · Dubai', color: '#06B6D4' },
      86: { label: 'PK · Islamabad HQ', color: '#3B82F6' }
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
        color: hub ? hub.color : i % 3 === 0 ? '#06B6D4' : i % 2 === 0 ? '#4F46E5' : '#2563EB'
      });
    }

    const hubIndices = Object.keys(regionalHubs).map(Number);
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
    let startTime = performance.now();

    const renderFrame = (now: number) => {
      const elapsed = (now - startTime) * 0.001;
      if (!dragRef.current.isDragging && !prefersReduced) {
        dragRef.current.rotY += 0.0032;
      }

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

      // Ambient radial glow behind the 3D sphere
      const glow = ctx.createRadialGradient(cx, cy, sphereRadius * 0.15, cx, cy, sphereRadius * 1.45);
      glow.addColorStop(0, 'rgba(37, 99, 235, 0.22)');
      glow.addColorStop(0.5, 'rgba(79, 70, 229, 0.10)');
      glow.addColorStop(1, 'rgba(5, 8, 17, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, sphereRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Subtle equatorial & orbital rings
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, sphereRadius * 1.18, sphereRadius * 0.34, -0.22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.14)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, sphereRadius * 1.06, sphereRadius * 0.98, 0.4, 0, Math.PI * 2);
      ctx.stroke();

      // Project all 3D points
      const projected = nodes.map((n, idx) => {
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.z * cosY + n.x * sinY;
        const y2 = n.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + n.y * sinX;

        const px = x1 * sphereRadius;
        const py = y2 * sphereRadius;
        const pz = z2 * sphereRadius;

        const scale = fov / (fov + pz);
        return {
          idx,
          sx: cx + px * scale,
          sy: cy + py * scale,
          pz,
          scale,
          depth: (1 - z2) * 0.5, // 0 = back, 1 = front
          hubLabel: n.hubLabel,
          color: n.color
        };
      });

      // Draw sparse neural mesh edges between nearby front/mid nodes
      ctx.lineWidth = 0.75;
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
            const alpha = (1 - Math.sqrt(distSq) / maxDist) * 0.22 * Math.min(a.depth, b.depth);
            ctx.strokeStyle = `rgba(96, 165, 250, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      // Draw glowing data-pulse arcs between regional hub nodes
      arcs.forEach((arc) => {
        const from = projected[arc.from];
        const to = projected[arc.to];
        if (!from || !to) return;

        const midX = (from.sx + to.sx) * 0.5;
        const midY = (from.sy + to.sy) * 0.5;
        const dx = midX - cx;
        const dy = midY - cy;
        const lift = 1.28;
        const ctrlX = cx + dx * lift;
        const ctrlY = cy + dy * lift;

        const avgDepth = (from.depth + to.depth) * 0.5;
        ctx.strokeStyle = `rgba(6, 182, 212, ${(0.18 + avgDepth * 0.28).toFixed(3)})`;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(from.sx, from.sy);
        ctx.quadraticCurveTo(ctrlX, ctrlY, to.sx, to.sy);
        ctx.stroke();

        // Traveling pulse packet
        const t = prefersReduced ? 0.5 : (elapsed * arc.speed + arc.offset) % 1;
        const inv = 1 - t;
        const px = inv * inv * from.sx + 2 * inv * t * ctrlX + t * t * to.sx;
        const py = inv * inv * from.sy + 2 * inv * t * ctrlY + t * t * to.sy;

        ctx.fillStyle = '#E0F2FE';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      // Depth sort nodes back-to-front
      const sorted = [...projected].sort((a, b) => b.pz - a.pz);

      sorted.forEach((p) => {
        const isHub = Boolean(p.hubLabel);
        const alpha = Math.max(0.18, Math.min(1, p.depth * 0.95 + 0.15));
        const r = (isHub ? 4.2 : 2.1) * p.scale;

        if (isHub) {
          ctx.fillStyle = `rgba(6, 182, 212, ${(alpha * 0.28).toFixed(3)})`;
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

          ctx.fillStyle = 'rgba(9, 14, 26, 0.85)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, textW + 12, 18, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#E2E8F0';
          ctx.fillText(p.hubLabel, tagX + 6, tagY + 12.5);
        }
        ctx.globalAlpha = 1;
      });

      // Subtle hub ring ticks
      void hubIndices;

      if (!prefersReduced) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.isDragging = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
    dragRef.current.hoverX = nx;
    dragRef.current.hoverY = ny;

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

  return (
    <div className="relative w-full h-[420px] sm:h-[470px] rounded-2xl border border-white/10 bg-[#070B16]/90 overflow-hidden">
      {/* Subtle architectural reticle frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.12),transparent_68%)]"
      />

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
        aria-label="Interactive 3D Global B2B Intelligence Network"
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Floating Glassmorphic HUD Micro-Cards */}
      <div className="pointer-events-none absolute top-4 left-4 rounded-xl border border-white/12 bg-[#090E1A]/80 backdrop-blur-md px-3.5 py-2.5">
        <div className="text-[11px] font-mono text-cyan-400">SMTP / MX Verified</div>
        <div className="text-xs font-semibold text-white mt-0.5">Multi-Layer Bounce Guard</div>
      </div>

      <div className="pointer-events-none hidden sm:block absolute top-4 right-4 rounded-xl border border-white/12 bg-[#090E1A]/80 backdrop-blur-md px-3.5 py-2.5 text-right">
        <div className="text-[11px] font-mono text-blue-400">ICP Signal Match</div>
        <div className="text-xs font-semibold text-white mt-0.5">Founders · C-Suite · VPs</div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
        <div className="rounded-xl border border-white/12 bg-[#090E1A]/80 backdrop-blur-md px-3.5 py-2">
          <div className="text-[11px] font-mono text-indigo-300">CRM-Ready Enrichment</div>
          <div className="text-xs font-semibold text-white mt-0.5">US · UK · UAE · Europe</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#090E1A]/75 backdrop-blur-md px-3 py-1.5 text-[11px] font-mono text-slate-400">
          Drag to rotate 3D mesh
        </div>
      </div>
    </div>
  );
};

/* Stripe-Inspired 3D Mouse-Tracking Tilt + Radial Spotlight Card */
const TiltSpotlightCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / Math.max(1, rect.width);
    const py = (e.clientY - rect.top) / Math.max(1, rect.height);
    const ry = (px - 0.5) * 7;
    const rx = (0.5 - py) * 7;
    setTilt({
      rx,
      ry,
      mx: px * 100,
      my: py * 100,
      active: true
    });
  };

  const handleMouseLeave = () => {
    setTilt((prev) => ({ ...prev, rx: 0, ry: 0, active: false }));
  };

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
      className={`relative rounded-2xl border border-white/10 bg-[#0C1222]/90 overflow-hidden will-change-transform ${className}`}
    >
      {/* Cursor-following spotlight border / sheen */}
      <div
        aria-hidden="true"
        style={{
          opacity: tilt.active ? 1 : 0,
          background: `radial-gradient(520px circle at ${tilt.mx}% ${tilt.my}%, rgba(56, 189, 248, 0.16), rgba(79, 70, 229, 0.08) 40%, transparent 70%)`
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
    document.title = 'ALM Nexus — Precision B2B Lead Generation, Data Intelligence & NexusFlow';
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

  const pipelineStages = [
    {
      step: '01',
      title: 'Target ICP & Scraping',
      shortLabel: 'Target ICP & Scraping',
      protocol: 'Custom Research + Python Pipelines',
      description:
        'Automated Python extraction pipelines and human analyst verification assemble net-new prospect accounts across niche registries, directories, and growth signals.',
      outputs: ['Firmographic & headcount filtering', 'Buying-committee role targeting', 'Off-market vertical extraction']
    },
    {
      step: '02',
      title: 'Multi-Layer MX / SMTP Verification',
      shortLabel: 'Multi-Layer MX / SMTP Verification',
      protocol: 'Syntax · DNS · Mailbox Ping',
      description:
        'Every extracted contact passes multi-step domain MX checks, catch-all detection, and SMTP handshake validation before entering your deliverable batch.',
      outputs: ['Bounce-protected corporate emails', 'Disposable & trap-domain filtering', 'Verification log included']
    },
    {
      step: '03',
      title: 'AI Account Enrichment',
      shortLabel: 'AI Account Enrichment',
      protocol: 'Schema Normalization & Deduplication',
      description:
        'Raw account signals are enriched with role context, company metadata, and strict deduplication so your outreach copy lands with genuine relevance.',
      outputs: ['Normalized CRM-ready columns', 'Account-level context signals', 'Zero duplicate contact records']
    },
    {
      step: '04',
      title: 'NexusFlow Outbound & CRM',
      shortLabel: 'NexusFlow Outbound & CRM',
      protocol: 'Managed Sequences & Portal Delivery',
      description:
        'Datasets deploy directly into NexusFlow workspaces—powering authenticated sending infrastructure, unified reply triage, and live pipeline tracking.',
      outputs: ['Resend / SMTP multi-step cadences', 'Unified prospect reply inbox', 'Real-time client portal visibility']
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
      icon: <Users className="w-4 h-4 text-cyan-400" />,
      summary:
        'Founder, C-Suite, VP, and Director targeting tailored to your exact ICP—backed by multi-step syntax, domain MX, and SMTP bounce-protected verification.',
      deliverables: [
        'Executive & buying-committee contact mapping',
        'Multi-layer MX & SMTP bounce-protected QA',
        'Segmented by geography, headcount & vertical'
      ]
    },
    {
      index: '02.',
      title: 'Custom Data Intelligence, Web Scraping & Account Enrichment',
      focusValue: 'Custom Data Intelligence, Web Scraping & Account Enrichment',
      icon: <Database className="w-4 h-4 text-blue-400" />,
      summary:
        'Automated Python web scraping, niche and off-market dataset extraction, account mapping, and deduplicated CRM enrichment built to specification.',
      deliverables: [
        'Custom Python scraping & off-market sourcing',
        'Full account mapping & firmographic enrichment',
        'Deduplicated exports ready for HubSpot, Salesforce, or NexusFlow'
      ]
    },
    {
      index: '03.',
      title: 'Automated Outbound Pipeline Systems (Cold Email & Multi-Channel)',
      focusValue: 'Automated Outbound Pipeline Systems',
      icon: <Send className="w-4 h-4 text-indigo-400" />,
      summary:
        'Dedicated sending domain & DNS deliverability setup, personalized multi-step outreach sequences, automated follow-ups, and structured reply triage.',
      deliverables: [
        'Dedicated sending domains with SPF, DKIM & DMARC',
        'Multi-step personalized outbound email cadences',
        'Automated follow-ups & positive-reply triage'
      ]
    },
    {
      index: '04.',
      title: 'AI-Powered Customer Response & CRM Automation Workflows',
      focusValue: 'AI-Powered Customer Response & CRM Automation Workflows',
      icon: <Workflow className="w-4 h-4 text-cyan-400" />,
      summary:
        'AI reply intent classification, automated lead qualification and departmental routing, plus custom webhook and CRM workflow automation.',
      deliverables: [
        'AI-assisted prospect reply intent classification',
        'Automated lead qualification & team routing',
        'Signed inbound/outbound CRM webhook pipelines'
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
        'Give every client organization isolated multi-company workspaces with strict department-level RBAC, guided onboarding, and live deliverable visibility.',
      icon: <ShieldCheck className="w-4 h-4 text-cyan-400" />,
      specs: [
        { key: 'Tenant Isolation', value: 'Company-Scoped Workspaces' },
        { key: 'Access Control', value: 'Per-Department Module Locks' },
        { key: 'Client Experience', value: 'Live Deliverable Portal' }
      ],
      capabilities: [
        'Company Owners toggle allowed modules per department',
        'Department Heads & specialists see strictly scoped tools',
        'Clients inspect delivered lead batches & milestones directly'
      ]
    },
    outreach: {
      label: 'Automated Outreach',
      badge: 'Resend & SMTP',
      title: 'Automated Outreach Engine & Unified Inbox',
      description:
        'Connect Resend or business SMTP mailboxes to launch multi-step email sequences, automate follow-ups, and manage all prospect replies in one centralized inbox.',
      icon: <Inbox className="w-4 h-4 text-blue-400" />,
      specs: [
        { key: 'Mail Transport', value: 'Resend API & Custom SMTP' },
        { key: 'Sequence Engine', value: 'Multi-Step Follow-Ups' },
        { key: 'Reply Workflow', value: 'Unified Prospect Inbox' }
      ],
      capabilities: [
        'Connect and verify business sending domains in minutes',
        'Run multi-stage sequences straight from verified ICP lists',
        'Triage inbound replies across teams without tab sprawl'
      ]
    },
    pipeline: {
      label: 'CRM & Pipeline',
      badge: 'Operations Suite',
      title: 'CRM, Deal Pipeline & Departmental Operations',
      description:
        'Track accounts from raw lead intake to closed deals with structured pipeline stages, departmental sprint tasks, and real-time conversion workflows.',
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
      specs: [
        { key: 'Deal Stages', value: 'Lead-to-Close Lifecycle' },
        { key: 'Execution', value: 'Departmental Task Boards' },
        { key: 'Collaboration', value: 'Private Department Channels' }
      ],
      capabilities: [
        'Move qualified replies seamlessly into structured deal stages',
        'Coordinate sprint deliverables across Research & Outbound units',
        'Monitor delivery accountability across every active engagement'
      ]
    },
    vault: {
      label: 'AI & BYOK Vault',
      badge: 'Encrypted Vault',
      title: 'AI Intelligence & Encrypted Integrations Vault (BYOK)',
      description:
        'Built-in AI prospect enrichment paired with an encrypted Bring Your Own Key vault supporting Resend, Apollo, Hunter, Stripe, and custom webhooks.',
      icon: <KeyRound className="w-4 h-4 text-cyan-400" />,
      specs: [
        { key: 'Key Governance', value: 'Encrypted BYOK Storage' },
        { key: 'Connectors', value: 'Resend · Apollo · Hunter · Stripe' },
        { key: 'Automation', value: 'Signed Inbound Webhooks' }
      ],
      capabilities: [
        'Store third-party API keys isolated inside your tenant vault',
        'Classify replies and enrich account metadata with AI workflows',
        'Ingest leads automatically from external scrapers via webhooks'
      ]
    }
  };

  const operationalStandards = [
    {
      code: '01',
      title: 'Multi-Layer SMTP & MX Verification',
      detail:
        'Every prospect email undergoes syntax validation, domain MX lookup, and SMTP mailbox verification prior to handoff—protecting sender reputation.'
    },
    {
      code: '02',
      title: '100% Custom-Sourced ICP Lists',
      detail:
        'Never recycled bulk databases. Every list is engineered fresh against your exact decision-maker titles, firmographics, and regional criteria.'
    },
    {
      code: '03',
      title: '48–72 Hour Sprint Turnaround',
      detail:
        'Structured research and Python extraction sprints deliver audited, CRM-ready B2B datasets on a predictable 48 to 72 hour turnaround.'
    },
    {
      code: '04',
      title: 'Live Portal Visibility in NexusFlow',
      detail:
        'Every engagement operates inside NexusFlow so your team has full real-time visibility into deliverables, sequences, and pipeline activity.'
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
        'Deduplicated CSV, Sheets, or webhook sync'
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
        'Live campaign visibility inside NexusFlow Client Portal'
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

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col font-sans selection:bg-[#2563EB] selection:text-white relative overflow-x-hidden">
      {/* Self-contained keyframe animations for SVG beam flow */}
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
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-transparent pointer-events-none"
      >
        <div
          style={{ transform: `scaleX(${scrollProgress})`, transformOrigin: '0% 50%' }}
          className="h-full w-full bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.75)] transition-transform duration-75"
        />
      </div>

      {/* Atmospheric Stripe/Linear Ambient Mesh + Architectural Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-48 left-1/4 w-[680px] h-[520px] rounded-full bg-[#2563EB]/14 blur-[140px]" />
        <div className="absolute top-1/3 -right-32 w-[560px] h-[560px] rounded-full bg-[#4F46E5]/12 blur-[150px]" />
        <div className="absolute bottom-0 left-1/3 w-[620px] h-[440px] rounded-full bg-[#06B6D4]/10 blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '64px 64px'
          }}
        />
      </div>

      {/* FLOATING GLASSMORPHIC TOP BAR */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#050811]/80 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Uploaded ALM Nexus Logo + Wordmark */}
          <a
            href="#"
            className="inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <AlmNexusLogoMark className="w-8 h-8" />
            <span>ALM Nexus</span>
          </a>

          {/* Zone 2: Clean Single-Line Navigation */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            <a href="#pipeline" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Pipeline
            </a>
            <a href="#services" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Services
            </a>
            <a href="#nexusflow" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              NexusFlow
            </a>
            <a href="#standards" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Standards
            </a>
            <a href="#contact" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          {/* Zone 3: Auth Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleClientSignIn}
              className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white border border-white/12 hover:border-white/25 bg-white/[0.03] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {currentUser ? 'Open Workspace' : 'Client Sign In'}
            </button>
            <button
              type="button"
              onClick={handleLaunchWorkspace}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] text-white shadow-[0_0_24px_rgba(37,99,235,0.4)] transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{currentUser ? 'Enter NexusFlow' : 'Launch NexusFlow'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* 1. HERO SECTION — Scale AI Interactive 3D Intelligence Globe Split */}
        <section className="py-16 sm:py-24 border-b border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
              {/* Left Proposition Column */}
              <div className="lg:col-span-6 space-y-8">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-mono text-cyan-300/90">
                    <span>almnexus.tech</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span>Islamabad, Pakistan</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span>Serving US, UK, UAE &amp; Europe</span>
                  </div>

                  <h1 className="text-[clamp(2.25rem,4vw,3.55rem)] font-extrabold text-white tracking-[-0.03em] leading-[1.06] text-balance">
                    Precision B2B Lead Generation &amp; Data Intelligence — Powered by Proprietary Technology.
                  </h1>

                  <p className="text-base sm:text-lg text-slate-300 leading-[1.65] max-w-xl">
                    ALM Nexus builds verified decision-maker datasets, automated Python data pipelines, and high-deliverability outbound systems for global B2B teams—powered by our proprietary SaaS platform,{' '}
                    <span className="text-white font-semibold">NexusFlow</span>.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => openInquiryModal('On-Demand Data Intelligence')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] text-white shadow-[0_0_32px_rgba(37,99,235,0.45)] transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>Book Strategy Call / Request Sample</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleLaunchWorkspace}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border border-white/15 hover:border-cyan-400/50 bg-white/[0.04] hover:bg-white/[0.08] text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span>{currentUser ? 'Open NexusFlow' : 'Launch NexusFlow'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                    <span>Client Portal Access:</span>
                    <button
                      type="button"
                      onClick={handleClientSignIn}
                      className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                    >
                      Sign in to NexusFlow
                    </button>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <a href="mailto:almnexus26@gmail.com" className="font-mono hover:text-white transition-colors">
                      almnexus26@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Right Interactive 3D Intelligence Globe */}
              <div className="lg:col-span-6">
                <InteractiveIntelligenceGlobe />
              </div>
            </div>
          </div>
        </section>

        {/* 2. CLAY & APOLLO-INSPIRED ANIMATED DATA ENRICHMENT & OUTBOUND PIPELINE FLOW */}
        <section id="pipeline" className="py-20 sm:py-24 border-b border-white/[0.08] bg-[#070B16]/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <RevealBlock className="max-w-2xl space-y-3">
              <p className="text-xs font-mono font-semibold text-cyan-400">
                Data Intelligence &amp; Outbound Architecture
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-[-0.025em] text-balance">
                How raw target accounts become verified outbound pipeline
              </h2>
              <p className="text-sm text-slate-400 leading-[1.65]">
                Select any stage below to inspect the exact verification, enrichment, and outbound execution mechanics powering ALM Nexus engagements.
              </p>
            </RevealBlock>

            {/* Interactive 4-Stage Pipeline Strip + Animated SVG Connector Beams */}
            <RevealBlock delayMs={80} className="space-y-6">
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
                          isActive
                            ? 'border-cyan-400/60 bg-gradient-to-b from-[#0F1A34] to-[#090E1A] shadow-[0_0_28px_rgba(6,182,212,0.16)]'
                            : isPassed
                              ? 'border-blue-500/35 bg-[#0C1325]'
                              : 'border-white/10 bg-[#090E1A] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-mono">
                          <span className={isActive ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
                            Stage {stage.step}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {isActive ? 'Inspecting' : 'Select'}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-sm font-bold text-white leading-snug">
                            {stage.shortLabel}
                          </div>
                          <div className="text-xs font-mono text-blue-300/90">
                            {stage.protocol}
                          </div>
                        </div>
                      </button>

                      {/* Glowing SVG Connector Beam between desktop columns */}
                      {idx < pipelineStages.length - 1 && (
                        <div
                          aria-hidden="true"
                          className="hidden md:flex items-center justify-center w-6 -mx-1 z-20 shrink-0"
                        >
                          <svg viewBox="0 0 28 16" className="w-7 h-4 overflow-visible">
                            <line
                              x1="0"
                              y1="8"
                              x2="24"
                              y2="8"
                              stroke={idx < activePipelineStage ? '#06B6D4' : 'rgba(148,163,184,0.35)'}
                              strokeWidth="1.75"
                              className={idx < activePipelineStage ? 'alm-beam-animate' : ''}
                            />
                            <polygon
                              points="22,4 28,8 22,12"
                              fill={idx < activePipelineStage ? '#06B6D4' : 'rgba(148,163,184,0.45)'}
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Active Stage Deliverable Inspector */}
              <div className="rounded-2xl border border-white/10 bg-[#0B1121] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-3">
                  <div className="text-xs font-mono text-cyan-400">
                    Stage {currentPipeline.step} · {currentPipeline.protocol}
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {currentPipeline.title}
                  </h3>
                  <p className="text-sm text-slate-300 leading-[1.65]">
                    {currentPipeline.description}
                  </p>
                </div>

                <div className="lg:col-span-5 space-y-2.5 border-t lg:border-t-0 lg:border-l border-white/10 pt-5 lg:pt-0 lg:pl-8">
                  <div className="text-xs font-mono text-slate-400 mb-3">
                    Stage Technical Deliverables
                  </div>
                  {currentPipeline.outputs.map((out) => (
                    <div key={out} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{out}</span>
                    </div>
                  ))}
                </div>
              </div>
            </RevealBlock>
          </div>
        </section>

        {/* 3. STRIPE-INSPIRED 3D TILT SPOTLIGHT CARDS — 4 ALM NEXUS AGENCY SERVICES */}
        <section id="services" className="py-20 sm:py-28 border-b border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <RevealBlock className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-mono font-semibold text-blue-400">
                  Core Agency Pillars · ALM Nexus
                </p>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-[-0.025em] leading-[1.12] text-balance">
                  Four specialized B2B intelligence &amp; outbound engineering pillars
                </h2>
                <p className="text-sm text-slate-400 leading-[1.65]">
                  Operating from Islamabad across the US, UK, UAE, and European markets, we engineer verified decision-maker data and automated outbound systems built for modern revenue teams.
                </p>
              </div>

              <div className="text-xs text-slate-300 space-y-1.5 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6 shrink-0">
                <div className="font-semibold text-white">Target Verticals &amp; Regions</div>
                <div className="text-slate-400 leading-relaxed">
                  {targetVerticals.join(' · ')}
                </div>
                <div className="font-mono text-cyan-400">US · UK · UAE · Europe</div>
              </div>
            </RevealBlock>

            {/* 2x2 Bento Grid with 3D Tilt + Radial Spotlight */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {servicePillars.map((pillar, idx) => (
                <RevealBlock key={pillar.index} delayMs={idx * 60}>
                  <TiltSpotlightCard className="h-full p-7 sm:p-8 flex flex-col justify-between">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="inline-flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg border border-white/12 bg-white/[0.04] inline-flex items-center justify-center">
                            {pillar.icon}
                          </span>
                          <span className="text-xs font-mono font-bold text-cyan-400 tabular-nums">
                            {pillar.index}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => openInquiryModal(pillar.focusValue)}
                          className="text-xs font-semibold text-blue-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <span>Scope Service</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        {pillar.title}
                      </h3>

                      <p className="text-sm text-slate-300 leading-[1.65]">
                        {pillar.summary}
                      </p>

                      <ul className="space-y-2.5 pt-4 border-t border-white/[0.08]">
                        {pillar.deliverables.map((item) => (
                          <li key={item} className="text-xs text-slate-300 flex items-start gap-2.5 leading-relaxed">
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
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

        {/* 4. LINEAR-INSPIRED DEEP 3D SHOWCASE STAGE FOR FLAGSHIP PRODUCT: NEXUSFLOW */}
        <section
          id="nexusflow"
          className="relative py-20 sm:py-28 border-b border-white/[0.08] bg-[#060913] overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_45%_at_50%_0%,rgba(79,70,229,0.20),transparent)]"
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <RevealBlock className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
              <div className="lg:col-span-7 space-y-3">
                <p className="text-xs font-mono font-semibold text-cyan-400">
                  Flagship Proprietary Product · Built In-House by ALM Nexus
                </p>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-[-0.025em] leading-[1.12] text-balance">
                  NexusFlow: Engineered for our own agency operations—now powering modern B2B teams.
                </h2>
              </div>

              <div className="lg:col-span-5 space-y-5">
                <p className="text-sm text-slate-300 leading-[1.65]">
                  Every ALM Nexus engagement runs through NexusFlow for live deliverable tracking—and agencies or B2B growth teams can deploy their own multi-tenant workspace directly.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleLaunchWorkspace}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] text-white shadow-[0_0_24px_rgba(37,99,235,0.4)] transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>{currentUser ? 'Open Workspace' : 'Launch NexusFlow / Create Workspace'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClientSignIn}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-white/15 hover:border-white/30 bg-white/[0.04] text-slate-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Client Sign In</span>
                  </button>
                </div>
              </div>
            </RevealBlock>

            {/* 3D Perspective Glass Product Stage */}
            <RevealBlock delayMs={90}>
              <div
                style={{ perspective: '1400px' }}
                className="relative"
              >
                <div className="rounded-2xl p-[1px] bg-gradient-to-b from-cyan-400/40 via-indigo-500/25 to-white/10 shadow-[0_24px_80px_-20px_rgba(37,99,235,0.35)]">
                  <div className="rounded-2xl bg-[#090E1A] overflow-hidden">
                    {/* Stage Tab Header */}
                    <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-[#070B16]">
                      <div
                        className="flex flex-wrap items-center gap-1.5"
                        role="tablist"
                        aria-label="NexusFlow Core Modules"
                      >
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
                                  ? 'bg-[#2563EB] text-white shadow-[0_0_18px_rgba(37,99,235,0.45)]'
                                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                              }`}
                            >
                              {nexusModules[key].icon}
                              <span>{nexusModules[key].label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
                        {activeModule.badge}
                      </span>
                    </div>

                    {/* Stage Split Body: Module Copy + Interactive UI Preview Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                      <div className="lg:col-span-6 p-6 sm:p-9 space-y-6 bg-[#0B1120]">
                        <div className="space-y-3">
                          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                            {activeModule.title}
                          </h3>
                          <p className="text-sm text-slate-300 leading-[1.65]">
                            {activeModule.description}
                          </p>
                        </div>

                        <ul className="space-y-3">
                          {activeModule.capabilities.map((cap) => (
                            <li key={cap} className="flex items-start gap-2.5 text-sm text-slate-200">
                              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                              <span>{cap}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="divide-y divide-white/10 border-y border-white/10 pt-1">
                          {activeModule.specs.map((spec) => (
                            <div
                              key={spec.key}
                              className="py-3 flex items-center justify-between gap-4 text-xs"
                            >
                              <span className="text-slate-400">{spec.key}</span>
                              <span className="font-mono font-semibold text-white text-right tabular-nums">
                                {spec.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Realistic Interactive UI Preview Card per Tab */}
                      <div className="lg:col-span-6 p-6 sm:p-9 bg-[#070B16] flex flex-col justify-between space-y-6">
                        {activeNexusModule === 'portal' && (
                          <div className="rounded-xl border border-white/10 bg-[#0C1222] p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                              <div>
                                <div className="text-xs font-semibold text-white">Tenant Workspace Matrix</div>
                                <div className="text-[11px] font-mono text-slate-400">Company-Isolated RBAC</div>
                              </div>
                              <span className="text-[11px] font-mono text-cyan-400">Role Enforced</span>
                            </div>

                            <div className="space-y-2.5">
                              {[
                                { dept: 'Lead Research Unit', role: 'Department Head', access: 'Operations · Chat' },
                                { dept: 'Outbound Delivery', role: 'Campaign Lead', access: 'Outreach · Client Inbox' },
                                { dept: 'External Client View', role: 'Portal Guest', access: 'Verified Deliverables Only' }
                              ].map((row) => (
                                <div
                                  key={row.dept}
                                  className="rounded-lg border border-white/[0.07] bg-[#090E1A] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div>
                                    <div className="font-semibold text-white">{row.dept}</div>
                                    <div className="text-[11px] text-slate-400">{row.role}</div>
                                  </div>
                                  <span className="font-mono text-[11px] text-blue-300 text-right">
                                    {row.access}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeNexusModule === 'outreach' && (
                          <div className="rounded-xl border border-white/10 bg-[#0C1222] p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                              <div>
                                <div className="text-xs font-semibold text-white">Outbound Sequence &amp; Inbox</div>
                                <div className="text-[11px] font-mono text-slate-400">Resend API · Custom SMTP</div>
                              </div>
                              <span className="text-[11px] font-mono text-cyan-400">Cadence Active</span>
                            </div>

                            <div className="space-y-2.5">
                              {[
                                { step: 'Step 01', subject: 'Personalized ICP Signal Opener', channel: 'Primary Domain' },
                                { step: 'Step 02', subject: 'Custom Sample Dataset Follow-Up', channel: 'Auto Day +3' },
                                { step: 'Inbox', subject: 'Positive Prospect Reply Triage', channel: 'Unified Thread' }
                              ].map((item) => (
                                <div
                                  key={item.step}
                                  className="rounded-lg border border-white/[0.07] bg-[#090E1A] px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="font-mono text-[11px] text-cyan-400 shrink-0">{item.step}</span>
                                    <span className="font-semibold text-white truncate">{item.subject}</span>
                                  </div>
                                  <span className="font-mono text-[11px] text-slate-400 shrink-0">
                                    {item.channel}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeNexusModule === 'pipeline' && (
                          <div className="rounded-xl border border-white/10 bg-[#0C1222] p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                              <div>
                                <div className="text-xs font-semibold text-white">Deal Pipeline &amp; Sprint Ops</div>
                                <div className="text-[11px] font-mono text-slate-400">Kanban · Departmental Tasks</div>
                              </div>
                              <span className="text-[11px] font-mono text-indigo-300">Milestone Sync</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5 text-xs">
                              {[
                                { col: 'ICP Scoped', items: ['US SaaS Series A', 'UK FinTech VP'] },
                                { col: 'Enriching', items: ['MX / SMTP QA', 'CRM Dedupe'] },
                                { col: 'Handover', items: ['Client Portal', 'Webhook Sync'] }
                              ].map((lane) => (
                                <div
                                  key={lane.col}
                                  className="rounded-lg border border-white/[0.07] bg-[#090E1A] p-3 space-y-2"
                                >
                                  <div className="font-mono text-[11px] text-cyan-400 font-semibold">
                                    {lane.col}
                                  </div>
                                  {lane.items.map((card) => (
                                    <div
                                      key={card}
                                      className="rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-slate-200"
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
                          <div className="rounded-xl border border-white/10 bg-[#0C1222] p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                              <div className="flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                                <div className="text-xs font-semibold text-white">Encrypted BYOK Integrations Vault</div>
                              </div>
                              <span className="text-[11px] font-mono text-cyan-400">Tenant Isolated</span>
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
                                  className="rounded-lg border border-white/[0.07] bg-[#090E1A] p-3 space-y-1"
                                >
                                  <div className="font-semibold text-white">{connector.name}</div>
                                  <div className="text-[11px] font-mono text-slate-400">{connector.role}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Email OTP Auth &amp; Multi-Company Switcher</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleClientSignIn}
                              className="font-semibold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
                            >
                              Client Sign In
                            </button>
                            <button
                              type="button"
                              onClick={handleLaunchWorkspace}
                              className="font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
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
        <section id="standards" className="py-20 sm:py-28 border-b border-white/[0.08]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <RevealBlock className="max-w-2xl space-y-3">
              <p className="text-xs font-mono font-semibold text-cyan-400">
                Operational Standards &amp; Guarantees
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-[-0.025em] text-balance">
                Audited execution discipline on every dataset and campaign
              </h2>
              <p className="text-sm text-slate-400 leading-[1.65]">
                No recycled lists, no synthetic vanity claims—only transparent verification protocols, custom ICP sourcing, and predictable sprint delivery.
              </p>
            </RevealBlock>

            <RevealBlock delayMs={60}>
              <div className="grid grid-cols-1 md:grid-cols-2 border border-white/10 rounded-2xl overflow-hidden bg-[#090E1A]/90 divide-y md:divide-y-0">
                {operationalStandards.map((std, idx) => (
                  <div
                    key={std.code}
                    className={`p-6 sm:p-9 space-y-3 border-white/10 ${
                      idx % 2 === 0 ? 'md:border-r' : ''
                    } ${idx < 2 ? 'md:border-b' : ''}`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                      <span className="text-cyan-400">Standard {std.code}</span>
                      <span>Verified Protocol</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {std.title}
                    </h3>
                    <p className="text-sm text-slate-300 leading-[1.65]">
                      {std.detail}
                    </p>
                  </div>
                ))}
              </div>
            </RevealBlock>
          </div>
        </section>

        {/* 6. ENGAGEMENT MODELS (3 Custom-Scoped Cards, No Hardcoded Dollar Pricing) */}
        <section id="engagement" className="py-20 sm:py-28 border-b border-white/[0.08] bg-[#070B16]/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <RevealBlock className="max-w-2xl space-y-3">
              <p className="text-xs font-mono font-semibold text-blue-400">
                Engagement Models
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-[-0.025em] text-balance">
                Structured ways to partner with ALM Nexus
              </h2>
              <p className="text-sm text-slate-400 leading-[1.65]">
                Commission custom B2B intelligence sprints, deploy a fully managed outbound pipeline, or operate inside NexusFlow directly.
              </p>
            </RevealBlock>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {engagementModels.map((model, idx) => (
                <RevealBlock key={model.title} delayMs={idx * 70}>
                  <TiltSpotlightCard className="h-full p-6 sm:p-8 flex flex-col justify-between space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
                        <span>Model {model.index}</span>
                        <span>Custom Scope</span>
                      </div>

                      <h3 className="text-lg font-bold text-white tracking-tight">
                        {model.title}
                      </h3>

                      <p className="text-xs font-semibold text-cyan-400">
                        {model.fit}
                      </p>

                      <p className="text-sm text-slate-300 leading-[1.65]">
                        {model.description}
                      </p>

                      <ul className="space-y-2.5 pt-3 border-t border-white/10">
                        {model.scope.map((point) => (
                          <li
                            key={point}
                            className="text-xs text-slate-300 flex items-start gap-2 leading-relaxed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
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
                          ? 'bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] text-white shadow-[0_0_20px_rgba(37,99,235,0.35)]'
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
        <section id="contact" className="py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
              <div className="lg:col-span-5 space-y-6">
                <p className="text-xs font-mono font-semibold text-cyan-400">
                  Strategy Call &amp; Custom Data Sample Desk
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-[-0.025em] leading-[1.15] text-balance">
                  Book a strategy call or request a custom B2B data sample
                </h2>
                <p className="text-sm text-slate-300 leading-[1.65]">
                  Share your target industry, geography, and decision-maker titles. Our research desk in Islamabad will prepare a verified sample slice and clear outbound scope directly for your team.
                </p>

                <div className="border-t border-white/10 pt-5 space-y-3.5 text-sm">
                  <div className="flex items-start gap-3 text-slate-200">
                    <Mail className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-semibold text-slate-400">
                        Primary Agency Email
                      </div>
                      <a
                        href="mailto:almnexus26@gmail.com"
                        className="font-mono text-xs sm:text-sm font-semibold text-white hover:text-cyan-300 transition-colors block"
                      >
                        almnexus26@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-slate-200">
                    <Mail className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[11px] font-semibold text-slate-400">
                        Direct / Founder Desk
                      </div>
                      <a
                        href="mailto:contact@abdulahadrana.me"
                        className="font-mono text-xs sm:text-sm text-slate-200 hover:text-cyan-300 transition-colors block"
                      >
                        contact@abdulahadrana.me
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-slate-300">
                    <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span className="text-xs sm:text-sm">
                      Islamabad, Pakistan · Serving US, UK, UAE &amp; Europe
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-5 space-y-3">
                  <div className="text-xs font-semibold text-white">Official Channels</div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                    {OFFICIAL_SOCIAL_LINKS.map((social) => (
                      <a
                        key={social.name}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap"
                      >
                        {social.icon}
                        <span>{social.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-2xl border border-white/10 bg-[#0B1120] p-6 sm:p-8">
                  {inquirySubmitted ? (
                    <div className="space-y-5">
                      <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>Brief Ready for almnexus26@gmail.com</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Send your structured brief directly via your email client (routed to almnexus26@gmail.com &amp; contact@abdulahadrana.me) or copy the formatted brief below.
                      </p>
                      <pre className="p-4 rounded-xl border border-white/10 bg-[#050811] text-xs font-mono text-slate-200 whitespace-pre-wrap">
                        {buildBriefText()}
                      </pre>
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={buildMailtoHref()}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Send via Email Client</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyBrief}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {copiedBrief ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedBrief ? 'Brief Copied' : 'Copy Brief'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInquirySubmitted(false)}
                          className="text-xs font-semibold text-slate-400 hover:text-white hover:underline cursor-pointer px-2"
                        >
                          Edit Brief
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitInquiry} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="landing-inquiry-name"
                            className="block text-xs font-semibold text-slate-200 mb-1.5"
                          >
                            Full Name
                          </label>
                          <input
                            id="landing-inquiry-name"
                            type="text"
                            value={inquiryForm.name}
                            onChange={(e) =>
                              setInquiryForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="Your full name"
                            className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#050811] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="landing-inquiry-email"
                            className="block text-xs font-semibold text-slate-200 mb-1.5"
                          >
                            Work Email
                          </label>
                          <input
                            id="landing-inquiry-email"
                            type="email"
                            value={inquiryForm.email}
                            onChange={(e) =>
                              setInquiryForm((prev) => ({ ...prev, email: e.target.value }))
                            }
                            placeholder="you@company.com"
                            className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#050811] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="landing-inquiry-website"
                            className="block text-xs font-semibold text-slate-200 mb-1.5"
                          >
                            Company Website
                          </label>
                          <input
                            id="landing-inquiry-website"
                            type="text"
                            value={inquiryForm.companyWebsite}
                            onChange={(e) =>
                              setInquiryForm((prev) => ({ ...prev, companyWebsite: e.target.value }))
                            }
                            placeholder="https://company.com"
                            className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#050811] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="landing-inquiry-focus"
                            className="block text-xs font-semibold text-slate-200 mb-1.5"
                          >
                            Service / Engagement Model
                          </label>
                          <select
                            id="landing-inquiry-focus"
                            value={inquiryForm.focus}
                            onChange={(e) =>
                              setInquiryForm((prev) => ({
                                ...prev,
                                focus: e.target.value as InquiryFocus
                              }))
                            }
                            className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#050811] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                        <label
                          htmlFor="landing-inquiry-notes"
                          className="block text-xs font-semibold text-slate-200 mb-1.5"
                        >
                          Target ICP Notes &amp; Objectives
                        </label>
                        <textarea
                          id="landing-inquiry-notes"
                          rows={3}
                          value={inquiryForm.notes}
                          onChange={(e) =>
                            setInquiryForm((prev) => ({ ...prev, notes: e.target.value }))
                          }
                          placeholder="e.g. Series A B2B SaaS or FinTech firms in US & UK, 25–200 employees, targeting Founders and VPs of Sales."
                          className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#050811] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                      </div>

                      {inquiryError && (
                        <p className="text-xs font-medium text-rose-400">{inquiryError}</p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                        <span className="text-xs text-slate-400">
                          Routed to almnexus26@gmail.com &amp; contact@abdulahadrana.me
                        </span>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] text-white transition-all cursor-pointer whitespace-nowrap shrink-0"
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
      <footer className="relative z-10 bg-[#050811] border-t border-white/[0.08] py-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5 text-white">
                <AlmNexusLogoMark className="w-8 h-8" />
                <span className="font-extrabold text-sm tracking-tight">ALM Nexus</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="font-mono text-xs text-slate-400">almnexus.tech</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Islamabad, Pakistan</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                B2B Lead Generation, Data Intelligence &amp; Proprietary NexusFlow Operations Platform. Serving US, UK, UAE &amp; Europe.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href="#services" className="hover:text-white transition-colors whitespace-nowrap">
                Services
              </a>
              <a href="#nexusflow" className="hover:text-white transition-colors whitespace-nowrap">
                NexusFlow
              </a>
              <a
                href="mailto:almnexus26@gmail.com"
                className="hover:text-cyan-300 transition-colors font-mono font-semibold text-white whitespace-nowrap"
              >
                almnexus26@gmail.com
              </a>
              <a
                href="mailto:contact@abdulahadrana.me"
                className="hover:text-cyan-300 transition-colors font-mono whitespace-nowrap"
              >
                contact@abdulahadrana.me
              </a>
              <button
                type="button"
                onClick={handleClientSignIn}
                className="px-3.5 py-2 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {currentUser ? 'Open Workspace' : 'Client Sign In'}
              </button>
            </div>
          </div>

          <div className="pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
              {OFFICIAL_SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap"
                >
                  {social.icon}
                  <span>{social.name}</span>
                </a>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-5 text-xs text-slate-400">
              <span>&copy; {new Date().getFullYear()} ALM Nexus (almnexus.tech). All rights reserved.</span>
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="hover:text-white transition-colors cursor-pointer whitespace-nowrap"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsInquiryModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-modal-title"
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#0B1120] p-6 sm:p-7 space-y-5 my-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-mono text-cyan-400">ALM Nexus · almnexus.tech</p>
                <h3 id="inquiry-modal-title" className="text-lg font-bold text-white mt-0.5">
                  Book Strategy Call / Request Custom Data Sample
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInquiryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close Inquiry Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inquirySubmitted ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Brief Ready for almnexus26@gmail.com</span>
                </div>
                <pre className="p-3.5 rounded-xl border border-white/10 bg-[#050811] text-xs font-mono text-slate-200 whitespace-pre-wrap">
                  {buildBriefText()}
                </pre>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={buildMailtoHref()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send via Email Client</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyBrief}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border border-white/15 bg-white/[0.04] text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {copiedBrief ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedBrief ? 'Copied' : 'Copy Brief'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitInquiry} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="modal-inquiry-name" className="block text-xs font-semibold text-slate-200 mb-1">
                      Full Name
                    </label>
                    <input
                      id="modal-inquiry-name"
                      type="text"
                      value={inquiryForm.name}
                      onChange={(e) => setInquiryForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Your full name"
                      className="w-full px-3 py-2 rounded-lg border border-white/12 bg-[#050811] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-inquiry-email" className="block text-xs font-semibold text-slate-200 mb-1">
                      Work Email
                    </label>
                    <input
                      id="modal-inquiry-email"
                      type="email"
                      value={inquiryForm.email}
                      onChange={(e) => setInquiryForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="you@company.com"
                      className="w-full px-3 py-2 rounded-lg border border-white/12 bg-[#050811] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="modal-inquiry-website" className="block text-xs font-semibold text-slate-200 mb-1">
                      Company Website
                    </label>
                    <input
                      id="modal-inquiry-website"
                      type="text"
                      value={inquiryForm.companyWebsite}
                      onChange={(e) =>
                        setInquiryForm((prev) => ({ ...prev, companyWebsite: e.target.value }))
                      }
                      placeholder="https://company.com"
                      className="w-full px-3 py-2 rounded-lg border border-white/12 bg-[#050811] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label htmlFor="modal-inquiry-focus" className="block text-xs font-semibold text-slate-200 mb-1">
                      Service / Model
                    </label>
                    <select
                      id="modal-inquiry-focus"
                      value={inquiryForm.focus}
                      onChange={(e) =>
                        setInquiryForm((prev) => ({
                          ...prev,
                          focus: e.target.value as InquiryFocus
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-white/12 bg-[#050811] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                  <label htmlFor="modal-inquiry-notes" className="block text-xs font-semibold text-slate-200 mb-1">
                    Target ICP Notes
                  </label>
                  <textarea
                    id="modal-inquiry-notes"
                    rows={3}
                    value={inquiryForm.notes}
                    onChange={(e) => setInquiryForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Specify decision-maker roles, industry vertical, region (US, UK, UAE, EU), and volume needed."
                    className="w-full px-3 py-2 rounded-lg border border-white/12 bg-[#050811] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                {inquiryError && <p className="text-xs font-medium text-rose-400">{inquiryError}</p>}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <a
                    href="mailto:almnexus26@gmail.com"
                    className="text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors truncate"
                  >
                    almnexus26@gmail.com
                  </a>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsInquiryModalOpen(false)}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer whitespace-nowrap"
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

      {/* MODAL: PRIVACY POLICY & B2B DATA COMPLIANCE / TERMS OF SERVICE */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
          onClick={() => setLegalModal(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0B1120] p-6 sm:p-8 space-y-5 my-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-mono text-cyan-400">ALM Nexus · almnexus.tech</p>
                <h3 id="legal-modal-title" className="text-lg font-bold text-white mt-0.5">
                  {legalModal === 'privacy'
                    ? 'Privacy Policy & B2B Data Compliance'
                    : 'Terms of Service'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close Legal Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {legalModal === 'privacy' ? (
              <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[65vh] overflow-y-auto pr-1">
                <div>
                  <h4 className="font-bold text-white mb-1">1. Scope &amp; Corporate Controller</h4>
                  <p>
                    ALM Nexus (almnexus.tech), headquartered in Islamabad, Pakistan, operates B2B data intelligence services and the NexusFlow SaaS workspace. This policy governs corporate inquiry records and client workspace data.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">
                    2. B2B Data Compliance (GDPR &amp; CAN-SPAM Alignment)
                  </h4>
                  <p>
                    All B2B research and outbound infrastructure built by ALM Nexus adheres to legitimate corporate interest standards under GDPR Article 6(1)(f), UK GDPR, and US CAN-SPAM transparency obligations, focusing strictly on business roles and corporate mail systems with immediate opt-out compliance.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">
                    3. Client Dataset Isolation &amp; BYOK Vault Security
                  </h4>
                  <p>
                    Custom-built prospect lists, scraped pipelines, and NexusFlow BYOK integration keys are strictly isolated per client organization. ALM Nexus never resells, shares, or recycles client-commissioned datasets.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">4. Data Requests &amp; Opt-Out Inquiries</h4>
                  <p>
                    Contact{' '}
                    <a href="mailto:almnexus26@gmail.com" className="font-mono text-cyan-400 underline">
                      almnexus26@gmail.com
                    </a>{' '}
                    or{' '}
                    <a
                      href="mailto:contact@abdulahadrana.me"
                      className="font-mono text-cyan-400 underline"
                    >
                      contact@abdulahadrana.me
                    </a>
                    .
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[65vh] overflow-y-auto pr-1">
                <div>
                  <h4 className="font-bold text-white mb-1">1. Engagement Scope &amp; Delivery</h4>
                  <p>
                    ALM Nexus provides custom B2B lead generation, Python data extraction, managed outbound systems, and NexusFlow platform access pursuant to mutually agreed project scopes.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">2. Custom Data Ownership &amp; Acceptable Use</h4>
                  <p>
                    Delivered custom prospect datasets are dedicated to the commissioning client&apos;s internal revenue operations and must be used in compliance with applicable commercial communication laws in the US, UK, UAE, and EU.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">3. NexusFlow Workspace Security</h4>
                  <p>
                    Workspace administrators govern departmental RBAC permissions, user invitations, and third-party API credentials stored inside their tenant BYOK Integrations Vault.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">4. Contact &amp; Governance</h4>
                  <p>
                    For enterprise agreements or compliance documentation, email{' '}
                    <a href="mailto:almnexus26@gmail.com" className="font-mono text-cyan-400 underline">
                      almnexus26@gmail.com
                    </a>{' '}
                    or{' '}
                    <a
                      href="mailto:contact@abdulahadrana.me"
                      className="font-mono text-cyan-400 underline"
                    >
                      contact@abdulahadrana.me
                    </a>
                    .
                  </p>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
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
