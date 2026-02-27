'use strict';

const chalk = require('chalk');
const { loreExists } = require('./index');

function requireInit() {
  if (!loreExists()) {
    console.error(chalk.red('📖 Run lore init first'));
    process.exit(1);
  }
}

module.exports = { requireInit };
