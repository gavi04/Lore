'use strict';

const fs = require('fs-extra');
const path = require('path');
const { detectType, extractTitle, scoreComment } = require('../lib/nlp');
const { saveDraft, listDrafts } = require('../lib/drafts');
const { readIndex } = require('../lib/index');
const { readEntry } = require('../lib/entries');

/**
 * Extract raw comment strings from source code.
 * Tries Babel AST for JS/TS, falls back to regex for all languages.
 */
function extractComments(code, filePath) {
  if (/\.(js|ts|jsx|tsx)$/.test(filePath)) {
    try {
      const babelParser = require('@babel/parser');
      const ast = babelParser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
        errorRecovery: true,
      });
      return (ast.comments || []).map(c => c.value.trim()).filter(Boolean);
    } catch (e) {
      // fall through
    }
  }

  // Regex: covers JS, Python, Go, Rust, shell
  const comments = [];
  const patterns = [
    /\/\/([^\n]+)/g,        // //
    /\/\*([\s\S]*?)\*\//g,  // /* */
    /#([^\n]+)/g,           // #
    /--([^\n]+)/g,          // --
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) {
      const text = m[1].trim();
      if (text) comments.push(text);
    }
  }
  return comments;
}

/**
 * Mine a single file for lore-worthy comments.
 * Saves passing comments as drafts.
 * @param {string} absFilePath
 * @param {string} projectRoot
 * @returns {Promise<object[]>} created drafts
 */
async function mineFile(absFilePath, projectRoot) {
  let code = '';
  try { code = await fs.readFile(absFilePath, 'utf8'); } catch (e) { return []; }

  const relativePath = path.relative(projectRoot, absFilePath).replace(/\\/g, '/');
  const comments = extractComments(code, absFilePath);
  const created = [];

  const existingDrafts = listDrafts();
  const index = readIndex();
  const existingEntries = Object.values(index.entries).map(p => readEntry(p)).filter(Boolean);

  // Deduplicate: skip if we have a recent draft or entry from same file with same title
  for (const comment of comments) {
    const score = scoreComment(comment);
    if (score < 0.5) continue;

    const { type, confidence } = detectType(comment);
    const title = extractTitle(comment);
    if (!title || title.length < 3) continue;

    const isDuplicateDraft = existingDrafts.some(d => d.suggestedTitle === title && (d.files || []).includes(relativePath));
    const isDuplicateEntry = existingEntries.some(e => e.title === title && (e.files || []).includes(relativePath));

    if (isDuplicateDraft || isDuplicateEntry) continue;

    const draft = {
      draftId: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      suggestedType: type,
      suggestedTitle: title,
      evidence: comment.length > 300 ? comment.slice(0, 300) + '…' : comment,
      files: [relativePath],
      confidence: Math.min(1, (score + confidence) / 2),
      createdAt: new Date().toISOString(),
      status: 'pending',
      source: 'comment-mine',
    };

    saveDraft(draft);
    created.push(draft);
  }

  return created;
}

/**
 * Mine all source files in a directory recursively.
 * @param {string} absDirPath
 * @param {string} projectRoot
 * @param {string[]} ignore
 * @returns {number} total drafts created
 */
async function mineDirectory(absDirPath, projectRoot, ignore) {
  const { globSync } = require('glob');
  const ignoreList = ignore || ['node_modules', 'dist', '.git', '.lore', 'coverage'];
  const ignorePats = ignoreList.map(i => `${i}/**`);

  const files = globSync('**/*.{js,ts,jsx,tsx,py,go,rs}', {
    cwd: absDirPath,
    ignore: ignorePats,
    absolute: true,
  });

  let total = 0;
  for (const file of files) {
    const drafts = await mineFile(file, projectRoot);
    total += drafts.length;
  }
  return total;
}

module.exports = { extractComments, mineFile, mineDirectory };
