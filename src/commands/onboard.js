'use strict';

const chalk = require('chalk');
const { readIndex } = require('../lib/index');
const { readEntry } = require('../lib/entries');
const { checkStaleness } = require('../lib/stale');
const { readConfig } = require('../lib/config');
const { getDaysSinceLastSession, updateLastSession } = require('../lib/sessions');
const { requireInit } = require('../lib/guard');

function onboard(options) {
  requireInit();
  try {
    const config = readConfig();
    const index = readIndex();
    const minDays = parseInt(options.days, 10) || 0;

    const daysSince = getDaysSinceLastSession();

    // If --days is set, only show onboarding if away long enough
    if (minDays > 0 && (daysSince === null || daysSince < minDays)) {
      console.log(chalk.cyan(`📖 Skipping onboarding (last session ${daysSince !== null ? daysSince + ' day(s) ago' : 'recently'})`));
      return;
    }

    // Update session tracking
    updateLastSession();

    const projectName = config.project || 'this project';
    const byType = { decision: [], invariant: [], gotcha: [], graveyard: [] };
    const staleItems = [];

    for (const entryPath of Object.values(index.entries)) {
      const entry = readEntry(entryPath);
      if (!entry) continue;
      if (byType[entry.type]) byType[entry.type].push(entry);
      const staleFiles = checkStaleness(entry);
      if (staleFiles.length > 0) staleItems.push({ entry, staleFiles });
    }

    const total = Object.values(byType).reduce((sum, arr) => sum + arr.length, 0);

    if (daysSince !== null && daysSince >= 3) {
      console.log(chalk.cyan(`\n📖 Welcome back to ${projectName}!`));
      console.log(chalk.dim(`   You've been away for ${daysSince} day${daysSince === 1 ? '' : 's'}\n`));
    } else {
      console.log(chalk.cyan(`\n📖 Lore — ${projectName}\n`));
    }

    if (total === 0) {
      console.log(chalk.yellow('  No lore entries yet. Run: lore log'));
      return;
    }

    // Decisions
    if (byType.decision.length > 0) {
      console.log(chalk.bold(`Architectural Decisions (${byType.decision.length}):`));
      for (const e of byType.decision.slice(0, 5)) {
        console.log(chalk.white(`  • ${e.title}`));
        if (e.context) {
          const firstLine = e.context.split('\n')[0];
          const summary = firstLine.slice(0, 80);
          console.log(chalk.dim(`    ${summary}${firstLine.length > 80 ? '…' : ''}`));
        }
      }
      if (byType.decision.length > 5) {
        console.log(chalk.dim(`    …and ${byType.decision.length - 5} more`));
      }
      console.log();
    }

    // Invariants
    if (byType.invariant.length > 0) {
      console.log(chalk.bold.red(`Invariants — Never Break These (${byType.invariant.length}):`));
      for (const e of byType.invariant) {
        console.log(chalk.white(`  • ${e.title}`));
      }
      console.log();
    }

    // Gotchas
    if (byType.gotcha.length > 0) {
      console.log(chalk.bold.yellow(`Gotchas (${byType.gotcha.length}):`));
      for (const e of byType.gotcha.slice(0, 3)) {
        console.log(chalk.white(`  • ${e.title}`));
      }
      if (byType.gotcha.length > 3) {
        console.log(chalk.dim(`    …and ${byType.gotcha.length - 3} more`));
      }
      console.log();
    }

    // Stale warnings
    if (staleItems.length > 0) {
      console.log(chalk.bold.yellow(`⚠ Stale Entries (${staleItems.length}):`));
      for (const { entry, staleFiles } of staleItems.slice(0, 5)) {
        const days = staleFiles[0].daysAgo;
        const daysText = days === 0 ? 'today' : `${days}d ago`;
        console.log(chalk.yellow(`  • ${entry.title} — ${staleFiles[0].filepath} changed ${daysText}`));
      }
      console.log(chalk.cyan('  Run: lore stale  for full details'));
      console.log();
    }

    console.log(chalk.dim(`Total: ${total} entries | lore search <query> | lore why <file>`));
    console.log();
  } catch (e) {
    console.error(chalk.red(`Failed to run onboard: ${e.message}`));
    process.exit(1);
  }
}

module.exports = onboard;
