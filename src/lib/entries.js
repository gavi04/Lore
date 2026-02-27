'use strict';

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { LORE_DIR, getTypeDir } = require('./index');

function getEntryPath(type, id) {
  return path.join(LORE_DIR, getTypeDir(type), `${id}.json`);
}

function readEntry(entryPath) {
  try {
    return fs.readJsonSync(entryPath);
  } catch (e) {
    console.error(chalk.red(`Failed to read entry at ${entryPath}: ${e.message}`));
    return null;
  }
}

function writeEntry(entry) {
  const entryPath = getEntryPath(entry.type, entry.id);
  try {
    fs.writeJsonSync(entryPath, entry, { spaces: 2 });
    return entryPath;
  } catch (e) {
    console.error(chalk.red(`Failed to write entry: ${e.message}`));
    process.exit(1);
  }
}

function generateId(type, title) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join('-');
  const ts = Math.floor(Date.now() / 1000);
  return `${type}-${words}-${ts}`;
}

function readAllEntries(index) {
  const entries = [];
  for (const entryPath of Object.values(index.entries)) {
    const entry = readEntry(entryPath);
    if (entry) entries.push(entry);
  }
  return entries;
}

module.exports = {
  getEntryPath,
  readEntry,
  writeEntry,
  generateId,
  readAllEntries,
};
