import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Cloud,
  Cpu,
  Database,
  Gamepad2,
  GitBranch,
  Globe,
  Layers,
  Mail,
  Phone,
  Rocket,
  ShieldCheck,
  Smartphone,
  Terminal
} from 'lucide-react';
import {
  AgencyServiceIconKey,
  HERO_ROTATING_WORDS,
  HOMEPAGE_INSIGHTS,
  HOMEPAGE_PRICING_MODELS,
  HOMEPAGE_PROCESS_STEPS,
  HOMEPAGE_STATS,
  HOMEPAGE_TECH_STACK,
  HomepageStatItem,
  QUICK_SERVICE_STRIP,
  STUDIO_BRAND,
  WHAT_WE_BUILD_SERVICES
} from '../../data/studioData';
import { HeroVideoBackdrop } from './HeroVideoBackdrop';
import { NexusFlowPreviewWindow } from './NexusFlowPreviewWindow';
import { StudioLink, StudioNavigationProps } from './StudioLayout';

interface HomePageProps extends StudioNavigationProps {
  isDark: boolean;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
}

const SERVICE_ICONS: Record<AgencyServiceIconKey, React.ElementType> = {
  bot: Bot,
  globe: Globe,
  cloud: Cloud,
  layers: Layers,
  database: Database,
  shield: ShieldCheck,
  rocket: Rocket,
  smartphone: Smartphone,
  gamepad: Gamepad2
};

// Typing word cycler: renders "Startups" immediately on SSR so crawlers see complete H1
function useRotatingTypedWord(words: readonly string[]): string {
  const [wordIndex, setWordIndex] = useState<number>(0);
  const [displayed, setDisplayed] = useState<string>(words[0]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplayed(words[0]);
      return;
    }

    const fullWord = words[wordIndex % words.length];

    if (!isDeleting && displayed === fullWord) {
      const pauseTimer = window.setTimeout(() => {
        setIsDeleting(true);
      }, 2100);
      return () => window.clearTimeout(pauseTimer);
    }

    if (isDeleting && displayed === '') {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const speed = isDeleting ? 42 : 76;
    const stepTimer = window.setTimeout(() => {
      if (isDeleting) {
        setDisplayed((prev) => prev.slice(0, Math.max(0, prev.length - 1)));
      } else {
        setDisplayed(fullWord.slice(0, displayed.length + 1));
      }
    }, speed);

    return () => window.clearTimeout(stepTimer);
  }, [displayed, isDeleting, wordIndex, words]);

  return displayed;
}

