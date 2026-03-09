'use strict';

const fs = require('fs-extra');
const path = require('path');

const LORE_DIR = path.join(process.cwd(), '.lore');
const PID_FILE = path.join(LORE_DIR, 'mcp.pid');

/**
 * Write a status file so other tools can detect if the MCP server is running.
 */
function writePidFile(tools) {
  try {
    fs.ensureDirSync(LORE_DIR);
    fs.writeJsonSync(PID_FILE, {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      tools: tools.map(t => t.toolDefinition.name),
    }, { spaces: 2 });
  } catch (e) {
    // Non-fatal
  }
}

/**
 * Remove the status file on shutdown.
 */
function removePidFile() {
  try { fs.removeSync(PID_FILE); } catch (e) {}
}

/**
 * Print startup banner to stderr (safe — MCP only reads stdout).
 * Register cleanup handlers.
 */
function announceStartup(tools) {
  writePidFile(tools);

  const toolNames = tools.map(t => t.toolDefinition.name).join(', ');
  process.stderr.write(`\n📖 Lore MCP server active (PID: ${process.pid})\n`);
  process.stderr.write(`   ${tools.length} tools available: ${toolNames}\n`);
  process.stderr.write(`   Serving project: ${path.basename(process.cwd())}\n\n`);

  process.on('SIGINT', () => { removePidFile(); process.exit(0); });
  process.on('SIGTERM', () => { removePidFile(); process.exit(0); });
  process.on('exit', removePidFile);
}

/**
 * Check if the MCP server is currently running.
 * @returns {{ pid: number, startedAt: string, tools: string[] }|null}
 */
function getServerStatus() {
  try {
    if (!fs.existsSync(PID_FILE)) return null;
    const info = fs.readJsonSync(PID_FILE);

    // Verify the process is actually alive
    try {
      process.kill(info.pid, 0); // Signal 0 = just check if process exists
      return info;
    } catch (e) {
      // Process is dead, clean up stale PID file
      removePidFile();
      return null;
    }
  } catch (e) {
    return null;
  }
}

module.exports = { announceStartup, getServerStatus };
