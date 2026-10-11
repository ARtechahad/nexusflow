import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  X, 
  Copy, 
  Check, 
  FileText, 
  Sparkles, 
  Plus, 
  Tag, 
  Folder, 
  Share2, 
  Calendar 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WikiDocument } from '../types';

interface CompanyWikiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompanyWikiModal: React.FC<CompanyWikiModalProps> = ({ isOpen, onClose }) => {
  const { wikiDocs, showToast } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeDoc, setActiveDoc] = useState<WikiDocument | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const docs = wikiDocs.length > 0 ? wikiDocs : [
    {
      id: 'wiki-1',
      title: 'LinkedIn Outreach Master Script (High-Converting <300 Chars)',
      category: 'outreach_scripts' as const,
      description: 'Word-for-word connection pitch yielding 42% acceptance with international founders.',
      content: `Hi {{name}}, saw your recent post regarding {{companyName}}'s web development roadmap.

We build modern, fast Next.js & Tailwind web applications with guaranteed 10-day sprint delivery and strict 50% escrow milestones.

Would love to share our live interactive preview deck if you're open to a 2-minute look. Best, Tariq`,
      author: 'Tariq Mehmood (CEO)',
      updatedAt: '2026-09-25T12:00:00Z',
      tags: ['linkedin', 'cold_outreach', 'conversion']
    },
    {
      id: 'wiki-2',
      title: 'SOP 50% Advance Payment & Staging Isolation Gate',
      category: 'sop_checklists' as const,
      description: 'Non-negotiable rule: Never provision live production domain without 100% balance clearance.',
      content: `### Mandatory Payment Gatekeeper Protocol:
1. Always secure 50% deposit before creating Git repositories or allocating engineering hours.
2. Develop strictly on internal staging subdomains (e.g., https://staging-client.agencyops.dev).
3. Client inspects and signs off on staging.
4. Issue final 50% balance invoice via Stripe or PayPal.
5. Only upon transaction ID verification: trigger DNS A-record cutover and transfer administrative credentials.`,
      author: 'Fatima Noor (QA Lead)',
      updatedAt: '2026-09-24T10:00:00Z',
      tags: ['sop', 'security', 'escrow', 'payments']
    },
    {
      id: 'wiki-3',
      title: 'ALM Nexus Dark-Mode & Geometric Brand Design Principles',
      category: 'brand_guidelines' as const,
      description: 'Aesthetic guidelines: Anti-AI slop, geometric accents, zero-pill discipline, high information density.',
      content: `### Design System Guidelines:
- **Color Palette:** Deep slate (#070a12, #0d1322), Indigo accents (#6366f1), Cyan telemetry (#06b6d4).
- **Typography:** Plus Jakarta Sans for UI headers, JetBrains Mono for financial figures and status badges.
- **Glassmorphism:** Subtle backdrops with 16px blur and 1px white/10 borders.
- **Data Clarity:** Never hide operational metrics behind ambiguous tooltips; show real numbers.`,
      author: 'Sara Jenkins (Design Lead)',
      updatedAt: '2026-09-22T08:00:00Z',
      tags: ['design', 'ui_ux', 'brand', 'tailwind']
    },
    {
      id: 'wiki-4',
      title: 'Cold Email Follow-Up Drip 4-Stage Cadence',
      category: 'email_templates' as const,
      description: 'Sequenced email follow-ups for non-responsive client proposals to reactivate discussions.',
      content: `Stage 1 (+24h): Sprint Slot Reservation Confirmation
Stage 2 (+72h): Dedicated Staging Server Pre-Allocation Hold
Stage 3 (+120h): Complimentary Performance & Core Web Vitals Audit
Stage 4 (+168h): Graceful File Archival (Break-Up Email)`,
      author: 'Hamza Farooq (Senior BD)',
      updatedAt: '2026-09-26T14:00:00Z',
      tags: ['drip', 'sales', 'follow_up']
    }
  ];

  const filteredDocs = docs.filter(doc => {
    const matchesCat = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const selectedDoc = activeDoc || filteredDocs[0] || docs[0];

  const handleCopy = (doc: WikiDocument) => {
    navigator.clipboard.writeText(doc.content);
    setCopiedId(doc.id);
    showToast('Copied script/template to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col h-[85vh]">
        
        {/* Top Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a12] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Global Company Wiki &amp; Knowledge Base
                </h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                  SOP Repository
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Standard outreach scripts, email templates, brand guidelines, and technical protocols
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search scripts, SOP rules, tags..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
            {[
              { key: 'all', label: 'All Docs' },
              { key: 'outreach_scripts', label: 'Outreach Scripts' },
              { key: 'email_templates', label: 'Email Templates' },
              { key: 'sop_checklists', label: 'SOP Rules' },
              { key: 'brand_guidelines', label: 'Brand & UI' }
            ].map(cat => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer text-xs ${
                  selectedCategory === cat.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Column: Docs List */}
          <div className="md:col-span-5 border-r border-slate-200 dark:border-white/10 overflow-y-auto p-4 space-y-2 bg-slate-50/50 dark:bg-slate-900/20">
            {filteredDocs.map(doc => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setActiveDoc(doc)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 shadow-sm ring-1 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                      {doc.category.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                    {doc.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {doc.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {doc.tags.map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Doc Reader & Action */}
          <div className="md:col-span-7 flex flex-col justify-between overflow-y-auto p-6 md:p-8 bg-white dark:bg-[#0b101e]">
            {selectedDoc ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
                  <div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                      {selectedDoc.category.replace(/_/g, ' ')}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1.5 leading-tight">
                      {selectedDoc.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Author: <strong className="text-slate-700 dark:text-slate-300">{selectedDoc.author}</strong> · Last updated: {new Date(selectedDoc.updatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleCopy(selectedDoc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer shrink-0"
                  >
                    {copiedId === selectedDoc.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === selectedDoc.id ? 'Copied!' : 'Copy Script'}</span>
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10">
                  <pre className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {selectedDoc.content}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 text-xs">
                Select an article to read.
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
