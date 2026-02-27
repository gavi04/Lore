'use strict';

const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { requireInit } = require('../lib/guard');
const { LORE_DIR } = require('../lib/index');

const pidFile = () => path.join(LORE_DIR, 'watcher.pid');
const logFile = () => path.join(LORE_DIR, 'watcher.log');

function watch(options) {
  requireInit();

  // Stop daemon
  if (options.stop) {
    const pf = pidFile();
    if (!fs.existsSync(pf)) {
      console.log(chalk.yellow('No watcher running'));
      return;
    }
    const pid = parseInt(fs.readFileSync(pf, 'utf8').trim(), 10);
    try {
      process.kill(pid, 'SIGTERM');
      fs.removeSync(pf);
      console.log(chalk.green(`✓ Stopped watcher (PID ${pid})`));
    } catch (e) {
      console.log(chalk.yellow(`Watcher process not found (PID ${pid}) — cleaning up`));
      fs.removeSync(pf);
    }
    return;
  }

  // Internal worker mode (spawned as detached child)
  if (options.daemonWorker) {
    const { startWatcher } = require('../watcher/index');
    startWatcher({ quiet: true, logFile: logFile() });
    return;
  }

  // Daemon mode: spawn detached child
  if (options.daemon) {
    const { spawn } = require('child_process');
    const lf = logFile();
    fs.ensureFileSync(lf);
    const logFd = fs.openSync(lf, 'a');

    const child = spawn(process.execPath, [process.argv[1], 'watch', '--daemon-worker'], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });
    child.unref();
    fs.closeSync(logFd);

    fs.writeFileSync(pidFile(), String(child.pid));
    console.log(chalk.green(`✓ Lore watcher started (PID ${child.pid})`));
    console.log(chalk.dim(`   Logging to: ${lf}`));
    console.log(chalk.dim('   Stop with: lore watch --stop'));
    return;
  }

  // Foreground mode
  const { startWatcher } = require('../watcher/index');
  startWatcher({});
}

module.exports = watch;
