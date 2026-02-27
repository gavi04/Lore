'use strict';

const fs = require('fs-extra');

function checkStaleness(entry) {
  const results = [];
  const entryDate = new Date(entry.date);

  for (const filepath of entry.files) {
    try {
      if (!fs.existsSync(filepath)) continue;
      const stat = fs.statSync(filepath);
      const mtime = stat.mtime;

      if (mtime > entryDate) {
        const daysAgo = Math.floor((Date.now() - mtime.getTime()) / (1000 * 60 * 60 * 24));
        results.push({ isStale: true, filepath, mtime, daysAgo });
      }
    } catch (e) {
      // Skip files that can't be stat'd
    }
  }

  return results;
}

module.exports = { checkStaleness };
