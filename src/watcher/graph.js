'use strict';

const fs = require('fs-extra');
const path = require('path');
const { loadGraph, saveGraph } = require('../lib/graph');

/**
 * Resolve a relative import path to a project-relative file path.
 */
function resolveImport(fromFile, importPath, projectRoot) {
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) return null;

  const fromDir = path.dirname(path.join(projectRoot, fromFile));
  const resolved = path.resolve(fromDir, importPath);
  const relative = path.relative(projectRoot, resolved);

  const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts', '/index.jsx', '/index.tsx'];
  for (const ext of extensions) {
    const candidate = relative + ext;
    if (fs.existsSync(path.join(projectRoot, candidate))) {
      return candidate.replace(/\\/g, '/');
    }
  }
  return null;
}

/**
 * Extract all imports from a source file.
 * Uses @babel/parser for JS/TS, falls back to regex.
 */
function extractImports(code, filePath, projectRoot) {
  const imports = [];

  if (/\.(js|ts|jsx|tsx)$/.test(filePath)) {
    try {
      const babelParser = require('@babel/parser');
      const ast = babelParser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
        errorRecovery: true,
      });

      function visit(node) {
        if (!node || typeof node !== 'object') return;

        // ES import: import x from 'y'
        if (node.type === 'ImportDeclaration' && node.source && node.source.value) {
          const r = resolveImport(filePath, node.source.value, projectRoot);
          if (r) imports.push(r);
        }

        // CJS require: require('y')
        if (
          node.type === 'CallExpression' &&
          node.callee && node.callee.name === 'require' &&
          node.arguments && node.arguments[0] &&
          node.arguments[0].type === 'StringLiteral'
        ) {
          const r = resolveImport(filePath, node.arguments[0].value, projectRoot);
          if (r) imports.push(r);
        }

        for (const key of Object.keys(node)) {
          if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
          const val = node[key];
          if (Array.isArray(val)) val.forEach(v => v && v.type && visit(v));
          else if (val && typeof val === 'object' && val.type) visit(val);
        }
      }

      visit(ast.program);
      return imports;
    } catch (e) {
      // fall through to regex
    }
  }

  // Regex fallback
  const requireRe = /require\(['"]([^'"]+)['"]\)/g;
  const importRe = /import(?:[^'"]*from)?\s*['"]([^'"]+)['"]/g;
  for (const re of [requireRe, importRe]) {
    let m;
    while ((m = re.exec(code)) !== null) {
      const r = resolveImport(filePath, m[1], projectRoot);
      if (r) imports.push(r);
    }
  }
  return imports;
}

/**
 * Update the graph incrementally for a single changed file.
 */
function updateGraphForFile(absFilePath, projectRoot) {
  const graph = loadGraph();
  const filePath = path.relative(projectRoot, absFilePath).replace(/\\/g, '/');

  // Remove old outgoing edges
  const oldImports = graph.imports[filePath] || [];
  for (const dep of oldImports) {
    if (graph.importedBy[dep]) {
      graph.importedBy[dep] = graph.importedBy[dep].filter(f => f !== filePath);
    }
  }

  // Read and parse
  let code = '';
  try { code = fs.readFileSync(absFilePath, 'utf8'); } catch (e) { return; }

  const newImports = extractImports(code, filePath, projectRoot);
  graph.imports[filePath] = newImports;

  for (const dep of newImports) {
    if (!graph.importedBy[dep]) graph.importedBy[dep] = [];
    if (!graph.importedBy[dep].includes(filePath)) {
      graph.importedBy[dep].push(filePath);
    }
  }

  saveGraph(graph);
}

/**
 * Build the full import graph by scanning all JS/TS files.
 */
function buildFullGraph(projectRoot, ignorePatterns) {
  const { globSync } = require('glob');
  const ignore = (ignorePatterns || ['node_modules', 'dist', '.git', '.lore', 'coverage']).map(i => `${i}/**`);

  const graph = { imports: {}, importedBy: {}, lastUpdated: new Date().toISOString() };
  const files = globSync('**/*.{js,ts,jsx,tsx}', { cwd: projectRoot, ignore, absolute: false });

  for (const file of files) {
    let code = '';
    try { code = fs.readFileSync(path.join(projectRoot, file), 'utf8'); } catch (e) { continue; }

    const imports = extractImports(code, file, projectRoot);
    graph.imports[file] = imports;

    for (const dep of imports) {
      if (!graph.importedBy[dep]) graph.importedBy[dep] = [];
      if (!graph.importedBy[dep].includes(file)) graph.importedBy[dep].push(file);
    }
  }

  return graph;
}

module.exports = { updateGraphForFile, buildFullGraph, extractImports };
