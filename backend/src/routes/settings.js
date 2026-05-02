const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { getDB } = require('../config/db');
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');

function readJSON(file) {
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return {};
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return {}; }
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

// ── GET /api/settings ─────────────────────────────
router.get('/', auth, (req, res) => {
  res.json(readJSON('settings.json'));
});

// ── PUT /api/settings ─────────────────────────────
router.put('/', auth, roleGuard('admin','manager'), (req, res) => {
  const current = readJSON('settings.json');
  const updated = { ...current, ...req.body };
  writeJSON('settings.json', updated);
  res.json({ message: 'Settings saved', data: updated });
});

// ── GET /api/settings/policies ────────────────────
router.get('/policies', (req, res) => {
  res.json(readJSON('policies.json'));
});

// ── PUT /api/settings/policies ────────────────────
router.put('/policies', auth, roleGuard('admin','manager'), (req, res) => {
  const current = readJSON('policies.json');
  const updated = { ...current, ...req.body };
  writeJSON('policies.json', updated);
  res.json({ message: 'Policies saved', data: updated });
});

module.exports = router;
