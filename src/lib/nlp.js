'use strict';

const natural = require('natural');

// Type detection patterns
const TYPE_PATTERNS = [
  { type: 'invariant', re: /\b(must|always|never|shall|required|mandatory|do not|don't)\b/i, confidence: 0.9 },
  { type: 'graveyard', re: /\b(tried|abandoned|removed|replaced|deprecated|don'?t use|do not use|we used to)\b/i, confidence: 0.85 },
  { type: 'gotcha', re: /\b(warning|careful|hack|workaround|footgun|beware|gotcha|pitfall|tricky|careful)\b/i, confidence: 0.8 },
  { type: 'decision', re: /\b(because|reason|chose|decided|switched|opted|note:|important:|we chose|we use)\b/i, confidence: 0.7 },
];

// Trigger phrases for comment scoring
const TRIGGER_PHRASES = [
  "don't", "never", "always", "because", "warning", "hack",
  "todo: explain", "note:", "important:", "must", "shall",
  "tried", "abandoned", "careful", "workaround", "footgun",
  "beware", "replaced", "deprecated", "we tried", "latency",
];

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'i', 'we', 'it', 'this', 'that', 'to', 'of', 'in',
  'for', 'on', 'with', 'as', 'at', 'by', 'or', 'and', 'but',
]);

/**
 * Detect the suggested entry type from a text snippet.
 * @param {string} text
 * @returns {{ type: string, confidence: number }}
 */
function detectType(text) {
  for (const { type, re, confidence } of TYPE_PATTERNS) {
    if (re.test(text)) return { type, confidence };
  }
  return { type: 'decision', confidence: 0.4 };
}

/**
 * Extract a short title from comment text.
 * @param {string} text
 * @param {number} maxWords
 * @returns {string}
 */
function extractTitle(text, maxWords = 8) {
  // Strip comment markers
  const stripped = text
    .replace(/^[\s\/\*#\-]+/, '')
    .replace(/\*\//g, '')
    .trim();

  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(stripped) || [];
  const meaningful = words.filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));

  const titleWords = meaningful.slice(0, maxWords);
  if (titleWords.length === 0) return stripped.slice(0, 50);

  // Title-case
  return titleWords
    .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

/**
 * Slugify text for use in IDs.
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Score a comment 0–1 for lore-worthiness.
 * @param {string} comment
 * @returns {number}
 */
function scoreComment(comment) {
  const lower = comment.toLowerCase();
  let score = 0;

  // Trigger phrase present
  for (const phrase of TRIGGER_PHRASES) {
    if (lower.includes(phrase)) {
      score += 0.4;
      break;
    }
  }

  // Length bonus
  if (comment.length > 20) score += 0.2;
  if (comment.length > 60) score += 0.2;

  // Penalty for generic TODO/FIXME without explanation
  if (/\b(todo|fixme)\b/i.test(lower) && !lower.includes('todo: explain')) {
    score -= 0.35;
  }

  // Bonus for numbers/metrics (performance constraints etc.)
  if (/\d+(ms|mb|kb|s|%|x)/.test(lower)) score += 0.1;

  return Math.max(0, Math.min(1, score));
}

module.exports = { detectType, extractTitle, slugify, scoreComment };
