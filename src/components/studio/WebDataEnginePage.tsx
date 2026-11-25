import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';
import {
  buildUtf8CsvWithBom,
  checkEngineHealth,
  ENGINE_CATEGORIES,
  EngineCategoryId,
  formatCellValue,
  getCrawlJobStatus,
  InspectResponse,
  inspectTargetSite,
  isSafeHttpUrl,
  JobStatusResponse,
  resolveEngineBaseUrl,
  startCrawlJob,
  triggerFileDownload,
  validateTargetUrl
} from '../../services/webDataEngineApi';
import { StudioLink } from './StudioLayout';

type BackendStatusState = 'checking' | 'online' | 'offline';

interface DemoPreset {
  id: string;
  label: string;
  url: string;
  maxPages: number;
  crawlProfiles: boolean;
  maxProfiles: number;
  categories: EngineCategoryId[];
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'quotes-scroll',
    label: 'Quotes Scroll Demo',
    url: 'https://quotes.toscrape.com/scroll',
    maxPages: 1,
    crawlProfiles: false,
    maxProfiles: 10,
    categories: ['quotes', 'meta_info']
  },
  {
    id: 'books-catalog',
    label: 'Books Catalog Demo',
    url: 'https://books.toscrape.com/',
    maxPages: 2,
    crawlProfiles: false,
    maxProfiles: 10,
    categories: ['books', 'images', 'meta_info']
  },
  {
    id: 'business-directory',
    label: 'Business Directory Demo',
    url: 'https://almnexus.tech/',
    maxPages: 1,
    crawlProfiles: true,
    maxProfiles: 5,
    categories: [
      'business_emails',
      'socials',
      'meta_info',
      'directory_profiles',
      'images'
    ]
  }
];

const COLUMN_ORDER_PRIORITY = [
  'Category',
  'category',
  'type',
  'Page #',
  'Website',
  'Profile / Shop Name',
  'Page Title',
  'Book Title',
  'Quote',
  'Author',
  'Tags',
  'title',
  'name',
  'Price',
  'price',
  'Availability',
  'Rating',
  'Business Emails',
  'Personal Emails',
  'email',
  'Phone Numbers',
  'phone',
  'WhatsApp',
  'whatsapp',
  'Official External Website',
  'Meta Description',
  'Instagram',
  'LinkedIn',
  'Twitter/X',
  'Facebook',
  'YouTube',
  'TikTok',
  'Alt Text',
  'Image URL',
  'Book URL',
  'Source Page',
  'url',
  'source_url'
];

interface WebDataEnginePageProps {
  onNavigate?: (href: string) => void;
}

const renderSafeCellContent = (rawVal: unknown, textVal: string) => {
  if (textVal === '') {
    return <span className="text-slate-400 dark:text-slate-600">—</span>;
  }

  if (isSafeHttpUrl(rawVal)) {
    return (
      <a
        href={rawVal.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-xs text-[var(--accent)] dark:text-blue-400 hover:underline break-all"
      >
        <span>{textVal}</span>
        <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </a>
    );
  }

  if (typeof rawVal === 'string' && rawVal.includes(',') && rawVal.includes('http')) {
    const parts = rawVal.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every((part) => isSafeHttpUrl(part))) {
      return (
        <div className="flex flex-col gap-1">
          {parts.map((part) => (
            <a
              key={part}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-[var(--accent)] dark:text-blue-400 hover:underline break-all"
            >
              <span>{part}</span>
              <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            </a>
          ))}
        </div>
      );
    }
  }

  return (
    <span className={typeof rawVal === 'number' ? 'font-mono tabular-nums' : undefined}>
      {textVal}
    </span>
  );
};

