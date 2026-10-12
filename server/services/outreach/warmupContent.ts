import crypto from 'node:crypto';
import pg from 'pg';
import { getOutreachPool } from './schema';
import { logger } from '../../logger';
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from '../geminiService';

export interface WarmupContentItem {
  id: string;
  category: 'subject' | 'opener' | 'body' | 'reply' | 'signoff';
  text: string;
  source: 'seed' | 'gemini' | 'user';
  createdAt?: Date;
}

// ============================================================================
// 1. BUILT-IN SEED CONTENT LIBRARY (>=60 subjects, >=60 openers, >=80 bodies, >=40 replies, >=30 signoffs)
// ============================================================================

export const SEED_SUBJECTS: string[] = [
  'Quick touchpoint on the quarterly timeline',
  'Notes from our Monday architecture sync',
  'Checking in on the project milestones',
  'Thoughts on the latest design review',
  'Follow-up regarding vendor documentation',
  'Updated slide deck for Thursday discussion',
  'Quick sync on upcoming release dates',
  'Feedback on the draft proposal',
  'Reviewing the integration checklist',
  'Catching up on open action items',
  'Availability for a brief strategy call tomorrow?',
  'Summary of items discussed earlier today',
  'Reaching out regarding next sprint priorities',
  'Quick question about the workflow configuration',
  'Resource planning for the next quarter',
  'Coffee chat next week to catch up',
  'Revisiting the customer feedback notes',
  'Draft schedule for the upcoming offsite',
  'Action items from this afternoon meeting',
  'Status check on the onboarding pipeline',
  'Notes on the updated service specifications',
  'Quick heads-up about tomorrow schedule',
  'Follow-up regarding team training session',
  'Review of the vendor security questionnaire',
  'Update on the platform migration schedule',
  'Checking availability for product sync',
  'Sharing the research notes from yesterday',
  'Thoughts on the upcoming conference agenda',
  'Quick update regarding contract renewal',
  'Draft agenda for Friday team retro',
  'Feedback on the revised project scope',
  'Sync regarding infrastructure maintenance window',
  'Quick check-in on the analytics dashboard',
  'Thoughts on the updated marketing collateral',
  'Brief check regarding upcoming holiday coverage',
  'Sharing the meeting recordings and key takeaways',
  'Reviewing the proposed change request',
  'Following up on the equipment delivery status',
  'Check-in regarding the regional rollout plan',
  'Notes on the developer tooling evaluation',
  'Quick touch base on the customer support queue',
  'Reviewing our team goals for next month',
  'Update on the staging environment rollout',
  'Thoughts on optimizing our weekly review cadence',
  'Sharing the updated team roster and contacts',
  'Quick clarification on the deliverables timeline',
  'Checking in on the data export requirements',
  'Brief discussion on the pilot user feedback',
  'Summary of key takeaways from the town hall',
  'Checking status on the security audit report',
  'Follow-up on the shared cloud storage access',
  'Thoughts on streamlining our documentation',
  'Reviewing the software license renewals',
  'Quick hello and catching up after the weekend',
  'Update on the client satisfaction survey results',
  'Planning for the mid-year budget review',
  'Notes on testing scenarios for next release',
  'Brief sync on vendor evaluation criteria',
  'Checking in on the knowledge base updates',
  'Reviewing the performance testing benchmarks',
  'Quick update on the team workspace relocation',
  'Sharing the slides for next week orientation'
];

