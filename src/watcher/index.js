'use strict';

const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const chokidar = require('chokidar');
const { readConfig } = require('../lib/config');
const { LORE_DIR } = require('../lib/index');
const signals = require('./signals');
const { mineFile } = require('./comments');
const { updateGraphForFile } = require('./graph');

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

/**
 * Start the file watcher.
 * @param {object} options - { quiet, logFile }
 */
function startWatcher(options = {}) {
  const projectRoot = process.cwd();
  const config = readConfig();
  const ignore = config.watchIgnore || ['node_modules', 'dist', '.git', 'coverage'];
  // Build regex: any segment matching ignore list or .lore
  const ignoreRe = new RegExp(`(${[...ignore, '\\.lore'].map(s => s.replace('.', '\\.')).join('|')})`);

  let draftCount = 0;

  const log = options.logFile
    ? (msg) => {
      const plain = msg.replace(/\x1B\[[0-9;]*m/g, '');
      fs.appendFileSync(options.logFile, `${new Date().toISOString()} ${plain}\n`);
    }
    : (msg) => console.log(msg);

  if (!options.quiet) {
    console.log(chalk.cyan('📖 Lore Watcher started'));
    console.log(chalk.dim(`   Watching: ${projectRoot}`));
    console.log(chalk.dim(`   Ignoring: ${ignore.join(', ')}`));
    console.log(chalk.dim('   Press Ctrl+C to stop'));
    console.log();
  }

  function recordDraft(draft, filepath) {
    draftCount++;
    const rel = path.relative(projectRoot, filepath) || filepath;
    log(`${chalk.dim(`[${timestamp()}]`)} Signal detected in ${chalk.yellow(rel)} — queued for review`);
  }

  const watcher = chokidar.watch('.', {
    cwd: projectRoot,
    ignored: ignoreRe,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  watcher.on('unlink', async (relPath) => {
    const abs = path.join(projectRoot, relPath);
    const draft = await signals.onFileDeletion(abs, projectRoot);
    if (draft) recordDraft(draft, abs);
  });

  watcher.on('unlinkDir', async (relPath) => {
    const abs = path.join(projectRoot, relPath);
    const draft = await signals.onDirectoryDeletion(abs, projectRoot);
    if (draft) recordDraft(draft, abs);
  });

  watcher.on('add', async (relPath) => {
    const abs = path.join(projectRoot, relPath);
    const draft = await signals.onNewFile(abs, projectRoot);
    if (draft) recordDraft(draft, abs);
  });

  watcher.on('change', async (relPath) => {
    const abs = path.join(projectRoot, relPath);

    // Repeated edit tracking
    const editDraft = await signals.trackFileEdit(abs, projectRoot);
    if (editDraft) recordDraft(editDraft, abs);

    // package.json changes
    if (relPath.endsWith('package.json')) {
      const pkgDrafts = await signals.onPackageJsonChange(abs, projectRoot);
      for (const d of pkgDrafts) recordDraft(d, abs);
    }

    // Comment mining + graph update for source files
    if (/\.(js|ts|jsx|tsx|py|go|rs)$/.test(relPath)) {
      const commentDrafts = await mineFile(abs, projectRoot);
      if (commentDrafts.length > 0) {
        draftCount += commentDrafts.length;
        log(`${chalk.dim(`[${timestamp()}]`)} Mined ${commentDrafts.length} comment${commentDrafts.length === 1 ? '' : 's'} from ${chalk.yellow(relPath)} — queued for review`);
      }

      try { updateGraphForFile(abs, projectRoot); } catch (e) { }
    }
  });

  // Watch COMMIT_EDITMSG to detect new commits
  const commitMsgPath = path.join(projectRoot, '.git', 'COMMIT_EDITMSG');
  let gitWatcher = null;
  if (fs.existsSync(path.join(projectRoot, '.git'))) {
    gitWatcher = chokidar.watch(commitMsgPath, { persistent: true, ignoreInitial: true });
    gitWatcher.on('change', async () => {
      try {
        const message = await fs.readFile(commitMsgPath, 'utf8');
        const drafts = await signals.onCommitMessage(message.trim(), projectRoot);
        for (const d of drafts) {
          draftCount++;
          log(`${chalk.dim(`[${timestamp()}]`)} Commit signal: "${message.slice(0, 60)}" — queued for review`);
        }
      } catch (e) { }
    });
  }

  function shutdown() {
    watcher.close();
    if (gitWatcher) gitWatcher.close();
    if (!options.quiet) {
      console.log();
      console.log(chalk.cyan(`📖 Lore captured ${draftCount} draft${draftCount === 1 ? '' : 's'} today. Review with: lore drafts`));
    }
  }

  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { watcher.close(); if (gitWatcher) gitWatcher.close(); process.exit(0); });

  return watcher;
}

module.exports = { startWatcher };
