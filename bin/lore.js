#!/usr/bin/env node
'use strict';

const { Command } = require('commander');

const program = new Command();

program
  .name('lore')
  .description('Persistent project memory for developers')
  .version(require('../package.json').version)
  .action(async () => {
    // Only launch the interactive menu if strictly NO arguments were provided
    if (process.argv.length !== 2) return;

    const inquirer = require('inquirer');
    const chalk = require('chalk');
    const { execSync } = require('child_process');

    const LORE_LOGO = `
    ██╗      ██████╗ ██████╗ ███████╗
    ██║     ██╔═══██╗██╔══██╗██╔════╝
    ██║     ██║   ██║██████╔╝█████╗  
    ██║     ██║   ██║██╔══██╗██╔══╝  
    ███████╗╚██████╔╝██║  ██║███████╗
    ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝
    `;

    console.log(chalk.cyan(LORE_LOGO));
    console.log(chalk.dim('    Project Memory for Developers\n'));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '📝 Log new knowledge (lore log)', value: 'log' },
          { name: '👀 Review pending drafts (lore drafts)', value: 'drafts' },
          { name: '📊 View project health (lore score)', value: 'score' },
          { name: '🔍 Search knowledge base (lore search)', value: 'search' },
          { name: '🪄 Generate AI Prompt (lore prompt)', value: 'prompt' },
          { name: '🌐 Open Local Web Dashboard (lore ui)', value: 'ui' },
          { name: '⚙️  Start background watcher (lore watch --daemon)', value: 'watch --daemon' },
          new inquirer.Separator(),
          { name: '❓ Show Help', value: 'help' },
          { name: '❌ Exit', value: 'exit' }
        ],
      },
    ]);

    if (action === 'exit') {
      process.exit(0);
    } else if (action === 'help') {
      program.outputHelp();
    } else if (action === 'prompt') {
      const { query } = await inquirer.prompt([{
        type: 'input',
        name: 'query',
        message: 'What are you trying to build or refactor? (e.g. "Add a login page")'
      }]);
      console.log();
      if (query.trim()) {
        try {
          execSync(`node ${__filename} prompt "${query.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
        } catch (e) { }
      }
    } else {
      console.log();
      try {
        execSync(`node ${__filename} ${action}`, { stdio: 'inherit' });
      } catch (e) { }
    }
  });

// Fuzzy matching for unknown commands
program.on('command:*', function (operands) {
  const chalk = require('chalk');
  console.error(chalk.red(`error: unknown command '${operands[0]}'`));
  const availableCommands = program.commands.map(cmd => cmd.name());

  // Simple Levenshtein distance check for did-you-mean
  let closest = null;
  let minDistance = 3; // only suggest if distance < 3

  for (const cmd of availableCommands) {
    let distance = 0;
    const a = operands[0];
    const b = cmd;
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) { matrix[0][i] = i; }
    for (let j = 0; j <= b.length; j += 1) { matrix[j][0] = j; }
    for (let j = 1; j <= b.length; j += 1) {
      for (let i = 1; i <= a.length; i += 1) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    distance = matrix[b.length][a.length];

    if (distance < minDistance) {
      minDistance = distance;
      closest = cmd;
    }
  }

  if (closest) {
    console.log();
    console.log(chalk.yellow(`Did you mean ${chalk.bold('lore ' + closest)}?`));
  }
  process.exitCode = 1;
});

program
  .command('init')
  .description('Initialize Lore in the current project')
  .action(require('../src/commands/init'));

program
  .command('log')
  .description('Log a new decision, invariant, graveyard entry, or gotcha')
  .option('--type <type>', 'Entry type (decision|invariant|graveyard|gotcha)')
  .option('--title <title>', 'Entry title')
  .option('--context <context>', 'Context/reason')
  .option('--alternatives <alternatives>', 'Alternatives considered')
  .option('--tradeoffs <tradeoffs>', 'Tradeoffs')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--files <files>', 'Comma-separated file paths')
  .action(require('../src/commands/log'));

program
  .command('why <filepath>')
  .description('Show all Lore entries linked to a file or directory')
  .action(require('../src/commands/why'));

program
  .command('status')
  .description('Show entry counts and stale warnings')
  .action(require('../src/commands/status'));

program
  .command('stale')
  .description('Show detailed stale entry report')
  .action(require('../src/commands/stale'));

program
  .command('search [query...]')
  .description('Search all entries for a keyword')
  .action(require('../src/commands/search'));

program
  .command('export')
  .description('Export all entries to CLAUDE.md at project root')
  .action(require('../src/commands/export'));

program
  .command('edit <id>')
  .description('Open an entry JSON in VSCode')
  .action(require('../src/commands/edit'));

program
  .command('serve')
  .description('Start the Lore MCP server (stdio) for use with Claude Code')
  .option('-q, --quiet', 'Suppress startup messages (use when piped into MCP client)')
  .action(require('../src/commands/serve'));

program
  .command('embed')
  .description('Build semantic search index using Ollama (requires ollama pull nomic-embed-text)')
  .action(require('../src/commands/embed'));

program
  .command('onboard')
  .description('Print a re-onboarding brief for this project')
  .option('--days <n>', 'Only show if away for at least N days', '0')
  .action(require('../src/commands/onboard'));

program
  .command('watch')
  .description('Watch project for decisions and mine comments passively')
  .option('-d, --daemon', 'Run as background daemon')
  .option('--stop', 'Stop the running background daemon')
  .option('--daemon-worker', { hidden: true })
  .action(require('../src/commands/watch'));

program
  .command('mine [path]')
  .description('Mine source files for lore-worthy comments and create drafts')
  .action(require('../src/commands/mine'));

program
  .command('drafts')
  .description('Review and approve auto-captured draft entries')
  .option('--auto', 'Auto-accept drafts with confidence >= 0.8')
  .action(require('../src/commands/drafts'));

program
  .command('score')
  .description('Show the Lore Score — memory health metric for this project')
  .action(require('../src/commands/score'));

program
  .command('graph [filepath]')
  .description('Show or build the module dependency graph')
  .option('--build', 'Rebuild the full graph from source')
  .action(require('../src/commands/graph'));

program
  .command('ui')
  .description('Start the local Lore web dashboard')
  .option('-p, --port <port>', 'Port to run the UI server on', '3333')
  .action(require('../src/commands/ui'));

program
  .command('prompt [query...]')
  .description('Generate a perfectly formatted LLM context prompt from project memory')
  .option('-t, --threshold <number>', 'Relevance threshold (0.0 to 1.0)', '0.4')
  .option('-l, --limit <number>', 'Max number of entries to include', '10')
  .action(require('../src/commands/prompt'));

program.parse(process.argv);