export const SEED_OPENERS: string[] = [
  'Hope you are having a productive and smooth week so far.',
  'Thanks for taking the time to connect with me earlier.',
  'Hope your day has been going well and everything is on track.',
  'Just following up on the discussion we had recently.',
  'I was reviewing our recent notes and wanted to quickly touch base.',
  'Hope you had a great weekend and are recharged for the week.',
  'Reaching out with a quick update following our team meeting.',
  'Wanted to pass along a few quick updates on my end.',
  'Hope all is well with you and the rest of the team.',
  'I wanted to touch base regarding the points we walked through yesterday.',
  'Thanks for sending over those initial insights earlier today.',
  'I appreciate your quick response on the earlier thread.',
  'Just wanted to share a few thoughts on the topic we discussed.',
  'Hope you are having a pleasant afternoon so far.',
  'Following up on our brief hallway chat before the break.',
  'Hope your week is off to a wonderful start.',
  'I was going over our checklist this morning and wanted to check in.',
  'Thanks for your patience while we consolidated the notes.',
  'Reaching out to see how things are progressing on your side.',
  'Hope you are finding some quiet time amidst the busy quarter.',
  'Just wanted to follow up on the questions that came up yesterday.',
  'I wanted to drop a quick note before the end of the day.',
  'Hope everything has been running smoothly with your recent initiatives.',
  'Thanks for keeping me in the loop on the latest developments.',
  'Reaching out to verify a few details before our next sync.',
  'Hope you enjoyed the weekend and got some well-deserved rest.',
  'Just circling back on the email thread from earlier in the week.',
  'Wanted to touch base briefly ahead of our upcoming milestone.',
  'Hope your sprint is shaping up nicely without any blockers.',
  'Thanks again for your helpful suggestions during the review.',
  'I was reflecting on our conversation and wanted to share these notes.',
  'Hope your morning is off to a great and productive start.',
  'Just checking in to make sure you have everything you need.',
  'Reaching out with a quick status report for your awareness.',
  'Hope you are having an enjoyable week despite the busy deadlines.',
  'Wanted to loop you in on a few decisions made during our sync.',
  'Thanks for collaborating on this project—it has been great working together.',
  'Just dropping a brief note to see if you have any questions.',
  'Hope things are settling down after the big launch last week.',
  'I wanted to circle back on the timeline adjustments we contemplated.',
  'Hope you are doing well and enjoying the current season.',
  'Reaching out to see if the timeline we laid out still looks reasonable.',
  'Thanks for sharing that documentation—it gave a lot of clarity.',
  'Just reaching out to verify our next steps for the upcoming cycle.',
  'Hope you had a relaxing break and are ready for the week ahead.',
  'I wanted to share a quick observation from our testing run today.',
  'Thanks for looking into this so promptly for our group.',
  'Hope your day is treating you well so far.',
  'Just writing to see if we are still aligned on the milestones.',
  'I wanted to send a quick recap of what we covered this morning.',
  'Hope you are having a productive Tuesday so far.',
  'Reaching out with a few thoughts on how we can structure next week.',
  'Thanks for putting this together and making it so easy to follow.',
  'Hope all is progressing smoothly across your workstreams.',
  'Just touching base to see if you had a chance to glance at the draft.',
  'I wanted to provide a quick heads-up on the delivery schedule.',
  'Hope your week has been treating you well and not too hectic.',
  'Reaching out to ensure we are in sync ahead of the upcoming deadline.',
  'Thanks for keeping everyone aligned across the different teams.',
  'Hope you have a fantastic rest of the day ahead.'
];

