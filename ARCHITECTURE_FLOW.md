# The Lore Architecture Flow

The following sequence diagram outlines exactly how data moves through the Lore application, taking the command `lore why src/auth.js` as an example. 

It highlights both the CLI flow (for a human user) and the MCP flow (for an AI Agent).

```mermaid
sequenceDiagram
    autonumber
    
    actor Developer
    actor AI as AI Agent (Claude/Cursor)
    
    box rgb(40, 44, 52) The Entry Layer
        participant CLI as bin/lore.js
        participant MCP as src/mcp/server.js
        participant Command as src/commands/why.js
        participant Tool as src/mcp/tools/why.js
    end
    
    box rgb(30, 40, 50) The Core Engine (src/lib/)
        participant Relevance as relevance.js
        participant Budget as budget.js
        participant Storage as .lore/ Data
    end
    
    box rgb(20, 35, 45) The Passive Engine (src/watcher/)
        participant Graph as graph.js
    end

    %% Human CLI Flow
    Note over Developer, CLI: Flow A: Human runs `lore why src/auth.js`
    Developer->>CLI: Types `lore why src/auth.js`
    CLI->>CLI: Levenshtein Fuzzy Matcher validates command
    CLI->>Command: Routes to `commands/why.js`
    Command->>Relevance: Calls `scoreEntry(..., 'src/auth.js')`
    
    %% AI MCP Flow
    Note over AI, MCP: Flow B: AI queries project memory
    AI->>MCP: JSON RPC `call_tool(lore_why, {filepath: 'src/auth.js'})`
    MCP->>Tool: Routes to `tools/why.js`
    Tool->>Relevance: Calls `scoreEntry(..., 'src/auth.js')`

    %% Shared Engine Logic
    Relevance->>Graph: Requests dependency map
    Graph-->>Relevance: Returns who imports auth.js & who auth.js imports
    
    Relevance->>Storage: Fetch all Decisions/Gotchas/Invariants
    Storage-->>Relevance: Returns raw JSON entries
    
    Relevance->>Relevance: Calculates Blast Radius Math (Direct=1.0, Parent=0.7, Import=0.3)
    
    %% Output Handling
    alt If triggered by AI (MCP Flow)
        Relevance-->>Tool: Returns sorted entries
        Tool->>Budget: `enforceBudget()` truncates lowest scores to fit LLM window
        Budget-->>Tool: Returns strictly sized Markdown/XML
        Tool-->>MCP: Returns prompt string
        MCP-->>AI: Feeds context natively to Claude
    else If triggered by Human (CLI Flow)
        Relevance-->>Command: Returns sorted entries
        Command->>Command: `format.js` colors and draws ASCII boxes using `chalk`
        Command-->>Developer: Prints beautiful UI into the terminal stdout
    end
```
