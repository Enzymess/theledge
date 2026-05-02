/* ============================================================
   THE LEDGE BAGUIO — Homepage Images Routes (fixed)
   ============================================================ */

const express    = require('express');
const router     = express.Router();
const path       = require('path');
const fs         = require('fs');
const auth       = require('../middleware/auth');       // FIX: single default export
const roleGuard  = require('../middleware/roleGuard'); // FIX: use roleGuard like every other route

const IMAGES_FILE = path.join(__dirname, '../../data/homepage_images.json');

function ensureImagesFile() {
  if (!fs.existsSync(IMAGES_FILE)) {
    const dir = path.dirname(IMAGES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(IMAGES_FILE, JSON.stringify({}));
  }
}

// Public — get homepage images
router.get('/', (req, res) => {
  try {
    ensureImagesFile();
    res.json(JSON.parse(fs.readFileSync(IMAGES_FILE, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load images' });
  }
});

// Admin — get homepage images
router.get('/admin', auth, roleGuard('admin', 'manager'), (req, res) => {
  try {
    ensureImagesFile();
    res.json(JSON.parse(fs.readFileSync(IMAGES_FILE, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load images' });
  }
});

// Admin — update all homepage images at once
router.post('/', auth, roleGuard('admin', 'manager'), (req, res) => {
  try {
    ensureImagesFile();
    const validKeys = ['hero','showcase1','showcase2','showcase3','showcase4','showcase5','room1','room2','room3'];
    const filtered  = {};
    validKeys.forEach(key => { if (req.body[key]) filtered[key] = req.body[key]; });
    fs.writeFileSync(IMAGES_FILE, JSON.stringify(filtered, null, 2));
    res.json({ success: true, message: 'Homepage images updated', data: filtered });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save images' });
  }
});

// Admin — upload / set a single image by key
router.post('/:key', auth, roleGuard('admin', 'manager'), (req, res) => {
  try {
    const { key } = req.params;
    const validKeys = ['hero','showcase1','showcase2','showcase3','showcase4','showcase5','room1','room2','room3'];
    if (!validKeys.includes(key)) return res.status(400).json({ error: 'Invalid image key' });

    const url = req.body.url || `/uploads/homepage/${key}.jpg`;
    ensureImagesFile();
    const images = JSON.parse(fs.readFileSync(IMAGES_FILE, 'utf8'));
    images[key]  = url;
    fs.writeFileSync(IMAGES_FILE, JSON.stringify(images, null, 2));
    res.json({ success: true, message: 'Image updated', url });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update image' });
  }
});

module.exports = router;
