import { logger } from '../../logger';

export interface SpamCheckIssue {
  id: string;
  type:
    | 'spam_words'
    | 'all_caps'
    | 'exclamation_count'
    | 'link_count'
    | 'image_only'
    | 'missing_plain_text'
    | 'broken_merge_tags'
    | 'url_shorteners';
  severity: 'high' | 'medium' | 'low';
  message: string;
  matched?: string[];
}

export interface SpamCheckResult {
  score: number; // 0 to 100, where 100 is pristine
  grade: 'A+' | 'A' | 'B' | 'C' | 'Risky';
  issues: SpamCheckIssue[];
  fixes: string[];
  highlights: string[]; // Specific words or tokens to highlight in the UI editor
  details: {
    wordCount: number;
    allCapsRatio: number;
    exclamationCount: number;
    linkCount: number;
    hasImageOnly: boolean;
    missingPlainText: boolean;
    brokenMergeTags: string[];
    urlShorteners: string[];
    spamWords: string[];
  };
}

// 1. Curated cold email and promotional spam trigger words/phrases
export const SPAM_TRIGGER_WORDS = [
  '100% free',
  'free trial',
  'free gift',
  'guarantee',
  'guaranteed',
  'risk-free',
  'no risk',
  'risk free',
  'act now',
  'buy now',
  'order now',
  'urgent',
  'limited time',
  'exclusive deal',
  'lowest price',
  'special promotion',
  'save big',
  'save money',
  'make money',
  'cash bonus',
  'extra cash',
  'double your income',
  'earn per week',
  'million dollars',
  'pure profit',
  'credit card',
  'no credit card',
  'click here',
  'click below',
  'congratulations',
  'winner',
  'you have been selected',
  'claim your prize',
  'once in a lifetime',
  'unlimited leads',
  'work from home',
  'be your own boss',
  'no catch',
  'no obligation',
  'apply now',
  'call now',
  'this isn\'t spam',
  'not spam',
  'pre-approved',
  'wire transfer',
  'casino',
  'crypto giveaway'
];

// 2. URL Shortener domains heavily penalized by spam algorithms
export const URL_SHORTENER_DOMAINS = [
  'bit.ly',
  'tinyurl.com',
  'ow.ly',
  't.co',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  'rb.gy',
  'goo.gl',
  'rebrand.ly',
  'shorturl.at',
  'tiny.cc'
];

/**
 * Local rules engine for cold email spam scoring and deliverability audit.
 */
