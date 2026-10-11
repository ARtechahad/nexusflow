import React, { useState, useEffect } from 'react';
import { X, Sparkles, Image as ImageIcon, Download, Check, RefreshCw, FolderPlus, Layers, Sliders } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CreativeStudioModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { currentTenant, authToken, showToast } = useApp();
  const [prompt, setPrompt] = useState('Modern dark-mode SaaS dashboard interface banner with indigo neon glow, 3D analytics charts, and glassmorphic card elements.');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '4:3' | '9:16'>('16:9');
  const [loading, setLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any>(null);
  const [mediaVault, setMediaVault] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'generate' | 'vault'>('generate');

  const fetchMediaVault = async () => {
    try {
      const res = await fetch('/api/ai/media-vault', {
        headers: {
          'X-Tenant-Id': currentTenant?.id || 'tenant-alm-nexus',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMediaVault(json.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMediaVault();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/ai/generate-creative', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': currentTenant?.id || 'tenant-alm-nexus',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setGeneratedResult(json.data);
        showToast('🎉 New creative asset generated & saved to Media Vault!');
        fetchMediaVault();
      } else {
        showToast('Error generating image asset.', 'error');
      }
    } catch (err: any) {
      showToast('Network error generating asset: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>AI Creative Studio & Media Vault</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-bold">
                  Gemini Image Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">Generate, edit, and store promotional graphics and UI mockups tied to {currentTenant?.name || 'Workspace'}.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Tabs */}
        <div className="flex items-center gap-1 p-2 bg-slate-950/40 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
              activeTab === 'generate' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio Generator</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition cursor-pointer ${
              activeTab === 'vault' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Multi-Tenant Media Vault ({mediaVault.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {activeTab === 'generate' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Controls Column */}
              <form onSubmit={handleGenerate} className="lg:col-span-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Text Prompt / Creative Vision</span>
                    <span className="text-[10px] text-slate-500 font-mono font-normal">Gemini 3.1 Flash Image</span>
                  </label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={4}
                    placeholder="Describe proposal graphics, landing page banners, ad creatives..."
                    className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2">Aspect Ratio</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['16:9', '1:1', '4:3', '9:16'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setAspectRatio(r)}
                        className={`py-2 px-2 rounded-xl border text-xs font-mono font-bold transition cursor-pointer ${
                          aspectRatio === r
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Synthesizing Creative Asset...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate & Save to Media Vault</span>
                    </>
                  )}
                </button>
              </form>

              {/* Preview Canvas */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center p-4 rounded-3xl bg-slate-950 border border-slate-800 min-h-[320px]">
                {loading ? (
                  <div className="text-center space-y-3 p-8">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">Rendering AI Graphic Asset...</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">Encoding prompt vector matrices into multi-tenant Media Vault format.</p>
                  </div>
                ) : generatedResult ? (
                  <div className="w-full space-y-3 animate-fadeIn">
                    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 group shadow-2xl">
                      <img
                        src={generatedResult.imageUrl}
                        alt="Generated Creative"
                        className="w-full h-auto object-cover max-h-[380px] mx-auto"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex items-end justify-between">
                        <a
                          href={generatedResult.imageUrl}
                          download={`creative_${Date.now()}.png`}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Asset</span>
                        </a>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 italic">Prompt: "{generatedResult.prompt}"</p>
                  </div>
                ) : (
                  <div className="text-center space-y-2 p-8 text-slate-500">
                    <ImageIcon className="w-10 h-10 mx-auto text-slate-700" />
                    <p className="text-xs font-bold text-slate-400">Creative Studio Canvas Ready</p>
                    <p className="text-[11px]">Enter a prompt and aspect ratio to synthesize promotional banners and UI mockups.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Media Vault Grid */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">Media Vault assets explicitly bound to tenant <strong className="text-indigo-400 font-mono">{currentTenant?.name}</strong>.</p>
                <button onClick={fetchMediaVault} className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh Vault
                </button>
              </div>

              {mediaVault.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-3xl">
                  <FolderPlus className="w-10 h-10 mx-auto text-slate-700" />
                  <p className="text-xs font-bold text-slate-400">Media Vault is Empty</p>
                  <p className="text-[11px]">Generate creatives in the studio to populate this tenant's asset library.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {mediaVault.map(item => (
                    <div key={item.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 group hover:border-indigo-500/50 transition">
                      <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-850 h-36">
                        <img src={item.imageUrl} alt={item.prompt} className="w-full h-full object-cover" />
                        <a
                          href={item.imageUrl}
                          download={`vault_${item.id}.png`}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-white hover:bg-indigo-600 transition opacity-0 group-hover:opacity-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-[11px] font-medium text-slate-300 line-clamp-2 leading-relaxed">{item.prompt}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-900">
                        <span>{item.aspectRatio || '16:9'}</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
