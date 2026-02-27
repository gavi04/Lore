'use strict';

const { execSync } = require('child_process');

function getRecentFiles(depth = 5) {
  try {
    const output = execSync(`git diff --name-only HEAD~${depth} HEAD`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
    // Not a git repo, no commits yet, or not enough history
    return [];
  }
}

module.exports = { getRecentFiles };