export const SEED_BODIES: string[] = [
  'I took some time this morning to walk through the latest revisions and everything looks well-aligned with our primary objectives. The overall flow makes total sense, and the key points are clearly highlighted for the stakeholders.',
  'The proposed timeline seems very feasible from our standpoint. We have already cleared the initial prerequisites, so we should be in a solid position to proceed once everyone gives the green light.',
  'Our team wrapped up the preliminary evaluation of the system requirements. Everything appears stable, though we might want to schedule a brief 10-minute check-in just to review the edge cases before final sign-off.',
  'I really liked the straightforward format you used in the updated summary. It makes the handoff process significantly simpler for both engineering and operations to follow along without ambiguity.',
  'We noticed a steady improvement in the overall workflow throughput after applying the latest adjustments. It feels like the new guidelines are already paying dividends across the active work streams.',
  'If you have five minutes later today or tomorrow, take a look at the revised draft when convenient. Let me know if you would like me to adjust any of the wording or expand on the background context.',
  'The customer feedback from the initial cohort has been mostly positive. Users particularly highlighted how much easier the interface feels compared to the previous version.',
  'Everything on our end is moving forward according to schedule. We will compile the final metrics by Thursday afternoon and share them with the wider distribution group.',
  'I reviewed the feedback from the cross-functional review group. Most of the suggestions are minor formatting and clarity tweaks, so it should not take more than an hour to incorporate them.',
  'We tested the updated configuration in staging earlier today and observed zero unexpected disruptions. That gives us great confidence as we prepare for the broader rollout next week.',
  'It looks like we are well ahead of the initial delivery estimates. Kudos to everyone involved for keeping things tidy and resolving the blockers so expeditiously.',
  'I have attached the bulleted takeaways to the internal repository so the entire team can reference them during our standup tomorrow morning.',
  'Regarding the open question about resource allocation, I think we have enough bandwidth to accommodate the additional review cycle without impacting the core target date.',
  'Please feel free to make direct edits or leave comments on the shared document if you spot anything that needs further elaboration.',
  'The consensus during yesterday discussion was that we should keep the rollout phased rather than doing everything in a single weekend. That will minimize potential downtime.',
  'We are planning to run one final regression pass on Wednesday afternoon. If that passes cleanly, we will proceed with notifying all team leads.',
  'I appreciate the thoughtful suggestions you provided on the architecture diagram. Adding the extra caching layer makes a lot of sense for high-load periods.',
  'The vendor confirmed that they can meet our required compliance standards ahead of schedule. That resolves the biggest pending dependency we had tracked.',
  'I went ahead and updated the project tracking board with the new task owners. That should give everyone clear visibility into who is driving which component.',
  'Our documentation repository is now fully up to date with the latest API changes and environment configuration steps. Let me know if any section feels incomplete.',
  'We saw great engagement on the internal demo session yesterday. It seems like the entire department is enthusiastic about adopting the improved workflow.',
  'I checked the server performance logs over the past 48 hours and resource utilization remained well within the expected thresholds even during peak hours.',
  'If there are any additional topics you would like to include on the agenda for Friday, just drop them into the shared outline before noon tomorrow.',
  'The initial benchmarks indicate an average latency reduction of roughly 35%. That is a noticeable win for the end-user experience across the board.',
  'I will be stepping away for a couple of hours in the afternoon for an offsite workshop, but I will be actively checking messages again before the end of the day.',
  'The draft slides are ready for review. I kept the technical deep dive in the appendix so the executive summary remains crisp and actionable.',
  'We are coordinating with the support desk to ensure they have the updated knowledge base articles handy when the new version goes live.',
  'Everything looks orderly and well-structured. I do not foresee any major hurdles in completing the remaining deliverables ahead of the target deadline.',
  'I made sure to capture the key action items in the meeting tracker so nothing falls through the cracks over the next couple of weeks.',
  'We tested the automated fallback mechanisms and confirmed that the system gracefully handles intermittent network latency without dropping transactions.',
  'The team agrees that keeping our communication async on this thread will save everyone time and keep all context organized in one place.',
  'I wanted to make sure you had full visibility into the upcoming maintenance schedule so you can plan your team tests accordingly.',
  'Our weekly burn-down chart looks healthy. We have successfully addressed 90% of the priority items identified at the beginning of the cycle.',
  'I followed up with the procurement team and the software license renewals have been approved. All team members should have continued uninterrupted access.',
  'Please let me know if you would like me to prepare an executive summary slide for the leadership review next Monday.',
  'We conducted a brief walkthrough with the regional stakeholders and they gave very encouraging feedback regarding the rollout timeline.',
  'The test coverage on the core business logic has increased to over 85%, which gives us much better safety nets against future regressions.',
  'I checked with operations and the staging cluster will remain reserved for our team use throughout the rest of the testing phase.',
  'Everything appears to be in solid shape on our side. We will continue monitoring the queue and reach out if any anomalies show up.',
  'The updated style guidelines have been published to the shared repository. They should make code reviews noticeably faster and more consistent.',
  'I took a pass at cleaning up the old tickets from the backlog so our active sprint view only reflects current, relevant work.',
  'We had a productive discussion about streamlining the deployment pipeline. The proposed improvements should cut down our build times by half.',
  'Let me know if you need any additional background information before your presentation tomorrow. Happy to jump in with supporting details.',
  'The feedback loop between engineering and customer success has been very effective lately. It is helping us identify user confusion much sooner.',
  'I will follow up with the platform team to make sure the SSL certificates and DNS records are scheduled for automated renewal.',
  'We added detailed inline comments to the configuration templates so that new team members can onboard without needing hand-holding.',
  'The retrospective notes highlighted that our daily standups have been very focused and concise. The team appreciated keeping them under fifteen minutes.',
  'I ran a quick sanity check on the database migrations and all foreign key constraints validated cleanly without locking active tables.',
  'We have scheduled a dry run for Thursday morning at 10 AM UTC. Please invite anyone from your team who would benefit from observing.',
  'The project timeline remains on track for the end-of-month target. We will do one more comprehensive milestone review next Tuesday.',
  'I noticed that our test suite completed twice as fast after splitting the integration specs into parallel runners. Great suggestion on that.',
  'All team members have confirmed their availability for next week sprint kickoff. We should be ready to hit the ground running.',
  'I organized the project assets into designated shared folders to ensure everyone can locate the graphics and design specs immediately.',
  'The customer onboarding checklist has been shortened to four intuitive steps, which should reduce drop-off during the initial signup flow.',
  'We verified that the error logging captures sufficient request context without logging sensitive customer credentials or personal details.',
  'I am reviewing the competitive analysis notes you shared and will add my thoughts to the document before the close of business tomorrow.',
  'The team resolved the minor caching discrepancy we saw on Friday. Cache invalidation is now happening immediately upon record mutation.',
  'We are preparing the release notes and will distribute them to the customer support team so they are familiar with the upcoming enhancements.',
  'I checked the backup restoration procedures this morning as part of our monthly routine and verified that snapshots restored within fifteen minutes.',
  'Everything looks on track for a calm and predictable release. Thanks for your continued diligence and collaboration throughout this initiative.',
  'I had a chance to test the mobile responsive layout on several different screen dimensions and the responsive behavior looks very polished.',
  'We are planning to bundle these improvements into the patch release scheduled for early next week so users can benefit without delay.',
  'I coordinated with the security team and they confirmed that our current implementation satisfies all requirements for data residency.',
  'The team morale is high following the positive launch reception. Everyone is motivated to tackle the next phase of the product roadmap.',
  'I wanted to check if you prefer receiving these status updates on a weekly or bi-weekly cadence going forward.',
  'We added automated health check endpoints that monitor downstream dependencies and alert our on-call rotation if latency spikes.',
  'The revised onboarding flow has already demonstrated an increase in day-one task completion among our beta user cohort.',
  'I verified that our rate limiting parameters are properly calibrated so that normal user traffic is never inadvertently throttled.',
  'We are wrapping up the remaining UI polish items today and should have a clean build ready for quality assurance testing by morning.',
  'I reviewed the analytics reports from last week and user retention showed a steady 12% improvement across our active customer accounts.',
  'The database indexing adjustments we deployed yesterday have significantly lowered CPU utilization across the primary read replicas.',
  'I will keep this email thread updated as we hit the remaining checkpoints over the course of the week.',
  'We documented the common troubleshooting steps in the internal wiki so team members can resolve environment quirks independently.',
  'The feedback from the UX review was largely constructive, focusing on micro-interactions and button labeling for accessibility.',
  'I scheduled a brief 15-minute sync with the design leads to finalize the typography tokens before we start building the new views.',
  'We verified that our automated rollback scripts execute cleanly in the event of an unexpected validation error in production.',
  'I checked with the finance department and the budget allocation for our infrastructure upgrade has been fully signed off.',
  'The team completed the code refactoring for the notification service, making it significantly easier to plug in alternative channels.',
  'I will send out a brief calendar invite for our wrap-up demo once the final QA round confirms everything is green.',
  'Everything is proceeding very smoothly and we are looking forward to delivering these improvements to our end users.'
];

