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
npm install -g .

# or during development
npm link
```

---

## Quick Start

```bash
# Initialize Lore in any git repo
lore init

# Start passive capture — Lore watches your work and builds memory automatically
lore watch

# Review what it found (takes ~30 seconds)
lore drafts

# Ask why a file is the way it is
lore why src/payments/stripe.js

# Check your knowledge base health
lore score
```

That's it. After `lore init` + `lore watch`, Lore runs in the background and surfaces things worth remembering. You approve or skip. Nothing is written without your review.

---

## How It Works

### Passive capture

`lore watch` monitors your project and creates **drafts** when it detects signals:

| Event | Draft created |
|---|---|
| You delete a file > 100 lines | "Why did this exist?" → graveyard |
| You edit the same file 5+ times in a week | "This might be a footgun" → gotcha |
| Commit message contains "replace", "migrate" | Decision entry |
| `package.json` dep added or removed | Decision or graveyard |
| Code comment contains `WARNING:`, `never`, `must` | Invariant |
| Code comment contains `because`, `we chose`, `note:` | Decision |

Nothing auto-saves. Every draft goes through `lore drafts` first.

### Comment mining

```js
// WARNING: never add synchronous calls to this path — 200ms SLA
// We chose polling over WebSockets because our infra blocks long-lived connections
// HACK: Safari doesn't support ReadableStream cancel, so we fall back here
```

Lore picks these up automatically during `lore watch`, or on demand with `lore mine`.

### Graph-weighted context

`lore why src/api/payments.js` returns entries weighted by relationship:

| Source | Weight |
|---|---|
| Entries directly linked to this file | 1.0 |
| Entries linked to parent directories | 0.7 |
| Entries for files this file imports | 0.3 |
| Entries for files that import this file | 0.2 |

### Staleness detection

Lore tracks which files each entry references. When those files change, `lore stale` surfaces it — including pattern-based semantic checks (e.g. "External HTTP call added to a performance-critical path").

---

## Commands

### Capture

| Command | Description |
|---|---|
| `lore log` | Log a decision, invariant, gotcha, or graveyard entry interactively |
| `lore log --type decision --title "..." --context "..." --files "src/"` | Inline logging |
| `lore mine [path]` | Scan a file or directory for comments worth capturing |
| `lore watch` | Start the file watcher (foreground) |
| `lore watch --daemon` | Start the file watcher in the background |
| `lore watch --stop` | Stop the background watcher |

### Review

| Command | Description |
|---|---|
| `lore drafts` | Interactively review pending auto-captured drafts |
| `lore drafts --auto` | Accept all drafts with ≥ 80% confidence automatically |
| `lore edit <id>` | Open an entry in your editor |

### Query

| Command | Description |
|---|---|
| `lore why <file>` | Show all Lore entries relevant to a file or directory |
| `lore search <query>` | Search entries by keyword |
| `lore graph [file]` | Show import relationships and entry coverage |
| `lore graph --build` | Build (or rebuild) the full dependency graph |

### Health

| Command | Description |
|---|---|
| `lore status` | Entry counts, draft count, stale summary |
| `lore stale` | Full detail on entries whose linked files have changed |
| `lore score` | Lore Score (0–100) with coverage, freshness, and depth breakdown |
| `lore export` | Generate `CLAUDE.md` at project root for AI context injection |

---

## Entry Types

**decision** — An architectural choice and its rationale.
> *"We use JWT over sessions because the API is consumed by both mobile and web. Stateless auth was the only option that worked cleanly for both."*

**invariant** — A rule that must not change without deliberate review.
> *"All payment API calls must complete within 200ms. Never add synchronous external calls to this path."*

**gotcha** — A non-obvious behavior or footgun.
> *"Jest mocks bleed between test files if you use require() without jest.resetModules() in beforeEach. Lost 3 days to this."*

**graveyard** — An approach that was tried and abandoned, and why.
> *"Tried Prisma ORM in 2023. Removed because it couldn't handle our multi-tenant row-level security pattern. Raw pg queries are intentional."*

---

## Lore Score

`lore score` gives you a health metric for your knowledge base:

```
📖 Lore Score: 73 / 100

  Coverage   ████████░░  80%   (8 / 10 active modules documented)
  Freshness  ███████░░░  70%   (3 entries may be stale)
  Depth      ██████░░░░  65%   (14 entries across 8 modules)

  Trend: 45 → 58 → 73 (improving)
  Tip: Add invariants or gotchas to improve your depth score.
