'use strict';

const path = require('path');
const fs = require('fs-extra');
const { readIndex } = require('../lib/index');
const { readEntry } = require('../lib/entries');

/**
 * Pattern-based staleness checks — no Ollama needed.
 * @param {object} entry
 * @param {string} changedFile - relative path of changed file
 * @param {string} changedCode - current content of changed file
 * @returns {string[]} array of reason strings
 */
function checkPatternStaleness(entry, changedFile, changedCode) {
  const reasons = [];
  const context = (entry.context || '').toLowerCase();
  const filename = path.basename(changedFile).toLowerCase();
  const code = (changedCode || '').toLowerCase();

  // Performance invariant + external HTTP added
  if (entry.type === 'invariant' && /\d+ms/.test(context)) {
    if (/fetch\(|axios\.|http\.get|https\.get|request\(/.test(code)) {
      reasons.push('External HTTP call added to a performance-critical path');
    }
  }

  // Decision about polling + websocket import
  if (context.includes('polling') && /websocket|ws\.|socket\.io/.test(code)) {
    reasons.push('Architecture may have shifted — is this decision still valid?');
  }

  // Decision mentions websocket + new websocket file added
  if (context.includes('websocket') && filename.includes('websocket')) {
    reasons.push('Your infra constraint may have changed');
  }

  // Graveyard entry for a package that may be re-added
  if (entry.type === 'graveyard' && changedFile.endsWith('package.json')) {
    const titleLower = entry.title.toLowerCase();
    // Extract package name from graveyard title
    const match = titleLower.match(/removed?\s+([\w-@/]+)\s+dep/);
    if (match && code.includes(match[1])) {
      reasons.push('This abandoned approach may have been re-introduced');
    }
  }

  return reasons;
}

/**
 * Semantic staleness check using embeddings.
 * @param {object} entry
 * @param {string} diff - summary of changes (function names + imports)
 * @returns {Promise<string[]>}
 */
async function checkSemanticStaleness(entry, diff) {
  try {
    const { generateEmbedding, cosineSimilarity, getEmbedding } = require('../lib/embeddings');
    const entryVec = getEmbedding(entry.id);
    if (!entryVec) return [];

    const diffVec = await generateEmbedding(diff);
    const sim = cosineSimilarity(diffVec, entryVec);

    if (sim > 0.6 && (entry.type === 'invariant' || entry.type === 'decision')) {
      return [`Diff is semantically related to this ${entry.type} (${(sim * 100).toFixed(0)}% similarity)`];
    }
  } catch (e) {
    // Ollama not available
  }
  return [];
}

/**
 * Check all entries linked to a changed file for staleness signals.
 * @param {string} changedFile - absolute path
 * @param {string} projectRoot
 * @param {string} changedCode
 * @param {string|null} diff - optional diff text for semantic check
 * @returns {Promise<Array<{entry, reasons}>>}
 */
async function checkFileStaleness(changedFile, projectRoot, changedCode, diff) {
  const index = readIndex();
  const relativePath = path.relative(projectRoot, path.resolve(changedFile)).replace(/\\/g, '/');

  const entryIds = new Set();
  if (index.files[relativePath]) index.files[relativePath].forEach(id => entryIds.add(id));

  const results = [];
  for (const id of entryIds) {
    const entry = readEntry(index.entries[id]);
    if (!entry) continue;

    const patternReasons = checkPatternStaleness(entry, relativePath, changedCode);
    const semanticReasons = diff ? await checkSemanticStaleness(entry, diff) : [];
    const reasons = [...patternReasons, ...semanticReasons];
    if (reasons.length > 0) results.push({ entry, reasons });
  }

  return results;
}

module.exports = { checkFileStaleness, checkPatternStaleness, checkSemanticStaleness };
