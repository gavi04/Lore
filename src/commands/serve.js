'use strict';

const chalk = require('chalk');
const { requireInit } = require('../lib/guard');

async function serve(options) {
  requireInit();
  try {
    const { startServer } = require('../mcp/server');
    if (!options.quiet) {
      process.stderr.write(chalk.green('📖 Lore MCP server starting on stdio\n'));
      process.stderr.write(chalk.cyan('   Add to Claude Code settings: { "command": "lore serve", "args": [] }\n'));
    }
    await startServer();
  } catch (e) {
    process.stderr.write(chalk.red(`Failed to start server: ${e.message}\n`));
    process.exit(1);
  }
}

module.exports = serve;
