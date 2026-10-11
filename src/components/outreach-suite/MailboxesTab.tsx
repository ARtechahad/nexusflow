import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Flame,
  Globe2,
  Info,
  Layers,
  Lock,
  Mail,
  MoreVertical,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  Zap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  Mailbox,
  DomainItem,
  ProviderPreset,
  ConnectionTestResult,
  listMailboxes,
  listDomains,
  getProviderPresets,
  testMailboxCredentials,
  createMailbox,
  updateMailbox,
  deleteMailbox,
  bulkImportMailboxes,
  checkDomainDns
} from '../../services/outreachService';

export const MailboxesTab: React.FC = () => {
  const { showToast } = useApp();

  // Data state
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [presets, setPresets] = useState<Record<string, ProviderPreset>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals & Drawers
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [activeDnsFixDomain, setActiveDnsFixDomain] = useState<DomainItem | null>(null);
  const [checkingDnsId, setCheckingDnsId] = useState<string | null>(null);

  // Add Wizard Form state
  const [selectedPresetId, setSelectedPresetId] = useState<string>('gmail');
  const [formData, setFormData] = useState({
    email: '',
    sender_name: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 465,
    smtp_user: '',
    imap_host: 'imap.gmail.com',
    imap_port: 993,
    imap_user: '',
    password: '',
    daily_cap: 30,
    send_interval_sec: 120,
    signature: ''
  });

  const [testStatus, setTestStatus] = useState<ConnectionTestResult | null>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [savingMailbox, setSavingMailbox] = useState<boolean>(false);

  // Bulk Import state
  const [csvContent, setCsvContent] = useState<string>('');
  const [importingBulk, setImportingBulk] = useState<boolean>(false);
  const [bulkReport, setBulkReport] = useState<any | null>(null);

  // Edit Form state
  const [editFormData, setEditFormData] = useState({
    sender_name: '',
    daily_cap: 30,
    send_interval_sec: 120,
    signature: '',
    newPassword: '',
    status: 'active' as 'active' | 'paused'
  });
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Load initial data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [mbxRes, domRes, presetsRes] = await Promise.all([
        listMailboxes(),
        listDomains(),
        getProviderPresets()
      ]);
      setMailboxes(mbxRes);
      setDomains(domRes);
      setPresets(presetsRes);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to load mailbox accounts', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Provider preset selection
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = presets[presetId];
    if (preset) {
      setFormData(prev => ({
        ...prev,
        smtp_host: preset.smtpHost,
        smtp_port: preset.smtpPort,
        imap_host: preset.imapHost,
        imap_port: preset.imapPort
      }));
    }
    setTestStatus(null);
  };

  // Run live test in wizard
  const handleTestConnection = async () => {
    if (!formData.email || !formData.password || !formData.smtp_host) {
      showToast?.('Please fill in email, password, and server settings first', 'warning');
      return;
    }

    setTestingConnection(true);
    setTestStatus(null);
    try {
      const res = await testMailboxCredentials({
        email: formData.email,
        smtpHost: formData.smtp_host,
        smtpPort: formData.smtp_port,
        smtpUser: formData.smtp_user || formData.email,
        imapHost: formData.imap_host,
        imapPort: formData.imap_port,
        imapUser: formData.imap_user || formData.smtp_user || formData.email,
        password: formData.password
      });

      setTestStatus(res);
      if (res.ok) {
        showToast?.('SMTP & IMAP connections verified successfully!', 'success');
      } else {
        showToast?.('Connection verification encountered errors. See details below.', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Test connection failed', 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  // Save new mailbox
  const handleSaveMailbox = async () => {
    if (!formData.email || !formData.password) {
      showToast?.('Email and password are required', 'warning');
      return;
    }

    setSavingMailbox(true);
    try {
      await createMailbox({
        email: formData.email,
        sender_name: formData.sender_name || formData.email.split('@')[0],
        provider: selectedPresetId,
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_user: formData.smtp_user || formData.email,
        imap_host: formData.imap_host,
        imap_port: formData.imap_port,
        imap_user: formData.imap_user || formData.smtp_user || formData.email,
        password: formData.password,
        daily_cap: formData.daily_cap,
        send_interval_sec: formData.send_interval_sec,
        signature: formData.signature
      });

      showToast?.(`Mailbox ${formData.email} connected safely.`, 'success');
      setIsAddModalOpen(false);
      setTestStatus(null);
      // Reset form
      setFormData({
        email: '',
        sender_name: '',
        smtp_host: 'smtp.gmail.com',
        smtp_port: 465,
        smtp_user: '',
        imap_host: 'imap.gmail.com',
        imap_port: 993,
        imap_user: '',
        password: '',
        daily_cap: 30,
        send_interval_sec: 120,
        signature: ''
      });
      loadData(true);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to save mailbox', 'error');
    } finally {
      setSavingMailbox(false);
    }
  };

  // Toggle Pause/Resume
  const handleToggleStatus = async (mbx: Mailbox) => {
    const nextStatus = mbx.status === 'active' ? 'paused' : 'active';
    try {
      await updateMailbox(mbx.id, { status: nextStatus });
      showToast?.(`Mailbox ${mbx.email} ${nextStatus === 'active' ? 'resumed' : 'paused'}.`, 'success');
      loadData(true);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to update mailbox status', 'error');
    }
  };

  // Open Edit drawer
  const handleOpenEdit = (mbx: Mailbox) => {
    setEditingMailbox(mbx);
    setEditFormData({
      sender_name: mbx.sender_name,
      daily_cap: mbx.daily_cap || 30,
      send_interval_sec: mbx.send_interval_sec || 120,
      signature: mbx.signature || '',
      newPassword: '',
      status: mbx.status === 'paused' ? 'paused' : 'active'
    });
  };

  const handleSaveEdit = async () => {
    if (!editingMailbox) return;
    setSavingEdit(true);
    try {
      const payload: any = {
        sender_name: editFormData.sender_name,
        daily_cap: editFormData.daily_cap,
        send_interval_sec: editFormData.send_interval_sec,
        signature: editFormData.signature,
        status: editFormData.status
      };
      if (editFormData.newPassword && editFormData.newPassword.trim().length > 0) {
        payload.password = editFormData.newPassword.trim();
      }

      await updateMailbox(editingMailbox.id, payload);
      showToast?.('Mailbox configuration updated.', 'success');
      setEditingMailbox(null);
      loadData(true);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to update mailbox', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete mailbox
  const handleDeleteMailbox = async (mbx: Mailbox) => {
    if (!confirm(`Are you sure you want to disconnect mailbox ${mbx.email}?`)) return;

    try {
      const res = await deleteMailbox(mbx.id);
      if (!res.success && res.campaigns) {
        const campNames = res.campaigns.map((c: any) => `"${c.name}"`).join(', ');
        alert(`Cannot delete mailbox: currently assigned to running campaign(s): ${campNames}. Remove or pause the campaign first.`);
        return;
      }
      showToast?.(`Mailbox ${mbx.email} disconnected.`, 'success');
      loadData(true);
    } catch (err: any) {
      showToast?.(err.message || 'Failed to delete mailbox', 'error');
    }
  };

  // Bulk import
  const handleRunBulkImport = async () => {
    if (!csvContent.trim()) {
      showToast?.('Please paste CSV data', 'warning');
      return;
    }

    setImportingBulk(true);
    setBulkReport(null);
    try {
      const report = await bulkImportMailboxes(csvContent);
      setBulkReport(report);
      showToast?.(`Import complete: ${report.imported} added, ${report.failed} failed`, 'info');
      loadData(true);
    } catch (err: any) {
      showToast?.(err.message || 'Bulk import failed', 'error');
    } finally {
      setImportingBulk(false);
    }
  };

  // Re-check DNS
  const handleCheckDns = async (domain: DomainItem) => {
    setCheckingDnsId(domain.id);
    try {
      const res = await checkDomainDns(domain.id);
      showToast?.(`DNS checked for ${domain.domain}. Overall: ${res.overallStatus}`, 'success');
      loadData(true);
    } catch (err: any) {
      showToast?.(err.message || 'DNS check failed', 'error');
    } finally {
      setCheckingDnsId(null);
    }
  };

  // Filtered mailboxes
  const filteredMailboxes = mailboxes.filter(mbx => {
    const matchesSearch =
      mbx.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mbx.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mbx.domain || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && mbx.status === 'active') ||
      (statusFilter === 'paused' && mbx.status === 'paused') ||
      (statusFilter === 'error' && mbx.health_status === 'error');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Connected Mailboxes</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              {mailboxes.length} / 5 Cap
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            SMTP outbound senders and IMAP feedback listeners with encrypted credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Bulk CSV Import
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Mailbox
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by email, name, or domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl text-xs">
            {['all', 'active', 'paused', 'error'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Mailboxes Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        {filteredMailboxes.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Mail className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">No Mailboxes Found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'No mailboxes match your current search filters.'
                : 'Connect your first Gmail, Google Workspace, or SMTP sending account to begin cold email campaigns.'}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Connect Account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Mailbox Account</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Health Score</th>
                  <th className="py-3 px-4">Daily Cap & Pace</th>
                  <th className="py-3 px-4">Today Sent</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredMailboxes.map((mbx) => (
                  <tr key={mbx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    {/* Mailbox & Sender */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{mbx.email}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{mbx.sender_name}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">{mbx.smtp_host}:{mbx.smtp_port}</span>
                      </div>
                      {mbx.last_error && (
                        <div className="text-[10px] text-rose-500 flex items-center gap-1 mt-1 truncate max-w-xs" title={mbx.last_error}>
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{mbx.last_error}</span>
                        </div>
                      )}
                    </td>

                    {/* Provider */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                        {mbx.provider.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          mbx.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : mbx.status === 'paused'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            mbx.status === 'active' ? 'bg-emerald-500' : mbx.status === 'paused' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                        />
                        <span className="capitalize">{mbx.status}</span>
                      </span>
                    </td>

                    {/* Health Score */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              mbx.reputation_score >= 80
                                ? 'bg-emerald-500'
                                : mbx.reputation_score >= 60
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${mbx.reputation_score}%` }}
                          />
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {Math.round(mbx.reputation_score)}%
                        </span>
                      </div>
                    </td>

                    {/* Daily Cap */}
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 dark:text-white font-medium">
                        {mbx.daily_cap} emails/day
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {mbx.send_interval_sec}s between sends
                      </div>
                    </td>

                    {/* Today Sent */}
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 dark:text-white">
                        <span className="font-semibold">{mbx.today_campaign_sent}</span>
                        <span className="text-slate-400 text-[10px]"> camp</span>
                        {' / '}
                        <span className="font-semibold text-amber-600 dark:text-amber-400">{mbx.today_warmup_sent}</span>
                        <span className="text-slate-400 text-[10px]"> warm</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(mbx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={mbx.status === 'active' ? 'Pause Sends' : 'Resume Sends'}
                        >
                          {mbx.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-500" />}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(mbx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Configure Settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMailbox(mbx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Disconnect Mailbox"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Sending Domains & DNS Deliverability Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-indigo-500" />
              Sending Domains & DNS Authentication
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live SPF, DKIM, DMARC, and MX records check for email deliverability.
            </p>
          </div>
        </div>

        {domains.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">No domains registered yet. Connecting a mailbox will register its domain automatically.</p>
        ) : (
          <div className="space-y-3">
            {domains.map((dom) => {
              const isChecking = checkingDnsId === dom.id;
              const isExpanded = activeDnsFixDomain?.id === dom.id;

              return (
                <div
                  key={dom.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-slate-900 dark:text-white text-xs">{dom.domain}</div>
                      <div className="flex items-center gap-1.5">
                        {/* SPF */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            dom.spf_status === 'valid'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : dom.spf_status === 'warning'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          SPF: {dom.spf_status}
                        </span>

                        {/* DKIM */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            dom.dkim_status === 'valid'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          DKIM: {dom.dkim_status}
                        </span>

                        {/* DMARC */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            dom.dmarc_status === 'valid'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          DMARC: {dom.dmarc_status}
                        </span>

                        {/* MX */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            dom.mx_status === 'valid'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          MX: {dom.mx_status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveDnsFixDomain(isExpanded ? null : dom)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <Settings className="w-3 h-3 text-indigo-500" />
                        {isExpanded ? 'Hide Fixes' : 'View Fixes'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      <button
                        onClick={() => handleCheckDns(dom)}
                        disabled={isChecking}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                        Re-check
                      </button>
                    </div>
                  </div>

                  {/* Fix it Drawer / Expanded Instructions */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/60 space-y-3">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Exact DNS Records to Add in Your Domain Registrar (Cloudflare, GoDaddy, Namecheap):
                      </div>

                      {dom.fix_instructions && dom.fix_instructions.length > 0 ? (
                        <div className="space-y-2.5">
                          {dom.fix_instructions.map((inst, i) => (
                            <div
                              key={i}
                              className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-semibold">
                                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px]">
                                    {inst.type}
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200">Host: <code>{inst.host}</code></span>
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(inst.value);
                                    showToast?.(`Copied record value: ${inst.value.slice(0, 30)}...`, 'success');
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy Value
                                </button>
                              </div>

                              <div className="p-2 rounded bg-slate-900 text-emerald-400 font-mono text-[11px] break-all select-all">
                                {inst.value}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                {inst.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          All DNS records (SPF, DKIM, DMARC, MX) are perfectly verified and aligned!
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL: ADD MAILBOX WIZARD
      ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-500" />
                  Connect Mailbox Account
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your provider, test connection, and securely store encrypted credentials.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* 1. Provider Selection Cards */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  1. Select Email Provider Preset
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(presets).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectPreset(key)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedPresetId === key
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold ring-1 ring-indigo-500'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="truncate">{p.name.split(' (')[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider-Specific Hint Box */}
              {presets[selectedPresetId]?.hint && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-semibold block mb-0.5">Provider Setup Requirement:</span>
                    {presets[selectedPresetId].hint}
                  </div>
                </div>
              )}

              {/* 2. Credentials Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="alex@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Display Sender Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Alex Vance"
                    value={formData.sender_name}
                    onChange={(e) => setFormData(p => ({ ...p, sender_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password / App Password *
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Daily Send Limit (1–120)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={formData.daily_cap}
                    onChange={(e) => setFormData(p => ({ ...p, daily_cap: parseInt(e.target.value, 10) || 30 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* 3. Server Configuration (Pre-filled) */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Server Details (Auto-configured from Preset)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={formData.smtp_host}
                      onChange={(e) => setFormData(p => ({ ...p, smtp_host: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">SMTP Port</label>
                    <input
                      type="number"
                      value={formData.smtp_port}
                      onChange={(e) => setFormData(p => ({ ...p, smtp_port: parseInt(e.target.value, 10) || 587 }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">IMAP Host</label>
                    <input
                      type="text"
                      value={formData.imap_host}
                      onChange={(e) => setFormData(p => ({ ...p, imap_host: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">IMAP Port</label>
                    <input
                      type="number"
                      value={formData.imap_port}
                      onChange={(e) => setFormData(p => ({ ...p, imap_port: parseInt(e.target.value, 10) || 993 }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Live Connection Test Results */}
              {testStatus && (
                <div className={`p-4 rounded-xl border ${testStatus.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'} space-y-2`}>
                  <div className="font-semibold flex items-center gap-1.5">
                    {testStatus.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                    <span>{testStatus.ok ? 'Connection Verified Successfully' : 'Connection Verification Failed'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-white/60 dark:bg-slate-800/60">
                      <span className="font-semibold block">SMTP Handshake:</span>
                      {testStatus.smtp.ok ? (
                        <span className="text-emerald-600 dark:text-emerald-400">✓ Ready to send emails</span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">{testStatus.smtp.error}</span>
                      )}
                      {testStatus.smtp.hint && <p className="mt-1 text-slate-500 italic">{testStatus.smtp.hint}</p>}
                    </div>

                    <div className="p-2 rounded bg-white/60 dark:bg-slate-800/60">
                      <span className="font-semibold block">IMAP Inbox & Junk Check:</span>
                      {testStatus.imap.ok ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✓ Connected ({testStatus.imap.folders?.length || 0} folders discovered)
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">{testStatus.imap.error}</span>
                      )}
                      {testStatus.imap.hint && <p className="mt-1 text-slate-500 italic">{testStatus.imap.hint}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                {testingConnection ? 'Testing Connection...' : 'Test Connection'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMailbox}
                  disabled={savingMailbox}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
                >
                  {savingMailbox ? 'Saving...' : 'Save & Connect'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: BULK CSV IMPORT
      ======================================================== */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-500" />
                  Bulk Mailbox Import (CSV)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Paste up to 200 mailbox rows with SMTP and IMAP connection settings.
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  CSV Columns: email,smtp_host,smtp_port,smtp_user,imap_host,imap_port,imap_user,password
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCsvContent(
                      `email,smtp_host,smtp_port,smtp_user,imap_host,imap_port,imap_user,password\nsdr1@mycompany.com,smtp.gmail.com,465,sdr1@mycompany.com,imap.gmail.com,993,sdr1@mycompany.com,app_password_1234\nsdr2@mycompany.com,smtp.office365.com,587,sdr2@mycompany.com,outlook.office365.com,993,sdr2@mycompany.com,app_password_5678`
                    );
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Insert Sample Template
                </button>
              </div>

              <textarea
                rows={8}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="email,smtp_host,smtp_port,smtp_user,imap_host,imap_port,imap_user,password&#10;sales@domain.com,smtp.gmail.com,465,sales@domain.com,imap.gmail.com,993,sales@domain.com,app_pass_xyz"
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />

              {bulkReport && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span>Import Summary:</span>
                    <span className="text-emerald-600">{bulkReport.imported} succeeded</span>
                    <span>•</span>
                    <span className="text-rose-600">{bulkReport.failed} failed</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {bulkReport.results.map((r: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-700 dark:text-slate-300">{r.email}</span>
                        {r.success ? (
                          <span className="text-emerald-600">✓ Added</span>
                        ) : (
                          <span className="text-rose-600">{r.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRunBulkImport}
                disabled={importingBulk}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {importingBulk ? 'Importing...' : 'Start Bulk Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DRAWER: EDIT MAILBOX SETTINGS
      ======================================================== */}
      {editingMailbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/40 backdrop-blur-xs">
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col justify-between overflow-y-auto text-xs">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Configure Mailbox</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{editingMailbox.email}</p>
                </div>
                <button
                  onClick={() => setEditingMailbox(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Display Sender Name
                </label>
                <input
                  type="text"
                  value={editFormData.sender_name}
                  onChange={(e) => setEditFormData(p => ({ ...p, sender_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Sending Cap (1–120 emails)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={editFormData.daily_cap}
                  onChange={(e) => setEditFormData(p => ({ ...p, daily_cap: parseInt(e.target.value, 10) || 30 }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Send Interval (Min 30 seconds)
                </label>
                <input
                  type="number"
                  min="30"
                  value={editFormData.send_interval_sec}
                  onChange={(e) => setEditFormData(p => ({ ...p, send_interval_sec: parseInt(e.target.value, 10) || 120 }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mailbox Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData(p => ({ ...p, status: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="active">Active (Sending Enabled)</option>
                  <option value="paused">Paused (Temporary Standby)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Update Password (Leave blank to keep unchanged)
                </label>
                <input
                  type="password"
                  placeholder="New app password..."
                  value={editFormData.newPassword}
                  onChange={(e) => setEditFormData(p => ({ ...p, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Signature (HTML or Text)
                </label>
                <textarea
                  rows={4}
                  value={editFormData.signature}
                  onChange={(e) => setEditFormData(p => ({ ...p, signature: e.target.value }))}
                  placeholder="Best regards,&#10;Alex Vance | Lumina Clinics&#10;+44 20 7946 0912"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingMailbox(null)}
                className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
