'use strict';

const chalk = require('chalk');
const { requireInit } = require('../lib/guard');
const { getServerStatus } = require('../mcp/status');

async function serve(options) {
  requireInit();

  // Prevent double-start
  const existing = getServerStatus();
  if (existing) {
    process.stderr.write(chalk.yellow(`\n⚠ Lore MCP server is already running (PID: ${existing.pid}, started: ${existing.startedAt})\n`));
    process.stderr.write(chalk.dim(`  Tools: ${existing.tools.join(', ')}\n\n`));
    process.exit(1);
  }

  try {
    // Start the MCP server (communicates via stdio)
    const { startServer } = require('../mcp/server');
    if (!options.quiet) {
      process.stderr.write(chalk.green('📖 Lore MCP server starting on stdio\n'));
      process.stderr.write(chalk.cyan('   Add to Claude Code settings: { "command": "lore serve", "args": [] }\n'));
    }
    await startServer();

    // Also start the UI dashboard in the same process
    const uiPort = options.port || 3333;
    try {
      const { startDashboard } = require('./ui');
      startDashboard(uiPort);
    } catch (e) {
      process.stderr.write(chalk.yellow(`⚠ Could not start UI dashboard: ${e.message}\n`));
    }
  } catch (e) {
    process.stderr.write(chalk.red(`Failed to start server: ${e.message}\n`));
    process.exit(1);
  }
}

module.exports = serve;

