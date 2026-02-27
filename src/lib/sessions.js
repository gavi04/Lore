'use strict';

const fs = require('fs-extra');
const path = require('path');
const { LORE_DIR } = require('./index');

function getSessionPath() {
  return path.join(LORE_DIR, 'sessions', 'last.json');
}

function updateLastSession() {
  const sessionPath = getSessionPath();
  fs.ensureDirSync(path.dirname(sessionPath));
  const data = { lastActive: new Date().toISOString() };
  fs.writeJsonSync(sessionPath, data, { spaces: 2 });
}

function getDaysSinceLastSession() {
  const sessionPath = getSessionPath();
  if (!fs.existsSync(sessionPath)) return null;
  try {
    const data = fs.readJsonSync(sessionPath);
    if (!data.lastActive) return null;
    const last = new Date(data.lastActive);
    const now = new Date();
    const diffMs = now - last;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch (e) {
    return null;
  }
}

/**
 * Watch for conversation activity in .lore/sessions/.
 * Calls onNewSession callback when a new Claude Code session is detected.
 * This is a simple file-watch-based implementation.
 */
function watchConversations(onNewSession) {
  const sessionsDir = path.join(LORE_DIR, 'sessions');
  fs.ensureDirSync(sessionsDir);

  const watcher = fs.watch(sessionsDir, { persistent: false }, (event, filename) => {
    if (filename && filename.endsWith('.json')) {
      onNewSession(filename);
    }
  });

  return watcher;
}

module.exports = { updateLastSession, getDaysSinceLastSession, watchConversations };
