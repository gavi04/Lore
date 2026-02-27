'use strict';

const chalk = require('chalk');
const { readIndex } = require('../lib/index');
const { readEntry } = require('../lib/entries');
const { checkStaleness } = require('../lib/stale');
const { getDraftCount } = require('../lib/drafts');
const { requireInit } = require('../lib/guard');

function status() {
  requireInit();
  try {
    const index = readIndex();
    const counts = { decision: 0, invariant: 0, graveyard: 0, gotcha: 0 };
    const staleItems = [];

    for (const entryPath of Object.values(index.entries)) {
      const entry = readEntry(entryPath);
      if (!entry) continue;

      if (counts[entry.type] !== undefined) {
        counts[entry.type]++;
      }

      for (const stale of checkStaleness(entry)) {
        staleItems.push({ entry, ...stale });
      }
    }

    const draftCount = getDraftCount();

    console.log(chalk.cyan('\n📖 Lore Status'));
    console.log(`  decisions:  ${counts.decision}`);
    console.log(`  invariants: ${counts.invariant}`);
    console.log(`  graveyard:  ${counts.graveyard}`);
    console.log(`  gotchas:    ${counts.gotcha}`);
    if (draftCount > 0) {
      console.log(chalk.yellow(`  drafts:     ${draftCount} pending — run: lore drafts`));
    }

    if (staleItems.length > 0) {
      console.log(chalk.yellow('\n⚠️  Stale entries (linked files changed since entry was written):'));
      for (const item of staleItems) {
        const daysText = item.daysAgo === 0 ? 'today' : `${item.daysAgo} day${item.daysAgo === 1 ? '' : 's'} ago`;
        console.log(chalk.yellow(`  ${item.entry.id}  →  ${item.filepath} changed ${daysText}`));
      }
      console.log(chalk.cyan('  Run: lore stale  for details'));
    } else {
      console.log(chalk.green('\n✓ All entries up to date'));
    }

    console.log();
  } catch (e) {
    console.error(chalk.red(`Failed to run status: ${e.message}`));
    process.exit(1);
  }
}

module.exports = status;
