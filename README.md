# Lore

> *"Your codebase has a story. Lore remembers it."*

Persistent project memory for developers. Every architectural decision, invariant, gotcha, and abandoned approach — captured automatically, structured, versioned in git, and injected into your AI coding sessions.

---

## 🚀 The Problem

Every AI coding session starts from zero. You re-explain why you chose JWT over sessions, why that Redis approach was abandoned, why the 200ms budget is a hard limit. That context lives in your head, not your codebase.

Without it, your AI assistant suggests things you've already rejected, removes workarounds that exist for real reasons, and retreads ground you've already covered.

Lore fixes that by acting as the ultimate "glue" between developers and their AI tools.

---

## 📦 Install

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

## ⚡ Quick Start

```bash
cd your-project
lore init           # sets up .lore/ and scans for comments
lore watch --daemon # starts passive capture in background
lore mine .         # immediately scan all source files for comments
lore ui             # view your knowledge base in a beautiful local browser dashboard
lore prompt "auth"  # generate an AI system prompt based on your memory bank
```

If you ever forget a command, just type `lore` to open the **Interactive Menu**!

---

## 🌟 Key Features

**1. The Local UI Dashboard (`lore ui`)**
Forget reading JSON files. Spin up a stunning, real-time local web server on port 3000 to search your project memory, view your Lore Score health, and read beautifully formatted Markdown entries.

**2. Zero-Shot "Context Compactor" (`lore prompt`)**
Run `lore prompt "Refactoring Auth"` and Lore instantly uses semantic vector search to compile a perfectly formatted, zero-shot system prompt containing the precise rules the LLM needs to know before it touches your code. Just pipe it to your clipboard (`lore prompt "..." | pbcopy`).

**3. Automated Passive Mining (`lore watch` & `lore mine`)**
You don't have to stop coding to document. Lore passively scans your source code for specific comment patterns (like `// WARNING:`, `// HACK:`, or `// IMPORTANT:`) and automatically drafts Lore entries for you to review later via `lore drafts`.

**4. Built-in MCP Server (`lore serve`)**
Full integration with AI native editors (like Cursor) and CLI agents (like Claude Code) via the Model Context Protocol. The AI assistant can seamlessly query your project's memory bank *before* it starts writing code.

**5. The "Architect-in-the-Loop" Git Hook**
During `lore init`, Lore installs a Git post-commit hook. If it detects a massive code change (e.g., >50 lines), it proactively intercepts the terminal and prompts the developer: *"Significant change detected. Do you want to log a Lore decision?"*

**6. Code-Linked Staleness Tracking (`lore stale`)**
Traditional wikis die because they go out of date. With Lore, you link memory entries to specific files (`src/api/auth.js`). If that file is modified in a future commit, Lore flags the entry as `[Stale]`, warning your team that the rule might need updating.

**7. Semantic Vector Search (`lore search`)**
Lore integrates locally with Ollama (`nomic-embed-text`) to generate offline vector embeddings for every entry. You can search by natural language concept, not just exact keyword matches.

---

## 🧠 Entry Types

Lore categorizes engineering knowledge into four distinct, semantic types:

**1. Decision** — An architectural or technical choice with its rationale.
```bash
lore log --type decision --title "Use Postgres over MongoDB" --context "We started with Mongo but our data is highly relational..."
```

**2. Invariant (🔴)** — A rule or constraint that must not be broken without deliberate review.
```bash
lore log --type invariant --title "All auth tokens must be validated on every request" --context "Never cache auth results in memory..."
```

**3. Gotcha (⚠️)** — A non-obvious behavior, footgun, or thing that's bitten you.
```bash
lore log --type gotcha --title "Date.now() in test fixtures produces flaky tests" --context "Jest doesn't freeze time by default..."
```

**4. Graveyard (🪦)** — An approach that was tried and abandoned, with a record of why.
```bash
lore log --type graveyard --title "Tried GraphQL for the public API" --context "Removed in v2 due to N+1 queries..."
```

---

## 🛠️ All Commands

### Setup & Capture
| Command | Description |
|---|---|
| `lore init` | Initialize `.lore/` in the current repo, install git hook |
| `lore log` | Log an entry interactively |
| `lore mine [path]` | Scan a file or directory for lore-worthy comments |
| `lore watch` | Start the file watcher in the foreground |

### Review & Edit
| Command | Description |
|---|---|
| `lore ui` | Launch a local web dashboard to view your memory bank |
| `lore drafts` | Review pending auto-captured drafts interactively |
| `lore edit <id>` | Open an entry in your editor |

### Query & Export
| Command | Description |
|---|---|
| `lore prompt <query>` | Generate a perfectly formatted LLM context prompt from project memory |
| `lore why <file>` | Show all entries relevant to a file or directory |
| `lore search <query>` | Search entries by keyword (semantic if Ollama running) |
| `lore graph` | Show dependency graph stats |
| `lore export` | Generate `CLAUDE.md` at project root |

### Health & Onboarding
| Command | Description |
|---|---|
| `lore status` | Entry counts, draft count, stale summary |
| `lore stale` | Full stale report with semantic pattern analysis |
| `lore score` | Lore Score (0–100): coverage, freshness, depth |
| `lore onboard` | Print re-onboarding brief |

### AI Integration (MCP)
Add the MCP server to your Claude Code config (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "lore": { "command": "lore", "args": ["serve"] }
  }
}
```

---

## 🔒 Privacy & Data

- **100% Free & Open Source:** No subscriptions.
- **Privacy-First (No Cloud API calls):** All semantic embeddings happen on your local machine via Ollama. No proprietary source code is ever sent to a third-party server.
- **Git Native:** All entries are stored as plain JSON in `.lore/` at the root of your project. They are committed alongside your codebase, so your team automatically shares the brain.

## 🏗️ Stack

Node.js · CommonJS · Commander · Inquirer · Express · Tailwind CSS · Chalk · Chokidar · Babel Parser · js-yaml · better-sqlite3 · Ollama (optional) · MCP SDK