const AnimatedStatValue: React.FC<{
  stat: HomepageStatItem;
  active: boolean;
}> = ({ stat, active }) => {
  const [current, setCurrent] = useState<number>(stat.targetNumber);
  const hasAnimatedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!active || hasAnimatedRef.current || typeof window === 'undefined') return;
    hasAnimatedRef.current = true;

    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setCurrent(stat.targetNumber);
      return;
    }

    const durationMs = 1100;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = stat.targetNumber * eased;
      setCurrent(nextValue);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setCurrent(stat.targetNumber);
      }
    };

    setCurrent(0);
    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [active, stat.targetNumber]);

  const formattedPrimary = stat.decimals
    ? current.toFixed(stat.decimals)
    : Math.round(current).toString();

  const text =
    stat.separator && stat.secondaryNumber !== undefined
      ? `${formattedPrimary}${stat.separator}${stat.secondaryNumber}`
      : `${stat.prefix || ''}${formattedPrimary}${stat.suffix || ''}`;

  return <span className="tabular-nums">{text}</span>;
};

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onOpenAuth
}) => {
  const typedAudience = useRotatingTypedWord(HERO_ROTATING_WORDS);

  const statsSectionRef = useRef<HTMLElement | null>(null);
  const [statsVisible, setStatsVisible] = useState<boolean>(false);

  const processSectionRef = useRef<HTMLElement | null>(null);
  const [processVisible, setProcessVisible] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setStatsVisible(true);
      setProcessVisible(true);
      return;
    }

    const statsObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setStatsVisible(true);
          statsObserver.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    const processObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setProcessVisible(true);
          processObserver.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (statsSectionRef.current) statsObserver.observe(statsSectionRef.current);
    if (processSectionRef.current) processObserver.observe(processSectionRef.current);

    return () => {
      statsObserver.disconnect();
      processObserver.disconnect();
    };
  }, []);

  const handleLaunchApp = () => {
    if (onOpenAuth) {
      onOpenAuth('signup');
    } else {
      onNavigate('/signup');
    }
  };

  return (
    <>
      {/* 2. HERO: Full-screen dark tech video + canvas backdrop */}
      <section className="relative min-h-[calc(100vh-4rem)] min-h-[620px] flex flex-col justify-center overflow-hidden bg-[#0B0F17] text-white border-b border-slate-800/80">
        <HeroVideoBackdrop />

        <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-4xl space-y-6">
            {/* Small tagline badge above heading */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-blue-500/30 bg-[#111827]/75 backdrop-blur-md text-xs font-mono text-blue-300 tracking-wide">
              <Terminal className="w-3.5 h-3.5 text-blue-400 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span>AI, Web &amp; Mobile Software Engineering Agency</span>
            </div>

            {/* Dynamic rotating typing headline */}
            <h1 className="font-display text-[36px] sm:text-[50px] lg:text-[62px] font-bold tracking-[-0.03em] leading-[1.08] text-white text-balance">
              ALM Nexus for{' '}
              <span className="inline-block text-blue-400">
                {typedAudience}
                <span
                  aria-hidden="true"
                  className="inline-block w-[3px] h-[0.88em] ml-1 align-middle bg-blue-400 animate-caret"
                />
              </span>
            </h1>

            <p className="text-[16px] sm:text-[18px] leading-[1.65] text-slate-300 max-w-[62ch]">
              We architect and deploy autonomous AI workflows, multi-tenant web and SaaS platforms, native mobile apps, verified B2B data pipelines, and hardened cloud infrastructure—built for scale with complete repository ownership.
            </p>

            {/* Primary & secondary CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <StudioLink
                href="/contact"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-[6px] text-sm font-semibold bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors shadow-lg shadow-blue-950/50 whitespace-nowrap"
              >
                <span>Start a Project</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              </StudioLink>

              <StudioLink
                href="/products"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-[6px] text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white transition-colors whitespace-nowrap"
              >
                <span>Explore Products</span>
              </StudioLink>
            </div>

            {/* Small case study badge linking to /work */}
            <div className="pt-2">
              <StudioLink
                href="/work"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-700/80 bg-[#111827]/70 hover:border-blue-500/50 backdrop-blur-md text-xs text-slate-300 hover:text-white transition-colors"
              >
                <span>Latest case study</span>
                <span aria-hidden="true" className="text-blue-400 font-semibold">
                  →
                </span>
                <span className="font-semibold text-white">NexusFlow</span>
              </StudioLink>
            </div>
          </div>
        </div>
      </section>

      {/* 3. QUICK SERVICE STRIP: 6 compact glassmorphism cards */}
      <section
        id="solutions"
        aria-label="Core engineering solutions"
        className="scroll-mt-20 py-10 sm:py-12 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0B0F17]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {QUICK_SERVICE_STRIP.map((item) => {
              const IconComp = SERVICE_ICONS[item.icon] || Cpu;
              return (
                <StudioLink
                  key={item.id}
                  href={item.href}
                  onNavigate={onNavigate}
                  className="group relative p-4 rounded-[10px] border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#111827]/70 backdrop-blur-md hover:border-[var(--accent)] dark:hover:border-blue-500/50 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between gap-3 shadow-xs dark:shadow-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-8 h-8 rounded-[6px] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B0F17]/90 flex items-center justify-center text-[var(--accent)] dark:text-blue-400 shrink-0">
                      <IconComp className="w-4 h-4" strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <ArrowRight
                      className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--accent)] dark:group-hover:text-blue-400 transition-colors shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white leading-snug">
                      {item.title}
                    </h2>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </StudioLink>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. STATS SECTION: 4 animated count-up metrics */}
      <section
        ref={statsSectionRef}
        aria-label="Engineering delivery metrics"
        className="py-14 md:py-16 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D121C]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOMEPAGE_STATS.map((stat) => (
              <div
                key={stat.id}
                className="p-6 rounded-[10px] border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#111827]/70 backdrop-blur-md space-y-2"
              >
                <div className="font-display text-[34px] sm:text-[40px] font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">
                  <AnimatedStatValue stat={stat} active={statsVisible} />
                </div>
                <div className="text-sm font-semibold text-[var(--accent)] dark:text-blue-400">
                  {stat.label}
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {stat.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SERVICES SECTION ("What We Build"): Responsive grid of 9 cards */}
      <section className="relative py-16 md:py-24 border-b border-slate-200 dark:border-slate-800/80 overflow-hidden bg-[#F8FAFC] dark:bg-[#0B0F17]">
        <div
          aria-hidden="true"
          className="hidden dark:block pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[780px] h-[340px] rounded-full bg-blue-600/10 blur-[120px]"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-[64ch] space-y-2">
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                Engineering Capabilities
              </p>
              <h2 className="font-display text-[28px] sm:text-[34px] lg:text-[40px] font-bold tracking-[-0.02em] leading-[1.15] text-slate-900 dark:text-white text-balance">
                What We Build
              </h2>
              <p className="text-[15px] sm:text-[16px] text-slate-600 dark:text-slate-300">
                Select any capability to compare architecture paths and configure your project scope interactively.
              </p>
            </div>

            <StudioLink
              href="/services"
              onNavigate={onNavigate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-white/15 bg-white dark:bg-[#111827]/75 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-900 dark:text-white transition-colors whitespace-nowrap self-start md:self-auto"
            >
              <span>All Service Blueprints</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            </StudioLink>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_WE_BUILD_SERVICES.map((service) => {
              const IconComp = SERVICE_ICONS[service.icon] || Cpu;
              return (
                <StudioLink
                  key={service.id}
                  href={service.href}
                  onNavigate={onNavigate}
                  className="group relative p-6 sm:p-7 rounded-[10px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827]/65 backdrop-blur-md hover:border-[var(--accent)] dark:hover:border-blue-500/50 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between gap-6 shadow-xs dark:shadow-none"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="w-10 h-10 rounded-[8px] border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B0F17] flex items-center justify-center text-[var(--accent)] dark:text-blue-400">
                        <IconComp className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <ArrowRight
                        className="w-4 h-4 text-slate-400 group-hover:text-[var(--accent)] dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {service.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {service.description}
                      </p>
                    </div>

                    <ul className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/10 text-[13px] text-slate-600 dark:text-slate-300">
                      {service.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2">
                          <Check
                            className="w-3.5 h-3.5 text-[var(--accent)] dark:text-blue-400 shrink-0 mt-1"
                            strokeWidth={2.25}
                            aria-hidden="true"
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs font-mono font-medium text-[var(--accent)] dark:text-blue-400 group-hover:underline underline-offset-4">
                    Configure &amp; scope →
                  </div>
                </StudioLink>
              );
            })}
          </div>
        </div>
      </section>

      {/* TECH STACK MATRIX (supports navbar Tech Stack anchor) */}
      <section
        id="tech-stack"
        className="scroll-mt-20 py-14 md:py-20 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D121C]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-[62ch] space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
              Production Stack
            </p>
            <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
              Battle-tested technologies under the hood
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {HOMEPAGE_TECH_STACK.map((group) => (
              <div
                key={group.category}
                className="p-5 rounded-[10px] border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#111827]/70 backdrop-blur-md space-y-3"
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {group.category}
                </h3>
                <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-mono text-slate-600 dark:text-slate-300">
                  {group.items.map((tech, idx) => (
                    <li key={tech} className="inline-flex items-center gap-3">
                      <span>{tech}</span>
                      {idx < group.items.length - 1 && (
                        <span aria-hidden="true" className="text-slate-400 dark:text-slate-600">
                          /
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. NEXUSFLOW SECTION: Flagship product preserved intact */}
      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800/80 bg-[#F8FAFC] dark:bg-[#0B0F17]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="p-6 sm:p-10 rounded-[12px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827]/80 backdrop-blur-md space-y-8 shadow-xs dark:shadow-none">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-[68ch] space-y-3">
                <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                  Flagship product
                </p>
                <h2 className="font-display text-[24px] sm:text-[30px] lg:text-[34px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
                  NexusFlow: multi-tenant operations platform for agencies and B2B teams
                </h2>
                <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
                  NexusFlow gives agencies one workspace for client portals, deal pipelines, and outbound email, with role-based access per department. It is built and run by ALM Nexus.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <StudioLink
                  href="/products"
                  onNavigate={onNavigate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
                >
                  <span>Explore NexusFlow</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                </StudioLink>

                <button
                  type="button"
                  onClick={handleLaunchApp}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0B0F17] hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-900 dark:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Launch App</span>
                </button>
              </div>
            </div>

            <NexusFlowPreviewWindow />
          </div>
        </div>
      </section>

      {/* 7. PROCESS SECTION: 01 Discovery -> 02 Design -> 03 Build -> 04 Launch with animated scroll connector */}
      <section
        ref={processSectionRef}
        className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0D121C]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-[64ch] space-y-2">
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                Delivery Methodology
              </p>
              <h2 className="font-display text-[28px] sm:text-[34px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                How we go from spec to production
              </h2>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-700 dark:text-emerald-400">
              <GitBranch className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>100% Git repository &amp; IP ownership handoff</span>
            </div>
          </div>

          <div className="relative">
            {/* Animated connecting line on desktop scroll */}
            <div
              aria-hidden="true"
              className="hidden lg:block absolute top-6 left-[12%] right-[12%] h-[2px] bg-slate-200 dark:bg-slate-800 overflow-hidden"
            >
              <div
                className={`h-full w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 origin-left transition-transform duration-1000 ease-out ${
                  processVisible ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {HOMEPAGE_PROCESS_STEPS.map((step, index) => (
                <article
                  key={step.number}
                  style={{
                    transitionDelay: processVisible ? `${index * 90}ms` : '0ms'
                  }}
                  className="p-6 rounded-[10px] border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#111827]/85 backdrop-blur-md space-y-4 transition-transform duration-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-[8px] border border-blue-500/30 bg-blue-50 dark:bg-[#0B0F17] font-mono text-sm font-bold text-[var(--accent)] dark:text-blue-400 tabular-nums">
                      {step.number}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Phase {index + 1}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {step.summary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-200">
                    Deliverable: {step.deliverable}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INSIGHTS & PRICING SECTIONS (backing Insights & Pricing navbar links with zero 404s) */}
      <section
        id="insights"
        className="scroll-mt-20 py-16 md:py-20 border-b border-slate-200 dark:border-slate-800/80 bg-[#F8FAFC] dark:bg-[#0B0F17]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Engineering Insights */}
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                  Insights &amp; Architecture
                </p>
                <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                  Applied engineering notes
                </h2>
              </div>
              <StudioLink
                href="/work"
                onNavigate={onNavigate}
                className="text-sm font-medium text-[var(--accent)] dark:text-blue-400 hover:underline underline-offset-4 whitespace-nowrap"
              >
                View all case studies →
              </StudioLink>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {HOMEPAGE_INSIGHTS.map((insight) => (
                <StudioLink
                  key={insight.title}
                  href={insight.href}
                  onNavigate={onNavigate}
                  className="group p-6 rounded-[10px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827]/70 backdrop-blur-md hover:border-[var(--accent)] dark:hover:border-blue-500/40 transition-colors flex flex-col justify-between gap-5"
                >
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {insight.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                      {insight.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {insight.summary}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[var(--accent)] dark:text-blue-400">
                    <span>{insight.ctaLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                </StudioLink>
              ))}
            </div>
          </div>

          {/* Transparent Engagement & Pricing Models */}
          <div id="pricing" className="scroll-mt-24 pt-12 border-t border-slate-200 dark:border-slate-800/80 space-y-8">
            <div className="max-w-[62ch] space-y-2">
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                Pricing &amp; Engagements
              </p>
              <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                Predictable scopes matched to your stage
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {HOMEPAGE_PRICING_MODELS.map((tier) => (
                <div
                  key={tier.id}
                  className={`p-6 rounded-[10px] border backdrop-blur-md flex flex-col justify-between gap-6 ${
                    tier.featured
                      ? 'border-[var(--accent)]/60 bg-blue-50/40 dark:bg-[#111827]/90 ring-1 ring-blue-500/20'
                      : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#111827]/70'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-[var(--accent)] dark:text-blue-400">
                        {tier.cadence}
                      </p>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {tier.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {tier.summary}
                      </p>
                    </div>

                    <ul className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-white/10 text-[13px] text-slate-600 dark:text-slate-300">
                      {tier.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1" strokeWidth={2.25} aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <StudioLink
                    href="/contact"
                    onNavigate={onNavigate}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[6px] text-sm font-medium transition-colors ${
                      tier.featured
                        ? 'bg-[var(--accent)] hover:bg-[#1D4ED8] text-white'
                        : 'border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-[#0B0F17] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    <span>Request Scope &amp; Estimate</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  </StudioLink>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. FINAL CTA SECTION */}
      <section className="relative py-16 md:py-24 overflow-hidden bg-white dark:bg-[#0B0F17]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden p-8 sm:p-12 lg:p-14 rounded-[14px] border border-slate-200 dark:border-white/10 bg-slate-900 dark:bg-[#111827]/85 text-white backdrop-blur-md">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 right-0 w-[420px] h-[420px] rounded-full bg-blue-600/20 blur-[110px]"
            />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="max-w-[60ch] space-y-3">
                <p className="text-xs font-mono uppercase tracking-wider text-blue-400">
                  Response within 24 hours
                </p>
                <h2 className="font-display text-[28px] sm:text-[36px] lg:text-[42px] font-bold tracking-[-0.025em] leading-[1.15] text-white text-balance">
                  Ready to engineer your next software or AI system?
                </h2>
                <p className="text-[15px] sm:text-[16px] text-slate-300">
                  Share your architecture goals or product scope. You will receive concrete technical recommendations and an execution timeline directly from our engineering lead.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                  <StudioLink
                    href="/contact"
                    onNavigate={onNavigate}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[6px] text-sm font-semibold bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
                  >
                    <span>Get Free Consultation</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  </StudioLink>

                  <a
                    href={STUDIO_BRAND.phoneHref}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[6px] text-sm font-semibold border border-white/15 bg-white/5 hover:bg-white/10 text-white transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-4 h-4 text-blue-400" strokeWidth={1.75} aria-hidden="true" />
                    <span>Call Us</span>
                  </a>
                </div>

                <a
                  href={`mailto:${STUDIO_BRAND.emailPrimary}`}
                  className="inline-flex items-center gap-2 text-xs font-mono text-slate-300 hover:text-white transition-colors pt-1"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.75} aria-hidden="true" />
                  <span>{STUDIO_BRAND.emailPrimary}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
