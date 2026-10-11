import dns from 'node:dns/promises';
import { logger } from '../../logger';

export interface DnsFixInstruction {
  type: 'MX' | 'TXT';
  host: string;
  value: string;
  priority?: number;
  purpose: 'SPF' | 'DKIM' | 'DMARC' | 'MX';
  reason: string;
}

export interface DnsCheckResult {
  domain: string;
  mx: {
    status: 'valid' | 'missing' | 'error';
    records: Array<{ exchange: string; priority: number }>;
    error?: string;
  };
  spf: {
    status: 'valid' | 'warning' | 'missing' | 'error';
    record?: string;
    lookupCount?: number;
    error?: string;
  };
  dkim: {
    status: 'valid' | 'warning' | 'missing' | 'error';
    selector?: string;
    record?: string;
    testedSelectors: string[];
    error?: string;
  };
  dmarc: {
    status: 'valid' | 'warning' | 'missing' | 'error';
    policy?: 'none' | 'quarantine' | 'reject' | 'unknown';
    record?: string;
    error?: string;
  };
  overallStatus: 'healthy' | 'warning' | 'critical';
  fixInstructions: DnsFixInstruction[];
  checkedAt: string;
}

const COMMON_DKIM_SELECTORS = [
  'google',
  'selector1',
  'selector2',
  'default',
  'k1',
  's1',
  'mail',
  'zoho',
  'smtp'
];

/**
 * Counts DNS lookup mechanisms in an SPF record per RFC 7208 (limit is 10)
 */
