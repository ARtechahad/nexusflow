import { useEffect, useState } from 'react';
import {
  getOutreachHealth,
  listMailboxes,
  listCampaigns,
  getOutreachAnalyticsData,
  Mailbox,
  CampaignItem,
  AnalyticsOverviewMetrics
} from '../services/outreachService';

export interface OutreachTelemetryState {
  loading: boolean;
  postgresConnected: boolean | null;
  mailboxes: Mailbox[];
  campaigns: CampaignItem[];
  analytics: AnalyticsOverviewMetrics | null;
  error: string | null;
  sentToday: number;
  dailyCapacity: number;
  activeMailboxesCount: number;
  activeCampaignsCount: number;
}

const INITIAL_STATE: OutreachTelemetryState = {
  loading: true,
  postgresConnected: null,
  mailboxes: [],
  campaigns: [],
  analytics: null,
  error: null,
  sentToday: 0,
  dailyCapacity: 0,
  activeMailboxesCount: 0,
  activeCampaignsCount: 0
};

let cachedState: OutreachTelemetryState | null = null;
let cachedKey = '';
let cachedAt = 0;
let inflightPromise: Promise<OutreachTelemetryState> | null = null;
const CACHE_TTL_MS = 30_000;

export function clearOutreachTelemetryCache(): void {
  cachedState = null;
  cachedKey = '';
  cachedAt = 0;
  inflightPromise = null;
}

async function fetchOutreachTelemetrySnapshot(scopeKey: string): Promise<OutreachTelemetryState> {
  const now = Date.now();
  if (cachedState && cachedKey === scopeKey && now - cachedAt < CACHE_TTL_MS) {
    return cachedState;
  }

  if (inflightPromise && cachedKey === scopeKey) {
    return inflightPromise;
  }

  cachedKey = scopeKey;
  inflightPromise = (async () => {
    try {
      const health = await getOutreachHealth().catch(() => null);

      if (!health || !health.postgresConnected) {
        const next: OutreachTelemetryState = {
          loading: false,
          postgresConnected: health ? health.postgresConnected : false,
          mailboxes: [],
          campaigns: [],
          analytics: null,
          error: null,
          sentToday: 0,
          dailyCapacity: 0,
          activeMailboxesCount: 0,
          activeCampaignsCount: 0
        };
        cachedState = next;
        cachedAt = Date.now();
        return next;
      }

      const [mailboxesRes, campaignsRes, analyticsRes] = await Promise.allSettled([
        listMailboxes(),
        listCampaigns(),
        getOutreachAnalyticsData({ dateRange: '30d' })
      ]);

      const mailboxes = mailboxesRes.status === 'fulfilled' ? mailboxesRes.value : [];
      const campaigns = campaignsRes.status === 'fulfilled' ? campaignsRes.value : [];
      const analytics = analyticsRes.status === 'fulfilled' ? analyticsRes.value.overview : null;

      const next: OutreachTelemetryState = {
        loading: false,
        postgresConnected: true,
        mailboxes,
        campaigns,
        analytics,
        error: null,
        sentToday: mailboxes.reduce((sum, m) => sum + (Number(m.today_campaign_sent) || 0), 0),
        dailyCapacity: mailboxes.reduce((sum, m) => sum + (Number(m.daily_cap) || 0), 0),
        activeMailboxesCount: mailboxes.filter(m => m.status === 'active').length,
        activeCampaignsCount: campaigns.filter(c => c.status === 'active').length
      };

      cachedState = next;
      cachedAt = Date.now();
      return next;
    } catch (err: any) {
      return {
        ...INITIAL_STATE,
        loading: false,
        error: err?.message || 'Unable to load outreach telemetry'
      };
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

export function useOutreachTelemetry(enabled: boolean = true, tenantScopeKey: string = ''): OutreachTelemetryState {
  const [state, setState] = useState<OutreachTelemetryState>(() => {
    if (!enabled) return { ...INITIAL_STATE, loading: false };
    return cachedState && cachedKey === tenantScopeKey ? cachedState : INITIAL_STATE;
  });

  useEffect(() => {
    if (!enabled || !tenantScopeKey) {
      setState({ ...INITIAL_STATE, loading: false });
      return;
    }
    let active = true;
    fetchOutreachTelemetrySnapshot(tenantScopeKey).then(result => {
      if (active) {
        setState(result);
      }
    });
    return () => {
      active = false;
    };
  }, [enabled, tenantScopeKey]);

  return state;
}
