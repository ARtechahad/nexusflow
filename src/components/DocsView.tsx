import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Code2,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Shield,
  Zap,
  Sparkles,
  Server,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { OUTREACH_DOCS, DocSection } from '../data/docsContent';

interface DocsViewProps {
  onBackToApp?: () => void;
}

export const DocsView: React.FC<DocsViewProps> = ({ onBackToApp }) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>('getting-started');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const filteredSections = OUTREACH_DOCS.filter(
    (sec) =>
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSection =
    OUTREACH_DOCS.find((sec) => sec.id === selectedSectionId) || OUTREACH_DOCS[0];

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-xs font-medium"
              title="Return to Application"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm font-bold text-sm">
              LF
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white">LeadFlow</span>
              <span className="ml-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Docs & API
              </span>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative w-72 max-w-sm hidden md:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides, REST endpoints, MCP..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </header>

      {/* Main Documentation Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        {/* Left Sidebar Navigation */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-800/80 p-4 space-y-1 overflow-y-auto shrink-0 bg-slate-900/30">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Documentation Index
          </div>

          <nav className="space-y-0.5">
            {filteredSections.map((sec) => {
              const isSelected = sec.id === activeSection.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSectionId(sec.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate">{sec.title}</span>
                  {isSelected && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-10 max-w-4xl overflow-y-auto space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Outreach Platform Guide</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">{activeSection.title}</h1>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed">{activeSection.summary}</p>
          </div>

          {/* Formatted Markdown Content */}
          <div className="prose prose-invert prose-indigo max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
            {activeSection.content.split('\n\n').map((paragraph, idx) => {
              const trimmed = paragraph.trim();

              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={idx} className="text-lg font-bold text-white mt-6 mb-2 border-b border-slate-800 pb-2">
                    {trimmed.replace('### ', '')}
                  </h3>
                );
              }

              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={idx} className="text-xl font-bold text-white mt-8 mb-3">
                    {trimmed.replace('## ', '')}
                  </h2>
                );
              }

              if (trimmed.startsWith('- ')) {
                const items = trimmed.split('\n- ').map((item) => item.replace(/^- /, ''));
                return (
                  <ul key={idx} className="space-y-1.5 list-disc pl-5 text-slate-300">
                    {items.map((it, iIdx) => (
                      <li key={iIdx} dangerouslySetInnerHTML={{ __html: formatInlineCode(it) }} />
                    ))}
                  </ul>
                );
              }

              if (trimmed.startsWith('```')) {
                const codeContent = trimmed.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
                return (
                  <pre key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto text-xs text-indigo-300 font-mono">
                    <code>{codeContent}</code>
                  </pre>
                );
              }

              if (trimmed.includes('|')) {
                // Markdown table
                return (
                  <div key={idx} className="overflow-x-auto my-4 border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <tbody>
                        {trimmed.split('\n').map((row, rIdx) => {
                          const cols = row.split('|').filter(Boolean).map((c) => c.trim());
                          if (row.includes('---')) return null;
                          const isHeader = rIdx === 0;
                          return (
                            <tr key={rIdx} className={isHeader ? 'bg-slate-800/80 font-semibold text-white' : 'border-t border-slate-800/60'}>
                              {cols.map((col, cIdx) => (
                                <td key={cIdx} className="p-2.5">
                                  {col}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              }

              return (
                <p key={idx} className="text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInlineCode(trimmed) }} />
              );
            })}
          </div>

          {/* Optional Code Samples */}
          {activeSection.codeSamples && activeSection.codeSamples.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-800/80">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Implementation Code Samples</h3>
              {activeSection.codeSamples.map((sample, sIdx) => (
                <div key={sIdx} className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                  <div className="bg-slate-800/70 px-4 py-2 flex items-center justify-between border-b border-slate-800">
                    <span className="text-xs font-semibold text-slate-200">{sample.label}</span>
                    <button
                      onClick={() => handleCopy(sample.code, sIdx)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700/80 hover:bg-slate-600 text-slate-200 transition cursor-pointer"
                    >
                      {copiedIndex === sIdx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 text-xs font-mono text-indigo-300 overflow-x-auto leading-relaxed">
                    <code>{sample.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

function formatInlineCode(str: string): string {
  return str.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded-md bg-slate-800 text-indigo-300 font-mono text-xs">$1</code>');
}
