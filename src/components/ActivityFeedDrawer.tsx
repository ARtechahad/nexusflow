import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  Check, 
  Sparkles, 
  CreditCard, 
  Send, 
  Code2, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Filter, 
  RefreshCw,
  ExternalLink 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ActivityFeedItem } from '../types';

interface ActivityFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityFeedDrawer: React.FC<ActivityFeedDrawerProps> = ({ isOpen, onClose }) => {
  const { 
    activityFeed, 
    unreadActivityCount, 
    markActivityAsRead, 
    refreshActivityFeed,
    setActiveTab,
    showToast 
  } = useApp();

  const [filterType, setFilterType] = useState<string>('all');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshActivityFeed();
    setRefreshing(false);
  };

  const handleMarkAllRead = () => {
    markActivityAsRead();
    showToast('All notifications marked as read', 'info');
  };

  const filteredFeed = activityFeed.filter(item => {
    if (filterType === 'all') return true;
    if (filterType === 'payments' && item.type === 'payment_captured') return true;
    if (filterType === 'leads' && (item.type === 'lead_scraped' || item.type === 'message_received')) return true;
    if (filterType === 'staging' && item.type === 'staging_deployed') return true;
    if (filterType === 'alerts' && item.type === 'system_alert') return true;
    return false;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'payment_captured':
        return <CreditCard className="w-4 h-4 text-emerald-500" />;
      case 'lead_scraped':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'message_received':
        return <Send className="w-4 h-4 text-indigo-500" />;
      case 'staging_deployed':
        return <Code2 className="w-4 h-4 text-cyan-500" />;
      case 'system_alert':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleItemClick = (item: ActivityFeedItem) => {
    markActivityAsRead(item.id);
    if (item.type === 'payment_captured') {
      setActiveTab('invoices' as any);
      onClose();
    } else if (item.type === 'lead_scraped') {
      setActiveTab('outreach');
      onClose();
    } else if (item.type === 'message_received') {
      setActiveTab('inbox');
      onClose();
    } else if (item.type === 'staging_deployed') {
      setActiveTab('pipeline');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div 
        className="w-full max-w-md bg-white dark:bg-[#090d18] border-l border-slate-200 dark:border-white/10 h-full flex flex-col shadow-2xl animate-slideLeft"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a12] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Activity &amp; System Stream
                </h3>
                {unreadActivityCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold">
                    {unreadActivityCount} New
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Real-time automation logs, payments &amp; team updates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
              title="Refresh Stream"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-4 py-2.5 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { key: 'all', label: 'All' },
              { key: 'payments', label: 'Payments' },
              { key: 'leads', label: 'Leads' },
              { key: 'staging', label: 'Staging' },
              { key: 'alerts', label: 'Alerts' }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                  filterType === f.key
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {unreadActivityCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold shrink-0 ml-2 cursor-pointer"
            >
              Mark Read
            </button>
          )}
        </div>

        {/* Stream List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredFeed.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
              <span>No notifications in this filter category.</span>
            </div>
          ) : (
            filteredFeed.map(item => {
              const isUnread = !item.isRead;
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                    isUnread
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/40 shadow-xs'
                      : 'bg-white dark:bg-slate-900/50 border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15'
                  }`}
                >
                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-3 right-3 animate-pulse" />
                  )}

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      {getEventIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-mono">
                        <span>{item.actorName}</span>
                        <span>·</span>
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a12] text-center text-[10px] text-slate-400 font-mono">
          <span>ALM Nexus Centralized Real-Time Event Bus</span>
        </div>
      </div>
    </div>
  );
};
