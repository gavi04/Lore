'use strict';

// Rough token estimate: 4 chars per token
function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

/**
 * Format a single entry for MCP context injection.
 * @param {object} entry
 * @returns {string}
 */
function formatEntry(entry) {
  const lines = [];
  lines.push(`## [${entry.type.toUpperCase()}] ${entry.title}`);
  lines.push(`ID: ${entry.id}`);
  if (entry.files && entry.files.length > 0) {
    lines.push(`Files: ${entry.files.join(', ')}`);
  }
  if (entry.tags && entry.tags.length > 0) {
    lines.push(`Tags: ${entry.tags.join(', ')}`);
  }
  lines.push('');
  if (entry.context) lines.push(entry.context);
  if (entry.alternatives && entry.alternatives.length > 0) {
    lines.push('');
    lines.push(`Alternatives considered: ${entry.alternatives.join(', ')}`);
  }
  if (entry.tradeoffs) {
    lines.push('');
    lines.push(`Tradeoffs: ${entry.tradeoffs}`);
  }
  return lines.join('\n');
}

/**
 * Select the highest-scoring entries that fit within a token budget.
 * @param {object[]} rankedEntries - Entries sorted by score descending (from rankEntries)
 * @param {number} budget - Max tokens
 * @returns {string} Formatted context block
 */
function enforceBudget(rankedEntries, budget) {
  const sections = [];
  let used = 0;

  for (const entry of rankedEntries) {
    const text = formatEntry(entry);
    const tokens = estimateTokens(text);
    if (used + tokens > budget) break;
    sections.push(text);
    used += tokens;
  }

  return sections.join('\n\n---\n\n');
}

module.exports = { estimateTokens, formatEntry, enforceBudget };
