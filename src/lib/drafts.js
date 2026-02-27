'use strict';

const fs = require('fs-extra');
const path = require('path');
const { LORE_DIR, readIndex, writeIndex, addEntryToIndex } = require('./index');
const { generateId, writeEntry } = require('./entries');

const DRAFTS_DIR = () => path.join(LORE_DIR, 'drafts');

function ensureDraftsDir() {
  fs.ensureDirSync(DRAFTS_DIR());
}

/**
 * Save a draft to .lore/drafts/.
 * @param {object} draft
 * @returns {string} draftId
 */
function saveDraft(draft) {
  ensureDraftsDir();
  const draftId = draft.draftId || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const draftPath = path.join(DRAFTS_DIR(), `${draftId}.json`);
  fs.writeJsonSync(draftPath, { ...draft, draftId, status: 'pending' }, { spaces: 2 });
  return draftId;
}

/**
 * List all pending drafts, sorted by confidence descending.
 * @returns {object[]}
 */
function listDrafts() {
  const dir = DRAFTS_DIR();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const drafts = [];
  for (const file of files) {
    try {
      const draft = fs.readJsonSync(path.join(dir, file));
      if (draft.status === 'pending') drafts.push(draft);
    } catch (e) {}
  }
  return drafts.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

/**
 * Promote a draft to a real Lore entry.
 * @param {string} draftId
 * @returns {object} the created entry
 */
function acceptDraft(draftId) {
  const draftPath = path.join(DRAFTS_DIR(), `${draftId}.json`);
  const draft = fs.readJsonSync(draftPath);

  const type = draft.suggestedType || 'decision';
  const title = draft.suggestedTitle || 'Untitled';
  const id = generateId(type, title);

  const entry = {
    id,
    type,
    title,
    context: draft.evidence || '',
    files: draft.files || [],
    tags: draft.tags || [],
    alternatives: [],
    tradeoffs: '',
    date: new Date().toISOString(),
  };

  writeEntry(entry);
  const index = readIndex();
  addEntryToIndex(index, entry);
  writeIndex(index);

  // Auto-embed if Ollama available
  try {
    const { generateEmbedding, storeEmbedding } = require('./embeddings');
    const text = [title, entry.context, ...entry.tags].join(' ');
    generateEmbedding(text).then(vec => storeEmbedding(id, vec)).catch(() => {});
  } catch (e) {}

  fs.removeSync(draftPath);
  return entry;
}

/**
 * Delete a draft permanently.
 * @param {string} draftId
 */
function deleteDraft(draftId) {
  const draftPath = path.join(DRAFTS_DIR(), `${draftId}.json`);
  fs.removeSync(draftPath);
}

/**
 * Count pending drafts.
 * @returns {number}
 */
function getDraftCount() {
  return listDrafts().length;
}

module.exports = { saveDraft, listDrafts, acceptDraft, deleteDraft, getDraftCount };
