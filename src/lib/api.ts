import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';

/**
 * Resolves the active session Bearer token from client-side storage.
 * Prioritizes Clerk session tokens synced via ClerkTokenSynchronizer.
 */
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  return (
    localStorage.getItem('clerk_token') ||
    localStorage.getItem('agency_jwt_token') ||
    sessionStorage.getItem('agency_jwt_token') ||
    localStorage.getItem('alm_nexus_token') ||
    null
  );
}

/**
 * Builds request headers with automatic Clerk Bearer token injection
 */
export function buildAuthHeaders(
  customHeaders?: HeadersInit,
  tokenOverride?: string | null
): Headers {
  const headers = new Headers(customHeaders || {});

  const token = tokenOverride !== undefined ? tokenOverride : getStoredAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !headers.has('content-type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

/**
 * Core authenticated fetch function with automatic token injection & JSON error parsing
 */
export async function apiFetch<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  tokenOverride?: string | null
): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  try {
    const headers = buildAuthHeaders(init?.headers, tokenOverride);
    const config: RequestInit = {
      ...init,
      headers
    };

    const res = await fetch(input, config);
    const contentType = res.headers.get('content-type') || '';
    let data: any = null;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const errorMessage =
        (typeof data === 'object' && data !== null && (data.error || data.message)) ||
        `HTTP ${res.status}: Request failed`;
      return {
        ok: false,
        status: res.status,
        data,
        error: errorMessage
      };
    }

    return {
      ok: true,
      status: res.status,
      data
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null as any,
      error: err?.message || 'Network request failed'
    };
  }
}

/**
 * Custom React hook for client components that guarantees fresh Clerk session tokens
 * directly from Clerk's useAuth() hook on every outbound API call.
 */
export function useAuthFetch() {
  const { getToken, isSignedIn } = useAuth();

  const fetchWithAuth = useCallback(
    async function doFetch<T = any>(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
      let freshToken: string | null = null;

      if (isSignedIn && getToken) {
        try {
          freshToken = await getToken();
          if (freshToken) {
            localStorage.setItem('clerk_token', freshToken);
          }
        } catch {
          freshToken = getStoredAuthToken();
        }
      } else {
        freshToken = getStoredAuthToken();
      }

      return apiFetch<T>(input, init, freshToken);
    },
    [getToken, isSignedIn]
  );

  const get = useCallback(
    function doGet<T = any>(url: string, headers?: HeadersInit) {
      return fetchWithAuth<T>(url, { method: 'GET', headers });
    },
    [fetchWithAuth]
  );

  const post = useCallback(
    function doPost<T = any>(url: string, body?: any, headers?: HeadersInit) {
      return fetchWithAuth<T>(url, {
        method: 'POST',
        headers,
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
      });
    },
    [fetchWithAuth]
  );

  const put = useCallback(
    function doPut<T = any>(url: string, body?: any, headers?: HeadersInit) {
      return fetchWithAuth<T>(url, {
        method: 'PUT',
        headers,
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
      });
    },
    [fetchWithAuth]
  );

  const patch = useCallback(
    function doPatch<T = any>(url: string, body?: any, headers?: HeadersInit) {
      return fetchWithAuth<T>(url, {
        method: 'PATCH',
        headers,
        body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
      });
    },
    [fetchWithAuth]
  );

  const del = useCallback(
    function doDel<T = any>(url: string, headers?: HeadersInit) {
      return fetchWithAuth<T>(url, { method: 'DELETE', headers });
    },
    [fetchWithAuth]
  );

  return {
    fetchWithAuth,
    get,
    post,
    put,
    patch,
    del,
    isSignedIn
  };
}

/**
 * Standard HTTP client helper methods using stored token
 */
export const api = {
  get<T = any>(url: string, headers?: HeadersInit) {
    return apiFetch<T>(url, { method: 'GET', headers });
  },

  post<T = any>(url: string, body?: any, headers?: HeadersInit) {
    return apiFetch<T>(url, {
      method: 'POST',
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    });
  },

  put<T = any>(url: string, body?: any, headers?: HeadersInit) {
    return apiFetch<T>(url, {
      method: 'PUT',
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    });
  },

  patch<T = any>(url: string, body?: any, headers?: HeadersInit) {
    return apiFetch<T>(url, {
      method: 'PATCH',
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    });
  },

  delete<T = any>(url: string, headers?: HeadersInit) {
    return apiFetch<T>(url, { method: 'DELETE', headers });
  }
};
