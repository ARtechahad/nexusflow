export interface DocSection {
  id: string;
  title: string;
  summary: string;
  content: string;
  codeSamples?: { language: string; label: string; code: string }[];
}

export const OUTREACH_DOCS: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    summary: 'Overview of LeadFlow Outreach Suite, quick setup, architecture, and onboarding steps.',
    content: `
LeadFlow Outreach Suite is an enterprise-grade cold outreach and deliverability platform engineered to protect your domain reputation while scaling predictable outbound revenue.

### Core Principles
- **Reputation-First Architecture**: Every single outgoing email is audited by Cap Guard, checking domain quotas, mailbox health, and daily warmup ramps before dispatch.
- **Autonomous Warmup**: Peer-to-peer network exchanges authentic business conversations across Gmail, Outlook, and custom SMTP inboxes to establish high sender trust.
- **Dynamic Sequence Branching**: Direct openers, non-openers, and reply sentiments down distinct, personalized paths with zero manual list slicing.
- **AI Agent Automation**: Model Context Protocol (MCP) server allows Claude Desktop, Cursor, and autonomous agents to safely orchestrate outbound pipeline creation.

### Quick Start Checklist
1. **Connect Mailbox**: Add your Google Workspace, Microsoft 365, or custom SMTP/IMAP credentials with auto-detected presets.
2. **Verify DNS**: Verify that MX, SPF, DKIM, and DMARC TXT records are valid using our built-in DNS inspector.
3. **Initiate Warmup**: Start with \`new_domain\` or \`new_mailbox\` mode. Our engine gradually ramps send volume from 1 email/day while pulling missed messages out of spam folders.
4. **Build Sequence**: Use the drag-and-drop Sequence Builder with A–Z split testing variants and conditional follow-ups.
5. **Import & Verify Prospects**: Upload your CSV; our layered verification engine flags disposable domains, role accounts, and invalid MX records before you ever hit send.
    `
  },
  {
    id: 'connect-mailbox',
    title: 'Connect a Mailbox',
    summary: 'Supported providers, authentication credentials, app passwords, and connection testing.',
    content: `
LeadFlow supports any standard email provider utilizing authenticated SMTP for sending and IMAP for bounce and reply synchronization.

### Supported Providers & Presets
- **Google Workspace**: SMTP \`smtp.gmail.com:587\` (STARTTLS) or \`465\` (SSL), IMAP \`imap.gmail.com:993\` (SSL). *Requires Google 2-Step Verification and an App Password.*
- **Microsoft 365 / Outlook**: SMTP \`smtp.office365.com:587\`, IMAP \`outlook.office365.com:993\`.
- **Zoho Mail**: SMTP \`smtppro.zoho.com:465\`, IMAP \`imappro.zoho.com:993\`.
- **Custom / Self-Hosted SMTP**: Any RFC-compliant SMTP/IMAP server with secure TLS.

### Credentials Encryption
All mailbox passwords, refresh tokens, and secret keys are encrypted at rest in PostgreSQL using AES-256-GCM authenticated encryption before persisting to disk. Plaintext credentials are never logged or exposed via API endpoints.
    `
  },
  {
    id: 'dns-setup',
    title: 'DNS Setup (SPF, DKIM, DMARC, MX)',
    summary: 'Step-by-step instructions for configuring DNS records to achieve maximum deliverability.',
    content: `
Modern mail receivers (Google, Yahoo, Microsoft) enforce mandatory sender verification. Without proper DNS authentication, messages are rejected or silently sent to spam.

### 1. MX (Mail Exchange)
Routes inbound email to your server.
\`\`\`
Type: MX | Host: @ | Priority: 10 | Value: aspmx.l.google.com.
\`\`\`

### 2. SPF (Sender Policy Framework)
Authorizes specific mail servers to send on behalf of your domain.
\`\`\`
Type: TXT | Host: @ | Value: v=spf1 include:_spf.google.com ~all
\`\`\`

### 3. DKIM (DomainKeys Identified Mail)
Cryptographically signs your outbound emails to verify sender integrity.
\`\`\`
Type: TXT | Host: google._domainkey | Value: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQE...
\`\`\`

### 4. DMARC (Domain-based Message Authentication, Reporting & Conformance)
Specifies how receiving servers handle messages failing SPF or DKIM.
\`\`\`
Type: TXT | Host: _dmarc | Value: v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@yourdomain.com
\`\`\`
    `
  },
  {
    id: 'warmup-explained',
    title: 'Warmup Engine Explained',
    summary: 'Ramp tables, operational modes, 7-day deliverability health scoring, and volume constraints.',
    content: `
Our Peer-to-Peer Warmup Engine builds and maintains high sender reputation across major email providers.

### Why Is Send Volume Constrained?
Spam filters analyze sending velocity. Sending 50 cold emails from a new domain on Day 1 guarantees instant blacklisting. Our engine enforces mathematically proven deliverability ramps:

| Ramp Schedule | Mode: new_domain | Mode: new_mailbox | Mode: recovery |
|---|---|---|---|
| **Day 1** | 1 email/day | 3 emails/day | 2 emails/day |
| **Day 3** | 3 emails/day | 6 emails/day | 4 emails/day |
| **Week 2 (Day 10)** | 10 emails/day | 18 emails/day | 12 emails/day |
| **Week 4 (Day 25)** | 25 emails/day | 40 emails/day | 30 emails/day |
| **Ceiling** | 40 emails/day | 60 emails/day | 50 emails/day |

### Dynamic Safety Adjustments
- **Spam Rescue**: Warmup peers continuously scan their Spam folders. When a message lands in Spam, it is moved to Inbox, marked "Not Spam", and starred.
- **Automatic Throttle**: If your domain spam placement rate exceeds 5%, daily target volume is automatically halved. If spam rate reaches 15%, the mailbox is temporarily isolated from campaign dispatches.
- **Health Score (0–100)**: Calculated over a rolling 7-day window factoring in DNS compliance, spam rate, hard bounces, and engagement velocity.
    `
  },
  {
    id: 'campaigns-sequences',
    title: 'Campaigns & Adaptive Sequences',
    summary: 'Multi-step sequences, conditional branching, Bayesian A–Z variant auto-optimization.',
    content: `
Create targeted, automated outreach sequences with conditional follow-ups.

### Conditional Branching
Add condition rules to sequence steps:
- \`opened\`: Prospect opened the email within X hours.
- \`not_opened\`: Prospect did not open within X hours.
- \`clicked\`: Prospect clicked any trackable link.
- \`replied\`: Prospect replied to the thread.
- \`replied_positive\`: Natural language sentiment detected interest or meeting request.

Branches branch to \`on_true_step\` or \`on_false_step\` without manual enrollment intervention.

### A–Z Variant Auto-Optimization
- Deploy up to 26 message variants (A through Z) per step.
- Enrollment variant assignment is stable: prospects receive the same variant across multi-step touchpoints.
- Once a step records $\\ge 100$ sends per variant, Bayesian Beta posterior comparison ($E[\\theta] = \\frac{\\text{replies} + 1}{\\text{sends} + 2}$) shifts sending weights toward top-performing copy while guaranteeing a 5% floor for exploratory testing.
    `
  },
  {
    id: 'tracking-unsubscribe',
    title: 'Tracking & Unsubscribe Compliance',
    summary: 'Custom tracking domains, open/click telemetry, Apple Mail Privacy Protection, and opt-out headers.',
    content: `
### Custom Tracking Domains
White-label tracking links and 1x1 invisible open pixels with your own CNAME (e.g., \`track.yourdomain.com\`) to prevent third-party domain flags.

### Apple Mail Privacy Protection (MPP) Notice
In modern email ecosystems, Apple MPP pre-fetches images via proxy servers, which can inflate open rates. LeadFlow labels open metrics as **approximate** and prioritizes **Reply Rate** and **Positive Reply Sentiment** as the true measures of campaign effectiveness.

### Unsubscribe Mechanisms
- Automatic insertion of RFC 8058 \`List-Unsubscribe: <mailto:unsubscribe@yourdomain.com>, <https://yourdomain.com/unsub?token=...>\` headers.
- One-click unsubscribe links automatically add prospects to the global tenant suppression list.
    `
  },
  {
    id: 'api-reference',
    title: 'REST API Reference',
    summary: 'Complete v1 REST documentation, Bearer token authentication, rate limits, and idempotency.',
    content: `
Integrate programmatic outreach directly into your CRM, lead generation workflows, or custom internal applications.

### Authentication
All requests must include your API key in the Authorization header:
\`\`\`bash
Authorization: Bearer lf_your32characterkeyhere
\`\`\`

### Idempotency Keys
Provide the \`Idempotency-Key: <unique_uuid>\` header on any POST endpoint. If the same key is received within 24 hours, the previously computed response is returned with the \`X-Cache-Lookup: HIT\` header.

### Endpoints
- \`GET /api/outreach/v1/campaigns\` - List outreach campaigns.
- \`POST /api/outreach/v1/campaigns\` - Create a campaign in draft mode.
- \`POST /api/outreach/v1/campaigns/:id/start\` - Activate a campaign with Cap Guard pacing.
- \`POST /api/outreach/v1/campaigns/:id/enroll\` - Enroll prospects into campaign sequences.
- \`GET /api/outreach/v1/prospects\` - Search and list workspace prospects.
- \`POST /api/outreach/v1/prospects\` - Create or update a prospect.
- \`POST /api/outreach/v1/prospects/bulk\` - Bulk import prospects.
- \`POST /api/outreach/v1/verify\` - Verify an email address before sending.
- \`GET /api/outreach/v1/mailboxes\` - List active mailboxes and health scores.
- \`GET /api/outreach/v1/usage\` - Inspect monthly send quotas and plan limits.
    `,
    codeSamples: [
      {
        language: 'bash',
        label: 'cURL Example',
        code: `curl -X POST https://your-domain.com/api/outreach/v1/prospects \\
  -H "Authorization: Bearer lf_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d" \\
  -H "Idempotency-Key: 8b35e23c-75f8-4e56-b0e7-817ad9174112" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "sarah.connor@cyberdyne.io",
    "first_name": "Sarah",
    "last_name": "Connor",
    "company": "Cyberdyne Systems",
    "tags": ["enterprise", "q4-pipeline"]
  }'`
      }
    ]
  },
  {
    id: 'webhooks',
    title: 'Webhooks & Event Delivery',
    summary: 'Supported event topics, HMAC-SHA256 signature verification, and replay mechanisms.',
    content: `
Subscribe to real-time events to sync outreach activity directly with your internal database or webhook destination.

### Supported Events
- \`email.sent\`: Message dispatched through authenticated mailbox.
- \`email.opened\`: Prospect opened an outreach email.
- \`email.clicked\`: Tracked link was clicked.
- \`reply.received\`: Prospect sent a reply to the sequence.
- \`email.bounced\`: Delivery bounced (hard or soft).
- \`lead.unsubscribed\`: Prospect opted out.
- \`campaign.completed\`: All scheduled touches for the enrollment completed.

### HMAC-SHA256 Verification
Incoming deliveries contain the header \`X-LeadFlow-Signature: t=<timestamp>,v1=<signature>\`.
The signature is an HMAC-SHA256 of \`\${timestamp}.\${rawRequestBody}\` using your endpoint's signing secret.
    `,
    codeSamples: [
      {
        language: 'javascript',
        label: 'Node.js Verification Sample',
        code: `const crypto = require('crypto');

function verifyLeadFlowWebhook(rawBody, signatureHeader, secret, toleranceSec = 300) {
  const parts = signatureHeader.split(',').reduce((acc, pair) => {
    const [k, v] = pair.split('=');
    acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const timestamp = parseInt(parts['t'], 10);
  const expectedSig = parts['v1'];

  // Check timestamp drift to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSec) {
    throw new Error('Webhook signature timestamp outside acceptable tolerance.');
  }

  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex');

  const bufExpected = Buffer.from(expectedSig, 'hex');
  const bufComputed = Buffer.from(computedSig, 'hex');

  if (bufExpected.length !== bufComputed.length || !crypto.timingSafeEqual(bufExpected, bufComputed)) {
    throw new Error('Webhook signature verification failed!');
  }

  return true;
}`
      },
      {
        language: 'python',
        label: 'Python Verification Sample',
        code: `import hmac
import hashlib
import time

def verify_leadflow_webhook(raw_body: bytes, signature_header: str, secret: str, tolerance_sec: int = 300) -> bool:
    pairs = dict(item.split("=") for item in signature_header.split(","))
    timestamp = int(pairs["t"])
    expected_sig = pairs["v1"]

    if abs(int(time.time()) - timestamp) > tolerance_sec:
        raise ValueError("Timestamp outside acceptable drift window")

    payload = f"{timestamp}.".encode("utf-8") + raw_body
    computed_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig, computed_sig):
        raise ValueError("Invalid HMAC signature")

    return True`
      }
    ]
  },
  {
    id: 'mcp-server',
    title: 'Model Context Protocol (MCP)',
    summary: 'Connect Claude Desktop, Cursor, and autonomous AI agents to manage outreach via natural language.',
    content: `
LeadFlow includes a first-class Model Context Protocol (MCP) server over Streamable HTTP and SSE.

### Safe Autonomous Guardrails
- **Scheduler Pacing**: An agent can start a campaign, but emails are never blasted instantly—sends are paced by domain warmup curves and Cap Guard limits.
- **Destructive Annotations**: Sensitive tools (such as suppression management) are annotated as destructive.
- **No Critical Deletions**: No tool can delete mailboxes or raise quotas.

### Connecting Claude Desktop
Add this entry to your \`claude_desktop_config.json\`:
\`\`\`json
{
  "mcpServers": {
    "leadflow": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sse",
        "https://your-domain.com/api/outreach/mcp",
        "--header",
        "Authorization: Bearer lf_your32characterkeyhere"
      ]
    }
  }
}
\`\`\`

### Available MCP Tools
- **Read**: \`list_campaigns\`, \`get_campaign\`, \`list_prospects\`, \`list_mailboxes\`, \`get_mailbox_health\`, \`get_warmup_stats\`, \`list_suppressions\`, \`get_usage\`.
- **Write**: \`create_prospect\`, \`bulk_create_prospects\`, \`create_campaign\`, \`update_campaign\`, \`start_campaign\`, \`pause_campaign\`, \`resume_campaign\`, \`enroll_prospects\`, \`add_to_suppression_list\`, \`verify_email\`.
    `
  },
  {
    id: 'compliance',
    title: 'Deliverability & Compliance',
    summary: 'CAN-SPAM, GDPR, SOC2 deliverability standards, and technical opt-out guarantees.',
    content: `
LeadFlow is built from the ground up for strict regulatory compliance and sender protection.

### 1. CAN-SPAM Act Compliance
- Valid postal address required on every campaign template via the \`{{postal_address}}\` merge tag.
- Distinct opt-out mechanism rendered in plain text and HTML footers.
- Prohibits deceptive or misleading subject lines.

### 2. GDPR & International Privacy Standards
- Full support for Right to be Forgotten: single-click prospect deletion removes all stored metadata from the database.
- Granular consent tracking and domain suppression lists prevent accidental contact with European corporate accounts.

### 3. Receiver Policies (Google & Yahoo 2024+ Mandates)
- Enforces SPF and DKIM authentication on 100% of connected domains.
- Requires DMARC record presence.
- Maintains bounce rates strictly below 2% and spam complaint rates below 0.3%.
    `
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting & FAQs',
    summary: 'Common connection issues, DNS propagation delays, and mailbox diagnostic procedures.',
    content: `
### Mailbox Connection Test Fails (SMTP 535)
- **Cause**: Authentication rejected. Usually due to regular password being used instead of an App Password when 2-Step Verification is active.
- **Fix**: In Google Workspace, generate a 16-character App Password at \`myaccount.google.com/apppasswords\` and enter that instead of your primary password.

### Warmup Volume Is Lower Than Campaign Target
- **Cause**: Deliverability protection algorithm detected low domain age, missing DNS records, or elevated spam placement rate.
- **Fix**: Check the Mailbox Health tab. Confirm that SPF, DKIM, and DMARC have green checkmarks. The warmup engine will automatically increase send targets as domain reputation matures.

### Webhook Delivery Failed (SSRF Protection)
- **Cause**: Destination URL points to a local address (\`localhost\`, \`127.0.0.1\`, private IP, or metadata endpoint).
- **Fix**: Webhooks must point to publicly routable HTTP/HTTPS addresses (e.g. your cloud API endpoint or a service like Webhook.site).
    `
  }
];
