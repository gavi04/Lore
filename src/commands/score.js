'use strict';

const chalk = require('chalk');
const { computeScore, saveScore, loadHistory } = require('../lib/scorer');
const { requireInit } = require('../lib/guard');

function label(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Work';
  return 'Low';
}

function bar(value, width = 20) {
  const filled = Math.round((value / 100) * width);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled));
}

function trend(history) {
  if (history.length < 2) return '';
  const last = history[history.length - 1].score;
  const prev = history[history.length - 2].score;
  if (last > prev) return ' (improving)';
  if (last < prev) return ' (declining)';
  return ' (stable)';
}

function score() {
  requireInit();
  try {
    const result = computeScore();
    const history = saveScore(result);

    const scoreLabel = label(result.score);
    console.log(chalk.cyan(`\n📖 Lore Score: ${chalk.bold(result.score)}/100  (${scoreLabel})`));
    console.log(chalk.dim('────────────────────────────────'));
    console.log();

    // Coverage
    const cColor = result.coverage >= 70 ? chalk.green : result.coverage >= 40 ? chalk.yellow : chalk.red;
    console.log(cColor(`Coverage     ${result.coverage}/100`));
    console.log(chalk.dim(`  ${bar(result.coverage)}  ${result.coveredModules}/${result.activeModules} active modules documented`));
    if (result.topUnlogged.length > 0) {
      console.log(chalk.yellow('  Highest risk unlogged modules:'));
      for (const { module: mod, commits } of result.topUnlogged) {
        console.log(chalk.yellow(`    ${mod}  — ${commits} commits`));
      }
    }
    console.log();

    // Freshness
    const fColor = result.freshness >= 70 ? chalk.green : result.freshness >= 40 ? chalk.yellow : chalk.red;
    console.log(fColor(`Freshness    ${result.freshness}/100`));
    console.log(chalk.dim(`  ${bar(result.freshness)}`));
    console.log();

    // Depth
    const dColor = result.depth >= 70 ? chalk.green : result.depth >= 40 ? chalk.yellow : chalk.red;
    console.log(dColor(`Depth        ${result.depth}/100`));
    console.log(chalk.dim(`  ${bar(result.depth)}`));
    console.log();

    console.log(chalk.dim('────────────────────────────────'));

    // History
    if (history.length > 1) {
      const recent = history.slice(-3).map(h => h.score).join(' → ');
      console.log(chalk.dim(`Score history: ${recent}${trend(history)}`));
    }

    // Tip
    if (result.topUnlogged.length > 0) {
      console.log(chalk.cyan(`Tip: Log memory for ${result.topUnlogged[0].module} — highest risk unlogged module`));
    } else if (result.freshness < 60) {
      console.log(chalk.cyan('Tip: Review stale entries — run: lore stale'));
    } else if (result.depth < 60) {
      console.log(chalk.cyan('Tip: Add invariants and gotchas — run: lore log --type invariant'));
    }

    console.log();
  } catch (e) {
    console.error(chalk.red(`Failed to compute score: ${e.message}`));
    process.exit(1);
  }
}

module.exports = score;