export const SEED_REPLIES: string[] = [
  'Thanks for the detailed update! Everything makes complete sense to me.',
  'Got it, thanks for confirming! I will review the notes and follow up if any questions arise.',
  'Appreciate the quick response! Looks like we are completely on track.',
  'Thanks for keeping me in the loop. The proposed timeline works very well on my side.',
  'Understood! I will check the shared doc shortly and leave any comments directly.',
  'Thanks for the clarification! That resolves the questions I had earlier.',
  'Sounds like a solid plan. Let me know if you need any assistance on my end.',
  'Appreciate the heads-up! I will inform my team during our morning standup.',
  'Great news, thank you! Glad to hear the staging tests passed without issues.',
  'Thanks for sending this over! The layout and points look very clean.',
  'Acknowledged! I will mark this task as completed on our project board.',
  'Thanks for following up so promptly. We are good to proceed with the next step.',
  'Makes total sense. Thanks for walking through the reasoning behind the change.',
  'Received with thanks! I will take a look this evening and circle back.',
  'Thank you for the helpful context! Looking forward to reviewing the final draft.',
  'Sounds great! Let us sync briefly tomorrow if anything else comes up.',
  'Appreciate the thoughtful feedback! We will incorporate those edits right away.',
  'Understood, and thanks for verifying! We will keep moving along this path.',
  'Thanks for checking in! Everything is looking smooth on our end as well.',
  'Got your note! I will make sure our group is aligned with the new date.',
  'Thanks for flagging this! We will adjust our schedule accordingly.',
  'Appreciate the quick turnaround! Everything looks great to me.',
  'Thank you! That clears up the minor ambiguity we were discussing.',
  'Perfect, thanks for taking care of this! Great teamwork all around.',
  'Received! I will review the attached summary before our afternoon sync.',
  'Thanks for following up! We are aligned and ready for the next milestone.',
  'Got it, thank you! I will update our stakeholders on the progress.',
  'Appreciate your guidance on this! The new approach is much cleaner.',
  'Understood completely. Thanks for keeping our communication organized.',
  'Thank you for the quick verification! We will proceed as planned.',
  'Sounds very good. I will check back in once our review is finished.',
  'Thanks for the thorough summary! It saves everyone a lot of time.',
  'Got it! Looking forward to seeing the final results in our demo.',
  'Appreciate your help with this item! Everything looks in great shape.',
  'Thanks for the update! Have a wonderful rest of your day.',
  'Received with gratitude! Let us touch base again next week.',
  'Understood, thanks! We will follow up if any edge cases appear.',
  'Thanks for confirming the details so quickly! Much appreciated.',
  'Got your message! I will keep you posted as our phase wraps up.',
  'Appreciate the clear explanation! We are completely in agreement.'
];

