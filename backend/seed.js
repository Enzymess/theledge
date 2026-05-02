// ================================================================
// THE LEDGE BAGUIO — seed.js
// Run once to create your admin account:   node seed.js
// ================================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs     = require('fs');   // FIX: was require('path') which has no existsSync
const path   = require('path');

const DATA_DIR   = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function seed() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // ── Change these before running ───────────────
  const adminEmail    = 'enzosebastian0719@gmail.com';
  const adminName     = 'Enzo Sebastian';
  const adminPassword = 'Admin@Ledge2025';  // ← change this
  // ──────────────────────────────────────────────

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  const hash   = await bcrypt.hash(adminPassword, rounds);

  const users = [{
    id:            1,
    name:          adminName,
    email:         adminEmail,
    google_id:     null,
    password_hash: hash,
    role:          'admin',
    is_active:     true,
    auth_method:   'password',
    last_login:    null,
    created_at:    new Date().toISOString(),
    updated_at:    new Date().toISOString(),
  }];

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  console.log('');
  console.log('✓ Admin account created!');
  console.log('');
  console.log('  Email:    ' + adminEmail);
  console.log('  Password: ' + adminPassword);
  console.log('');
  console.log('  Login at: http://localhost:5000/login');
  console.log('');
  console.log('  → Change the password after your first login.');
  console.log('  → Add your Google credentials to .env to enable Google Sign-In.');
  console.log('');
}

seed().catch(console.error);
