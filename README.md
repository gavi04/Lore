# Lore

> *"Your codebase has a story. Lore remembers it."*

Persistent project memory for developers. Every architectural decision, invariant, gotcha, and abandoned approach — versioned, structured, and AI-injectable — living inside your repo.

## The Problem

Every AI coding session starts from zero. You re-explain why you chose JWT over sessions, why that Redis approach was abandoned, why token expiry is hard-coded at 15 minutes. That context lives in your head, not your codebase.

Lore fixes that.

## Install

```bash
npm install -g .
# or during development:
npm link
```

## Quick Start

```bash
# Initialize in any git repo
lore init

# Log a decision interactively
lore log

# Or inline
lore log --type decision --title "Use JWT over sessions" --context "Stateless auth for mobile + web" --files "src/auth/"

# See why a file is the way it is
lore why src/auth/middleware.js

# Export everything to CLAUDE.md for AI context
lore export
```

## Commands

| Command | Description |
|---|---|
| `lore init` | Initialize `.lore/` in the current repo |
| `lore log` | Log a decision, invariant, gotcha, or graveyard entry |
| `lore why <file>` | Show all Lore entries linked to a file or directory |
| `lore status` | Count entries and surface stale warnings |
| `lore stale` | Full detail on entries whose linked files have changed |
| `lore search <query>` | Search all entries by keyword |
| `lore export` | Generate `CLAUDE.md` at project root |
| `lore edit <id>` | Open an entry JSON in VSCode |

## Entry Types

- **decision** — An architectural choice and its rationale
- **invariant** — A rule that must not be changed without deliberate review
- **gotcha** — A non-obvious behavior or foot-gun
- **graveyard** — An approach that was tried and abandoned, and why

## How It Works

`lore init` creates a `.lore/` directory at your repo root:

```
.lore/
  decisions/
  invariants/
  graveyard/
  gotchas/
  modules/
  index.json      ← maps files → entry IDs
  config.yaml
```

Each entry is a plain JSON file committed to git. `lore export` generates a `CLAUDE.md` that Claude Code (and other AI tools) read automatically at session start.

## Stack

Node.js · CommonJS · Commander · Inquirer · Chalk · fs-extra · js-yaml