export function analyzeEmailSpamScore(input: {
  subject?: string;
  body?: string;
  html?: string;
  text?: string;
  emailCopy?: string;
}): SpamCheckResult {
  const subject = (input.subject || '').trim();
  const rawBody = (input.emailCopy || input.body || input.text || input.html || '').trim();
  const htmlContent = input.html || (rawBody.includes('<') && rawBody.includes('>') ? rawBody : '');
  const textContent = input.text || (htmlContent ? htmlContent.replace(/<[^>]*>/g, ' ') : rawBody);
  const fullText = `${subject} ${textContent}`.trim();

  const issues: SpamCheckIssue[] = [];
  const fixes: string[] = [];
  const highlights: string[] = [];

  let penalty = 0;

  // RULE 1: Spam Trigger Words
  const lowerText = fullText.toLowerCase();
  const detectedSpamWords: string[] = [];

  for (const trigger of SPAM_TRIGGER_WORDS) {
    // Word boundary check (escaped for regex)
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lowerText)) {
      detectedSpamWords.push(trigger);
      highlights.push(trigger);
    }
  }

  if (detectedSpamWords.length > 0) {
    const wordPenalty = Math.min(40, detectedSpamWords.length * 10);
    penalty += wordPenalty;
    issues.push({
      id: 'spam_words',
      type: 'spam_words',
      severity: detectedSpamWords.length >= 3 ? 'high' : 'medium',
      message: `Detected ${detectedSpamWords.length} spam-trigger keyword(s): ${detectedSpamWords.map(w => `"${w}"`).join(', ')}.`,
      matched: detectedSpamWords
    });
    fixes.push(`Replace promotional buzzwords (${detectedSpamWords.slice(0, 3).join(', ')}) with conversational peers.`);
  }

  // RULE 2: ALL CAPS Ratio
  const alphabeticChars = fullText.replace(/[^a-zA-Z]/g, '');
  const upperChars = alphabeticChars.replace(/[^A-Z]/g, '');
  const allCapsRatio = alphabeticChars.length > 10 ? upperChars.length / alphabeticChars.length : 0;

  if (allCapsRatio > 0.15) {
    const capsPenalty = allCapsRatio > 0.35 ? 25 : 15;
    penalty += capsPenalty;
    issues.push({
      id: 'all_caps',
      type: 'all_caps',
      severity: allCapsRatio > 0.35 ? 'high' : 'medium',
      message: `High ALL-CAPS ratio (${Math.round(allCapsRatio * 100)}%). Spam filters flag messages that shout in capital letters.`
    });
    fixes.push('Convert uppercase words and headings into natural sentence case.');
  }

  // RULE 3: Exclamation Count
  const exclamationMatches = fullText.match(/!/g) || [];
  const exclamationCount = exclamationMatches.length;
  const hasConsecutiveExclamation = /!{2,}/.test(fullText);

  if (exclamationCount > 2 || hasConsecutiveExclamation) {
    const excPenalty = hasConsecutiveExclamation ? 15 : 10;
    penalty += excPenalty;
    issues.push({
      id: 'exclamation_count',
      type: 'exclamation_count',
      severity: hasConsecutiveExclamation ? 'high' : 'medium',
      message: hasConsecutiveExclamation
        ? 'Consecutive exclamation marks detected ("!!"). Highly penalized by email gateways.'
        : `Found ${exclamationCount} exclamation marks. Executive cold emails should keep exclamation marks to <= 1.`
    });
    fixes.push('Remove multiple exclamation marks and stick to professional standard punctuation.');
  }

  // RULE 4: Link Count
  const urlRegex = /https?:\/\/[^\s<>"']+/gi;
  const rawUrls = fullText.match(urlRegex) || [];
  const hrefMatches = (htmlContent.match(/href=["'][^"']+["']/gi) || []);
  const linkCount = Math.max(rawUrls.length, hrefMatches.length);

  if (linkCount > 3) {
    const linkPenalty = linkCount > 5 ? 20 : 10;
    penalty += linkPenalty;
    issues.push({
      id: 'link_count',
      type: 'link_count',
      severity: linkCount > 5 ? 'high' : 'medium',
      message: `Too many links detected (${linkCount} links). Cold emails with more than 1-2 links trigger promotional or spam folder placement.`
    });
    fixes.push('Reduce email hyperlinks to a single clear, relevant call-to-action link.');
  }

  // RULE 5: URL Shorteners
  const detectedShorteners: string[] = [];
  for (const shortener of URL_SHORTENER_DOMAINS) {
    if (lowerText.includes(shortener)) {
      detectedShorteners.push(shortener);
      highlights.push(shortener);
    }
  }

  if (detectedShorteners.length > 0) {
    penalty += Math.min(40, detectedShorteners.length * 20);
    issues.push({
      id: 'url_shorteners',
      type: 'url_shorteners',
      severity: 'high',
      message: `URL shortener detected (${detectedShorteners.join(', ')}). Anti-spam filters (Proofpoint, Gmail, Outlook) block redirect shorteners as security risks.`,
      matched: detectedShorteners
    });
    fixes.push('Use your verified root domain link rather than URL shorteners like bit.ly.');
  }

  // RULE 6: Image-Only / Image-Heavy Email Check
  const words = textContent.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const hasImage = /<img\b|!\[[^\]]*\]\([^)]+\)/i.test(rawBody);
  const hasImageOnly = hasImage && wordCount < 25;

  if (hasImageOnly) {
    penalty += 30;
    issues.push({
      id: 'image_only',
      type: 'image_only',
      severity: 'high',
      message: 'Image-only or image-heavy message with very little text. Major spam filters block graphic-only cold outreach.'
    });
    fixes.push('Include at least 50–90 words of readable plain-text copy alongside any image assets.');
  }

  // RULE 7: Missing Plain-Text Part (when HTML is provided)
  const isHtml = /<[a-z][\s\S]*>/i.test(rawBody);
  const missingPlainText = isHtml && (!input.text || input.text.trim().length === 0);

  if (missingPlainText && isHtml) {
    penalty += 15;
    issues.push({
      id: 'missing_plain_text',
      type: 'missing_plain_text',
      severity: 'medium',
      message: 'HTML template provided without a corresponding multipart plain-text version.'
    });
    fixes.push('Ensure a clean plain-text fallback part is generated for email clients that disallow HTML.');
  }

  // RULE 8: Broken Merge Tags
  const brokenTags: string[] = [];
  // Detect unclosed {{
  const unclosedMatch = rawBody.match(/\{\{[a-zA-Z0-9_]+(?!\}\})/g);
  if (unclosedMatch) brokenTags.push(...unclosedMatch);
  // Detect single braces like {first_name} when template expects {{first_name}}
  const singleBraceMatch = rawBody.match(/(?<!\{)\{[a-zA-Z0-9_]+\}(?!\})/g);
  if (singleBraceMatch) brokenTags.push(...singleBraceMatch);
  // Detect empty tags like {{}}
  if (rawBody.includes('{{}}')) brokenTags.push('{{}}');

  if (brokenTags.length > 0) {
    penalty += 20;
    issues.push({
      id: 'broken_merge_tags',
      type: 'broken_merge_tags',
      severity: 'high',
      message: `Broken or mismatched merge tag syntax detected: ${brokenTags.join(', ')}.`,
      matched: brokenTags
    });
    fixes.push('Verify all variable placeholders are properly closed using double braces (e.g. {{first_name}}).');
  }

  // Calculate Final Score
  const rawScore = 100 - penalty;
  const score = Math.max(0, Math.min(100, rawScore));

  let grade: 'A+' | 'A' | 'B' | 'C' | 'Risky' = 'A+';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 65) grade = 'B';
  else if (score >= 45) grade = 'C';
  else grade = 'Risky';

  if (fixes.length === 0) {
    fixes.push('Copy is clean and conversational. Deliverability checks passed.');
  }

  return {
    score,
    grade,
    issues,
    fixes,
    highlights: Array.from(new Set(highlights)),
    details: {
      wordCount,
      allCapsRatio: Math.round(allCapsRatio * 100) / 100,
      exclamationCount,
      linkCount,
      hasImageOnly,
      missingPlainText,
      brokenMergeTags: brokenTags,
      urlShorteners: detectedShorteners,
      spamWords: detectedSpamWords
    }
  };
}
