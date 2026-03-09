# Lore: Documentation
> *Your codebase has a story. Lore remembers it.*

Lore is a privacy-first, zero-configuration Project Memory system for developers and AI agents. It acts as the ultimate "glue" between human engineers and AI coding assistants by capturing architectural decisions, constraints, and known traps, and structurally injecting them straight into your AI's context window.

---

## 🚀 The Core Problem
Every time you start an AI coding session (with Claude, Copilot, or Cursor), the AI starts with **amnesia**. 

It might suggest using Redis, even though your team explicitly decided against Redis two months ago. It might add caching to an auth route where caching is strictly forbidden. You have to constantly re-explain your project rules, boundaries, and past decisions to the AI because that "context" only lives in your head, not in the codebase.

Lore fixes this by acting as a permanent, version-controlled **long-term memory bank** for your codebase.

---

## 🧠 Core Concepts (Entry Types)
Lore categorizes engineering knowledge into four specific types:

1. ⚖️ **Decision**: *Why did we do this?* (e.g., "We chose Next.js over Vite for SSR").
2. 🔴 **Invariant**: *What must NEVER be broken?* (e.g., "Auth tokens must NEVER be logged to the console").
3. ⚠️ **Gotcha**: *What is a known trap?* (e.g., "The payment webhook occasionally fires twice, always debounce it").
4. 🪦 **Graveyard**: *What did we try that failed?* (e.g., "We tried GraphQL, but it caused N+1 issues and was removed").

By structuring knowledge this way, Lore forces Language Models to pay strict attention to the *rationale* behind your rules, drastically reducing AI hallucinations and bad architectural suggestions.

---

## 🌟 Comprehensive Feature List

### 1. The Context Compactor (`lore prompt`)
The killer feature for AI web users. Run `lore prompt "Refactoring Auth"` and Lore instantly uses semantic vector search to compile a perfectly formatted, zero-shot system prompt containing the precise rules the LLM needs to know *before* it touches your code. Just pipe it to your clipboard (`lore prompt "..." | pbcopy`) and paste it into ChatGPT or Claude Web.

### 2. Built-in MCP Server (`lore serve`)
Complete native integration with AI editors (like Cursor) and CLI agents (like Claude Code) via the **Model Context Protocol (MCP)**. 
Lore exposes secure "Tools" directly to the AI. If Claude decides it needs to edit `src/auth.js`, it autonomously queries Lore via MCP and silently injects your project's rules into its own working memory before writing a single line of code.

### 3. Automated Passive Mining (`lore watch`)
You don't have to stop coding to document. Run `lore watch --daemon` and Lore passively scans your source code in the background. It looks for specific comment patterns (like `// WARNING:`, `// HACK:`, or `// IMPORTANT:`) and automatically extracts them into pending "Drafts" for you to review later.

### 4. Code-Linked Staleness Tracking (`lore stale`)
Traditional wikis die because they go out of date. With Lore, you link memory entries to specific files (`src/api/auth.js`). If that file is modified six months later, Lore flags the entry as `[Stale]`, warning your team that the rule might need updating.

### 5. Semantic Vector Search (`lore search`)
Lore integrates locally with Ollama (`nomic-embed-text`) to generate offline vector embeddings for every entry. You can search your knowledge base by natural language concept (e.g., "database migrations"), not just exact keyword matches. No cloud APIs or external Vector Databases required—everything is stored natively in JSON!

### 6. The Local UI Dashboard (`lore ui`)
Forget reading raw JSON files. Spin up a stunning, real-time local web server on port `3333` to search your project memory, view your Lore Score health, and read beautifully formatted entries in your browser.

### 7. The "Architect-in-the-Loop" Git Hook
During `lore init`, Lore natively installs a Git post-commit hook. If it detects a massive architectural code change (e.g., >50 lines), it proactively intercepts your terminal and asks: *"Significant change detected. Do you want to log a Lore decision?"*

---

## ⚙️ How it Works Under the Hood

Lore operates primarily on the **Unix Philosophy**: do one thing perfectly, keep it lightweight, and make it modular.

### The Blast Radius Algorithm (Relevance Scoring)
When checking if a Lore entry applies to a specific file (e.g., `lore why src/auth.js`), Lore doesn't just do a dumb keyword search. It runs a proprietary "Blast Radius" calculation:
- It uses the Babel Parser to build a living AST dependency graph of your code (`.lore/graph.json`).
- It scores entries mathematically: **Direct file links** get top priority (1.0). **Parent directory** links get (0.7). If `auth.js` **imports** a database file, the database rules are recursively pulled in with a lesser weight (0.3).
- Before handing these rules to an LLM, Lore strictly enforces an **Attention Token Budget**, slicing off the lowest-scoring rules so the AI never suffers from "Context Rot".

### Data Storage & Privacy
Lore is **100% Local and Privacy-First**. 
- It uses zero proprietary cloud endpoints.
- No heavy databases are required (no Postgres, MongoDB, or Pinecone).
- All decisions, embeddings, and graphs are saved as plain `.json` and `.md` files directly inside your repository's `.lore/` folder.
- This means your project's "Brain" is natively version-controlled in Git, and any developer who pulls your repo instantly shares the exact same AI boundaries!
