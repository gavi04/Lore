'use strict';

const chalk = require('chalk');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const { listDrafts, acceptDraft, deleteDraft } = require('../lib/drafts');
const { LORE_DIR } = require('../lib/index');
const { requireInit } = require('../lib/guard');

async function drafts(options) {
  requireInit();

  const pending = listDrafts();

  if (pending.length === 0) {
    console.log(chalk.green('✓ No pending drafts'));
    return;
  }

  // Auto mode: accept high-confidence, leave rest
  if (options.auto) {
    let accepted = 0;
    for (const draft of pending) {
      if ((draft.confidence || 0) >= 0.8) {
        acceptDraft(draft.draftId);
        console.log(chalk.green(`  ✓ ${draft.suggestedTitle}`));
        accepted++;
      }
    }
    const remaining = pending.length - accepted;
    console.log(chalk.green(`\n📖 Auto-accepted ${accepted} draft${accepted === 1 ? '' : 's'}`));
    if (remaining > 0) {
      console.log(chalk.cyan(`   ${remaining} remaining — run: lore drafts`));
    }
    return;
  }

  console.log(chalk.cyan(`\n📖 ${pending.length} pending draft${pending.length === 1 ? '' : 's'}\n`));

  for (let i = 0; i < pending.length; i++) {
    const draft = pending[i];
    const conf = Math.round((draft.confidence || 0) * 100);
    const typeColor = {
      decision: chalk.blue,
      invariant: chalk.red,
      gotcha: chalk.yellow,
      graveyard: chalk.dim,
    }[draft.suggestedType] || chalk.white;

    console.log(chalk.cyan(`[${i + 1}/${pending.length}] SUGGESTED: ${typeColor(draft.suggestedType.toUpperCase())}  (confidence: ${conf}%)`));
    console.log(`  ${chalk.bold('Title:')}    ${draft.suggestedTitle}`);
    console.log(`  ${chalk.bold('Evidence:')} ${draft.evidence}`);
    if (draft.files && draft.files.length > 0) {
      console.log(`  ${chalk.bold('Files:')}    ${draft.files.join(', ')}`);
    }
    console.log();

    let done = false;
    while (!done) {
      let action;
      try {
        const ans = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'Action:',
          choices: [
            { name: '[a] Accept', value: 'accept' },
            { name: '[e] Edit then save', value: 'edit' },
            { name: '[s] Skip', value: 'skip' },
            { name: '[d] Delete', value: 'delete' },
            { name: '[q] Quit', value: 'quit' },
          ],
        }]);
        action = ans.action;
      } catch (e) {
        console.log(chalk.yellow('\nAborted.'));
        return;
      }

      if (action === 'accept') {
        const entry = acceptDraft(draft.draftId);
        console.log(chalk.green(`  ✓ Saved as ${entry.id}`));
        done = true;
      } else if (action === 'edit') {
        let edited;
        try {
          edited = await inquirer.prompt([
            {
              type: 'list',
              name: 'type',
              message: 'Type:',
              choices: ['decision', 'invariant', 'gotcha', 'graveyard'],
              default: draft.suggestedType,
            },
            {
              type: 'input',
              name: 'title',
              message: 'Title:',
              default: draft.suggestedTitle,
            },
            {
              type: 'input',
              name: 'context',
              message: 'Context:',
              default: draft.evidence,
            },
          ]);
        } catch (e) {
          console.log(chalk.yellow('\nAborted.'));
          return;
        }

        // Update draft on disk, then accept
        const draftPath = path.join(LORE_DIR, 'drafts', `${draft.draftId}.json`);
        fs.writeJsonSync(draftPath, {
          ...draft,
          suggestedType: edited.type,
          suggestedTitle: edited.title,
          evidence: edited.context,
        }, { spaces: 2 });

        const entry = acceptDraft(draft.draftId);
        console.log(chalk.green(`  ✓ Saved as ${entry.id}`));
        done = true;
      } else if (action === 'skip') {
        console.log(chalk.dim('  Skipped'));
        done = true;
      } else if (action === 'delete') {
        deleteDraft(draft.draftId);
        console.log(chalk.dim('  Deleted'));
        done = true;
      } else if (action === 'quit') {
        console.log(chalk.cyan('\n  Remaining drafts saved. Run: lore drafts'));
        return;
      }
    }
    console.log();
  }

  console.log(chalk.green('✓ All drafts reviewed'));
}

module.exports = drafts;
