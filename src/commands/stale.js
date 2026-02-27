'use strict';

const chalk = require('chalk');
const { readIndex } = require('../lib/index');
const { readEntry } = require('../lib/entries');
const { checkStaleness } = require('../lib/stale');
const { requireInit } = require('../lib/guard');

function stale() {
  requireInit();
  try {
    const index = readIndex();
    let found = false;

    for (const [id, entryPath] of Object.entries(index.entries)) {
      const entry = readEntry(entryPath);
      if (!entry) continue;

      const staleFiles = checkStaleness(entry);
      if (staleFiles.length > 0) {
        found = true;
        console.log(chalk.yellow(`\n⚠ ${entry.id}`));
        console.log(`  Title: ${entry.title}`);
        for (const s of staleFiles) {
          const daysText = s.daysAgo === 0 ? 'today' : `${s.daysAgo} day${s.daysAgo === 1 ? '' : 's'} ago`;
          console.log(chalk.yellow(`  File changed: ${s.filepath} (${daysText})`));
        }
        console.log(chalk.cyan(`  Suggest: lore edit ${entry.id}`));
      }
    }

    if (!found) {
      console.log(chalk.green('✓ No stale entries found'));
    }
  } catch (e) {
    console.error(chalk.red(`Failed to run stale: ${e.message}`));
    process.exit(1);
  }
}

module.exports = stale;
