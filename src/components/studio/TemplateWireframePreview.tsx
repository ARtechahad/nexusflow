import React from 'react';
import {
  Calendar,
  Check,
  Database,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wallet
} from 'lucide-react';
import { WireframeVariantId } from '../../data/serviceStorefrontData';

interface MiniWireframeCardProps {
  variant: WireframeVariantId;
  active?: boolean;
}

/**
 * Compact, realistic mini-UI mockup rendered directly inside each selectable Step 2 storefront card.
 * Keeps every selector visually anchored with real layout anatomy (sidebars, mobile shells, pipelines, badges).
 */
export const MiniWireframeCard: React.FC<MiniWireframeCardProps> = ({
  variant,
  active = false
}) => {
  const accentBorder = active
    ? 'border-[var(--accent)]/40'
    : 'border-slate-200 dark:border-slate-800';

  switch (variant) {
    case 'mobile-saas':
      return (
        <div className="h-32 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-center">
          <div className={`w-28 h-full rounded-[12px] border bg-white dark:bg-[#111827] p-2 flex flex-col justify-between ${accentBorder}`}>
            <div className="flex items-center justify-between">
              <span className="h-1.5 w-6 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="text-[7px] font-mono text-slate-400">KPI</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div className="p-1 rounded bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800">
                <div className="text-[8px] font-bold text-slate-900 dark:text-white leading-none">142</div>
              </div>
              <div className="p-1 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50">
                <div className="text-[8px] font-bold text-[var(--accent)] leading-none">28</div>
              </div>
            </div>
            <div className="flex items-end gap-1 h-7 px-0.5">
              {[40, 75, 55, 95, 70].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="flex-1 rounded-t-[1px] bg-[var(--accent)]/80"
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-200 dark:border-slate-800">
              <span className="h-1 rounded bg-[var(--accent)]" />
              <span className="h-1 rounded bg-slate-200 dark:bg-slate-700" />
              <span className="h-1 rounded bg-slate-200 dark:bg-slate-700" />
              <span className="h-1 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        </div>
      );

    case 'mobile-ecommerce':
      return (
        <div className="h-32 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-center">
          <div className={`w-28 h-full rounded-[12px] border bg-white dark:bg-[#111827] p-2 flex flex-col justify-between ${accentBorder}`}>
            <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0B0F17]">
              <span className="h-1 w-10 rounded bg-slate-300 dark:bg-slate-700" />
              <ShoppingBag className="w-2.5 h-2.5 text-[var(--accent)]" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[0, 1].map((card) => (
                <div key={card} className="p-1 rounded border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="h-5 rounded-[2px] bg-slate-100 dark:bg-[#0B0F17]" />
                  <div className="h-1 w-7 rounded bg-slate-300 dark:bg-slate-700" />
                </div>
              ))}
            </div>
            <div className="py-1 px-1.5 rounded bg-[var(--accent)] text-white text-[7px] font-medium flex items-center justify-between">
              <span>Cart (2)</span>
              <span>Pay →</span>
            </div>
          </div>
        </div>
      );

    case 'mobile-booking':
      return (
        <div className="h-32 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-center">
          <div className={`w-28 h-full rounded-[12px] border bg-white dark:bg-[#111827] p-2 flex flex-col justify-between ${accentBorder}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700" />
                <span className="h-1.5 w-10 rounded bg-slate-300 dark:bg-slate-700" />
              </div>
              <Calendar className="w-2.5 h-2.5 text-[var(--accent)]" aria-hidden="true" />
            </div>
            <div className="grid grid-cols-4 gap-1">
              {['M', 'T', 'W', 'T'].map((d, i) => (
                <span
                  key={i}
                  className={`py-0.5 rounded text-center text-[7px] font-mono ${
                    i === 1
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-slate-100 dark:bg-[#0B0F17] text-slate-500'
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span className="py-0.5 rounded border border-[var(--accent)] text-[7px] font-mono text-center text-[var(--accent)]">
                10:30
              </span>
              <span className="py-0.5 rounded border border-slate-200 dark:border-slate-800 text-[7px] font-mono text-center text-slate-400">
                14:00
              </span>
            </div>
            <div className="py-0.5 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-center text-[7px] font-medium">
              Book Slot
            </div>
          </div>
        </div>
      );

    case 'mobile-fintech':
      return (
        <div className="h-32 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-center">
          <div className={`w-28 h-full rounded-[12px] border bg-white dark:bg-[#111827] p-2 flex flex-col justify-between ${accentBorder}`}>
            <div className="p-1.5 rounded-[5px] bg-slate-900 dark:bg-[#0B0F17] text-white space-y-1">
              <div className="flex items-center justify-between text-[6px] text-slate-400 font-mono">
                <span>BALANCE</span>
                <Wallet className="w-2.5 h-2.5 text-blue-400" aria-hidden="true" />
              </div>
              <div className="text-[10px] font-bold tabular-nums leading-none">$24.8k</div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[7px] font-mono text-slate-600 dark:text-slate-300">
                <span>Payout</span>
                <span className="text-emerald-600 dark:text-emerald-400">+$3.2k</span>
              </div>
              <div className="flex justify-between text-[7px] font-mono text-slate-600 dark:text-slate-300">
                <span>Cloud</span>
                <span>-$184</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'web-saas':
      return (
        <div className="h-32 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2 flex flex-col">
          <div className="flex items-center gap-1 pb-1.5 mb-1.5 border-b border-slate-200 dark:border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="h-1.5 w-20 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 ml-1" />
          </div>
          <div className="flex-1 grid grid-cols-12 gap-1.5">
            <div className="col-span-3 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-1 space-y-1">
              <span className="block h-1.5 w-full rounded bg-[var(--accent)]" />
              <span className="block h-1 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
              <span className="block h-1 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="col-span-9 space-y-1.5">
              <div className="grid grid-cols-3 gap-1">
                {[0, 1, 2].map((m) => (
                  <div
                    key={m}
                    className="p-1 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800"
                  >
                    <div className="h-1 w-5 rounded bg-slate-300 dark:bg-slate-700" />
                    <div className="h-2 w-8 mt-1 rounded bg-[var(--accent)]/60" />
                  </div>
                ))}
              </div>
              <div className="h-9 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-1.5 flex items-end gap-1">
                {[30, 55, 45, 80, 65, 95].map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className="flex-1 rounded-t-[1px] bg-[var(--accent)]/70"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );

    case 'web-agency':
      return (
        <div className="h-32 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
            <span className="h-1.5 w-10 rounded bg-slate-800 dark:bg-slate-200" />
            <span className="px-1.5 py-0.5 rounded bg-[var(--accent)] text-[6px] font-mono text-white">
              GET QUOTE
            </span>
          </div>
          <div className="p-2 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="h-2 w-3/4 rounded bg-slate-800 dark:bg-slate-200" />
            <div className="h-1.5 w-1/2 rounded bg-slate-300 dark:bg-slate-700" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((b) => (
              <div
                key={b}
                className="h-6 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-1"
              >
                <span className="block h-1 w-6 rounded bg-slate-300 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'web-crm':
      return (
        <div className="h-32 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[7px] font-mono text-slate-500">
            <span>PIPELINE STAGES</span>
            <span className="text-emerald-600 dark:text-emerald-400">LIVE</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 flex-1 pt-1.5">
            {['NEW', 'SCOPE', 'WON'].map((col, idx) => (
              <div
                key={col}
                className="rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-1 space-y-1"
              >
                <div className="text-[6px] font-mono text-slate-400">{col}</div>
                <div
                  className={`h-4 rounded-[2px] border p-0.5 ${
                    idx === 1
                      ? 'border-[var(--accent)] bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                />
                <div className="h-4 rounded-[2px] border border-slate-200 dark:border-slate-800" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'web-ecommerce':
      return (
        <div className="h-32 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2 grid grid-cols-12 gap-1.5">
          <div className="col-span-3 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-1.5 space-y-1.5">
            <div className="text-[6px] font-mono text-slate-400">FILTER</div>
            {[0, 1, 2].map((f) => (
              <div key={f} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-[1px] border border-slate-400" />
                <span className="h-1 w-6 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
          <div className="col-span-9 grid grid-cols-3 gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-1 flex flex-col justify-between"
              >
                <div className="h-5 rounded-[2px] bg-slate-100 dark:bg-[#0B0F17]" />
                <div className="h-1 w-8 rounded bg-[var(--accent)]/70" />
              </div>
            ))}
          </div>
        </div>
      );

    case 'ai-cloud':
    case 'ai-private':
    case 'ai-hybrid': {
      const isPrivate = variant === 'ai-private';
      const isHybrid = variant === 'ai-hybrid';
      return (
        <div className="h-28 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 dark:text-slate-400">
            <span>{isPrivate ? 'VPC AIR-GAP' : isHybrid ? 'PII SCRUB' : 'CLOUD RAG'}</span>
            {isPrivate ? (
              <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <Sparkles className="w-3 h-3 text-[var(--accent)]" aria-hidden="true" />
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5 items-center">
            <div className="p-1.5 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[7px] font-mono text-slate-400">INPUT</div>
              <div className="text-[9px] font-semibold text-slate-800 dark:text-slate-200">Docs</div>
            </div>
            <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 border border-[var(--accent)]/60 text-center">
              <div className="text-[7px] font-mono text-[var(--accent)]">FILTER</div>
              <div className="text-[9px] font-semibold text-slate-900 dark:text-white">
                {isPrivate ? 'Local DB' : isHybrid ? 'PII Mask' : 'Vector'}
              </div>
            </div>
            <div className="p-1.5 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-[7px] font-mono text-slate-400">MODEL</div>
              <div className="text-[9px] font-semibold text-slate-800 dark:text-slate-200">
                {isPrivate ? 'Private' : 'API'}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'data-csv':
    case 'data-api':
    case 'data-crm':
      return (
        <div className="h-28 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] font-mono text-slate-500">
            <span>
              {variant === 'data-csv'
                ? 'VERIFIED.CSV'
                : variant === 'data-api'
                ? 'REST /V1/LEADS'
                : 'CRM AUTO-SYNC'}
            </span>
            {variant === 'data-csv' ? (
              <FileSpreadsheet className="w-3 h-3 text-[var(--accent)]" aria-hidden="true" />
            ) : (
              <Database className="w-3 h-3 text-[var(--accent)]" aria-hidden="true" />
            )}
          </div>
          <div className="rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 overflow-hidden text-[8px] font-mono">
            <div className="grid grid-cols-3 px-2 py-1 bg-slate-50 dark:bg-[#0B0F17] text-slate-500">
              <span>Company</span>
              <span>Email</span>
              <span>Check</span>
            </div>
            <div className="grid grid-cols-3 px-2 py-1 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <span>Northstar</span>
              <span>ops@...</span>
              <span className="text-emerald-600 dark:text-emerald-400">SMTP OK</span>
            </div>
            <div className="grid grid-cols-3 px-2 py-1 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <span>Apex Co</span>
              <span>ceo@...</span>
              <span className="text-emerald-600 dark:text-emerald-400">SMTP OK</span>
            </div>
          </div>
        </div>
      );

    case 'sec-webapp':
    case 'sec-api':
    case 'sec-cloud':
      return (
        <div className="h-28 rounded-[6px] bg-slate-100/80 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[8px] font-mono text-slate-500">
            <span>
              {variant === 'sec-webapp'
                ? 'OWASP TOP 10'
                : variant === 'sec-api'
                ? 'API / BOLA FUZZ'
                : 'CLOUD / IAM'}
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            {(variant === 'sec-webapp'
              ? ['RBAC & Tenant Isolation', 'CSRF, XSS & Session Audit']
              : variant === 'sec-api'
              ? ['BOLA / IDOR Endpoint Probe', 'JWT & Webhook Signatures']
              : ['SSH, Ports & Firewall Check', 'IAM Policy & TLS Headers']
            ).map((row) => (
              <div
                key={row}
                className="flex items-center justify-between px-2 py-1 rounded bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-[8px] font-mono text-slate-700 dark:text-slate-300"
              >
                <span className="truncate pr-1">{row}</span>
                <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      );
  }
};
