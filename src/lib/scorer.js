'use strict';

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { LORE_DIR, readIndex } = require('./index');
const { readEntry } = require('./entries');
const { checkStaleness } = require('./stale');
const { readConfig } = require('./config');

const SCORE_PATH = () => path.join(LORE_DIR, 'score.json');

/**
 * Get directories that have >5 commits in the last 90 days.
 * @returns {string[]} relative dir paths
 */
function getActiveModules() {
  try {
    const output = execSync(
      'git log --since="90 days ago" --name-only --pretty=format:""',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const dirCounts = {};
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('warning:')) continue;
      const dir = path.dirname(trimmed);
      if (dir === '.') continue;
      dirCounts[dir] = (dirCounts[dir] || 0) + 1;
    }
    return Object.entries(dirCounts)
      .filter(([, count]) => count > 5)
      .map(([dir]) => dir);
  } catch (e) {
    return [];
  }
}

/**
 * Get all directories that have at least one Lore entry linked.
 */
function getModulesWithEntries(index) {
  const dirs = new Set();
  for (const entryPath of Object.values(index.entries)) {
    const entry = readEntry(entryPath);
    if (!entry) continue;
    for (const file of (entry.files || [])) {
      const dir = path.dirname(file.replace(/^\.\//, '').replace(/\/$/, ''));
      if (dir && dir !== '.') dirs.add(dir);
    }
  }
  return dirs;
}

function calcCoverage(activeModules, modulesWithEntries) {
  if (activeModules.length === 0) return 100;
  const covered = activeModules.filter(m => modulesWithEntries.has(m)).length;
  return Math.round((covered / activeModules.length) * 100);
}

function calcFreshness(index) {
  let deduction = 0;
  const now = new Date();
  for (const entryPath of Object.values(index.entries)) {
    const entry = readEntry(entryPath);
    if (!entry) continue;

    // File-based staleness
    const staleFiles = checkStaleness(entry);
    for (const { daysAgo } of staleFiles) {
      deduction += Math.min(40, daysAgo / 2);
    }

    // Age-based staleness for entries with no linked files (older than 60 days)
    if ((!entry.files || entry.files.length === 0) && entry.date) {
      const ageDays = (now - new Date(entry.date)) / (1000 * 60 * 60 * 24);
      if (ageDays > 60) {
        deduction += Math.min(10, (ageDays - 60) / 6);
      }
    }
  }
  return Math.max(0, Math.round(100 - deduction));
}

function calcDepth(index) {
  const counts = { decision: 0, invariant: 0, graveyard: 0, gotcha: 0 };
  for (const entryPath of Object.values(index.entries)) {
    const entry = readEntry(entryPath);
    if (!entry) continue;
    if (counts[entry.type] !== undefined) counts[entry.type]++;
  }
  // invariants and gotchas worth 1.5x
  const weighted =
    counts.decision + counts.graveyard + (counts.invariant * 1.5) + (counts.gotcha * 1.5);
  const maxReasonable = 20;
  return Math.min(100, Math.round((weighted / maxReasonable) * 100));
}

/**
 * Compute the full Lore Score result.
 * @returns {object}
 */
function computeScore() {
  const index = readIndex();
  const config = readConfig();
  const weights = config.scoringWeights || { coverage: 0.4, freshness: 0.35, depth: 0.25 };

  const activeModules = getActiveModules();
  const modulesWithEntries = getModulesWithEntries(index);

  // Commit count per dir for ranking unlogged modules
  const commitCounts = {};
  try {
    const output = execSync(
      'git log --since="90 days ago" --name-only --pretty=format:""',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('warning:')) continue;
      const dir = path.dirname(trimmed);
      if (dir !== '.') commitCounts[dir] = (commitCounts[dir] || 0) + 1;
    }
  } catch (e) {}

  const topUnlogged = activeModules
    .filter(m => !modulesWithEntries.has(m))
    .sort((a, b) => (commitCounts[b] || 0) - (commitCounts[a] || 0))
    .slice(0, 3)
    .map(m => ({ module: m, commits: commitCounts[m] || 0 }));

  const coverage = calcCoverage(activeModules, modulesWithEntries);
  const freshness = calcFreshness(index);
  const depth = calcDepth(index);
  const score = Math.round(
    coverage * weights.coverage +
    freshness * weights.freshness +
    depth * weights.depth
  );

  return {
    score,
    coverage,
    freshness,
    depth,
    activeModules: activeModules.length,
    coveredModules: activeModules.filter(m => modulesWithEntries.has(m)).length,
    topUnlogged,
  };
}

/**
 * Append today's score to history, save to .lore/score.json.
 * @param {object} result
 * @returns {object[]} full history
 */
function saveScore(result) {
  const scorePath = SCORE_PATH();
  let data = { history: [] };
  if (fs.existsSync(scorePath)) {
    try { data = fs.readJsonSync(scorePath); } catch (e) {}
  }
  const today = new Date().toISOString().split('T')[0];
  data.history = (data.history || []).filter(h => h.date !== today);
  data.history.push({
    date: today,
    score: result.score,
    coverage: result.coverage,
    freshness: result.freshness,
    depth: result.depth,
  });
  data.history = data.history.slice(-90);
  fs.ensureDirSync(LORE_DIR);
  fs.writeJsonSync(scorePath, data, { spaces: 2 });
  return data.history;
}

/**
 * Load score history.
 * @returns {object[]}
 */
function loadHistory() {
  const scorePath = SCORE_PATH();
  if (!fs.existsSync(scorePath)) return [];
  try { return fs.readJsonSync(scorePath).history || []; } catch (e) { return []; }
}

module.exports = { computeScore, saveScore, loadHistory, getActiveModules };