export const WebDataEnginePage: React.FC<WebDataEnginePageProps> = ({
  onNavigate = () => {}
}) => {
  const baseUrl = useMemo(() => resolveEngineBaseUrl(), []);

  // Backend health state
  const [healthStatus, setHealthStatus] = useState<BackendStatusState>('checking');
  const [engineLabel, setEngineLabel] = useState<string>('');
  const [healthError, setHealthError] = useState<string | null>(null);

  // Crawl configuration state
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [maxPages, setMaxPages] = useState<number>(5);
  const [crawlProfiles, setCrawlProfiles] = useState<boolean>(false);
  const [maxProfiles, setMaxProfiles] = useState<number>(10);
  const [selectedCategories, setSelectedCategories] = useState<EngineCategoryId[]>([
    'business_emails',
    'phones',
    'socials',
    'meta_info'
  ]);

  // Smart inspect state
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectResult, setInspectResult] = useState<InspectResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Job execution & polling state
  const [isSubmittingCrawl, setIsSubmittingCrawl] = useState<boolean>(false);
  const [activeJob, setActiveJob] = useState<JobStatusResponse | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Results table state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    setHealthStatus('checking');
    setHealthError(null);

    try {
      const data = await checkEngineHealth(baseUrl);
      if (!isMountedRef.current) return;
      if (data && data.status === 'ok') {
        setHealthStatus('online');
        setEngineLabel(data.engine || 'ALM Nexus Web Data Engine');
        setHealthError(null);
      } else {
        setHealthStatus('offline');
        setEngineLabel('');
        setHealthError('Backend responded without a healthy "ok" status.');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setHealthStatus('offline');
      setEngineLabel('');
      setHealthError(err?.message || 'Unable to reach the Web Data Engine backend.');
    }
  }, [baseUrl]);

  useEffect(() => {
    isMountedRef.current = true;
    refreshHealth();
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [refreshHealth, stopPolling]);

  const scheduleNextPoll = useCallback(
    (jobId: string, consecutiveErrors = 0) => {
      if (typeof window === 'undefined') return;
      stopPolling();
      pollTimerRef.current = window.setTimeout(async () => {
        try {
          const job = await getCrawlJobStatus(baseUrl, jobId);
          if (!isMountedRef.current) return;
          setActiveJob(job);

          if (job.status === 'queued' || job.status === 'running') {
            scheduleNextPoll(jobId, 0);
          } else {
            stopPolling();
            if (job.status === 'failed') {
              setActionError(job.error || 'Extraction job failed on the backend.');
            }
          }
        } catch (err: any) {
          if (!isMountedRef.current) return;
          if (consecutiveErrors < 2) {
            scheduleNextPoll(jobId, consecutiveErrors + 1);
          } else {
            stopPolling();
            setActionError(
              err?.message || 'Lost connection while polling extraction job progress.'
            );
          }
        }
      }, 1500);
    },
    [baseUrl, stopPolling]
  );

  const handleApplyPreset = (preset: DemoPreset) => {
    setTargetUrl(preset.url);
    setUrlError(null);
    setActionError(null);
    setInspectResult(null);
    setMaxPages(preset.maxPages);
    setCrawlProfiles(preset.crawlProfiles);
    setMaxProfiles(preset.maxProfiles);
    setSelectedCategories(preset.categories);
  };

  const handleInspectSite = async () => {
    setActionError(null);
    const validation = validateTargetUrl(targetUrl);
    if (!validation.valid) {
      setUrlError(validation.error);
      return;
    }

    setUrlError(null);
    setTargetUrl(validation.normalizedUrl);
    setIsInspecting(true);

    try {
      const inspected = await inspectTargetSite(baseUrl, validation.normalizedUrl);
      if (!isMountedRef.current) return;
      setInspectResult(inspected);

      const validCategoryIds = new Set<string>(ENGINE_CATEGORIES.map((c) => c.id));
      const matched = (inspected.suggested_categories || []).filter((cat): cat is EngineCategoryId =>
        validCategoryIds.has(cat)
      );

      if (matched.length > 0) {
        setSelectedCategories(matched);
      }
      if (matched.includes('directory_profiles')) {
        setCrawlProfiles(true);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setActionError(err?.message || 'Failed to inspect target URL.');
    } finally {
      if (isMountedRef.current) {
        setIsInspecting(false);
      }
    }
  };

  const handleToggleCategory = (categoryId: EngineCategoryId) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((item) => item !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(ENGINE_CATEGORIES.map((c) => c.id));
  };

  const handleClearCategories = () => {
    setSelectedCategories([]);
  };

  const isJobRunning =
    activeJob?.status === 'queued' || activeJob?.status === 'running';

  const handleStartExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const validation = validateTargetUrl(targetUrl);
    if (!validation.valid) {
      setUrlError(validation.error);
      return;
    }

    setUrlError(null);
    setTargetUrl(validation.normalizedUrl);
    setIsSubmittingCrawl(true);
    setSearchQuery('');
    setCategoryFilter('all');
    setCurrentPage(1);
    stopPolling();

    try {
      const startRes = await startCrawlJob(baseUrl, {
        url: validation.normalizedUrl,
        categories: selectedCategories.length > 0 ? selectedCategories : null,
        max_pages: maxPages,
        crawl_profiles: crawlProfiles,
        max_profiles: maxProfiles
      });

      if (!isMountedRef.current) return;

      const initialJob: JobStatusResponse = {
        job_id: startRes.job_id,
        status: (startRes.status as JobStatusResponse['status']) || 'queued',
        progress: 0,
        pages_crawled: 0,
        total_records: 0,
        results: [],
        error: null
      };
      setActiveJob(initialJob);

      if (initialJob.status === 'queued' || initialJob.status === 'running') {
        scheduleNextPoll(startRes.job_id, 0);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setActionError(err?.message || 'Failed to queue extraction job.');
    } finally {
      if (isMountedRef.current) {
        setIsSubmittingCrawl(false);
      }
    }
  };

  const rawResults = useMemo(() => activeJob?.results || [], [activeJob]);

  const dynamicColumns = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rawResults) {
      if (row && typeof row === 'object') {
        for (const key of Object.keys(row)) {
          seen.add(key);
        }
      }
    }
    const keys = Array.from(seen);
    keys.sort((a, b) => {
      const idxA = COLUMN_ORDER_PRIORITY.indexOf(a);
      const idxB = COLUMN_ORDER_PRIORITY.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return keys;
  }, [rawResults]);

  const categoryColumnKey = useMemo(() => {
    for (const candidate of ['Category', 'category', 'type', 'record_type']) {
      if (dynamicColumns.includes(candidate)) return candidate;
    }
    return null;
  }, [dynamicColumns]);

  const availableResultCategories = useMemo(() => {
    if (!categoryColumnKey) return [];
    const set = new Set<string>();
    for (const row of rawResults) {
      const val = row?.[categoryColumnKey];
      if (typeof val === 'string' && val.trim()) {
        set.add(val.trim());
      }
    }
    return Array.from(set).sort();
  }, [rawResults, categoryColumnKey]);

  const filteredResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rawResults.filter((row) => {
      if (categoryFilter !== 'all' && categoryColumnKey) {
        const val = String(row?.[categoryColumnKey] ?? '').trim();
        if (val !== categoryFilter) return false;
      }
      if (!query) return true;
      for (const col of dynamicColumns) {
        const text = formatCellValue(row?.[col]).toLowerCase();
        if (text.includes(query)) return true;
      }
      return false;
    });
  }, [rawResults, categoryFilter, categoryColumnKey, searchQuery, dynamicColumns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedResults = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredResults.slice(start, start + pageSize);
  }, [filteredResults, safeCurrentPage, pageSize]);

  const handleExportCsv = () => {
    if (filteredResults.length === 0 || dynamicColumns.length === 0) return;
    const csvContent = buildUtf8CsvWithBom(filteredResults, dynamicColumns);
    const domainSlug = (inspectResult?.domain || 'extraction')
      .replace(/[^a-zA-Z0-9.-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    triggerFileDownload(
      csvContent,
      'text/csv;charset=utf-8;',
      `almnexus_${domainSlug || 'web_data'}_${Date.now()}.csv`
    );
  };

  const handleExportJson = () => {
    if (filteredResults.length === 0) return;
    const jsonContent = JSON.stringify(filteredResults, null, 2);
    const domainSlug = (inspectResult?.domain || 'extraction')
      .replace(/[^a-zA-Z0-9.-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    triggerFileDownload(
      jsonContent,
      'application/json;charset=utf-8;',
      `almnexus_${domainSlug || 'web_data'}_${Date.now()}.json`
    );
  };

  const clampedProgress = Math.min(100, Math.max(0, Math.round(activeJob?.progress ?? 0)));
  const suggestedSet = useMemo(
    () => new Set(inspectResult?.suggested_categories || []),
    [inspectResult]
  );

  return (
    <>
      {/* Header Section */}
      <section className="py-12 md:py-16 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-[68ch] space-y-3">
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                Tools · Data Extraction
              </p>
              <h1 className="text-[32px] sm:text-[42px] lg:text-[46px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
                ALM Nexus Web Data Engine
              </h1>
              <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
                Inspect target domains, configure multi-page and directory-profile extraction jobs, track live crawler progress, and export structured UTF-8 CSV or JSON datasets.
              </p>
            </div>

            {/* Live Backend Status Telemetry Badge + Refresh */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-[6px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-sm"
              >
                {healthStatus === 'online' && (
                  <>
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                      aria-hidden="true"
                    />
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      Backend Online
                    </span>
                    {engineLabel && (
                      <span className="hidden sm:inline text-xs font-mono text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-2.5">
                        {engineLabel}
                      </span>
                    )}
                  </>
                )}

                {healthStatus === 'offline' && (
                  <>
                    <span
                      className="w-2 h-2 rounded-full bg-red-500 shrink-0"
                      aria-hidden="true"
                    />
                    <AlertCircle
                      className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      Backend Offline
                    </span>
                  </>
                )}

                {healthStatus === 'checking' && (
                  <>
                    <Loader2
                      className="w-4 h-4 text-[var(--accent)] animate-spin shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      Checking Backend
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={refreshHealth}
                disabled={healthStatus === 'checking'}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/70 text-sm font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-4 h-4 ${healthStatus === 'checking' ? 'animate-spin' : ''}`}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Offline / Error Banner */}
          {(healthError || actionError) && (
            <div
              role="alert"
              className="p-4 rounded-[8px] border border-red-300 dark:border-red-900/70 bg-red-50 dark:bg-red-950/30 flex items-start gap-3 text-sm text-red-900 dark:text-red-200"
            >
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
              <div className="space-y-1 flex-1 min-w-0">
                <p className="font-semibold">
                  {actionError ? 'Extraction Engine Error' : 'FastAPI Backend Unreachable'}
                </p>
                <p className="text-red-800 dark:text-red-300 break-words">
                  {actionError || healthError}
                </p>
                {baseUrl && (
                  <p className="text-xs font-mono text-red-700 dark:text-red-400">
                    Endpoint: {baseUrl}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Configuration & Live Status Workspace */}
      <section className="py-10 md:py-14 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Crawl Configuration Panel */}
            <form
              onSubmit={handleStartExtraction}
              noValidate
              className="lg:col-span-8 p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-7"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Crawl Configuration
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Load a sample preset or inspect a target site to detect categories automatically.
                  </p>
                </div>
                {baseUrl && (
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                    {baseUrl}
                  </span>
                )}
              </div>

              {/* Sample Preset Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 mr-1">
                  Sample presets:
                </span>
                {DEMO_PRESETS.map((preset) => {
                  const isActive = targetUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      disabled={isJobRunning}
                      className={`px-3 py-1.5 rounded-[6px] border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                        isActive
                          ? 'border-[var(--accent)] bg-blue-50/70 dark:bg-blue-950/30 text-[var(--accent)] dark:text-blue-400'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Target URL + Smart Inspect */}
              <div className="space-y-2">
                <label
                  htmlFor="engine-target-url"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Target URL
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Globe
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <input
                      id="engine-target-url"
                      type="url"
                      value={targetUrl}
                      onChange={(e) => {
                        setTargetUrl(e.target.value);
                        if (urlError) setUrlError(null);
                      }}
                      placeholder="https://books.toscrape.com/"
                      aria-invalid={Boolean(urlError)}
                      aria-describedby={urlError ? 'engine-url-error' : undefined}
                      className="w-full h-11 pl-10 pr-3.5 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleInspectSite}
                    disabled={isInspecting || isJobRunning || healthStatus !== 'online'}
                    className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] hover:bg-slate-50 dark:hover:bg-slate-800/70 text-sm font-medium text-slate-900 dark:text-slate-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                  >
                    {isInspecting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <span>{isInspecting ? 'Inspecting...' : 'Smart Inspect URL'}</span>
                  </button>
                </div>
                {urlError && (
                  <p id="engine-url-error" className="text-xs text-red-600 dark:text-red-400">
                    {urlError}
                  </p>
                )}
              </div>

              {/* Inspection Summary Box */}
              {inspectResult && (
                <div className="p-4 rounded-[6px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F17] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                    <span>
                      Domain: <strong className="text-slate-900 dark:text-white">{inspectResult.domain}</strong>
                    </span>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                    <span>
                      Render Mode:{' '}
                      <strong className="text-slate-900 dark:text-white">
                        {inspectResult.rendered_with_browser ? 'Headless Browser' : 'Static HTTP'}
                      </strong>
                    </span>
                    <span aria-hidden="true" className="hidden sm:inline">·</span>
                    <span>
                      Suggested Categories:{' '}
                      <strong className="text-slate-900 dark:text-white tabular-nums">
                        {inspectResult.suggested_categories.length}
                      </strong>
                    </span>
                  </div>

                  {inspectResult.detected_socials && inspectResult.detected_socials.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Detected Social Channels
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
                        {inspectResult.detected_socials.map((socialItem, idx) => (
                          <React.Fragment key={socialItem}>
                            {idx > 0 && (
                              <span aria-hidden="true" className="text-slate-400">
                                ·
                              </span>
                            )}
                            {isSafeHttpUrl(socialItem) ? (
                              <a
                                href={socialItem}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--accent)] dark:text-blue-400 hover:underline truncate max-w-[260px]"
                              >
                                <span className="truncate">{socialItem}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="text-slate-700 dark:text-slate-300">
                                {socialItem}
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Crawl Depth & Directory Profile Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="engine-max-pages"
                      className="text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                      Max Pages
                    </label>
                    <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {maxPages} / 20
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="engine-max-pages"
                      type="range"
                      min={1}
                      max={20}
                      value={maxPages}
                      onChange={(e) => setMaxPages(Number(e.target.value))}
                      className="flex-1 accent-[#2563EB] cursor-pointer"
                    />
                    <input
                      type="number"
                      aria-label="Max Pages exact value"
                      min={1}
                      max={20}
                      value={maxPages}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val)) {
                          setMaxPages(Math.min(20, Math.max(1, val)));
                        }
                      }}
                      className="w-16 h-9 px-2 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-sm font-mono tabular-nums text-center text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="engine-crawl-profiles"
                      className="inline-flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100 cursor-pointer"
                    >
                      <input
                        id="engine-crawl-profiles"
                        type="checkbox"
                        checked={crawlProfiles}
                        onChange={(e) => setCrawlProfiles(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 accent-[#2563EB] cursor-pointer"
                      />
                      <span>Deep Directory / Profile Crawl</span>
                    </label>
                    <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {crawlProfiles ? `${maxProfiles} / 25` : 'Off'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      id="engine-max-profiles"
                      type="range"
                      aria-label="Max Profiles range"
                      min={1}
                      max={25}
                      disabled={!crawlProfiles}
                      value={maxProfiles}
                      onChange={(e) => setMaxProfiles(Number(e.target.value))}
                      className="flex-1 accent-[#2563EB] cursor-pointer disabled:opacity-40"
                    />
                    <input
                      type="number"
                      aria-label="Max Profiles exact value"
                      min={1}
                      max={25}
                      disabled={!crawlProfiles}
                      value={maxProfiles}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!Number.isNaN(val)) {
                          setMaxProfiles(Math.min(25, Math.max(1, val)));
                        }
                      }}
                      className="w-16 h-9 px-2 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-sm font-mono tabular-nums text-center text-slate-900 dark:text-white disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>

              {/* Extraction Categories Checkboxes */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Extraction Categories
                    </span>
                    <span className="ml-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {selectedCategories.length === 0
                        ? 'Auto-detect mode (backend chooses)'
                        : `${selectedCategories.length} selected`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-medium">
                    <button
                      type="button"
                      onClick={handleSelectAllCategories}
                      className="text-[var(--accent)] dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearCategories}
                      className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ENGINE_CATEGORIES.map((category) => {
                    const checked = selectedCategories.includes(category.id);
                    const isSuggested = suggestedSet.has(category.id);

                    return (
                      <label
                        key={category.id}
                        className={`flex items-start gap-3 p-3 rounded-[6px] border transition-colors cursor-pointer ${
                          checked
                            ? 'border-[var(--accent)] bg-blue-50/50 dark:bg-blue-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleCategory(category.id)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 accent-[#2563EB] cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {category.label}
                            </span>
                            {isSuggested && (
                              <span className="text-[11px] font-mono text-[var(--accent)] dark:text-blue-400 shrink-0">
                                Suggested
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {category.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Submit Action */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Polls <span className="font-mono">/api/v1/jobs/&#123;job_id&#125;</span> every 1.5s while queued or running.
                </p>

                <button
                  type="submit"
                  disabled={isSubmittingCrawl || isJobRunning || healthStatus !== 'online'}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {(isSubmittingCrawl || isJobRunning) && (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span>
                    {isSubmittingCrawl
                      ? 'Queuing Job...'
                      : isJobRunning
                      ? 'Extraction Running...'
                      : 'Start Deep Extraction'}
                  </span>
                </button>
              </div>
            </form>

            {/* Live Progress & Status Panel */}
            <aside className="lg:col-span-4 p-6 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-6">
              <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Live Progress &amp; Status
                </h2>
                {activeJob && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold uppercase ${
                      activeJob.status === 'completed'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : activeJob.status === 'failed'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-[var(--accent)] dark:text-blue-400'
                    }`}
                  >
                    {activeJob.status === 'completed' && (
                      <Check className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                    )}
                    {(activeJob.status === 'queued' || activeJob.status === 'running') && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
                    )}
                    <span>{activeJob.status}</span>
                  </span>
                )}
              </div>

              {!activeJob ? (
                <div className="py-6 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <p>
                    No active extraction job yet. Choose a preset or enter a URL, run <strong className="text-slate-900 dark:text-slate-200">Smart Inspect URL</strong>, then start extraction.
                  </p>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Ready · Polling interval: 1.5s
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600 dark:text-slate-400">Progress</span>
                      <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                        {clampedProgress}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={clampedProgress}
                      className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                    >
                      <div
                        className={`h-full transition-all duration-300 ${
                          activeJob.status === 'failed'
                            ? 'bg-red-500'
                            : activeJob.status === 'completed'
                            ? 'bg-emerald-500'
                            : 'bg-[var(--accent)]'
                        }`}
                        style={{ width: `${clampedProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Counters */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Pages Crawled
                      </div>
                      <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {activeJob.pages_crawled ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Records Found
                      </div>
                      <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {activeJob.total_records ?? rawResults.length}
                      </div>
                    </div>
                  </div>

                  {/* Job Metadata */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <div className="flex items-center justify-between gap-2">
                      <span>Job ID</span>
                      <span className="text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                        {activeJob.job_id}
                      </span>
                    </div>
                  </div>

                  {/* Empty / Failed Callout Inside Status Panel */}
                  {activeJob.status === 'completed' && rawResults.length === 0 && (
                    <div className="p-3 rounded-[6px] border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
                      Extraction completed with 0 matching records. Try inspecting the URL or expanding selected categories.
                    </div>
                  )}

                  {activeJob.status === 'failed' && activeJob.error && (
                    <div className="p-3 rounded-[6px] border border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 text-xs text-red-900 dark:text-red-200 break-words">
                      {activeJob.error}
                    </div>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      {/* Results Table & Conversion Banner */}
      <section className="py-10 md:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-[-0.015em] text-slate-900 dark:text-white">
                  Extracted Records
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  {rawResults.length === 0
                    ? 'No extracted dataset loaded yet'
                    : `${filteredResults.length} of ${rawResults.length} records shown`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredResults.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/70 text-sm font-medium text-slate-900 dark:text-slate-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                  <span>Export CSV (UTF-8)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  disabled={filteredResults.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/70 text-sm font-medium text-slate-900 dark:text-slate-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <FileJson className="w-4 h-4 text-[var(--accent)] dark:text-blue-400" strokeWidth={1.75} aria-hidden="true" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Search & Category Filter Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Search extracted records"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search across extracted domains, emails, titles, prices, or URLs..."
                  className="w-full h-10 pl-10 pr-3.5 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {availableResultCategories.length > 0 && (
                <select
                  aria-label="Filter by extracted category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-10 px-3 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-sm text-slate-900 dark:text-white"
                >
                  <option value="all">All Categories</option>
                  {availableResultCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 px-3 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-sm font-mono tabular-nums text-slate-900 dark:text-white"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            {/* Data Grid */}
            <div className="rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
              {rawResults.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Download className="w-6 h-6 text-slate-400 mx-auto" strokeWidth={1.75} aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {isJobRunning
                      ? 'Crawling target pages and streaming results...'
                      : 'Run an extraction job to populate dynamic result columns here.'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Columns adapt automatically to the schema returned by the backend (books, quotes, emails, phone numbers, social links, or directory profiles).
                  </p>
                </div>
              ) : filteredResults.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    No records match your current search or category filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('all');
                    }}
                    className="text-xs font-medium text-[var(--accent)] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0D131F]">
                          <th className="py-2.5 px-3 font-mono text-xs font-medium text-slate-500 dark:text-slate-400 w-12 tabular-nums">
                            #
                          </th>
                          {dynamicColumns.map((col) => (
                            <th
                              key={col}
                              className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {paginatedResults.map((row, rowIdx) => {
                          const globalIndex = (safeCurrentPage - 1) * pageSize + rowIdx + 1;
                          return (
                            <tr
                              key={`row-${globalIndex}`}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 align-top">
                                {globalIndex}
                              </td>
                              {dynamicColumns.map((col) => {
                                const rawVal = row?.[col];
                                const textVal = formatCellValue(rawVal);

                                return (
                                  <td
                                    key={col}
                                    className="py-2.5 px-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 align-top max-w-[280px] break-words"
                                  >
                                    {renderSafeCellContent(rawVal, textVal)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar */}
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0D131F] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      Page {safeCurrentPage} of {totalPages} · Showing{' '}
                      {(safeCurrentPage - 1) * pageSize + 1}–
                      {Math.min(safeCurrentPage * pageSize, filteredResults.length)} of{' '}
                      {filteredResults.length}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safeCurrentPage <= 1}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                        <span>Prev</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safeCurrentPage >= totalPages}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Subtle Conversion Banner */}
          <div className="p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-[15px] sm:text-[16px] leading-[1.6] text-slate-700 dark:text-slate-200 max-w-[68ch]">
              Need 10,000+ leads, automated CRM sync, or custom scheduled scraping pipelines?
            </p>
            <StudioLink
              href="/contact"
              onNavigate={onNavigate}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>Scope a Custom Pipeline</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            </StudioLink>
          </div>
        </div>
      </section>
    </>
  );
};