export const SEED_SIGNOFFS: string[] = [
  'Best regards,',
  'Warm regards,',
  'Cheers,',
  'Kind regards,',
  'Thanks again,',
  'Best,',
  'With appreciation,',
  'Sincerely,',
  'Talk soon,',
  'Have a wonderful day,',
  'All the best,',
  'Warmly,',
  'Many thanks,',
  'Have a great week ahead,',
  'Respectfully,',
  'Wishing you the best,',
  'Until next time,',
  'Take care,',
  'Speak soon,',
  'Looking forward to catching up,',
  'In partnership,',
  'With gratitude,',
  'Cordially,',
  'Best wishes,',
  'Have a great evening,',
  'Catch you later,',
  'Warmest regards,',
  'Thanks and best regards,',
  'Enjoy the rest of your week,',
  'Stay well,'
];

// Spammy trigger words to blacklist during validation
const SPAMMY_WORDS_BLACKLIST = [
  'free money', 'crypto', 'bitcoin', 'viagra', 'cialis', 'guaranteed cash',
  'act now', '100% free', 'urgent wire', 'cash prize', 'lottery', 'winner',
  'earn extra cash', 'work from home fast', 'no credit check', 'casino',
  'make millions', 'double your income', 'unsecured loan', 'claim your prize'
];

/**
 * Validates a generated warmup text item for length, no links, and no spammy words.
 */
