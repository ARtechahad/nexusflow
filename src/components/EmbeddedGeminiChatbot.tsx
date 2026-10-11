import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, User, RefreshCw, Zap, ShieldAlert, ChevronDown, Minimize2, Maximize2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const EmbeddedGeminiChatbot: React.FC = () => {
  const { role, currentTenant, authToken, showToast, refreshProjects } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; timestamp: string; actionExecuted?: any }>>([
    {
      sender: 'bot',
      text: `Hello! I am your ALM Nexus AI Copilot. I am reading active tenant workspace "${currentTenant?.name || 'ALM Nexus'}" under your ${role.toUpperCase()} role context. Ask me about pipeline stats, SOP Rule 8 gates, invoice balances, or ask me to create a lead for you!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || loading) return;

    const userText = messageInput.trim();
    setMessageInput('');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: timeStr }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/copilot-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': currentTenant?.id || 'tenant-alm-nexus',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          message: userText,
          role,
          conversationHistory: []
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'bot',
            text: json.data.response,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionExecuted: json.data.executedFunction
          }
        ]);

        if (json.data.executedFunction) {
          await refreshProjects();
          showToast(`⚡ AI Copilot triggered function: ${json.data.executedFunction.name}`);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: 'bot',
            text: 'I could not process your query at this moment. Please check your workspace connection.',
            timestamp: timeStr
          }
        ]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: 'Network error communicating with AI Copilot: ' + err.message,
          timestamp: timeStr
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-2xl transition cursor-pointer flex items-center gap-2 font-bold text-xs ring-4 ring-indigo-600/20 group"
          title="Open ALM Nexus AI Copilot"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-indigo-600 animate-pulse"></span>
          </div>
          <span className="hidden sm:inline">AI Copilot</span>
        </button>
      )}

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-full sm:w-[420px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isMinimized ? 'h-16' : 'h-[540px]'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>ALM Nexus AI Copilot</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-mono font-bold">Live</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-mono">{currentTenant?.name || 'Workspace'} &bull; {role.toUpperCase()}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          {!isMinimized && (
            <>
              <div className="p-4 flex-1 overflow-y-auto space-y-3.5 text-xs bg-slate-950/40">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500 font-mono">
                      {msg.sender === 'user' ? (
                        <>
                          <span>You ({role})</span>
                          <span>&bull;</span>
                          <span>{msg.timestamp}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span className="text-indigo-400 font-bold">Gemini 3.8 Copilot</span>
                          <span>&bull;</span>
                          <span>{msg.timestamp}</span>
                        </>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] p-3 rounded-2xl leading-relaxed text-xs shadow-md ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-xs'
                          : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {msg.actionExecuted && (
                      <div className="mt-1.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>Executed: {msg.actionExecuted.name}</span>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 w-fit">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gemini is reasoning over workspace SOP context...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  placeholder="Ask Copilot about SOPs, deals, or create a lead..."
                  className="flex-1 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={loading || !messageInput.trim()}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white transition cursor-pointer shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};
