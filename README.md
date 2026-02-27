# Lore

> *"Your codebase has a story. Lore remembers it."*

Persistent project memory for developers. Every architectural decision, invariant, gotcha, and abandoned approach — captured automatically, structured, versioned in git, and injected into your AI coding sessions.

---

## The Problem

Every AI coding session starts from zero. You re-explain why you chose JWT over sessions, why that Redis approach was abandoned, why the 200ms budget is a hard limit. That context lives in your head, not your codebase.

Without it, your AI assistant suggests things you've already rejected, removes workarounds that exist for real reasons, and retreads ground you've already covered.

Lore fixes that.

---

## Install

```bash
npm install -g lore-memory
```

Or from source:

```bash
git clone https://github.com/Tjindl/Lore
cd Lore
npm install
npm link        # makes `lore` available globally
```

---

## Table of Contents

- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
  - [Day 1: Initialize and populate](#day-1-initialize-and-populate)
  - [Day 2+: Passive capture with the watcher](#day-2-passive-capture-with-the-watcher)
  - [Reviewing drafts](#reviewing-drafts)
  - [Querying your knowledge base](#querying-your-knowledge-base)
  - [Connecting to Claude Code](#connecting-to-claude-code)
  - [Checking health](#checking-health)
  - [Team workflows](#team-workflows)
- [Entry Types](#entry-types)
- [All Commands](#all-commands)
- [How It Works](#how-it-works)
- [MCP Tools Reference](#mcp-tools-reference)
- [Configuration](#configuration)
- [Semantic Search & Embeddings](#semantic-search--embeddings)
- [.lore/ Structure](#lore-structure)

---

## Quick Start

```bash
cd your-project
lore init           # sets up .lore/ and scans for comments
lore watch --daemon # starts passive capture in background
lore mine .         # immediately scan all source files for comments
lore drafts         # review what was found
lore score          # see your knowledge base health
```

---

## Usage Guide

### Day 1: Initialize and populate

**1. Initialize**

```bash
cd your-project
lore init
```

This creates `.lore/` in your project root, installs a git post-commit hook, and immediately scans your codebase for comments worth capturing.

**2. Scan for existing knowledge**

```bash
lore mine .
```

Lore walks every `.js`, `.ts`, `.py`, `.go`, `.rs` file looking for comments that contain signal phrases (`WARNING:`, `because`, `never`, `hack`, `we chose`, etc.). Each match becomes a draft for you to review.

```
📖 Mining comments in . ...
✓ Found 7 drafts — run: lore drafts
```

**3. Review the drafts**

```bash
lore drafts
```

For each draft Lore shows what it found and asks what you want to do:

```
Draft 1 of 7
────────────────────────────────
Type:       invariant
Title:      Never add synchronous calls to payment path
Evidence:   // WARNING: never add synchronous calls here — 200ms SLA
Files:      src/payments/processor.js
Confidence: 90%

  [a] accept   [e] edit   [s] skip   [d] delete   [q] quit
```

- **Accept** — saves it as a real entry, updates the index, generates embedding
- **Edit** — opens a prompt to tweak the title/type/context before saving
- **Skip** — leaves it in the queue for later
- **Delete** — removes permanently

**4. Log entries manually**

For things you know right now, use `lore log`:

```bash
lore log
```

Interactive prompts walk you through type → title → context → files → tags. Or go inline:

```bash
lore log \
  --type decision \
  --title "Use JWT over sessions" \
  --context "API consumed by both mobile and web. Stateless auth was the only option that worked cleanly for both. Sessions require sticky routing which our k8s setup doesn't support." \
  --files "src/auth/"
```

---

### Day 2+: Passive capture with the watcher

```bash
lore watch --daemon     # runs in background, survives terminal close
```

From this point, Lore watches your project and automatically creates drafts when it detects signals:

| What you do | What Lore captures |
|---|---|
| Delete a file > 100 lines | Why did this exist? → graveyard draft |
| Edit the same file 5+ times in a week | This might be a footgun → gotcha draft |
| Commit with "replace", "migrate", "switch" | Decision draft |
| Commit with "never", "always", "must" | Invariant draft |
| Add or remove a dep in `package.json` | Decision or graveyard draft |
| Write `// WARNING:` or `// must never` | Invariant draft |
| Write `// because` or `// we chose` | Decision draft |
| Write `// HACK:` or `// workaround` | Gotcha draft |

To stop the daemon:

```bash
lore watch --stop
```

To run in foreground (useful to see activity live):

```bash
lore watch
```

**Check what the watcher captured:**

```bash
lore status     # shows draft count alongside entry counts
```

```
📖 Lore Status
  decisions:  4
  invariants: 2
  graveyard:  1
  gotchas:    3
  drafts:     5 pending — run: lore drafts
```

---

### Reviewing drafts

```bash
lore drafts
```

Drafts are sorted by confidence — highest first. Each shows the signal that triggered it and which file it came from. You approve or discard each one.

**Batch accept everything high-confidence:**

```bash
lore drafts --auto
```

Accepts all drafts with ≥ 80% confidence silently. Useful after a busy coding session.

**Edit an existing entry:**

```bash
lore edit decision-use-jwt-1703001234
```

Opens the entry JSON in your editor (VSCode by default, falls back to printing the path).

---

### Querying your knowledge base

**Why is this file the way it is?**

```bash
lore why src/payments/stripe.js
lore why src/auth/           # works on directories too
```

Returns entries weighted by how closely they relate to the file:

```
📖 src/payments/stripe.js

[INVARIANT] All payment calls must complete within 200ms
  Never add synchronous external calls to this path.
  Files: src/payments/
  Score: 1.00

[GRAVEYARD] Tried Stripe webhooks with idempotency keys (2023)
  Removed — DB transactions weren't atomic with the webhook handler.
  Files: src/payments/stripe.js
  Score: 1.00

[DECISION] Use polling over webhook push for payment status
  Files: src/payments/ (imported by this file)
  Score: 0.30
```

**Search by keyword:**

```bash
lore search "postgres"
lore search "rate limit"
lore search "why not redis"
```

**See the dependency graph:**

```bash
lore graph --build               # index all imports (run once, updates automatically)
lore graph src/api/server.js     # what does this file import, and what imports it?
```

```
📖 src/api/server.js

Imports:
  src/auth/middleware.js    → 2 Lore entries
  src/payments/processor.js → 1 Lore entry
  src/lib/db.js             → 0 Lore entries

Imported by:
  src/index.js              → 0 Lore entries
```

---

### Connecting to Claude Code

This is where Lore pays off the most. Add the MCP server to your Claude Code config:

**Global** (`~/.claude/settings.json`) — works in every project:

```json
{
  "mcpServers": {
    "lore": {
      "command": "lore",
      "args": ["serve"]
    }
  }
}
```

**Per-project** (`.claude/settings.json` in your repo) — only for this project:

```json
{
  "mcpServers": {
    "lore": {
      "command": "lore",
      "args": ["serve"]
    }
  }
}
```

After restarting Claude Code, Lore is live. You don't need to do anything — Claude automatically calls `lore_why` when you ask it to work on a file, and the context is injected before it writes a single line.

**What Claude sees when you say "refactor src/payments/stripe.js":**

```
[INVARIANT] All payment calls must complete within 200ms
  Never add synchronous external calls to this path.

[GRAVEYARD] Tried Stripe webhooks with idempotency keys
  Removed — DB transactions weren't atomic. Current polling approach is intentional.

[GOTCHA] Stripe test clock doesn't advance automatically in CI
  Call stripe.testHelpers.testClocks.advance() explicitly in test setup.
```

Claude now knows the constraints. It won't suggest adding an inline fraud-check API call. It won't suggest switching to webhooks. It won't write tests that silently break.

**Claude also surfaces your draft queue:**

If you have unreviewed drafts, Claude will mention it:
> *"You have 3 unreviewed Lore drafts — run `lore drafts` to review."*

**Export to CLAUDE.md (without MCP):**

If you prefer a static file over the MCP server:

```bash
lore export
```

Generates a `CLAUDE.md` at project root that Claude Code reads automatically at session start. Less dynamic than MCP (no per-file context injection) but requires no server.

---

### Checking health

**Lore Score:**

```bash
lore score
```

```
📖 Lore Score: 73/100  (Good)
────────────────────────────────

Coverage     ████████░░  80%
  8 / 10 active modules documented
  Highest risk unlogged: src/billing (12 commits this quarter)

Freshness    ███████░░░  70%
  3 entries may be stale — run: lore stale

Depth        ██████░░░░  65%
  14 entries across 8 modules

────────────────────────────────
Trend: 45 → 58 → 73  (improving)
Tip: Add invariants or gotchas to improve your depth score.
```

- **Coverage** — what fraction of your actively-changed modules have at least one entry. "Active" means > 5 commits in the last 90 days.
- **Freshness** — how recently entries were updated relative to their linked files. Stale entries drag this down.
- **Depth** — how many entries you have per active module. Invariants and gotchas count 1.5× because they're the most valuable.

**Stale entries:**

```bash
lore stale
```

```
⚠️  Stale entries (linked files changed since entry was written):

  invariant-payment-timeout  →  src/payments/processor.js changed 4 days ago
  ⚠  External HTTP call added to a performance-critical path
  Review with: lore edit invariant-payment-timeout

  decision-use-polling  →  src/payments/stripe.js changed 12 days ago
  Review with: lore edit decision-use-polling
```

Stale detection combines mtime (file changed after entry was written) with pattern analysis — e.g. if you added a `fetch()` call to a file covered by a 200ms invariant, Lore flags it specifically.

---

### Team workflows

Lore entries live in `.lore/decisions/`, `.lore/invariants/`, etc. as plain JSON files. Commit them like any other source file.

**Recommended `.gitignore` additions** (already set up by `lore init`):

```
.lore/drafts/       # personal draft queue, not shared
.lore/graph.json    # rebuilt automatically
.lore/score.json    # personal history
.lore/watch-state.json
.lore/watcher.pid
.lore/watcher.log
```

**Onboarding a new team member:**

```bash
lore onboard
```

Prints a brief covering recent decisions, active invariants, and anything flagged stale. Useful after a long weekend too:

```bash
lore onboard --days 7    # pretend you've been away 7 days
```

**When you join a repo that already has Lore:**

```bash
git pull
lore status         # see what's there
lore onboard        # get the brief
lore why src/       # see what the whole src/ directory remembers
```

---

## Entry Types

**decision** — An architectural or technical choice with its rationale.

```bash
lore log --type decision \
  --title "Use Postgres over MongoDB" \
  --context "We started with Mongo but our data is highly relational. Join queries were getting complex. Migrated to Postgres in Q3 2023." \
  --files "src/db/"
```

**invariant** — A rule or constraint that must not be broken without deliberate review.

```bash
lore log --type invariant \
  --title "All auth tokens must be validated on every request" \
  --context "Never cache auth results in memory. Token revocation must take effect immediately. This burned us in a security audit." \
  --files "src/auth/middleware.js"
```

**gotcha** — A non-obvious behavior, footgun, or thing that's bitten you.

```bash
lore log --type gotcha \
  --title "Date.now() in test fixtures produces flaky tests" \
  --context "Jest doesn't freeze time by default. Use jest.useFakeTimers() or pass timestamps explicitly. Spent 2 days on this." \
  --files "src/__tests__/"
```

**graveyard** — An approach that was tried and abandoned, with a record of why.

```bash
lore log --type graveyard \
  --title "Tried GraphQL for the public API" \
  --context "Removed in v2. N+1 queries in the default resolver were hammering the DB. REST with explicit eager-loading is intentional." \
  --files "src/api/"
```

---

## All Commands

### Setup & capture

| Command | Description |
|---|---|
| `lore init` | Initialize `.lore/` in the current repo, install git hook |
| `lore log` | Log an entry interactively |
| `lore log --type <t> --title <t> --context <c> --files <f>` | Log inline, no prompts |
| `lore mine [path]` | Scan a file or directory for lore-worthy comments |
| `lore mine .` | Scan the entire project |
| `lore watch` | Start the file watcher in the foreground |
| `lore watch --daemon` | Start the file watcher in the background |
| `lore watch --stop` | Stop the background watcher |

### Review & edit

| Command | Description |
|---|---|
| `lore drafts` | Review pending auto-captured drafts interactively |
| `lore drafts --auto` | Accept all drafts with ≥ 80% confidence silently |
| `lore edit <id>` | Open an entry in your editor |

### Query

| Command | Description |
|---|---|
| `lore why <file>` | Show all entries relevant to a file or directory |
| `lore search <query>` | Search entries by keyword (semantic if Ollama running) |
| `lore graph` | Show dependency graph stats |
| `lore graph <file>` | Show imports and importers for a specific file |
| `lore graph --build` | Build or rebuild the full dependency graph |

### Health & export

| Command | Description |
|---|---|
| `lore status` | Entry counts, draft count, stale summary |
| `lore stale` | Full stale report with semantic pattern analysis |
| `lore score` | Lore Score (0–100): coverage, freshness, depth |
| `lore export` | Generate `CLAUDE.md` at project root |
| `lore onboard` | Print re-onboarding brief |
| `lore onboard --days <n>` | Simulate returning after N days |

### AI integration

| Command | Description |
|---|---|
| `lore serve` | Start the MCP server (used by Claude Code, called automatically) |
| `lore embed` | Generate semantic embeddings for all entries via Ollama |

---

## How It Works

### Comment mining

Lore uses the Babel AST parser for JS/TS files and regex for Python/Go/Rust. It scores each comment on:

- Does it contain a signal phrase? (`must`, `never`, `warning`, `hack`, `because`, `we chose`, `tried`, etc.)
- Is it longer than 20 characters?
- Is it more than a generic `TODO` or `FIXME`?

Comments scoring above the threshold become drafts with a suggested type and a title extracted from the first meaningful words.

### Graph-weighted context

When you run `lore why src/api/payments.js`, entries are ranked by how closely they relate:

| Relationship | Weight |
|---|---|
| Entry directly linked to this file | 1.0 |
| Entry linked to a parent directory | 0.7 |
| Entry for a file this file imports | 0.3 |
| Entry for a file that imports this file | 0.2 |

This means the context you get isn't just "entries tagged to this file" — it's the full blast radius of relevant knowledge, ranked by relevance.

### Staleness detection

Every entry records which files it references. When those files change:

1. **mtime check** — if the file was modified after the entry was written, it's flagged
2. **pattern check** — specific patterns are analyzed: a `fetch()` call added near a 200ms invariant, a WebSocket import near a "we chose polling" decision, a graveyard dep re-appearing in `package.json`

No Ollama required for either of these. If Ollama is running and embeddings exist, a semantic similarity check runs additionally.

---

## MCP Tools Reference

When connected via MCP, Claude Code has access to these tools:

| Tool | Input | Returns |
|---|---|---|
| `lore_why` | `filepath` | All relevant entries for that file, graph-weighted and token-budgeted |
| `lore_overview` | — | Entry counts, Lore Score, draft count, highest-risk unlogged module |
| `lore_stale` | — | Stale entries with mtime and semantic pattern reasons |
| `lore_drafts` | — | Pending draft count and summary |
| `lore_search` | `query` | Matching entries |
| `lore_log` | `type`, `title`, `context`, `files` | Confirmation after saving |

The token budget (default 4000, configurable) ensures Lore never floods Claude's context window. If entries exceed the budget, the lowest-scored ones are summarized to a single line.

---

## Configuration

`.lore/config.yaml` is created by `lore init` with sensible defaults. Edit it to tune behaviour:

```yaml
# Entry types to enable
types:
  - decision
  - invariant
  - graveyard
  - gotcha

# Directories the watcher ignores
watchIgnore:
  - node_modules
  - dist
  - .git
  - coverage

# Comment phrases that trigger draft creation
commentPatterns:
  - must
  - never
  - warning
  - hack
  - because
  - we chose
  - tried

# Minimum confidence for --auto mode in lore drafts
signalThreshold: 0.8

# Pattern-based semantic staleness (no Ollama needed)
semanticStaleness: true

# Lore Score component weights (must sum to 1.0)
scoringWeights:
  coverage: 0.4
  freshness: 0.35
  depth: 0.25

# Max tokens Lore injects into Claude's context per request
mcp:
  tokenBudget: 4000
```

---

## Semantic Search & Embeddings

Optional. Requires [Ollama](https://ollama.com) running locally.

```bash
ollama pull nomic-embed-text
lore embed
```

What this enables:
- `lore search "why not redis"` finds entries that are semantically related, not just keyword matches
- `lore stale` adds similarity-based staleness (diff vs entry embedding)
- MCP `lore_why` ranks entries partly by semantic relevance

Lore works fully without this. All core features — capture, review, why, stale, score, MCP — work with no Ollama dependency.

---

## .lore/ Structure

```
.lore/
  decisions/          ← committed to git
  invariants/         ← committed to git
  graveyard/          ← committed to git
  gotchas/            ← committed to git
  modules/            ← committed to git
  index.json          ← committed to git
  config.yaml         ← committed to git

  drafts/             ← gitignored (personal review queue)
  graph.json          ← gitignored (rebuilt automatically)
  score.json          ← gitignored (personal history)
  watch-state.json    ← gitignored (watcher bookkeeping)
  watcher.pid         ← gitignored (daemon PID)
  watcher.log         ← gitignored (daemon logs)
  embeddings.db       ← gitignored (SQLite, local only)
```

Entries are plain JSON. You can read, edit, or delete them directly. The index is rebuilt on next `lore status` or `lore why` if it drifts.

---

## Stack

Node.js · CommonJS · Commander · Inquirer · Chalk · Chokidar · Babel Parser · fs-extra · js-yaml · natural · better-sqlite3 · Ollama (optional) · MCP SDK
