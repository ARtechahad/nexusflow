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
let cachedAt = 0;
let inflightPromise: Promise<OutreachTelemetryState> | null = null;
const CACHE_TTL_MS = 30_000;

async function fetchOutreachTelemetrySnapshot(): Promise<OutreachTelemetryState> {
  const now = Date.now();
  if (cachedState && now - cachedAt < CACHE_TTL_MS) {
    return cachedState;
  }

  if (inflightPromise) {
    return inflightPromise;
  }

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

export function useOutreachTelemetry(): OutreachTelemetryState {
  const [state, setState] = useState<OutreachTelemetryState>(() => cachedState || INITIAL_STATE);

  useEffect(() => {
    let active = true;
    fetchOutreachTelemetrySnapshot().then(result => {
      if (active) {
        setState(result);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