export function validateWarmupContentItem(
  category: 'subject' | 'opener' | 'body' | 'reply' | 'signoff',
  text: string
): { valid: boolean; reason?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, reason: 'Text must be a non-empty string' };
  }

  const trimmed = text.trim();
  if (trimmed.length < 3) {
    return { valid: false, reason: 'Text is too short' };
  }

  // Maximum lengths per category
  const maxLengths: Record<string, number> = {
    subject: 120,
    opener: 250,
    body: 1000,
    reply: 300,
    signoff: 60
  };

  const limit = maxLengths[category] || 500;
  if (trimmed.length > limit) {
    return { valid: false, reason: `Text exceeds maximum length of ${limit} characters for ${category}` };
  }

  // Strictly NO links (http, https, www, .com/, bit.ly)
  const linkRegex = /(https?:\/\/|www\.|\.com\/|\.org\/|\.net\/|\.io\/|bit\.ly)/i;
  if (linkRegex.test(trimmed)) {
    return { valid: false, reason: 'Warmup content must not contain links or URLs' };
  }

  // Strictly NO spammy words
  const lower = trimmed.toLowerCase();
  for (const spamWord of SPAMMY_WORDS_BLACKLIST) {
    if (lower.includes(spamWord)) {
      return { valid: false, reason: `Text contains prohibited spam word: "${spamWord}"` };
    }
  }

  return { valid: true };
}

/**
 * Random item picker helper
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Loads content pool combining built-in code arrays and DB ox_warmup_content table.
 */
export async function getWarmupContentPool(pool?: pg.Pool | null): Promise<{
  subjects: string[];
  openers: string[];
  bodies: string[];
  replies: string[];
  signoffs: string[];
}> {
  const subjects = [...SEED_SUBJECTS];
  const openers = [...SEED_OPENERS];
  const bodies = [...SEED_BODIES];
  const replies = [...SEED_REPLIES];
  const signoffs = [...SEED_SIGNOFFS];

  const dbPool = pool || getOutreachPool();
  if (dbPool) {
    try {
      const res = await dbPool.query(
        `SELECT category, text FROM ox_warmup_content WHERE is_active = true`
      );
      for (const row of res.rows) {
        if (row.category === 'subject') subjects.push(row.text);
        else if (row.category === 'opener') openers.push(row.text);
        else if (row.category === 'body') bodies.push(row.text);
        else if (row.category === 'reply') replies.push(row.text);
        else if (row.category === 'signoff') signoffs.push(row.text);
      }
    } catch (err: any) {
      // ox_warmup_content table might not exist yet during initial boot
      logger.debug('Warmup content DB query fallback to seed: ' + err?.message);
    }
  }

  return { subjects, openers, bodies, replies, signoffs };
}

/**
 * Assembles a random non-repetitive warmup email message.
 */
export async function assembleWarmupMessage(
  recipientName?: string,
  pool?: pg.Pool | null
): Promise<{
  subject: string;
  bodyText: string;
  bodyHtml: string;
}> {
  const content = await getWarmupContentPool(pool);

  const subject = pickRandom(content.subjects);
  const opener = pickRandom(content.openers);
  const body = pickRandom(content.bodies);
  const signoff = pickRandom(content.signoffs);

  const greeting = recipientName ? `Hi ${recipientName.split(' ')[0]},` : 'Hi there,';

  const bodyText = `${greeting}\n\n${opener}\n\n${body}\n\n${signoff}`;
  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">
      <p style="margin: 0 0 16px 0;">${greeting}</p>
      <p style="margin: 0 0 16px 0;">${opener}</p>
      <p style="margin: 0 0 16px 0;">${body}</p>
      <p style="margin: 16px 0 0 0; color: #475569;">${signoff}</p>
    </div>
  `.trim();

  return { subject, bodyText, bodyHtml };
}

/**
 * Assembles a random warmup thread reply message.
 */
export async function assembleWarmupReply(
  parentSubject: string,
  recipientName?: string,
  pool?: pg.Pool | null
): Promise<{
  subject: string;
  bodyText: string;
  bodyHtml: string;
}> {
  const content = await getWarmupContentPool(pool);

  const reply = pickRandom(content.replies);
  const signoff = pickRandom(content.signoffs);
  const greeting = recipientName ? `Hi ${recipientName.split(' ')[0]},` : 'Hi,';

  const cleanSubject = parentSubject.startsWith('Re:') ? parentSubject : `Re: ${parentSubject}`;
  const bodyText = `${greeting}\n\n${reply}\n\n${signoff}`;
  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">
      <p style="margin: 0 0 14px 0;">${greeting}</p>
      <p style="margin: 0 0 14px 0;">${reply}</p>
      <p style="margin: 14px 0 0 0; color: #475569;">${signoff}</p>
    </div>
  `.trim();

  return { subject: cleanSubject, bodyText, bodyHtml };
}

