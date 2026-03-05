'use strict';

const chalk = require('chalk');
const { readIndex } = require('../lib/index');
const { readEntry } = require('../lib/entries');
const { printEntry } = require('../lib/format');
const { requireInit } = require('../lib/guard');

function search(queryArgs) {
  requireInit();
  try {
    const query = Array.isArray(queryArgs) ? queryArgs.join(' ') : (queryArgs || '');

    if (!query || query.trim().length === 0) {
      console.error(chalk.red('\nError: You must provide a search query.'));
      process.exit(1);
    }

    const index = readIndex();
    const q = query.toLowerCase();
    const matches = [];

    for (const entryPath of Object.values(index.entries)) {
      const entry = readEntry(entryPath);
      if (!entry) continue;

      const searchable = [
        entry.title,
        entry.context,
        ...(entry.alternatives || []),
        entry.tradeoffs || '',
        ...(entry.tags || []),
      ].join(' ').toLowerCase();

      if (searchable.includes(q)) {
        matches.push(entry);
      }
    }

    if (matches.length === 0) {
      console.log(chalk.cyan(`📖 No entries found for "${query}"`));
      return;
    }

    console.log(chalk.cyan(`\n─── Search results for "${query}" ───\n`));
    for (const entry of matches) {
      printEntry(entry);
    }
    console.log(chalk.cyan('─── End results ───\n'));
  } catch (e) {
    console.error(chalk.red(`Failed to search: ${e.message}`));
    process.exit(1);
  }
}

module.exports = search;
