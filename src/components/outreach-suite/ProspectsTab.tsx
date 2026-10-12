import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Edit,
  Sparkles,
  RefreshCw,
  Sliders,
  ChevronRight,
  ArrowRight,
  Check,
  Building,
  Briefcase,
  Mail,
  Tag,
  Ban,
  FileSpreadsheet,
  Globe
} from 'lucide-react';
import {
  getProspects,
  createProspect,
  updateProspect,
  deleteProspect,
  importProspectsCsv,
  findLeadsOnline,
  startBulkVerification,
  getSuppressionsList,
  addSuppressionItem,
  removeSuppressionItem,
  importSuppressionsCsvData,
  Prospect,
  SuppressionItem
} from '../../services/outreachService';

interface ProspectsTabProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProspectsTab: React.FC<ProspectsTabProps> = ({ showToast }) => {
  // Main table states
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [verifFilter, setVerifFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showFindModal, setShowFindModal] = useState<boolean>(false);
  const [showSuppressionsModal, setShowSuppressionsModal] = useState<boolean>(false);
  const [verifyingBatch, setVerifyingBatch] = useState<boolean>(false);

  // Add / Edit form state
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    company: '',
    title: '',
    phone: '',
    linkedin_url: '',
    tags: ''
  });

  // CSV Import Wizard state
  const [csvStep, setCsvStep] = useState<'upload' | 'mapping' | 'executing' | 'report'>('upload');
  const [rawCsvHeaders, setRawCsvHeaders] = useState<string[]>([]);
  const [rawCsvRows, setRawCsvRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    email: '',
    first_name: '',
    last_name: '',
    company: '',
    title: '',
    phone: '',
    linkedin_url: ''
  });
  const [importReport, setImportReport] = useState<{
    total: number;
    imported: number;
    duplicate: number;
    invalid: number;
    suppressed: number;
  } | null>(null);

  // Lead Sourcing state
  const [findDomain, setFindDomain] = useState<string>('');
  const [findCompany, setFindCompany] = useState<string>('');
  const [findTitle, setFindTitle] = useState<string>('');
  const [findingLeads, setFindingLeads] = useState<boolean>(false);
  const [foundLeads, setFoundLeads] = useState<any[]>([]);
  const [findProviderNotice, setFindProviderNotice] = useState<string | null>(null);

  // Suppressions manager state
  const [suppressions, setSuppressions] = useState<SuppressionItem[]>([]);
  const [suppressSearch, setSuppressSearch] = useState<string>('');
  const [newSuppressTarget, setNewSuppressTarget] = useState<string>('');
  const [newSuppressIsDomain, setNewSuppressIsDomain] = useState<boolean>(false);
  const [newSuppressReason, setNewSuppressReason] = useState<'manual' | 'unsubscribe' | 'hard_bounce' | 'complaint'>('manual');

  // Load Prospects
  const loadProspects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getProspects({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        verification_status: verifFilter || undefined,
        limit: 50
      });
      setProspects(res.prospects || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      showToast(err.message || 'Failed to load prospects', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, verifFilter, showToast]);

  useEffect(() => {
    loadProspects();
  }, [loadProspects]);

  // Load Suppressions
  const loadSuppressions = useCallback(async () => {
    try {
      const res = await getSuppressionsList({ search: suppressSearch.trim() || undefined });
      setSuppressions(res.suppressions || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load suppressions', 'error');
    }
  }, [suppressSearch, showToast]);

  useEffect(() => {
    if (showSuppressionsModal) {
      loadSuppressions();
    }
  }, [showSuppressionsModal, loadSuppressions]);

  // Handle select all / single
  const toggleSelectAll = () => {
    if (selectedIds.size === prospects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(prospects.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Submit single prospect create / edit
  const handleSaveProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      showToast('Email is required', 'error');
      return;
    }

    try {
      const tagList = formData.tags
        ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      if (editingProspect) {
        await updateProspect(editingProspect.id, {
          first_name: formData.first_name,
          last_name: formData.last_name,
          company: formData.company,
          title: formData.title,
          phone: formData.phone,
          linkedin_url: formData.linkedin_url,
          tags: tagList
        });
        showToast('Prospect updated successfully', 'success');
      } else {
        await createProspect({
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          company: formData.company,
          title: formData.title,
          phone: formData.phone,
          linkedin_url: formData.linkedin_url,
          tags: tagList
        });
        showToast('Prospect created successfully', 'success');
      }

      setShowAddModal(false);
      setEditingProspect(null);
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        company: '',
        title: '',
        phone: '',
        linkedin_url: '',
        tags: ''
      });
      loadProspects();
    } catch (err: any) {
      showToast(err.message || 'Failed to save prospect', 'error');
    }
  };

  // Delete single prospect
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prospect?')) return;
    try {
      await deleteProspect(id);
      showToast('Prospect deleted', 'success');
      loadProspects();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete prospect', 'error');
    }
  };

  // Bulk Verification Trigger
  const handleBulkVerify = async () => {
    const idsToVerify = Array.from(selectedIds);
    setVerifyingBatch(true);
    try {
      const res = await startBulkVerification({
        prospectIds: idsToVerify.length > 0 ? idsToVerify : undefined
      });
      showToast(
        `Verification queued for ${res.total} prospect(s). Background worker is processing.`,
        'success'
      );
      setTimeout(() => loadProspects(), 2000);
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger verification', 'error');
    } finally {
      setVerifyingBatch(false);
    }
  };

  // CSV File Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      parseCsvText(text);
    };
    reader.readAsText(file);
  };

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      showToast('CSV must contain a header row and at least one data row', 'error');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
    setRawCsvHeaders(headers);

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] || '';
      });
      rows.push(rowObj);
    }

    setRawCsvRows(rows);

    // Auto-detect mappings
    const autoMap: Record<string, string> = { ...columnMapping };
    headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes('email')) autoMap.email = h;
      else if (lower.includes('first') || lower === 'fname') autoMap.first_name = h;
      else if (lower.includes('last') || lower === 'lname') autoMap.last_name = h;
      else if (lower.includes('comp') || lower.includes('org')) autoMap.company = h;
      else if (lower.includes('title') || lower.includes('role')) autoMap.title = h;
      else if (lower.includes('phone') || lower.includes('tel')) autoMap.phone = h;
      else if (lower.includes('linkedin')) autoMap.linkedin_url = h;
    });

    setColumnMapping(autoMap);
    setCsvStep('mapping');
  };

  // Execute CSV Import
  const handleExecuteImport = async () => {
    if (!columnMapping.email) {
      showToast('Please select which column maps to Email', 'error');
      return;
    }

    setCsvStep('executing');
    try {
      const res = await importProspectsCsv(rawCsvRows, columnMapping);
      setImportReport(res.report);
      setCsvStep('report');
      showToast(`Imported ${res.report.imported} prospects successfully`, 'success');
      loadProspects();
    } catch (err: any) {
      showToast(err.message || 'Import failed', 'error');
      setCsvStep('mapping');
    }
  };

  // Lead Sourcing Search
  const handleFindLeads = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!findDomain && !findCompany) {
      showToast('Please provide a Domain or Company Name', 'error');
      return;
    }

    setFindingLeads(true);
    setFindProviderNotice(null);
    try {
      const res = await findLeadsOnline({
        domain: findDomain.trim() || undefined,
        company: findCompany.trim() || undefined,
        title: findTitle.trim() || undefined
      });

      if (!res.configured) {
        setFindProviderNotice(res.error || 'Provider not configured.');
        setFoundLeads([]);
      } else {
        setFoundLeads(res.prospects || []);
        if (res.prospects?.length === 0) {
          showToast('No matching contacts found for this query', 'info');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to search leads', 'error');
    } finally {
      setFindingLeads(false);
    }
  };

  // Import one found lead
  const handleAddFoundLead = async (lead: any) => {
    try {
      await createProspect({
        email: lead.email,
        first_name: lead.first_name,
        last_name: lead.last_name,
        company: lead.company,
        title: lead.title,
        phone: lead.phone,
        linkedin_url: lead.linkedin_url,
        tags: ['sourced-lead']
      });
      showToast(`Added ${lead.email} to prospects`, 'success');
      loadProspects();
    } catch (err: any) {
      showToast(err.message || 'Failed to add lead', 'error');
    }
  };

  // Add suppression
  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppressTarget) return;

    try {
      await addSuppressionItem({
        email: !newSuppressIsDomain ? newSuppressTarget.trim() : undefined,
        domain: newSuppressIsDomain ? newSuppressTarget.trim().replace(/^@/, '') : undefined,
        is_domain: newSuppressIsDomain,
        reason: newSuppressReason
      });
      showToast('Added to suppression list', 'success');
      setNewSuppressTarget('');
      loadSuppressions();
    } catch (err: any) {
      showToast(err.message || 'Failed to add suppression', 'error');
    }
  };

  const handleRemoveSuppression = async (id: string) => {
    try {
      await removeSuppressionItem(id);
      showToast('Suppression removed', 'success');
      loadSuppressions();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove suppression', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Prospect Directory
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              {total.toLocaleString()} leads
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Segment, verify deliverability, and maintain clean recipient lists.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFindModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors border border-purple-200 dark:border-purple-800/40"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Find Leads
          </button>

          <button
            onClick={() => setShowSuppressionsModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors border border-rose-200 dark:border-rose-800/40"
          >
            <Ban className="w-3.5 h-3.5" />
            Suppressions
          </button>

          <button
            onClick={() => {
              setCsvStep('upload');
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>

          <a
            href="/api/outreach/prospects/export-csv"
            download="prospects.csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>

          <button
            onClick={() => {
              setEditingProspect(null);
              setFormData({
                email: '',
                first_name: '',
                last_name: '',
                company: '',
                title: '',
                phone: '',
                linkedin_url: '',
                tags: ''
              });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Prospect
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="uncontacted">Uncontacted</option>
            <option value="contacted">Contacted</option>
            <option value="replied">Replied</option>
            <option value="bounced">Bounced</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>

          <select
            value={verifFilter}
            onChange={(e) => setVerifFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Verification</option>
            <option value="valid">Valid (Clean)</option>
            <option value="risky">Risky (Role / Catch-all)</option>
            <option value="invalid">Invalid (No MX / Bad)</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/40">
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleBulkVerify}
              disabled={verifyingBatch}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <ShieldCheck className="w-3 h-3" />
              {verifyingBatch ? 'Queueing...' : 'Verify Deliverability'}
            </button>
          </div>
        )}
      </div>

      {/* Main Prospects Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={prospects.length > 0 && selectedIds.size === prospects.length}
                    onChange={toggleSelectAll}
                    className="rounded-sm border-slate-300 dark:border-slate-700 text-indigo-600"
                  />
                </th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">Company & Role</th>
                <th className="p-3.5">Verification</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Tags</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading prospects...
                  </td>
                </tr>
              ) : prospects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">
                      No prospects found
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Import a CSV spreadsheet or click "Add Prospect" to populate your directory.
                    </p>
                  </td>
                </tr>
              ) : (
                prospects.map((p) => {
                  const isChecked = selectedIds.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        isChecked ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(p.id)}
                          className="rounded-sm border-slate-300 dark:border-slate-700 text-indigo-600"
                        />
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {p.email}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                          {p.company && <Building className="w-3 h-3 text-slate-400 shrink-0" />}
                          {p.company || '—'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {p.title || '—'}
                        </div>
                      </td>

                      <td className="p-3.5">
                        {p.verification_status === 'valid' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                            <CheckCircle2 className="w-3 h-3" />
                            Valid
                          </span>
                        )}
                        {p.verification_status === 'risky' && (
                          <span
                            title={p.verification_reason || 'Role address or Catch-all'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Risky
                          </span>
                        )}
                        {p.verification_status === 'invalid' && (
                          <span
                            title={p.verification_reason || 'Disposable or No-MX'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40"
                          >
                            <XCircle className="w-3 h-3" />
                            Invalid
                          </span>
                        )}
                        {(!p.verification_status || p.verification_status === 'unknown') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <HelpCircle className="w-3 h-3" />
                            Unverified
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                          {p.status}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {Array.isArray(p.tags) && p.tags.length > 0 ? (
                            p.tags.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded-md text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setEditingProspect(p);
                            setFormData({
                              email: p.email,
                              first_name: p.first_name || '',
                              last_name: p.last_name || '',
                              company: p.company || '',
                              title: p.title || '',
                              phone: p.phone || '',
                              linkedin_url: p.linkedin_url || '',
                              tags: Array.isArray(p.tags) ? p.tags.join(', ') : ''
                            });
                            setShowAddModal(true);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV IMPORT WIZARD MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  CSV Import Wizard
                </h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Upload */}
            {csvStep === 'upload' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a CSV file containing your prospects. The file must include an email column.
                </p>
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <label className="cursor-pointer">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                      Click to choose CSV file
                    </span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">Supports up to 50,000 rows</p>
                </div>
              </div>
            )}

            {/* Step 2: Mapping */}
            {csvStep === 'mapping' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Map CSV Columns ({rawCsvRows.length} rows loaded)
                  </p>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                    Step 2 of 3
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {[
                    { key: 'email', label: 'Email Address *', required: true },
                    { key: 'first_name', label: 'First Name' },
                    { key: 'last_name', label: 'Last Name' },
                    { key: 'company', label: 'Company' },
                    { key: 'title', label: 'Job Title' },
                    { key: 'phone', label: 'Phone Number' },
                    { key: 'linkedin_url', label: 'LinkedIn Profile' }
                  ].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {field.label}
                      </label>
                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, [field.key]: e.target.value })
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                      >
                        <option value="">— Don't import —</option>
                        {rawCsvHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setCsvStep('upload')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleExecuteImport}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  >
                    Start Import
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Executing */}
            {csvStep === 'executing' && (
              <div className="p-8 text-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Validating & Deduplicating Leads...
                </h4>
                <p className="text-xs text-slate-400">
                  Filtering suppressed addresses and updating database.
                </p>
              </div>
            )}

            {/* Step 4: Report */}
            {csvStep === 'report' && importReport && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <h4 className="text-sm font-bold">Import Completed</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-center">
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {importReport.imported}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-600 uppercase">
                      Imported
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-center">
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      {importReport.duplicate}
                    </div>
                    <div className="text-[10px] font-semibold text-blue-600 uppercase">
                      Duplicates
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-center">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {importReport.invalid}
                    </div>
                    <div className="text-[10px] font-semibold text-amber-600 uppercase">
                      Invalid Syntax
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-center">
                    <div className="text-lg font-bold text-rose-700 dark:text-rose-300">
                      {importReport.suppressed}
                    </div>
                    <div className="text-[10px] font-semibold text-rose-600 uppercase">
                      Suppressed
                    </div>
                  </div>
                </div>

                <div className="text-right pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEAD SOURCING "FIND LEADS" MODAL */}
      {showFindModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Lead Discovery Engine
                </h3>
              </div>
              <button
                onClick={() => setShowFindModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFindLeads} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Target Domain
                </label>
                <input
                  type="text"
                  placeholder="stripe.com"
                  value={findDomain}
                  onChange={(e) => setFindDomain(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Company Name
                </label>
                <input
                  type="text"
                  placeholder="Stripe"
                  value={findCompany}
                  onChange={(e) => setFindCompany(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Title Filter
                  </label>
                  <input
                    type="text"
                    placeholder="Engineering / VP"
                    value={findTitle}
                    onChange={(e) => setFindTitle(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={findingLeads}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 shrink-0"
                >
                  {findingLeads ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            {/* Provider Not Configured Warning */}
            {findProviderNotice && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Provider Integration Notice
                </div>
                <p>{findProviderNotice}</p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Set <code>APOLLO_API_KEY</code> or <code>HUNTER_API_KEY</code> in <code>.env</code> to activate live API discovery. LinkedIn scraping is strictly disallowed.
                </p>
              </div>
            )}

            {/* Results Table */}
            {foundLeads.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Title</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {foundLeads.map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 font-medium">
                          {l.first_name} {l.last_name}
                        </td>
                        <td className="p-2.5 font-mono text-slate-500">{l.email}</td>
                        <td className="p-2.5 text-slate-500">{l.title || '—'}</td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleAddFoundLead(l)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100"
                          >
                            + Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUPPRESSIONS MANAGER MODAL */}
      {showSuppressionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Suppression List Manager
                </h3>
              </div>
              <button
                onClick={() => setShowSuppressionsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Addresses or domains listed here are automatically excluded from campaigns and CSV imports to protect sender reputation.
            </p>

            {/* Add Suppression Form */}
            <form onSubmit={handleAddSuppression} className="flex flex-wrap items-end gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Target (Email or Domain)
                </label>
                <input
                  type="text"
                  placeholder="e.g. competitor.com or bad@domain.com"
                  value={newSuppressTarget}
                  onChange={(e) => setNewSuppressTarget(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="w-28">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Type
                </label>
                <select
                  value={newSuppressIsDomain ? 'domain' : 'email'}
                  onChange={(e) => setNewSuppressIsDomain(e.target.value === 'domain')}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="email">Exact Email</option>
                  <option value="domain">Domain (*.dom)</option>
                </select>
              </div>

              <div className="w-32">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Reason
                </label>
                <select
                  value={newSuppressReason}
                  onChange={(e) => setNewSuppressReason(e.target.value as any)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="manual">Manual</option>
                  <option value="unsubscribe">Unsubscribe</option>
                  <option value="hard_bounce">Hard Bounce</option>
                  <option value="complaint">Complaint</option>
                </select>
              </div>

              <button
                type="submit"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
              >
                + Suppress
              </button>
            </form>

            {/* Suppressions Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5">Target</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Reason</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {suppressions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        No suppressed addresses recorded
                      </td>
                    </tr>
                  ) : (
                    suppressions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 font-mono font-medium text-slate-800 dark:text-slate-200">
                          {s.domain ? `*.${s.domain}` : s.email}
                        </td>
                        <td className="p-2.5">
                          {s.is_domain ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                              Domain-Wide
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Single Email
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 capitalize text-slate-500">{s.reason}</td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleRemoveSuppression(s.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PROSPECT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingProspect ? 'Edit Prospect' : 'Add New Prospect'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProspect} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingProspect)}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Company
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="saas, outbound-q1, enterprise"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                >
                  Save Prospect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
