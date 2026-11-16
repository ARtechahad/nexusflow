import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { buildAuthHeaders } from '../lib/api';
import { ChatMessage } from '../types';
import { SkeletonChat } from './SkeletonLoader';
import { EmptyState } from './EmptyState';
import {
  Send,
  Hash,
  Users,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const TeamChatView: React.FC = () => {
  const {
    currentUser,
    currentTenant,
    companyRole,
    departments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    showToast
  } = useApp();

  const activeDept =
    departments.find((d) => d.id === selectedDepartmentId) || departments[0] || null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<'general' | 'work-status' | 'announcements'>('general');
  const [isStatusUpdate, setIsStatusUpdate] = useState<boolean>(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const channels: Array<{
    id: 'general' | 'work-status' | 'announcements';
    name: string;
    desc: string;
  }> = [
    { id: 'general', name: 'general', desc: 'Department coordination and quick alignment' },
    { id: 'work-status', name: 'work-status', desc: 'Daily progress updates and blockers' },
    { id: 'announcements', name: 'announcements', desc: 'Priority milestones and schedule notices' }
  ];

  const fetchMessages = useCallback(async () => {
    if (!currentTenant?.id || !activeDept?.id) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setForbiddenMessage(null);
    try {
      const params = new URLSearchParams({
        channel: selectedChannel,
        departmentId: activeDept.id
      });
      const res = await fetch(`/api/chat?${params.toString()}`, {
        headers: buildAuthHeaders()
      });

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        setForbiddenMessage(
          errData.error || 'Private department chat is restricted to department members.'
        );
        setMessages([]);
      } else if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data.messages) ? data.messages : []);
      }
    } catch (err) {
      console.warn('Failed to fetch department chat messages:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, activeDept?.id, selectedChannel]);

  useEffect(() => {
    setLoading(true);
    fetchMessages();
  }, [fetchMessages]);

  // Real-time SSE listener strictly scoped by companyId + departmentId
  useEffect(() => {
    const onSseChat = (ev: any) => {
      const msg: ChatMessage | undefined = ev.detail;
      if (!msg) return;
      if (msg.companyId && msg.companyId !== currentTenant?.id) return;
      if (!activeDept?.id || msg.departmentId !== activeDept.id) return;
      if (msg.channel !== selectedChannel) return;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    window.addEventListener('clientops:sse:chat', onSseChat);
    return () => {
      window.removeEventListener('clientops:sse:chat', onSseChat);
    };
  }, [currentTenant?.id, activeDept?.id, selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !currentTenant?.id || !activeDept?.id || sending) return;

    setSending(true);
    const targetChannel = isStatusUpdate ? 'work-status' : selectedChannel;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          channel: targetChannel,
          departmentId: activeDept.id,
          content: inputText.trim(),
          isStatusUpdate
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.message) {
        if (targetChannel !== selectedChannel) {
          setSelectedChannel(targetChannel);
        } else {
          setMessages((prev) =>
            prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
          );
        }
        setInputText('');
        setIsStatusUpdate(false);
      } else {
        showToast(data.error || data.message || 'Could not send message.', 'error');
      }
    } catch {
      showToast('Network error sending chat message.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col md:flex-row h-[640px] max-w-7xl mx-auto">
      {/* Channels & Department Sidebar */}
      <div className="w-full md:w-68 bg-[#F8FAFC] dark:bg-[#090D16] border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between shrink-0 gap-4">
        <div className="space-y-4">
          {/* Department Scope Selector */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Department Room
            </span>
            {departments.length > 0 ? (
              <select
                value={activeDept?.id || ''}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-semibold text-slate-900 dark:text-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                No department selected
              </div>
            )}
          </div>

          {/* Channels */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Private Channels
            </span>
            {channels.map((ch) => (
              <button
                key={ch.id}
                id={`channel-btn-${ch.id}`}
                type="button"
                onClick={() => {
                  setSelectedChannel(ch.id);
                  setIsStatusUpdate(ch.id === 'work-status');
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition cursor-pointer ${
                  selectedChannel === ch.id
                    ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Hash className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{ch.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Identity & Isolation Note */}
        <div className="p-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            <Lock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            <span>Isolated to {activeDept?.name || 'Department'}</span>
          </div>
          <div className="font-semibold text-slate-900 dark:text-white truncate">
            {currentUser?.name}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {companyRole === 'company_admin'
              ? 'Company Owner'
              : companyRole === 'department_head'
              ? 'Department Head'
              : 'Department Employee'}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col justify-between h-full bg-[#FFFFFF] dark:bg-[#111827] min-w-0">
        {/* Chat Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h3 className="text-sm font-bold text-slate-950 dark:text-white truncate">
              {activeDept ? `${activeDept.name} / ${selectedChannel}` : selectedChannel}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline truncate">
              &mdash; {channels.find((c) => c.id === selectedChannel)?.desc}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0 font-mono tabular-nums">
            <Users className="w-3.5 h-3.5" />
            <span>{activeDept?.memberCount ?? 1} Members</span>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {!activeDept ? (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={Lock}
                title="Select a department"
                description="Join or select a department to view and participate in its private chat room."
              />
            </div>
          ) : forbiddenMessage ? (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={Lock}
                title="Department Chat Restricted"
                description={forbiddenMessage}
              />
            </div>
          ) : loading ? (
            <SkeletonChat messagesCount={5} />
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={Hash}
                title={`No messages in #${selectedChannel}`}
                description={`Post a message or Daily Work Status update for ${activeDept.name}.`}
              />
            </div>
          ) : (
            messages.map((msg) => {
              const msgSender = msg.senderName || msg.sender || 'Team Member';
              const msgDesignation = msg.senderDesignation || '';
              const msgText = msg.content || msg.text || '';
              const isSelf = msg.senderId === currentUser?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {msgSender}
                    </span>
                    {msgDesignation && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {msgDesignation}
                      </span>
                    )}
                    {msg.isStatusUpdate && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Daily Work Status
                      </span>
                    )}
                    <span className="font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div
                    className={`max-w-lg rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                      msg.isStatusUpdate
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-emerald-100'
                        : isSelf
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {msgText}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-[#F8FAFC] dark:bg-[#090D16]"
        >
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isStatusUpdate}
                onChange={(e) => setIsStatusUpdate(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Post as Daily Work Status Update (routes to #work-status)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="input-team-chat-message"
              type="text"
              disabled={!activeDept || !!forbiddenMessage}
              placeholder={
                activeDept
                  ? isStatusUpdate
                    ? `Share today's work progress with ${activeDept.name}...`
                    : `Message ${activeDept.name} #${selectedChannel}...`
                  : 'Select a department...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <button
              id="btn-team-chat-send"
              type="submit"
              disabled={!inputText.trim() || !activeDept || !!forbiddenMessage || sending}
              className="btn-tactile-primary p-2.5 rounded-lg disabled:opacity-40 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
