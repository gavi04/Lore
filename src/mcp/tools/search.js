'use strict';

const { readIndex } = require('../../lib/index');
const { readEntry } = require('../../lib/entries');
const { enforceBudget, formatEntry } = require('../../lib/budget');
const { readConfig } = require('../../lib/config');

const toolDefinition = {
  name: 'lore_search',
  description: 'Search Lore entries by keyword or semantic meaning. Returns matching architectural decisions, invariants, gotchas, and graveyard entries.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query — keyword or natural language description',
      },
      type: {
        type: 'string',
        enum: ['decision', 'invariant', 'gotcha', 'graveyard'],
        description: 'Optional: filter by entry type',
      },
    },
    required: ['query'],
  },
};

async function handler(args) {
  const { query, type: filterType } = args;
  const config = readConfig();
  const budget = (config.mcp && config.mcp.tokenBudget) ? config.mcp.tokenBudget : 4000;

  try {
    const index = readIndex();
    const q = query.toLowerCase();
    const matches = [];

    for (const entryPath of Object.values(index.entries)) {
      const entry = readEntry(entryPath);
      if (!entry) continue;
      if (filterType && entry.type !== filterType) continue;

      const searchable = [
        entry.title,
        entry.context,
        ...(entry.alternatives || []),
        entry.tradeoffs || '',
        ...(entry.tags || []),
      ].join(' ').toLowerCase();

      if (searchable.includes(q)) {
        // Calculate a basic relevance score for text search:
        // 1. Term frequency of query
        const tf = (searchable.match(new RegExp(q, 'g')) || []).length;
        // 2. Bonus for newer entries
        const ageDays = (Date.now() - new Date(entry.date || 0)) / (1000 * 60 * 60 * 24);
        const recencyBonus = Math.max(0, 5 - (ageDays / 30)); // up to +5 points for newest

        matches.push(Object.assign({}, entry, { _score: tf + recencyBonus }));
      }
    }

    // Sort matches by relevance score descending
    matches.sort((a, b) => (b._score || 0) - (a._score || 0));

    // Try semantic search if text search found nothing and embeddings exist
    if (matches.length === 0) {
      try {
        const { findSimilar } = require('../../lib/embeddings');
        const allIds = Object.keys(index.entries);
        const similar = await findSimilar(query, allIds, 5);
        for (const { id, score } of similar) {
          if (score < 0.5) continue;
          const entry = readEntry(index.entries[id]);
          if (entry) {
            if (!filterType || entry.type === filterType) {
              matches.push(entry);
            }
          }
        }
      } catch (e) {
        // Ollama not available — skip semantic search silently
      }
    }

    if (matches.length === 0) {
      return {
        content: [{ type: 'text', text: `No entries found for: "${query}"` }],
      };
    }

    const budgeted = enforceBudget(matches, budget);

    return {
      content: [{ type: 'text', text: budgeted || `Matches found, but they exceed the ${budget} token budget.` }],
    };
  } catch (e) {
    return {
      content: [{ type: 'text', text: `Error: ${e.message}` }],
      isError: true,
    };
  }
}

module.exports = { toolDefinition, handler };
