'use strict';

const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const { mineFile, mineDirectory } = require('../watcher/comments');
const { requireInit } = require('../lib/guard');

function mine(targetPath) {
  requireInit();
  const projectRoot = process.cwd();
  const target = targetPath || '.';

  try {
    const abs = path.resolve(target);
    const stat = fs.statSync(abs);
    let count = 0;

    if (stat.isDirectory()) {
      console.log(chalk.cyan(`📖 Mining comments in ${target} ...`));
      count = mineDirectory(abs, projectRoot);
    } else {
      console.log(chalk.cyan(`📖 Mining comments in ${target} ...`));
      count = mineFile(abs, projectRoot).length;
    }

    if (count === 0) {
      console.log(chalk.green('✓ No significant comments found'));
    } else {
      console.log(chalk.green(`📖 Found ${count} draft entr${count === 1 ? 'y' : 'ies'} — review with: lore drafts`));
    }
  } catch (e) {
    console.error(chalk.red(`Failed to mine: ${e.message}`));
    process.exit(1);
  }
}

module.exports = mine;
