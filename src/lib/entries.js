'use strict';

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { LORE_DIR, getTypeDir } = require('./index');

function getEntryPath(type, id) {
  return path.join(LORE_DIR, getTypeDir(type), `${id}.json`);
}

function readEntry(entryPath) {
  try {
    return fs.readJsonSync(entryPath);
  } catch (e) {
    console.error(chalk.red(`Failed to read entry at ${entryPath}: ${e.message}`));
    return null;
  }
}

function writeEntry(entry) {
  const entryPath = getEntryPath(entry.type, entry.id);
  try {
    fs.writeJsonSync(entryPath, entry, { spaces: 2 });
    return entryPath;
  } catch (e) {
    console.error(chalk.red(`Failed to write entry: ${e.message}`));
    process.exit(1);
  }
}

function generateId(type, title) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join('-');
  const ts = Math.floor(Date.now() / 1000);
  return `${type}-${words}-${ts}`;
}

function readAllEntries(index) {
  const entries = [];
  for (const entryPath of Object.values(index.entries)) {
    const entry = readEntry(entryPath);
    if (entry) entries.push(entry);
  }
  return entries;
}

/**
 * Check if a similar entry or draft already exists.
 * @param {object} index - The lore index
 * @param {string} type - Entry type
 * @param {string} title - Entry title
 * @returns {{ match: 'exact'|'fuzzy', entry: object, source: 'entry'|'draft' }|null}
 */
function findDuplicate(index, type, title) {
  const normalizedTitle = title.toLowerCase().trim();
  const titleWords = new Set(normalizedTitle.split(/\s+/).filter(w => w.length > 2));

  function checkTitle(candidateTitle) {
    const candidate = (candidateTitle || '').toLowerCase().trim();

    // Exact match (case-insensitive)
    if (candidate === normalizedTitle) return 'exact';

    // Fuzzy match: ≥60% word overlap
    if (titleWords.size > 0) {
      const candidateWords = new Set(candidate.split(/\s+/).filter(w => w.length > 2));
      if (candidateWords.size === 0) return null;

      let overlap = 0;
      for (const w of titleWords) {
        if (candidateWords.has(w)) overlap++;
      }

      const similarity = overlap / Math.max(titleWords.size, candidateWords.size);
      if (similarity >= 0.6) return 'fuzzy';
    }

    return null;
  }

  // Check approved entries
  for (const entryPath of Object.values(index.entries)) {
    const entry = readEntry(entryPath);
    if (!entry || entry.type !== type) continue;

    const match = checkTitle(entry.title);
    if (match) return { match, entry, source: 'entry' };
  }

  // Check pending drafts
  try {
    const { listDrafts } = require('./drafts');
    const drafts = listDrafts();
    for (const draft of drafts) {
      if (draft.suggestedType !== type) continue;

      const match = checkTitle(draft.suggestedTitle);
      if (match) return { match, entry: { id: draft.draftId, title: draft.suggestedTitle, type: draft.suggestedType }, source: 'draft' };
    }
  } catch (e) {
    // drafts module not available — skip
  }

  return null;
}

module.exports = {
  getEntryPath,
  readEntry,
  writeEntry,
  generateId,
  readAllEntries,
  findDuplicate,
};
