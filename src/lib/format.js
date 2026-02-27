'use strict';

const chalk = require('chalk');

function printEntry(entry) {
  const typeLabel = `[${entry.type.toUpperCase()}]`;
  console.log(chalk.bold(`${typeLabel} ${entry.title}`) + chalk.gray(` (${entry.date})`));
  console.log(`  → ${entry.context}`);

  if (entry.alternatives && entry.alternatives.length > 0) {
    for (const alt of entry.alternatives) {
      console.log(chalk.yellow(`  → Rejected: ${alt}`));
    }
  }

  if (entry.tradeoffs) {
    console.log(chalk.gray(`  → Tradeoffs: ${entry.tradeoffs}`));
  }

  console.log();
}

module.exports = { printEntry };
