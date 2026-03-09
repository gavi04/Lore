'use strict';

const express = require('express');
const path = require('path');
const chalk = require('chalk');
const { requireInit } = require('../lib/guard');
const { readIndex, LORE_DIR } = require('../lib/index');
const { readEntry } = require('../lib/entries');
const { computeScore } = require('../lib/scorer');
const { listDrafts, acceptDraft, deleteDraft } = require('../lib/drafts');
const { getServerStatus } = require('../mcp/status');

// Only load 'open' dynamically to avoid overhead on other CLI commands if not needed
async function openBrowser(url) {
    const open = (await import('open')).default;
    await open(url);
}

function createApp(portNum) {
    const app = express();
    const PORT = portNum || 3333;

    app.use(express.json());

    // CORS for local dev
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        next();
    });

    // API Endpoints

    app.get('/api/stats', (req, res) => {
        try {
            const scoreData = computeScore();
            const drafts = listDrafts();

            const index = readIndex();
            const counts = { decision: 0, invariant: 0, graveyard: 0, gotcha: 0 };
            for (const entryPath of Object.values(index.entries)) {
                const entry = readEntry(entryPath);
                if (entry && counts[entry.type] !== undefined) counts[entry.type]++;
            }

            res.json({
                score: scoreData,
                counts,
                draftCount: drafts.length,
                totalEntries: Object.keys(index.entries).length
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/mcp-status', (req, res) => {
        try {
            const status = getServerStatus();
            res.json({
                active: !!status,
                ...(status || {}),
            });
        } catch (e) {
            res.json({ active: false });
        }
    });

    app.get('/api/entries', (req, res) => {
        try {
            const index = readIndex();
            const entries = [];
            for (const entryPath of Object.values(index.entries)) {
                const entry = readEntry(entryPath);
                if (entry) entries.push(entry);
            }
            // Sort newest first
            entries.sort((a, b) => new Date(b.date) - new Date(a.date));
            res.json(entries);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/drafts', (req, res) => {
        try {
            const drafts = listDrafts();
            res.json(drafts);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/drafts/:id/accept', (req, res) => {
        try {
            const entry = acceptDraft(req.params.id);
            res.json({ success: true, entry });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.delete('/api/drafts/:id', (req, res) => {
        try {
            deleteDraft(req.params.id);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/graph', (req, res) => {
        try {
            const { loadGraph, saveGraph } = require('../lib/graph');
            let g = loadGraph();

            if (Object.keys(g.imports).length === 0) {
                const { buildFullGraph } = require('../watcher/graph');
                g = buildFullGraph(process.cwd());
                saveGraph(g);
            }

            const nodesSet = new Set();
            const edges = [];
            for (const [file, deps] of Object.entries(g.imports)) {
                nodesSet.add(file);
                for (const dep of deps) {
                    nodesSet.add(dep);
                    edges.push({ from: file, to: dep });
                }
            }

            const nodes = Array.from(nodesSet).map(id => ({ id, label: id }));
            res.json({ nodes, edges });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Handle unmapped API routes with 404 JSON (instead of serving index.html)
    app.use('/api', (req, res) => {
        res.status(404).json({ error: 'API route not found' });
    });

    // Serve the frontend application
    const uiPath = path.join(__dirname, '..', 'ui', 'public');
    app.use(express.static(uiPath));

    // Catch-all to serve index.html for SPA routing
    app.use((req, res) => {
        res.sendFile(path.join(uiPath, 'index.html'));
    });

    const server = app.listen(PORT, () => {
        const url = `http://localhost:${PORT}`;
        console.log(chalk.green(`\n🚀 Lore UI Dashboard running at ${chalk.bold(url)}\n`));
        console.log(chalk.cyan(`  Press Ctrl+C to stop the server.`));

        // Use native exec to open browser to avoid ESM import issues with 'open'
        const { exec } = require('child_process');
        const startPath = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${startPath} ${url}`, (err) => {
            if (err) {
                console.log(chalk.dim(`  (Could not open browser automatically. Please visit ${url} manually)`));
            }
        });
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(chalk.red(`\nPort ${PORT} is already in use by another process.`));
            console.error(chalk.yellow(`Use 'lore ui --port <number>' to specify a different port.\n`));
            process.exit(1);
        } else {
            console.error(chalk.red(`\nFailed to start server: ${e.message}\n`));
            process.exit(1);
        }
    });

    return server;
}

/**
 * Start just the dashboard Express server (called from serve.js).
 * @param {number} port
 * @returns {object} Express server instance
 */
function startDashboard(port) {
    return createApp(port || 3333);
}

function ui(options) {
    requireInit();
    createApp(options.port || 3333);
}

module.exports = ui;
module.exports.startDashboard = startDashboard;
