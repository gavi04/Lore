# Lore CLI Architecture Overview

The `lore-memory` repository is designed around the Unix philosophy: do one thing well, be highly modular, and enable users to pipe outputs recursively. 

This document provides a comprehensive breakdown of the core architecture, the directory structure, and how data moves through the application.

## 📂 Directory Structure

The codebase is split into five main conceptual areas inside the `src/` directory:

```text
Lore/
├── bin/
│   └── lore.js          # The CLI entry point and interactive menu
├── src/
│   ├── commands/        # CLI wrappers for every command (e.g. `lore log`, `lore why`)
│   ├── lib/             # The core "engine" (file parsing, AI embeddings, scoring)
│   ├── watcher/         # The passive automation engine (AST parsing, graph building)
│   ├── mcp/             # The Model Context Protocol integration for Claude/Cursor
│   └── ui/              # The local web dashboard frontend
└── package.json
```

---

## 1. The Entry Point (`bin/lore.js`)

This acts as the front door for the application. 
- It uses the `commander` package to register and parse all CLI subcommands.
- It provides an **Interactive Menu** (via `inquirer`) if the user simply types `lore` without any arguments.
- It includes a completely custom **Fuzzy Command Matcher** utilizing Levenshtein distance. If a user mistypes a command (e.g., `lore servee`), it will gracefully suggest or alias the correct command.

---

## 2. The Core Engine (`src/lib/`)

This directory is the absolute backbone of Lore. It contains the business logic for reading, writing, and scoring knowledge entries. If you were to build a standalone Desktop GUI app later, this is the folder you would reuse.

- **`entries.js` & `index.js`**: These files manage the `.lore/` directory. `entries.js` handles reading/writing the actual Markdown/JSON files (for decisions, invariants, etc.). `index.js` maintains a fast, lightweight lookup index so commands execute instantly without constantly crawling the filesystem.
- **`relevance.js`**: The secret sauce behind `lore why`. It implements the **Blast Radius Algorithm**—which mathematically scores how relevant an entry is to a specific file based on:
  - Direct links (1.0 weight)
  - Parent directory links (0.7 weight)
  - Imported files (0.3 weight)
  - Importers (0.2 weight)
- **`embeddings.js`**: The AI semantic layer. It talks recursively to your local **Ollama** instance (`nomic-embed-text`) to convert your entries into mathematical vector embeddings and performs cosine similarity scoring.
- **`budget.js`**: A critical file for AI agents. It intelligently truncates contexts (starting with the lowest relevance entries) to ensure the MCP server never blows up an LLM’s context window.

---

## 3. The Commands (`src/commands/`)

These files act as thin wrappers. They parse user input from the CLI, format the output nicely with `chalk`, and pass the real work down into `src/lib/`. 

- **`init.js`**: Bootstraps the `.lore/` folder and dynamically injects the **Architect-in-the-Loop** hook into `.git/hooks/post-commit`.
- **`prompt.js`**: Takes a natural language query, runs semantic search via `embeddings.js`, and uses `formatPromptContext()` to build a strictly formatted, zero-shot system prompt tailored for LLMs.
- **`ui.js`**: Spins up an Express web server on port 3333. It exposes internal REST APIs (`/api/stats`, `/api/drafts`) and serves the vanilla frontend static site.

---

## 4. The Passive Engine (`src/watcher/`)

This directory is what makes Lore feel "magical". You don't have to remember to document things because the watcher does it for you in the background.

- **`comments.js`**: Uses the `@babel/parser` to build an Abstract Syntax Tree (AST) of JavaScript/TypeScript files. It extracts all comments, checks them against signal words (`// WARNING:`, `// HACK:`), and asynchronously generates drafts.
- **`graph.js`**: Another AST parser. This one specifically traverses `import` and `require()` statements to build a living dependency graph of your codebase (`.lore/graph.json`). This powers the relevance weighting.
- **`staleness.js`**: Compares the `mtime` (last modified date) of your source code files against the timestamp a Lore entry was originally written.

---

## 5. The MCP Server (`src/mcp/`)

This directory allows Lore to talk directly to AI coding assistants like Claude Code and Cursor.

- **`server.js`**: Implements the official `@modelcontextprotocol/sdk`. It exposes Lore's internal functions as secure "tools" that LLMs can invoke.
- **`tools/`**: Each file here is a highly isolated schema for Claude to use. For example, `why.js` maps Claude's `lore_why` tool request directly to our internal `relevance.js` logic and returns exactly the budget-constrained context the LLM needs to make safe architectural decisions.

---

## 6. The Web Frontend (`src/ui/public/`)

The local UI dashboard. It avoids heavy framework bloat by being a completely vanilla, dependency-free frontend.

- **`app.js`**: Fetches telemetry from the backend (via `fetch('/api/stats')`) and renders it to the DOM. Handles the interactive draft approval UI.
- **`style.css`**: Pure CSS, using a modern dark-mode aesthetic with glassmorphism and smooth hover state animations.

---

## Data Flow Example: running \`lore why src/auth.js\`

1. User types `lore why src/auth.js` in the terminal.
2. `bin/lore.js` uses fuzzy matching to confirm the command and routes the request to `src/commands/why.js`.
3. `why.js` passes the target path to `relevance.js`.
4. `relevance.js` cross-references `src/auth.js` with the dependency graph built by `watcher/graph.js`.
5. It mathematically models the relevance of all entries in `.lore/` using graph weighting.
6. The compiled, sorted array of entries is sent back up to `why.js`.
7. `why.js` passes the entries to `lib/format.js` to draw the beautiful terminal boxes using `chalk`, and prints the final output to standard out.
