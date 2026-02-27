'use strict';

const path = require('path');
const { getEmbedding, cosineSimilarity } = require('./embeddings');

// Weights for relevance scoring
const WEIGHTS = {
  directFileMatch: 1.0,
  parentDirMatch: 0.7,
  semanticSimilarity: 0.5,
  tagOverlap: 0.3,
};

/**
 * Score an entry against a query context.
 * @param {object} entry - The lore entry
 * @param {object} context - { filepath, queryText, queryEmbedding, tags }
 * @returns {number} score 0–1+
 */
function scoreEntry(entry, context) {
  let score = 0;

  // Direct file match
  if (context.filepath && entry.files && entry.files.length > 0) {
    const normalizedQuery = context.filepath.replace(/^\.\//, '');
    for (const f of entry.files) {
      const normalizedFile = f.replace(/^\.\//, '');
      if (normalizedFile === normalizedQuery) {
        score += WEIGHTS.directFileMatch;
        break;
      }
    }
  }

  // Parent dir match
  if (context.filepath && entry.files && entry.files.length > 0) {
    const queryDir = path.dirname(context.filepath.replace(/^\.\//, ''));
    for (const f of entry.files) {
      const fileDir = path.dirname(f.replace(/^\.\//, ''));
      if (fileDir === queryDir && queryDir !== '.') {
        score += WEIGHTS.parentDirMatch;
        break;
      }
    }
  }

  // Semantic similarity (if query embedding and entry embedding available)
  if (context.queryEmbedding) {
    const entryVec = getEmbedding(entry.id);
    if (entryVec) {
      const sim = cosineSimilarity(context.queryEmbedding, entryVec);
      score += sim * WEIGHTS.semanticSimilarity;
    }
  }

  // Tag overlap
  if (context.tags && entry.tags && context.tags.length > 0 && entry.tags.length > 0) {
    const queryTagSet = new Set(context.tags.map(t => t.toLowerCase()));
    const matches = entry.tags.filter(t => queryTagSet.has(t.toLowerCase())).length;
    const overlap = matches / Math.max(queryTagSet.size, entry.tags.length);
    score += overlap * WEIGHTS.tagOverlap;
  }

  return score;
}

/**
 * Rank entries by relevance to a context.
 * @param {object[]} entries
 * @param {object} context
 * @returns {object[]} sorted entries with .score attached
 */
function rankEntries(entries, context) {
  return entries
    .map(entry => ({ entry, score: scoreEntry(entry, context) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry, score }) => Object.assign({}, entry, { _score: score }));
}

module.exports = { scoreEntry, rankEntries };