/**
 * Admin-only: Requests Gemini (gemini-3.8-flash) to generate 100 varied warmup items,
 * validates each one (length, no links, no spam words), and appends to ox_warmup_content.
 */
export async function generateContentWithGemini(
  pool?: pg.Pool | null
): Promise<{
  generatedCount: number;
  addedCount: number;
  items: WarmupContentItem[];
  errors: string[];
}> {
  const gemini = getGeminiClient();
  if (!gemini) {
    throw new Error('Gemini API client is not configured (GEMINI_API_KEY required).');
  }

  const prompt = `You are an expert copywriter for professional business correspondence.
Generate exactly 100 diverse, realistic, polite, everyday business email snippets across 5 categories:
- 20 'subject' items: realistic business subjects (e.g. project timelines, design reviews, standup syncs, feedback). Max 80 characters.
- 20 'opener' items: friendly professional email openers. Max 150 characters.
- 30 'body' items: short professional body paragraphs (2-4 sentences) discussing everyday team operations, product testing, roadmaps, and scheduling. Max 400 characters.
- 20 'reply' items: realistic conversational replies acknowledging prior messages. Max 150 characters.
- 10 'signoff' items: professional email sign-offs. Max 40 characters.

STRICT CONSTRAINTS:
1. Absolutely NO web links, URLs, domain names, or email addresses.
2. Absolutely NO spam triggers (no "crypto", "free money", "winner", "urgent wire", "lottery", "cash", "act now").
3. Everyday corporate and casual business tone only.
4. Output MUST be a valid JSON array of objects with keys: "category" and "text".
Example:
[
  {"category": "subject", "text": "Draft roadmap notes for next quarter"},
  {"category": "opener", "text": "Hope you are having a productive week so far."},
  {"category": "body", "text": "Our team finished testing the staging deployment and everything looks stable. We will proceed with the rollout schedule tomorrow."},
  {"category": "reply", "text": "Thanks for confirming! That works well on my end."},
  {"category": "signoff", "text": "Best regards,"}
]`;

  const response = await gemini.models.generateContent({
    model: DEFAULT_GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  });

  const rawText = response.text || '';
  let parsedItems: any[] = [];
  try {
    parsedItems = JSON.parse(rawText);
    if (!Array.isArray(parsedItems)) {
      throw new Error('Gemini response did not return a JSON array');
    }
  } catch (err: any) {
    logger.error('Failed to parse Gemini warmup content JSON: ' + err?.message, {
      context: 'WarmupContent'
    });
    throw new Error('Failed to parse Gemini generated content JSON: ' + err?.message);
  }

  const targetPool = pool || getOutreachPool();
  if (!targetPool) {
    throw new Error('PostgreSQL database pool is unavailable.');
  }

  const client = await targetPool.connect();
  const addedItems: WarmupContentItem[] = [];
  const errors: string[] = [];

  try {
    await client.query('BEGIN');

    for (const item of parsedItems) {
      const category = String(item.category || '').toLowerCase() as any;
      const text = String(item.text || '').trim();

      if (!['subject', 'opener', 'body', 'reply', 'signoff'].includes(category)) {
        errors.push(`Invalid category "${category}"`);
        continue;
      }

      const validation = validateWarmupContentItem(category, text);
      if (!validation.valid) {
        errors.push(`Validation failed for "${text.slice(0, 30)}...": ${validation.reason}`);
        continue;
      }

      const id = `wc_${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO ox_warmup_content (id, category, text, source, is_active, created_at)
         VALUES ($1, $2, $3, 'gemini', true, NOW())`,
        [id, category, text]
      );

      addedItems.push({
        id,
        category,
        text,
        source: 'gemini'
      });
    }

    await client.query('COMMIT');

    logger.info(`Gemini generated ${parsedItems.length} items; added ${addedItems.length} to ox_warmup_content`, {
      context: 'WarmupContent'
    });

    return {
      generatedCount: parsedItems.length,
      addedCount: addedItems.length,
      items: addedItems,
      errors
    };
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
