'use strict';

const chalk = require('chalk');

function drawBox(content, colorFn, title) {
  const lines = content.split('\n');
  const maxLen = Math.max(
    ...lines.map(l => l.replace(/\x1B\[[0-9;]*m/g, '').length),
    title ? title.length + 4 : 0
  );

  const width = Math.min(80, Math.max(40, maxLen + 2)); // keep between 40 and 80 width

  const top = title
    ? `╭─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 4))}╮`
    : `╭${'─'.repeat(width)}╮`;

  console.log(colorFn(top));

  for (const line of lines) {
    const cleanLen = line.replace(/\x1B\[[0-9;]*m/g, '').length;
    const padding = ' '.repeat(Math.max(0, width - cleanLen - 2));
    console.log(colorFn('│ ') + line + padding + colorFn(' │'));
  }

  console.log(colorFn(`╰${'─'.repeat(width)}╯\n`));
}

function printEntry(entry) {
  let content = '';

  let colorFn = chalk.white;
  let titleColor = chalk.bold.white;

  if (entry.type === 'decision') { colorFn = chalk.cyan; titleColor = chalk.bold.cyan; }
  else if (entry.type === 'invariant') { colorFn = chalk.red; titleColor = chalk.bold.red; }
  else if (entry.type === 'gotcha') { colorFn = chalk.yellow; titleColor = chalk.bold.yellow; }
  else if (entry.type === 'graveyard') { colorFn = chalk.gray; titleColor = chalk.bold.gray; }

  const typeLabel = `[${entry.type.toUpperCase()}]`;
  content += `${titleColor(typeLabel)} ${titleColor(entry.title)} ${chalk.gray('(' + entry.date + ')')}\n\n`;

  // Wrap context text roughly
  const contextWords = entry.context.split(' ');
  let currentLine = '';
  for (const word of contextWords) {
    if (currentLine.length + word.length > 70) {
      content += chalk.white(currentLine) + '\n';
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine) content += chalk.white(currentLine) + '\n';

  if (entry.alternatives && entry.alternatives.length > 0) {
    content += '\n' + chalk.yellow('Alternatives Considered:\n');
    for (const alt of entry.alternatives) {
      content += chalk.yellow(`  → ${alt}\n`);
    }
  }

  if (entry.tradeoffs) {
    content += '\n' + chalk.magenta(`Tradeoffs: ${entry.tradeoffs}\n`);
  }

  if (entry.files && entry.files.length > 0) {
    content += '\n' + chalk.dim(`Files: ${entry.files.join(', ')}\n`);
  }

  drawBox(content.trim(), colorFn, entry.id);
}

module.exports = { printEntry };
