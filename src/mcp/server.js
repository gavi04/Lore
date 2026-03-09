'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const why = require('./tools/why');
const search = require('./tools/search');
const log = require('./tools/log');
const update = require('./tools/update');
const stale = require('./tools/stale');
const overview = require('./tools/overview');
const drafts = require('./tools/drafts');

const TOOLS = [why, search, log, update, stale, overview, drafts];

async function startServer() {
  const server = new Server(
    { name: 'lore', version: '0.3.0' },
    { capabilities: { tools: {} } }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map(t => t.toolDefinition),
  }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = TOOLS.find(t => t.toolDefinition.name === name);

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    return tool.handler(args || {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep process alive
  process.stdin.resume();
}

module.exports = { startServer };
