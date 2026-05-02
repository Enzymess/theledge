const { getDB }          = require('../config/db');
const logger             = require('../utils/logger');
const { sanitizeObject } = require('../utils/sanitize');
const path               = require('path');
const fs                 = require('fs');

function getRooms(req, res, next) {
  try {
    const db    = getDB();
    const rooms = db.find('rooms', r => r.is_active);
    res.json(rooms);
  } catch (err) { next(err); }
}

function getRoom(req, res, next) {
  try {
    const db   = getDB();
    const room = db.findById('rooms', req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) { next(err); }
}

function createRoom(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const { name, description, bed_type, max_occupancy, base_price } = clean;
    if (!name || !base_price) return res.status(400).json({ error: 'Name and base price required' });

    const db   = getDB();
    const room = db.insert('rooms', {
      name, description: description || null,
      bed_type: bed_type || null,
      max_occupancy: parseInt(max_occupancy) || 2,
      base_price: parseFloat(base_price),
      weekday_price: parseFloat(base_price),
      weekend_price: parseFloat(base_price),
      images: [], amenities: [], is_active: true,
    });

    logger.info('Room created', { id: room.id, name, by: req.user.id });
    res.status(201).json({ id: room.id, message: 'Room created' });
  } catch (err) { next(err); }
}

function updateRoom(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const db    = getDB();
    const room  = db.findById('rooms', req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const changes = {};
    if (clean.name          !== undefined) changes.name          = clean.name;
    if (clean.description   !== undefined) changes.description   = clean.description;
    if (clean.bed_type      !== undefined) changes.bed_type      = clean.bed_type;
    if (clean.max_occupancy !== undefined) changes.max_occupancy = parseInt(clean.max_occupancy);
    if (clean.base_price    !== undefined) changes.base_price    = parseFloat(clean.base_price);
    if (clean.weekday_price !== undefined) changes.weekday_price = parseFloat(clean.weekday_price);
    if (clean.weekend_price !== undefined) changes.weekend_price = parseFloat(clean.weekend_price);
    if (clean.is_active     !== undefined) changes.is_active     = Boolean(parseInt(clean.is_active));
    if (clean.amenities     !== undefined) changes.amenities     = Array.isArray(clean.amenities) ? clean.amenities : JSON.parse(clean.amenities || '[]');

    db.updateById('rooms', req.params.id, changes);
    logger.info('Room updated', { id: req.params.id, by: req.user.id });
    res.json({ message: 'Room updated' });
  } catch (err) { next(err); }
}

function uploadPhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const db   = getDB();
    const room = db.findById('rooms', req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const images = [...(room.images || []), `/uploads/rooms/${req.file.filename}`];
    db.updateById('rooms', req.params.id, { images });

    logger.info('Photo uploaded', { room: req.params.id, file: req.file.filename });
    res.json({ url: `/uploads/rooms/${req.file.filename}`, message: 'Photo uploaded' });
  } catch (err) { next(err); }
}

function deletePhoto(req, res, next) {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename required' });

    const db   = getDB();
    const room = db.findById('rooms', req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const images = (room.images || []).filter(img => !img.includes(filename));
    db.updateById('rooms', req.params.id, { images });

    const filePath = path.join(__dirname, '../../uploads/rooms/', path.basename(filename));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ message: 'Photo removed' });
  } catch (err) { next(err); }
}

function deleteRoom(req, res, next) {
  try {
    const db = getDB();
    db.updateById('rooms', req.params.id, { is_active: false });
    logger.info('Room deactivated', { id: req.params.id, by: req.user.id });
    res.json({ message: 'Room deactivated' });
  } catch (err) { next(err); }
}

module.exports = { getRooms, getRoom, createRoom, updateRoom, uploadPhoto, deletePhoto, deleteRoom };
