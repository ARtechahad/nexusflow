import crypto from 'node:crypto';

export interface RenderContext {
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

export interface RenderResult {
  text: string;
  errors: string[];
}

/**
 * Deterministic pseudo-random number generator seeded with an integer.
 * Produces float in [0, 1).
 */
function createSeededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Converts a string seed (e.g. enrollment_id or prospect_id) into a 32-bit positive integer.
 */
function stringToSeed(str?: string): number {
  if (!str) return 42;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * Resolves nested spintax patterns like `{Hello|Hi|Hey {there|friend}}`.
 * Uses a seeded PRNG so that retries with the same seed produce exactly the same text.
 * Ignores double-brace merge tags `{{...}}`.
 */
export function resolveSpintax(template: string, seedString?: string): string {
  if (!template) return '';
  const rng = createSeededRandom(stringToSeed(seedString));

  // Step 1: Temporarily mask double-brace merge tags so their inner pipes don't get eaten
  const preservedTags: string[] = [];
  let masked = template.replace(/\{\{[^}]+\}\}/g, (match) => {
    preservedTags.push(match);
    return `___OX_MERGE_TAG_${preservedTags.length - 1}___`;
  });

  // Step 2: Resolves innermost {option1|option2|...} iteratively
  const innerSpintaxRegex = /\{([^{}]+)\}/g;
  let hasMatch = true;
  let safetyLoop = 0;

  while (hasMatch && safetyLoop < 50) {
    safetyLoop++;
    hasMatch = false;

    masked = masked.replace(innerSpintaxRegex, (_match, group) => {
      hasMatch = true;
      const options = group.split('|');
      if (options.length === 0) return '';
      const chosenIndex = Math.floor(rng() * options.length);
      return options[chosenIndex] !== undefined ? options[chosenIndex] : options[0];
    });
  }

  // Step 3: Restore preserved merge tags
  return masked.replace(/___OX_MERGE_TAG_(\d+)___/g, (_match, indexStr) => {
    return preservedTags[parseInt(indexStr, 10)] ?? '';
  });
}

/**
 * Known supported standard merge tag keys in lowercase.
 */
const STANDARD_KEYS = new Set([
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'name',
  'full_name',
  'fullname',
  'company',
  'company_name',
  'title',
  'job_title',
  'email',
  'phone',
  'website',
  'sender_name',
  'sender_email',
  'unsubscribe_url',
  'postal_address'
]);

/**
 * Validates template for unknown merge tags and syntax issues.
 * Returns a list of error descriptions.
 */
export function validateTemplate(template: string, knownCustomFields: string[] = []): string[] {
  if (!template) return [];
  const errors: string[] = [];

  const validKeys = new Set([...STANDARD_KEYS, ...knownCustomFields.map((k) => k.toLowerCase())]);

  // Find all merge tags {{tag}} or {{tag|fallback}}
  const tagRegex = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(template)) !== null) {
    const rawInner = match[1].trim();
    if (!rawInner) {
      errors.push(`Empty merge tag {{}} found`);
      continue;
    }

    const parts = rawInner.split('|');
    const tagName = parts[0].trim().toLowerCase();

    if (!validKeys.has(tagName)) {
      errors.push(`Unknown merge tag: "{{${parts[0].trim()}}}"`);
    }
  }

  // Check for mismatched braces in spintax
  let braceCount = 0;
  for (let i = 0; i < template.length; i++) {
    if (template[i] === '{' && template[i + 1] !== '{') {
      braceCount++;
    } else if (template[i] === '}' && template[i - 1] !== '}') {
      braceCount--;
    }
    if (braceCount < 0) {
      errors.push('Mismatched closing brace "}" in spintax');
      break;
    }
  }
  if (braceCount > 0) {
    errors.push('Unclosed opening brace "{" in spintax');
  }

  return errors;
}

/**
 * Renders merge tags in the template with prospect data and fallbacks:
 * e.g. {{first_name|there}} -> "John" or "there"
 * If an unknown tag has no value and no fallback, records an error and leaves empty string.
 */
export function renderMergeTags(
  template: string,
  context: RenderContext,
  allowUnknownFallback = true
): RenderResult {
  if (!template) return { text: '', errors: [] };

  const errors: string[] = [];

  // Flatten and lower-case lookup map
  const normalizedContext: Record<string, string> = {};
  for (const [k, v] of Object.entries(context)) {
    if (v !== undefined && v !== null) {
      normalizedContext[k.toLowerCase()] = String(v);
    }
  }

  // Aliases for common variations
  if (normalizedContext.first_name && !normalizedContext.firstname) {
    normalizedContext.firstname = normalizedContext.first_name;
  }
  if (normalizedContext.last_name && !normalizedContext.lastname) {
    normalizedContext.lastname = normalizedContext.last_name;
  }
  if (normalizedContext.first_name || normalizedContext.last_name) {
    const full = `${normalizedContext.first_name || ''} ${normalizedContext.last_name || ''}`.trim();
    if (!normalizedContext.full_name) normalizedContext.full_name = full;
    if (!normalizedContext.name) normalizedContext.name = full;
  }

  const rendered = template.replace(/\{\{([^}]+)\}\}/g, (_fullMatch, inner) => {
    const trimmed = inner.trim();
    const parts = trimmed.split('|');
    const key = parts[0].trim();
    const fallback = parts.length > 1 ? parts.slice(1).join('|').trim() : undefined;
    const keyLower = key.toLowerCase();

    // Check if key exists in context
    if (normalizedContext[keyLower] !== undefined && normalizedContext[keyLower] !== '') {
      return normalizedContext[keyLower];
    }

    // Use fallback if provided
    if (fallback !== undefined) {
      return fallback;
    }

    // Unknown or missing tag without fallback
    if (!STANDARD_KEYS.has(keyLower)) {
      errors.push(`Missing value for unknown merge tag: "{{${key}}}"`);
    } else {
      errors.push(`Missing value for merge tag: "{{${key}}}"`);
    }

    return allowUnknownFallback ? '' : _fullMatch;
  });

  return { text: rendered, errors };
}

/**
 * Full template compilation pipeline:
 * 1. Spintax resolution seeded by enrollment ID
 * 2. Merge tag substitution with fallbacks
 */
export function renderEmailTemplate(
  template: string,
  context: RenderContext,
  seedString?: string
): RenderResult {
  if (!template) return { text: '', errors: [] };

  // Step 1: Spintax first so that spintax can contain merge tags if needed
  const afterSpintax = resolveSpintax(template, seedString);

  // Step 2: Merge tags
  const afterTags = renderMergeTags(afterSpintax, context);

  return afterTags;
}
