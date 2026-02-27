'use strict';

const { execSync } = require('child_process');
const chalk = require('chalk');
const { readIndex } = require('../lib/index');
const { requireInit } = require('../lib/guard');

function edit(id) {
  requireInit();
  try {
    const index = readIndex();
    const entryPath = index.entries[id];

    if (!entryPath) {
      console.error(chalk.red(`Entry not found: ${id}`));
      process.exit(1);
    }

    try {
      execSync(`code "${entryPath}"`, { stdio: 'inherit' });
    } catch (e) {
      console.log(chalk.yellow(`Could not open VSCode. File path: ${entryPath}`));
    }
  } catch (e) {
    console.error(chalk.red(`Failed to edit: ${e.message}`));
    process.exit(1);
  }
}

module.exports = edit;
