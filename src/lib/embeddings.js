'use strict';

const path = require('path');
const { LORE_DIR } = require('./index');
const { readConfig } = require('./config');

let _db = null;

function getDbPath() {
  return path.join(LORE_DIR, 'embeddings.db');
}

function openDb() {
  if (_db) return _db;
  const Database = require('better-sqlite3');
  _db = new Database(getDbPath());
  _db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      vector TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return _db;
}

async function generateEmbedding(text) {
  const { Ollama } = require('ollama');
  const config = readConfig();
  const model = config.embed && config.embed.model ? config.embed.model : 'nomic-embed-text';
  const ollama = new Ollama();
  const response = await ollama.embeddings({ model, prompt: text });
  return response.embedding;
}

function storeEmbedding(id, vector) {
  const db = openDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO embeddings (id, vector, updated_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(id, JSON.stringify(vector), new Date().toISOString());
}

function getEmbedding(id) {
  const db = openDb();
  const row = db.prepare('SELECT vector FROM embeddings WHERE id = ?').get(id);
  if (!row) return null;
  return JSON.parse(row.vector);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  if (mag === 0) return 0;
  return dot / mag;
}

async function findSimilar(queryText, ids, topN = 5) {
  const queryVec = await generateEmbedding(queryText);
  const db = openDb();
  const results = [];

  for (const id of ids) {
    const row = db.prepare('SELECT vector FROM embeddings WHERE id = ?').get(id);
    if (!row) continue;
    const vec = JSON.parse(row.vector);
    const score = cosineSimilarity(queryVec, vec);
    results.push({ id, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = {
  openDb,
  generateEmbedding,
  storeEmbedding,
  getEmbedding,
  cosineSimilarity,
  findSimilar,
  closeDb,
};
