'use strict';

const path = require('path');
const chalk = require('chalk');
const { readIndex } = require('../lib/index');
const { requireInit } = require('../lib/guard');
const { readEntry } = require('../lib/entries');
const { printEntry } = require('../lib/format');

function why(filepath) {
  requireInit();
  try {
    const index = readIndex();
    const normalized = filepath.replace(/^\.\//, '');

    const entryIds = new Set();

    // Exact match (also try with trailing slash for bare directory names)
    if (index.files[normalized]) {
      index.files[normalized].forEach(id => entryIds.add(id));
    }
    if (!normalized.endsWith('/') && index.files[normalized + '/']) {
      index.files[normalized + '/'].forEach(id => entryIds.add(id));
    }

    // Walk up parent directories
    let dir = path.dirname(normalized.replace(/\/$/, ''));
    while (dir && dir !== '.') {
      const dirKey = dir + '/';
      if (index.files[dirKey]) {
        index.files[dirKey].forEach(id => entryIds.add(id));
      }
      dir = path.dirname(dir);
    }

    if (entryIds.size === 0) {
      console.log(chalk.cyan(`📖 No Lore entries linked to ${filepath} yet. Run: lore log`));
      return;
    }

    console.log(chalk.cyan(`\n─── Lore Context: ${filepath} ───\n`));

    for (const id of entryIds) {
      const entryPath = index.entries[id];
      if (!entryPath) continue;
      const entry = readEntry(entryPath);
      if (!entry) continue;
      printEntry(entry);
    }

    console.log(chalk.cyan('─── End Lore Context ───\n'));
  } catch (e) {
    console.error(chalk.red(`Failed to run why: ${e.message}`));
    process.exit(1);
  }
}

module.exports = why;
