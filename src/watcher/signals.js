'use strict';

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { detectType, extractTitle } = require('../lib/nlp');
const { saveDraft } = require('../lib/drafts');
const { LORE_DIR } = require('../lib/index');

function makeDraft(overrides) {
  return {
    draftId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    suggestedType: 'decision',
    suggestedTitle: '',
    evidence: '',
    files: [],
    confidence: 0.6,
    createdAt: new Date().toISOString(),
    status: 'pending',
    source: 'signal',
    ...overrides,
  };
}

async function onFileDeletion(filepath, projectRoot) {
  const relativePath = path.relative(projectRoot, filepath).replace(/\\/g, '/');

  // Try to check line count via git
  let lines = 0;
  try {
    const out = execSync(`git show HEAD:"${relativePath}" 2>/dev/null | wc -l`, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    lines = parseInt(out.trim(), 10) || 0;
  } catch (e) { }

  if (lines > 0 && lines < 100) return null;

  const name = path.basename(relativePath, path.extname(relativePath));
  const draft = makeDraft({
    suggestedType: 'graveyard',
    suggestedTitle: `Removed ${name}`,
    evidence: `File deleted: ${relativePath}`,
    files: [relativePath],
    confidence: 0.6,
  });
  saveDraft(draft);
  return draft;
}

async function onDirectoryDeletion(dirpath, projectRoot) {
  const relativePath = path.relative(projectRoot, dirpath).replace(/\\/g, '/');
  const name = path.basename(relativePath);
  const draft = makeDraft({
    suggestedType: 'graveyard',
    suggestedTitle: `Removed ${name} module`,
    evidence: `Directory deleted: ${relativePath}`,
    files: [relativePath + '/'],
    confidence: 0.6,
  });
  saveDraft(draft);
  return draft;
}

async function onNewFile(filepath, projectRoot) {
  const relativePath = path.relative(projectRoot, filepath).replace(/\\/g, '/');
  const name = path.basename(relativePath);
  const lower = name.toLowerCase();

  const configRe = /^(\.env|config\.|settings\.|\.eslintrc|\.prettierrc|\.babelrc|jest\.config|webpack\.config|vite\.config|tsconfig)/;
  if (configRe.test(lower)) {
    const draft = makeDraft({
      suggestedType: 'decision',
      suggestedTitle: `Added ${name}`,
      evidence: `New config file detected: ${relativePath}`,
      files: [relativePath],
      confidence: 0.6,
    });
    saveDraft(draft);
    return draft;
  }

  const adapterRe = /(adapter|provider|connector|driver|handler|strategy|middleware)\.(js|ts|jsx|tsx)$/;
  if (adapterRe.test(lower)) {
    const base = name.replace(/\.(js|ts|jsx|tsx)$/, '');
    const draft = makeDraft({
      suggestedType: 'decision',
      suggestedTitle: `Added ${base}`,
      evidence: `New adapter/provider file added: ${relativePath}`,
      files: [relativePath],
      confidence: 0.6,
    });
    saveDraft(draft);
    return draft;
  }

  return null;
}

async function onPackageJsonChange(filepath, projectRoot) {
  const relativePath = path.relative(projectRoot, filepath).replace(/\\/g, '/');
  if (!relativePath.endsWith('package.json')) return [];

  let prev = {};
  let curr = {};
  try {
    const prevRaw = execSync(`git show HEAD:"${relativePath}"`, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
    prev = JSON.parse(prevRaw);
  } catch (e) { }

  try { curr = await fs.readJson(filepath); } catch (e) { return []; }

  const prevDeps = Object.assign({}, prev.dependencies || {}, prev.devDependencies || {});
  const currDeps = Object.assign({}, curr.dependencies || {}, curr.devDependencies || {});

  const drafts = [];
  for (const pkg of Object.keys(currDeps)) {
    if (!prevDeps[pkg]) {
      drafts.push(makeDraft({
        suggestedType: 'decision',
        suggestedTitle: `Added ${pkg} dependency`,
        evidence: `New package added to package.json: ${pkg}@${currDeps[pkg]}`,
        files: [relativePath],
        confidence: 0.6,
      }));
    }
  }
  for (const pkg of Object.keys(prevDeps)) {
    if (!currDeps[pkg]) {
      drafts.push(makeDraft({
        suggestedType: 'graveyard',
        suggestedTitle: `Removed ${pkg} dependency`,
        evidence: `Package removed from package.json: ${pkg}`,
        files: [relativePath],
        confidence: 0.6,
      }));
    }
  }

  for (const d of drafts) saveDraft(d);
  return drafts;
}

async function onCommitMessage(message, projectRoot) {
  const lower = message.toLowerCase();
  const signals = [
    { re: /\b(replac|switch(ed|ing)|migrat)\b/, type: 'decision', confidence: 0.8 },
    { re: /\b(remov|delet|drop(ped|ping))\b/, type: 'graveyard', confidence: 0.8 },
    { re: /\b(revert|undo|rollback)\b/, type: 'graveyard', confidence: 0.8 },
    { re: /\b(never|always|must|shall)\b/, type: 'invariant', confidence: 0.8 },
  ];

  for (const { re, type, confidence } of signals) {
    if (re.test(lower)) {
      const title = extractTitle(message) || message.slice(0, 50);
      const draft = makeDraft({
        suggestedType: type,
        suggestedTitle: title,
        evidence: `Commit message: "${message}"`,
        files: [],
        confidence,
        source: 'commit-signal',
      });
      saveDraft(draft);
      return [draft];
    }
  }
  return [];
}

// Track repeated edits to detect gotcha-worthy files
async function trackFileEdit(filepath, projectRoot) {
  const relativePath = path.relative(projectRoot, filepath).replace(/\\/g, '/');
  const statePath = path.join(LORE_DIR, 'watch-state.json');

  let state = { edits: {} };
  try { state = await fs.readJson(statePath); } catch (e) { }
  if (!state.edits) state.edits = {};

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  if (!state.edits[relativePath]) state.edits[relativePath] = [];
  state.edits[relativePath].push(now);
  state.edits[relativePath] = state.edits[relativePath].filter(t => t > weekAgo);

  try { await fs.writeJson(statePath, state, { spaces: 2 }); } catch (e) { }

  if (state.edits[relativePath].length >= 5) {
    const name = path.basename(relativePath);
    const draft = makeDraft({
      suggestedType: 'gotcha',
      suggestedTitle: `Frequent edits to ${name}`,
      evidence: `${relativePath} edited ${state.edits[relativePath].length}× this week — may be a tricky area`,
      files: [relativePath],
      confidence: 0.4,
      source: 'repeated-edit',
    });
    saveDraft(draft);
    // Reset to avoid spam
    state.edits[relativePath] = [];
    try { await fs.writeJson(statePath, state, { spaces: 2 }); } catch (e) { }
    return draft;
  }
  return null;
}

module.exports = {
  onFileDeletion,
  onDirectoryDeletion,
  onNewFile,
  onPackageJsonChange,
  onCommitMessage,
  trackFileEdit,
};
