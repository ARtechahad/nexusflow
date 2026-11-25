export type EngineCategoryId =
  | 'quotes'
  | 'books'
  | 'business_emails'
  | 'personal_emails'
  | 'phones'
  | 'whatsapp'
  | 'socials'
  | 'meta_info'
  | 'directory_profiles'
  | 'images';

export interface EngineCategoryOption {
  id: EngineCategoryId;
  label: string;
  description: string;
}

export const ENGINE_CATEGORIES: EngineCategoryOption[] = [
  {
    id: 'business_emails',
    label: 'Business Emails',
    description: 'Corporate and role-based contact addresses'
  },
  {
    id: 'personal_emails',
    label: 'Personal Emails',
    description: 'Individual webmail addresses exposed on pages'
  },
  {
    id: 'phones',
    label: 'Phone Numbers',
    description: 'Normalized telephone numbers and extensions'
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'Direct wa.me links and WhatsApp contact numbers'
  },
  {
    id: 'socials',
    label: 'Social Profiles',
    description: 'LinkedIn, X, Instagram, Facebook, GitHub links'
  },
  {
    id: 'directory_profiles',
    label: 'Directory Profiles',
    description: 'Structured member, listing, and profile detail pages'
  },
  {
    id: 'meta_info',
    label: 'Meta Info',
    description: 'Page titles, descriptions, canonicals, and schema tags'
  },
  {
    id: 'images',
    label: 'Images',
    description: 'Image asset URLs, alt text, and dimensions'
  },
  {
    id: 'books',
    label: 'Books & Catalogs',
    description: 'Titles, prices, ratings, and catalog stock records'
  },
  {
    id: 'quotes',
    label: 'Quotes & Snippets',
    description: 'Structured quote blocks, authors, and topic tags'
  }
];

export interface HealthResponse {
  status: string;
  engine: string;
}

export interface InspectResponse {
  url: string;
  domain: string;
  rendered_with_browser: boolean;
  suggested_categories: string[];
  detected_socials: string[];
}

export interface CrawlRequestPayload {
  url: string;
  categories: string[] | null;
  max_pages: number;
  crawl_profiles: boolean;
  max_profiles: number;
}

export interface CrawlStartResponse {
  job_id: string;
  status: string;
}

export type CrawlJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobStatusResponse {
  job_id: string;
  status: CrawlJobStatus;
  progress: number;
  pages_crawled: number;
  total_records: number;
  results: Record<string, any>[];
  error: string | null;
}

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl: string;
  error: string | null;
}

export function resolveEngineBaseUrl(): string {
  const metaEnv =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env
      : undefined;

  const configured =
    typeof metaEnv?.VITE_ENGINE_API_URL === 'string'
      ? metaEnv.VITE_ENGINE_API_URL.trim().replace(/\/+$/, '')
      : '';

  if (configured) {
    return configured;
  }

  const isDev = Boolean(metaEnv?.DEV);
  if (isDev) {
    return 'http://localhost:8000';
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000';
    }
  }

  return '';
}

export function validateTargetUrl(rawInput: string): UrlValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Enter a target URL starting with https:// or http://'
    };
  }

  const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Only http:// and https:// URLs are allowed.'
      };
    }
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return {
        valid: false,
        normalizedUrl: '',
        error: 'Enter a valid domain name (for example, https://example.com).'
      };
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString(),
      error: null
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      error: 'Enter a valid URL (for example, https://books.toscrape.com).'
    };
  }
}

export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchEngineJson<T>(
  baseUrl: string,
  endpoint: string,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  if (!baseUrl) {
    throw new Error(
      'Engine API URL is not configured. Set VITE_ENGINE_API_URL in your environment.'
    );
  }

  const controller = new AbortController();
  const timeoutHandle =
    typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {})
      },
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const detail =
        (payload && (payload.detail || payload.error || payload.message)) ||
        `Engine returned HTTP ${response.status}`;
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }

    if (payload === null) {
      throw new Error('Engine returned an empty or non-JSON response.');
    }

    return payload as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out while contacting the Web Data Engine backend.');
    }
    if (err instanceof TypeError) {
      throw new Error(
        `Unable to reach the Web Data Engine backend at ${baseUrl}. Confirm the FastAPI server is running and CORS is enabled.`
      );
    }
    throw err;
  } finally {
    if (timeoutHandle !== undefined && typeof window !== 'undefined') {
      window.clearTimeout(timeoutHandle);
    }
  }
}

export async function checkEngineHealth(baseUrl: string): Promise<HealthResponse> {
  return fetchEngineJson<HealthResponse>(baseUrl, '/health', { method: 'GET' }, 6000);
}

export async function inspectTargetSite(
  baseUrl: string,
  url: string
): Promise<InspectResponse> {
  return fetchEngineJson<InspectResponse>(
    baseUrl,
    '/api/v1/inspect',
    {
      method: 'POST',
      body: JSON.stringify({ url })
    },
    30000
  );
}

export async function startCrawlJob(
  baseUrl: string,
  payload: CrawlRequestPayload
): Promise<CrawlStartResponse> {
  return fetchEngineJson<CrawlStartResponse>(
    baseUrl,
    '/api/v1/crawl',
    {
      method: 'POST',
      body: JSON.stringify({
        url: payload.url,
        categories: payload.categories,
        max_pages: Math.min(20, Math.max(1, Math.round(payload.max_pages))),
        crawl_profiles: Boolean(payload.crawl_profiles),
        max_profiles: Math.min(25, Math.max(1, Math.round(payload.max_profiles)))
      })
    },
    20000
  );
}

export async function getCrawlJobStatus(
  baseUrl: string,
  jobId: string
): Promise<JobStatusResponse> {
  return fetchEngineJson<JobStatusResponse>(
    baseUrl,
    `/api/v1/jobs/${encodeURIComponent(jobId)}`,
    { method: 'GET' },
    12000
  );
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function escapeCsvField(rawValue: string): string {
  const safe = rawValue.replace(/"/g, '""');
  return `"${safe}"`;
}

export function buildUtf8CsvWithBom(
  rows: Record<string, any>[],
  columns: string[]
): string {
  const headerLine = columns.map((col) => escapeCsvField(col)).join(',');
  const bodyLines = rows.map((row) =>
    columns.map((col) => escapeCsvField(formatCellValue(row?.[col]))).join(',')
  );
  return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
}

export function triggerFileDownload(
  content: string,
  mimeType: string,
  filename: string
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
