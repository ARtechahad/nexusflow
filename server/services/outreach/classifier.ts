import { getGeminiClient, DEFAULT_GEMINI_MODEL } from '../geminiService';
import { logger } from '../../logger';

export type OutreachReplyLabel =
  | 'interested'
  | 'not_interested'
  | 'question'
  | 'out_of_office'
  | 'unsubscribe'
  | 'wrong_person';

export interface ClassificationResult {
  label: OutreachReplyLabel;
  confidence: number;
  reason: string;
  source: 'gemini' | 'rules';
}

/**
 * Deterministic fast keyword / regex fallback classifier.
 * Evaluates in priority order: Unsubscribe -> Out of Office -> Wrong Person -> Not Interested -> Interested -> Question.
 */
export function classifyReplyWithRules(body: string, subject: string = ''): ClassificationResult {
  const combined = `${subject} \n ${body}`.toLowerCase();

  // 1. Explicit Unsubscribe / Removal
  if (
    /unsubscribe|remove me|opt[ -]?out|stop emailing|take me off|do not contact|don't contact|please delete my|remove my email/i.test(combined)
  ) {
    return {
      label: 'unsubscribe',
      confidence: 0.95,
      reason: 'Matched explicit unsubscribe / removal keyword pattern',
      source: 'rules'
    };
  }

  // 2. Out of Office / Vacation / Auto-reply
  if (
    /out of (the )?office|on vacation|annual leave|maternity leave|paternity leave|away from (my|the) desk|returning on|back on|auto-?reply|automatic reply/i.test(
      combined
    )
  ) {
    return {
      label: 'out_of_office',
      confidence: 0.95,
      reason: 'Matched out-of-office / automated absence phrasing',
      source: 'rules'
    };
  }

  // 3. Wrong Person / Referral
  if (
    /wrong person|no longer with|no longer work|left the company|not the right (person|contact)|reach out to|contact.*instead|looping in|speak with/i.test(
      combined
    )
  ) {
    return {
      label: 'wrong_person',
      confidence: 0.9,
      reason: 'Indicates wrong contact or directs to another colleague',
      source: 'rules'
    };
  }

  // 4. Not Interested / Hard Rejection
  if (
    /not interested|no thanks|pass on this|we('re| are) good|don't need|do not need|not looking|already have a solution|not at this time|no budget/i.test(
      combined
    )
  ) {
    return {
      label: 'not_interested',
      confidence: 0.9,
      reason: 'Polite or explicit decline / lack of interest',
      source: 'rules'
    };
  }

  // 5. Positive / Interested / Meeting Request
  if (
    /interested|sounds (good|great|interesting)|let's chat|let's connect|hop on a call|book a time|send (over )?a (deck|quote|proposal|pricing)|free (next|this) week|calendar link|grab 15 minutes|schedule time|set up a demo/i.test(
      combined
    )
  ) {
    return {
      label: 'interested',
      confidence: 0.9,
      reason: 'Positive buying sentiment or interest in discussing further',
      source: 'rules'
    };
  }

  // 6. Question / Inquiring for Details
  if (
    /\?|how much|what (are|is|does|about)|cost|pricing|portfolio|case studies|how does this work|do you support|tell me more/i.test(
      combined
    )
  ) {
    return {
      label: 'question',
      confidence: 0.85,
      reason: 'Contains clarifying questions regarding features or pricing',
      source: 'rules'
    };
  }

  // Default fallback for short messages
  return {
    label: 'question',
    confidence: 0.6,
    reason: 'Inbound response requiring operator review',
    source: 'rules'
  };
}

/**
 * Classifies an inbound reply using Gemini AI with fallback to keyword rules.
 */
export async function classifyInboundReply(params: {
  subject: string;
  bodyText: string;
  senderEmail?: string;
}): Promise<ClassificationResult> {
  const { subject, bodyText } = params;

  // Run rules first to check high-confidence unsubscription
  const quickRule = classifyReplyWithRules(bodyText, subject);
  if (quickRule.label === 'unsubscribe') {
    return quickRule;
  }

  const ai = getGeminiClient();
  if (!ai) {
    return quickRule;
  }

  try {
    const prompt = `You are an enterprise sales reply classification engine.
Analyze this inbound email response to a cold outreach campaign and classify it into EXACTLY ONE category:
- "interested": Positive sentiment, wants to talk, open to a demo, asks for meeting/call, wants pricing/deck.
- "not_interested": Declined, not interested, no budget, already using competitor, pass.
- "question": Asking clarifying questions about product, security, integrations, capabilities.
- "out_of_office": Away on vacation, medical/paternity leave, return date mentioned.
- "unsubscribe": Wants to be removed, opted out, stop emailing, do not contact.
- "wrong_person": Referral to colleague, no longer works there, wrong department.

Subject: ${subject}
Message Body:
"""
${bodyText.slice(0, 2000)}
"""

Respond ONLY with valid JSON in this format:
{
  "label": "interested" | "not_interested" | "question" | "out_of_office" | "unsubscribe" | "wrong_person",
  "confidence": 0.95,
  "reason": "1-sentence rationale"
}`;

    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const rawJson = response.text?.trim() || '';
    const parsed = JSON.parse(rawJson);

    const validLabels: OutreachReplyLabel[] = [
      'interested',
      'not_interested',
      'question',
      'out_of_office',
      'unsubscribe',
      'wrong_person'
    ];

    if (validLabels.includes(parsed.label)) {
      return {
        label: parsed.label,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
        reason: parsed.reason || 'Classified by Gemini AI',
        source: 'gemini'
      };
    }
  } catch (err: any) {
    logger.warn('Gemini classification fallback to rules engine', {
      context: 'ReplyClassifier',
      details: err?.message
    });
  }

  return quickRule;
}