```

- **Coverage** — what fraction of actively-developed modules have at least one Lore entry
- **Freshness** — how recently entries were updated relative to their linked files
- **Depth** — how many entries exist per active module (invariants and gotchas count 1.5×)

---

## MCP Server (Claude Code Integration)

Lore ships with an MCP server that gives Claude Code direct access to your knowledge base — no manual export needed.

### Setup

Add to your Claude Code MCP config (`~/.claude/mcp_settings.json` or project `.claude/settings.json`):

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

### What Claude gets

| Tool | What it does |
|---|---|
| `lore_why` | Fetches all relevant entries for a file, weighted by import graph distance |
| `lore_overview` | Project summary: entry counts, Lore Score, pending drafts |
| `lore_stale` | Entries whose linked files changed, with semantic pattern analysis |
| `lore_drafts` | Pending draft count and summary — Claude surfaces this proactively |
| `lore_search` | Keyword search across all entries |
| `lore_log` | Claude can create new entries during a session |

### What this means in practice

When you ask Claude to work on `src/payments/stripe.js`, it automatically calls `lore_why` and gets back:

```
[INVARIANT] All payment calls must complete within 200ms
  Never add synchronous external calls to this path.

[GRAVEYARD] Tried Stripe webhooks with idempotency keys (2023)
  Removed — our DB transactions weren't atomic with the webhook handler.
  Current approach uses polling + reconciliation job.

[GOTCHA] Stripe's test clock doesn't advance automatically in CI
  You must call stripe.testHelpers.testClocks.advance() explicitly.
```

Claude now knows the constraints before writing a line. It won't suggest the approaches you've already rejected.

---

## .lore/ Structure

```
.lore/
  decisions/          ← decision entry JSON files
  invariants/         ← invariant entry JSON files
  graveyard/          ← graveyard entry JSON files
  gotchas/            ← gotcha entry JSON files
  drafts/             ← pending auto-captured drafts (gitignored)
  modules/            ← per-module onboarding guides
  index.json          ← maps file paths → entry IDs
  graph.json          ← import dependency graph (gitignored)
  score.json          ← score history (gitignored)
  config.yaml         ← Lore configuration
```

Entries are plain JSON files committed to git. `drafts/`, `graph.json`, `score.json`, and watcher state are gitignored by default.

---

## config.yaml

```yaml
# Entry types to enable
types:
  - decision
  - invariant
  - graveyard
  - gotcha

# Passive watcher
watchMode: false          # set true to auto-start on init
watchIgnore:
  - node_modules
  - dist
  - .git
  - coverage

# Comment mining — phrases that trigger draft creation
commentPatterns:
  - must
  - never
  - warning
  - hack
  - because
  - we chose

# Confidence threshold for --auto mode in lore drafts
signalThreshold: 0.8

# Semantic staleness (pattern-based, no Ollama required)
semanticStaleness: true

# Lore Score weights
scoringWeights:
  coverage: 0.4
  freshness: 0.35
  depth: 0.25

# MCP token budget
mcp:
  tokenBudget: 4000
```

---

## Semantic Search & Embeddings (optional)

If you have [Ollama](https://ollama.com) running locally:

```bash
ollama pull nomic-embed-text
lore embed          # generate embeddings for all entries
```

This enables:
- Semantic search in `lore search` (beyond keyword matching)
- Deeper semantic staleness detection in `lore stale` and `lore_stale`

Lore works fully without Ollama — embeddings are an optional enhancement.

---

## Stack

Node.js · CommonJS · Commander · Inquirer · Chalk · Chokidar · Babel Parser · fs-extra · js-yaml · natural · better-sqlite3 · Ollama (optional) · MCP SDK
