'use strict';

const fs = require('fs-extra');
const yaml = require('js-yaml');
const path = require('path');
const { LORE_DIR } = require('./index');

const DEFAULTS = {
  version: '1.0',
  staleAfterDays: 30,
  embed: {
    model: 'nomic-embed-text',
    autoEmbed: true,
  },
  mcp: {
    tokenBudget: 4000,
    confirmEntries: true,
  },
};

function readConfig() {
  const configPath = path.join(LORE_DIR, 'config.yaml');
  let fileConfig = {};
  try {
    if (fs.existsSync(configPath)) {
      fileConfig = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
    }
  } catch (e) {
    // Fall back to defaults on parse error
  }
  return deepMerge(DEFAULTS, fileConfig);
}

function deepMerge(base, override) {
  const result = Object.assign({}, base);
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      base[key] !== null &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

module.exports = { readConfig };