export function countSpfLookups(spfString: string): number {
  const tokens = spfString.trim().split(/\s+/);
  let count = 0;
  for (const token of tokens) {
    const clean = token.toLowerCase();
    if (
      clean.startsWith('include:') ||
      clean.startsWith('a') ||
      clean.startsWith('mx') ||
      clean.startsWith('ptr') ||
      clean.startsWith('exists:') ||
      clean.startsWith('redirect=')
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Runs live DNS checks for MX, SPF, DKIM, and DMARC against a domain
 */
export async function checkDomainDns(rawDomain: string): Promise<DnsCheckResult> {
  const domain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  const fixInstructions: DnsFixInstruction[] = [];

  // 1. Check MX Records
  let mxResult: DnsCheckResult['mx'] = {
    status: 'missing',
    records: []
  };

  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      mxRecords.sort((a, b) => a.priority - b.priority);
      mxResult = {
        status: 'valid',
        records: mxRecords
      };
    } else {
      mxResult = {
        status: 'missing',
        records: [],
        error: 'No MX records found'
      };
      fixInstructions.push({
        type: 'MX',
        host: '@',
        value: 'smtp.google.com (or your email provider MX)',
        priority: 1,
        purpose: 'MX',
        reason: 'Missing MX record. Inbound emails and bounce detection cannot resolve mail servers.'
      });
    }
  } catch (err: any) {
    mxResult = {
      status: 'missing',
      records: [],
      error: err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'No MX records configured' : err.message
    };
    fixInstructions.push({
      type: 'MX',
      host: '@',
      value: 'smtp.google.com',
      priority: 1,
      purpose: 'MX',
      reason: 'No active Mail Exchange (MX) record detected for this sending domain.'
    });
  }

  // 2. Check SPF Record (TXT v=spf1)
  let spfResult: DnsCheckResult['spf'] = {
    status: 'missing'
  };

  try {
    const txtRecords = await dns.resolveTxt(domain);
    const flattenedTxt = txtRecords.map(chunks => chunks.join(''));
    const spfRecord = flattenedTxt.find(txt => txt.trim().toLowerCase().startsWith('v=spf1'));

    if (spfRecord) {
      const trimmedSpf = spfRecord.trim();
      const lookups = countSpfLookups(trimmedSpf);
      const endsProperly = trimmedSpf.endsWith('~all') || trimmedSpf.endsWith('-all');

      if (!endsProperly) {
        spfResult = {
          status: 'warning',
          record: trimmedSpf,
          lookupCount: lookups,
          error: 'SPF record should terminate with ~all (softfail) or -all (hardfail) for strict mailbox alignment.'
        };
        fixInstructions.push({
          type: 'TXT',
          host: '@',
          value: `${trimmedSpf.replace(/[?+]all$/, '')} ~all`.trim(),
          purpose: 'SPF',
          reason: 'Replace insecure "+all" or "?all" with "~all" to prevent unauthorized address spoofing.'
        });
      } else if (lookups > 10) {
        spfResult = {
          status: 'error',
          record: trimmedSpf,
          lookupCount: lookups,
          error: `SPF record has ${lookups} DNS lookups, exceeding the RFC 7208 maximum limit of 10.`
        };
        fixInstructions.push({
          type: 'TXT',
          host: '@',
          value: trimmedSpf,
          purpose: 'SPF',
          reason: `Too many SPF lookups (${lookups}/10). Flatten your SPF record by removing unused include: mechanisms.`
        });
      } else {
        spfResult = {
          status: 'valid',
          record: trimmedSpf,
          lookupCount: lookups
        };
      }
    } else {
      spfResult = {
        status: 'missing',
        error: 'No SPF record (v=spf1) found.'
      };
      fixInstructions.push({
        type: 'TXT',
        host: '@',
        value: 'v=spf1 include:_spf.google.com ~all',
        purpose: 'SPF',
        reason: 'Add SPF TXT record so receiving servers verify that your mailboxes are authorized to send.'
      });
    }
  } catch (err: any) {
    spfResult = {
      status: 'missing',
      error: err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'No TXT records found' : err.message
    };
    fixInstructions.push({
      type: 'TXT',
      host: '@',
      value: 'v=spf1 include:_spf.google.com ~all',
      purpose: 'SPF',
      reason: 'No SPF record found. Cold emails without SPF are routed straight to recipient spam folders.'
    });
  }

  // 3. Check DKIM Record (try common selectors)
  let dkimResult: DnsCheckResult['dkim'] = {
    status: 'missing',
    testedSelectors: COMMON_DKIM_SELECTORS
  };

  for (const selector of COMMON_DKIM_SELECTORS) {
    const dkimHost = `${selector}._domainkey.${domain}`;
    try {
      const records = await dns.resolveTxt(dkimHost);
      const flattened = records.map(chunks => chunks.join(''));
      const dkimRec = flattened.find(r => r.includes('v=DKIM1') || r.includes('p='));

      if (dkimRec) {
        dkimResult = {
          status: 'valid',
          selector,
          record: dkimRec,
          testedSelectors: COMMON_DKIM_SELECTORS
        };
        break;
      }
    } catch {
      // Continue testing selectors
    }
  }

  if (dkimResult.status !== 'valid') {
    fixInstructions.push({
      type: 'TXT',
      host: 'google._domainkey (or your provider selector)',
      value: 'v=DKIM1; k=rsa; p=<YOUR_PUBLIC_KEY>',
      purpose: 'DKIM',
      reason: `No DKIM record detected on tested selectors (${COMMON_DKIM_SELECTORS.slice(0, 4).join(', ')}...). Generate a 2048-bit DKIM key in your email provider console.`
    });
  }

  // 4. Check DMARC Record (_dmarc.domain)
  let dmarcResult: DnsCheckResult['dmarc'] = {
    status: 'missing'
  };

  try {
    const dmarcHost = `_dmarc.${domain}`;
    const txtRecords = await dns.resolveTxt(dmarcHost);
    const flattened = txtRecords.map(chunks => chunks.join(''));
    const dmarcRec = flattened.find(r => r.trim().toLowerCase().startsWith('v=dmarc1'));

    if (dmarcRec) {
      const policyMatch = dmarcRec.match(/p=([a-z]+)/i);
      const policy = (policyMatch ? policyMatch[1].toLowerCase() : 'unknown') as any;

      dmarcResult = {
        status: 'valid',
        policy,
        record: dmarcRec
      };
    } else {
      dmarcResult = {
        status: 'missing',
        error: 'No DMARC record starting with v=DMARC1 found at _dmarc.'
      };
      fixInstructions.push({
        type: 'TXT',
        host: `_dmarc.${domain}`,
        value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; pct=100; adkim=r; aspf=r`,
        purpose: 'DMARC',
        reason: 'DMARC tells recipient filters how to handle unaligned emails and protects against domain impersonation.'
      });
    }
  } catch (err: any) {
    dmarcResult = {
      status: 'missing',
      error: err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'No _dmarc record found' : err.message
    };
    fixInstructions.push({
      type: 'TXT',
      host: `_dmarc.${domain}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; pct=100; adkim=r; aspf=r`,
      purpose: 'DMARC',
      reason: 'No DMARC record found. Major providers (Gmail, Yahoo) now require DMARC for inbox placement.'
    });
  }

  // 5. Compute Overall Status
  let overallStatus: DnsCheckResult['overallStatus'] = 'healthy';
  const hasSpf = spfResult.status === 'valid';
  const hasDkim = dkimResult.status === 'valid';
  const hasDmarc = dmarcResult.status === 'valid';
  const hasMx = mxResult.status === 'valid';

  if (!hasMx || (!hasSpf && !hasDkim)) {
    overallStatus = 'critical';
  } else if (!hasDmarc || !hasSpf || !hasDkim || spfResult.status === 'warning') {
    overallStatus = 'warning';
  }

  return {
    domain,
    mx: mxResult,
    spf: spfResult,
    dkim: dkimResult,
    dmarc: dmarcResult,
    overallStatus,
    fixInstructions,
    checkedAt: new Date().toISOString()
  };
}
