// ================================================================
// THE LEDGE BAGUIO — db.js (JSON File Database)
// All data is stored in backend/data/*.json files.
// No MySQL or any external database needed.
// ================================================================

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function read(collection) {
  const file = path.join(DATA_DIR, `${collection}.json`);
  if (!fs.existsSync(file)) { fs.writeFileSync(file, '[]', 'utf8'); return []; }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function write(collection, data) {
  const file = path.join(DATA_DIR, `${collection}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function nextId(records) {
  if (!records.length) return 1;
  return Math.max(...records.map(r => r.id || 0)) + 1;
}

const db = {
  all(collection) {
    return read(collection);
  },

  find(collection, filterOrFn) {
    const records = read(collection);
    if (typeof filterOrFn === 'function') return records.filter(filterOrFn);
    return records.filter(r => Object.entries(filterOrFn).every(([k, v]) => r[k] === v));
  },

  findOne(collection, filterOrFn) {
    return this.find(collection, filterOrFn)[0] || null;
  },

  findById(collection, id) {
    return this.findOne(collection, r => r.id === parseInt(id));
  },

  insert(collection, data) {
    const records = read(collection);
    const record  = { ...data, id: nextId(records), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    records.push(record);
    write(collection, records);
    return record;
  },

  update(collection, filterOrFn, changes) {
    const records = read(collection);
    let count = 0;
    const updated = records.map(r => {
      const match = typeof filterOrFn === 'function'
        ? filterOrFn(r)
        : Object.entries(filterOrFn).every(([k, v]) => r[k] === v);
      if (match) { count++; return { ...r, ...changes, updated_at: new Date().toISOString() }; }
      return r;
    });
    write(collection, updated);
    return count;
  },

  updateById(collection, id, changes) {
    return this.update(collection, r => r.id === parseInt(id), changes);
  },

  delete(collection, filterOrFn) {
    const records = read(collection);
    const filtered = records.filter(r => {
      const match = typeof filterOrFn === 'function'
        ? filterOrFn(r)
        : Object.entries(filterOrFn).every(([k, v]) => r[k] === v);
      return !match;
    });
    write(collection, filtered);
    return records.length - filtered.length;
  },

  deleteById(collection, id) {
    return this.delete(collection, r => r.id === parseInt(id));
  },

  count(collection, filterOrFn) {
    if (!filterOrFn) return read(collection).length;
    return this.find(collection, filterOrFn).length;
  },
};

async function connectDB() {
  const logger = require('../utils/logger');
  logger.info(`JSON database ready — data: ${DATA_DIR}`);
  return db;
}

function getDB() { return db; }

module.exports = { connectDB, getDB, db };
