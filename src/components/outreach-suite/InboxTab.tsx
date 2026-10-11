import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox,
  Search,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Mail,
  RefreshCw,
  Archive,
  ArrowRight,
  TrendingUp,
  Tag,
  ShieldAlert,
  HelpCircle,
  XCircle,
  UserX,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import {
  getOutreachThreads,
  getOutreachThread,
  sendThreadReply,
  updateThread,
  suggestAIReply,
  createLeadFromThread,
  ThreadItem,
  MessageItem,
  ThreadLabel,
  ThreadStats
} from '../../services/outreachService';
import { useApp } from '../../context/AppContext';

export const InboxTab: React.FC = () => {
  const { showToast, setActiveTab, currentTenant } = useApp();

  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [stats, setStats] = useState<ThreadStats>({
    total: 0,
    unread: 0,
    interested: 0,
    question: 0,
    notInterested: 0
  });
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<ThreadItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingThreads, setLoadingThreads] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);

  // Filters
  const [selectedLabel, setSelectedLabel] = useState<string>('all');
  const [filterUnread, setFilterUnread] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reply Composer
  const [replyBody, setReplyBody] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isCreatingLead, setIsCreatingLead] = useState<boolean>(false);

  // Fetch threads list
  const loadThreads = useCallback(async (selectFirst = false) => {
    try {
      setLoadingThreads(true);
      const res = await getOutreachThreads({
        label: selectedLabel !== 'all' ? selectedLabel : undefined,
        unread: filterUnread || undefined,
        search: searchQuery.trim() || undefined
      });
      setThreads(res.threads);
      setStats(res.stats);

      if (selectFirst && res.threads.length > 0 && !selectedThreadId) {
        setSelectedThreadId(res.threads[0].id);
      } else if (selectedThreadId) {
        // Keep current selected thread updated in state
        const updated = res.threads.find(t => t.id === selectedThreadId);
        if (updated) setSelectedThread(updated);
      }
    } catch (err: any) {
      console.warn('Failed to fetch outreach threads', err?.message);
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedLabel, filterUnread, searchQuery, selectedThreadId]);

  useEffect(() => {
    loadThreads(true);
  }, [loadThreads]);

  // Load message detail when thread selection changes
  useEffect(() => {
    if (!selectedThreadId) {
      setSelectedThread(null);
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);
    setAiSuggestions([]);
    setReplyBody('');

    getOutreachThread(selectedThreadId)
      .then(res => {
        if (!isMounted) return;
        setSelectedThread(res.thread);
        setMessages(res.messages);
        // Mark as read in local list
        setThreads(prev =>
          prev.map(t => (t.id === selectedThreadId ? { ...t, is_unread: false } : t))
        );
      })
      .catch(err => {
        showToast?.(`Failed to load thread: ${err.message}`, 'error');
      })
      .finally(() => {
        if (isMounted) setLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedThreadId, showToast]);

  // Realtime SSE listener for new incoming replies
  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('reply_received', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        showToast?.(
          `New reply from ${payload.prospectEmail} [${payload.label}]`,
          'info'
        );
        loadThreads();
        if (selectedThreadId === payload.threadId) {
          getOutreachThread(payload.threadId).then(res => {
            setSelectedThread(res.thread);
            setMessages(res.messages);
          });
        }
      } catch {}
    });

    return () => {
      eventSource.close();
    };
  }, [loadThreads, selectedThreadId, showToast]);

  // Quick label change
  const handleUpdateLabel = async (label: ThreadLabel) => {
    if (!selectedThread) return;
    try {
      const updated = await updateThread(selectedThread.id, { label });
      setSelectedThread(updated);
      setThreads(prev => prev.map(t => (t.id === updated.id ? updated : t)));
      showToast?.(`Thread marked as "${label}"`, 'success');
      loadThreads();
    } catch (err: any) {
      showToast?.(`Failed to update label: ${err.message}`, 'error');
    }
  };

  // Convert to CRM Lead
  const handleCreateLead = async () => {
    if (!selectedThread) return;
    try {
      setIsCreatingLead(true);
      const res = await createLeadFromThread(selectedThread.id);
      showToast?.(res.message, 'success');
      handleUpdateLabel('interested');
    } catch (err: any) {
      showToast?.(`Lead creation failed: ${err.message}`, 'error');
    } finally {
      setIsCreatingLead(false);
    }
  };

  // AI Reply Suggestion
  const handleSuggestReply = async () => {
    if (!selectedThread) return;
    try {
      setIsSuggesting(true);
      const res = await suggestAIReply(selectedThread.id);
      setAiSuggestions(res.suggestions);
      if (res.suggestions.length > 0) {
        showToast?.(
          res.isFallback
            ? 'Generated standard high-conversion response template.'
            : 'Gemini generated 2 tailored reply drafts.',
          'info'
        );
      }
    } catch (err: any) {
      showToast?.(`Failed to generate suggestion: ${err.message}`, 'error');
    } finally {
      setIsSuggesting(false);
    }
  };

  // Send Reply
  const handleSendReply = async () => {
    if (!selectedThread || !replyBody.trim()) return;
    try {
      setIsSending(true);
      await sendThreadReply(selectedThread.id, { bodyText: replyBody.trim() });
      showToast?.('Reply dispatched via Cap Guard!', 'success');
      setReplyBody('');
      setAiSuggestions([]);
      // Reload thread messages
      const res = await getOutreachThread(selectedThread.id);
      setSelectedThread(res.thread);
      setMessages(res.messages);
      loadThreads();
    } catch (err: any) {
      showToast?.(`Failed to send reply: ${err.message}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Helper for label badge styling
  const getLabelBadge = (label: string) => {
    switch (label) {
      case 'interested':
        return {
          bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
          icon: TrendingUp,
          text: 'Interested'
        };
      case 'question':
        return {
          bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-200 dark:border-blue-800',
          icon: HelpCircle,
          text: 'Question'
        };
      case 'not_interested':
        return {
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          icon: XCircle,
          text: 'Not Interested'
        };
      case 'out_of_office':
        return {
          bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-800',
          icon: Clock,
          text: 'Out of Office'
        };
      case 'unsubscribe':
        return {
          bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-800',
          icon: ShieldAlert,
          text: 'Unsubscribed'
        };
      case 'wrong_person':
        return {
          bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border-purple-200 dark:border-purple-800',
          icon: UserX,
          text: 'Wrong Person'
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
          icon: Tag,
          text: label || 'Uncategorized'
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Stat Chips */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-500" />
            Outreach Response Inbox
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time IMAP responses categorized by Gemini AI with automated suppression & lead routing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
            <span className="text-slate-500 dark:text-slate-400 mr-1.5">Unread:</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{stats.unread}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 mr-1.5">Interested:</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{stats.interested}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs">
            <span className="text-blue-600 dark:text-blue-400 mr-1.5">Questions:</span>
            <span className="font-semibold text-blue-700 dark:text-blue-300">{stats.question}</span>
          </div>
          <button
            onClick={() => loadThreads()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh Threads"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-280px)] min-h-[580px]">
        {/* Left Column: Filter Tabs & Thread List */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search prospect email, subject, or text..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Label Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {[
                { id: 'all', label: 'All' },
                { id: 'interested', label: 'Interested' },
                { id: 'question', label: 'Question' },
                { id: 'out_of_office', label: 'OOO' },
                { id: 'not_interested', label: 'Declined' },
                { id: 'unsubscribe', label: 'Unsub' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedLabel(tab.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    selectedLabel === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <button
                onClick={() => setFilterUnread(!filterUnread)}
                className={`ml-auto px-2 py-1 rounded-lg text-[10px] font-medium border flex items-center gap-1 whitespace-nowrap ${
                  filterUnread
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Unread only
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {loadingThreads ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                <p>Loading conversations...</p>
              </div>
            ) : threads.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <Inbox className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-600 dark:text-slate-300">No threads match your filters</p>
                <p className="text-[11px]">When prospects reply to your campaigns, they will arrive here automatically.</p>
              </div>
            ) : (
              threads.map(thread => {
                const isSelected = thread.id === selectedThreadId;
                const badge = getLabelBadge(thread.label);
                const BadgeIcon = badge.icon;

                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`p-3.5 cursor-pointer transition-colors relative ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {thread.is_unread && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" title="Unread" />
                        )}
                        <span className={`text-xs font-semibold truncate ${thread.is_unread ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {thread.prospect_email}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(thread.last_message_at || thread.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate mb-1">
                      {thread.subject || '(No Subject)'}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2 font-normal">
                      {thread.snippet || 'No message preview'}
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-medium ${badge.bg}`}>
                        <BadgeIcon className="w-3 h-3" />
                        {badge.text}
                      </span>

                      {thread.campaign_name && (
                        <span className="text-slate-400 truncate max-w-[140px]">
                          {thread.campaign_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Conversation View & Reply Composer */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {!selectedThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <Mail className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select a Conversation</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Choose a prospect reply from the list to view the full dialogue, classify the intent, and dispatch replies.
              </p>
            </div>
          ) : (
            <>
              {/* Conversation Top Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedThread.prospect_email}
                    </span>
                    {(() => {
                      const badge = getLabelBadge(selectedThread.label);
                      const BadgeIcon = badge.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3" />
                          {badge.text}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="text-xs text-slate-500 truncate">
                    Subject: <strong className="text-slate-700 dark:text-slate-300">{selectedThread.subject}</strong>
                    {selectedThread.mailbox_email && (
                      <span className="ml-2 text-slate-400">• Mailbox: {selectedThread.mailbox_email}</span>
                    )}
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Mark as Interested & Create Lead */}
                  <button
                    onClick={handleCreateLead}
                    disabled={isCreatingLead}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-50"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    {isCreatingLead ? 'Creating Lead...' : 'Mark as Interested (CRM Lead)'}
                  </button>

                  {/* Label Dropdown / Quick Buttons */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => handleUpdateLabel('question')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${selectedThread.label === 'question' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                      title="Mark as Question"
                    >
                      Question
                    </button>
                    <button
                      onClick={() => handleUpdateLabel('not_interested')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${selectedThread.label === 'not_interested' ? 'bg-slate-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                      title="Mark as Not Interested"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleUpdateLabel('unsubscribe')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${selectedThread.label === 'unsubscribe' ? 'bg-rose-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                      title="Add to Suppression & Unsubscribe"
                    >
                      Unsub
                    </button>
                  </div>
                </div>
              </div>

              {/* Message History Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
                    Loading conversation messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No messages found for this thread.
                  </div>
                ) : (
                  messages.map(msg => {
                    const isInbound = msg.direction === 'inbound';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {isInbound ? msg.from_email : msg.from_email || 'You'}
                          </span>
                          <span>•</span>
                          <span>{new Date(msg.received_at || msg.created_at).toLocaleString()}</span>
                          <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-medium ${
                            isInbound ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {isInbound ? 'Inbound Reply' : 'Outbound Sent'}
                          </span>
                        </div>

                        <div
                          className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                            isInbound
                              ? 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-tl-sm'
                              : 'bg-indigo-600 text-white rounded-tr-sm shadow-xs'
                          }`}
                        >
                          {msg.body_text ? (
                            <div className="whitespace-pre-wrap">{msg.body_text}</div>
                          ) : msg.body_html ? (
                            <div
                              dangerouslySetInnerHTML={{ __html: msg.body_html }}
                              className="prose prose-xs dark:prose-invert max-w-none"
                            />
                          ) : (
                            <span className="italic text-slate-400">Empty message content</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Composer Section */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-3">
                {/* AI Suggestion Bar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSuggestReply}
                      disabled={isSuggesting}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isSuggesting ? 'Drafting suggestions...' : 'AI Suggest Reply (Gemini)'}
                    </button>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Dispatches via mailbox SMTP adhering to Cap Guard & In-Reply-To thread headers.
                    </span>
                  </div>
                </div>

                {/* AI Suggestions Cards */}
                {aiSuggestions.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 animate-fadeIn">
                    {aiSuggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        onClick={() => setReplyBody(sug)}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/80 text-xs text-slate-700 dark:text-slate-300 cursor-pointer hover:border-indigo-500 hover:shadow-xs transition-all"
                      >
                        <div className="flex items-center justify-between font-semibold text-[10px] text-indigo-600 dark:text-indigo-400 mb-1">
                          <span>Draft Option {idx + 1}</span>
                          <span className="text-slate-400">Click to use</span>
                        </div>
                        <p className="line-clamp-3 text-[11px]">{sug}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Textarea Composer */}
                <div className="relative">
                  <textarea
                    rows={4}
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${selectedThread.prospect_email}...`}
                    className="w-full p-3 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400">
                      Sending from: <strong>{selectedThread.mailbox_email || 'Assigned Mailbox'}</strong>
                    </span>

                    <button
                      onClick={handleSendReply}
                      disabled={isSending || !replyBody.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSending ? 'Sending Reply...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
