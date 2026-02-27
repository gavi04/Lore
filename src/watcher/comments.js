'use strict';

const fs = require('fs-extra');
const path = require('path');
const { detectType, extractTitle, scoreComment } = require('../lib/nlp');
const { saveDraft } = require('../lib/drafts');

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
 * @returns {object[]} created drafts
 */
function mineFile(absFilePath, projectRoot) {
  let code = '';
  try { code = fs.readFileSync(absFilePath, 'utf8'); } catch (e) { return []; }

  const relativePath = path.relative(projectRoot, absFilePath).replace(/\\/g, '/');
  const comments = extractComments(code, absFilePath);
  const created = [];

  // Deduplicate: skip if we have a recent draft from same file with very similar title
  for (const comment of comments) {
    const score = scoreComment(comment);
    if (score < 0.5) continue;

    const { type, confidence } = detectType(comment);
    const title = extractTitle(comment);
    if (!title || title.length < 3) continue;

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
function mineDirectory(absDirPath, projectRoot, ignore) {
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
    total += mineFile(file, projectRoot).length;
  }
  return total;
}

module.exports = { extractComments, mineFile, mineDirectory };
