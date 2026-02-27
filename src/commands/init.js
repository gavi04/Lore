'use strict';

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { LORE_DIR, emptyIndex } = require('../lib/index');

const HOOK_CONTENT = `#!/bin/bash
LINECOUNT=$(git diff HEAD~1 --shortstat 2>/dev/null | grep -o '[0-9]* insertion' | grep -o '[0-9]*' || echo 0)
if [ "\${LINECOUNT:-0}" -gt 50 ]; then
  echo "📖 Lore: Significant change detected. Log it? (y/n)"
  read -r answer </dev/tty
  if [ "$answer" = "y" ]; then
    lore log </dev/tty
  fi
fi
`;

async function init() {
  try {
    const dirs = ['decisions', 'invariants', 'graveyard', 'gotchas', 'modules'];
    for (const dir of dirs) {
      await fs.ensureDir(path.join(LORE_DIR, dir));
    }

    const indexPath = path.join(LORE_DIR, 'index.json');
    if (!fs.existsSync(indexPath)) {
      await fs.writeJson(indexPath, emptyIndex(), { spaces: 2 });
    }

    const configPath = path.join(LORE_DIR, 'config.yaml');
    if (!fs.existsSync(configPath)) {
      const config = {
        version: '1.0',
        project: path.basename(process.cwd()),
        staleAfterDays: 30,
      };
      await fs.writeFile(configPath, yaml.dump(config));
    }

    const hookDir = path.join('.git', 'hooks');
    if (fs.existsSync(hookDir)) {
      const hookPath = path.join(hookDir, 'post-commit');
      await fs.writeFile(hookPath, HOOK_CONTENT);
      await fs.chmod(hookPath, '755');
      console.log(chalk.green('✓ Git post-commit hook installed'));
    } else {
      console.log(chalk.yellow('⚠ Not a git repo — hook not installed'));
    }

    console.log(chalk.green(`✓ Lore initialized at ${LORE_DIR}/`));
    console.log(chalk.cyan('  Run: lore log  to create your first entry'));
  } catch (e) {
    console.error(chalk.red(`Failed to initialize Lore: ${e.message}`));
    process.exit(1);
  }
}

module.exports = init;
