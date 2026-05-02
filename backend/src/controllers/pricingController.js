const { getDB }          = require('../config/db');
const { sanitizeObject } = require('../utils/sanitize');
const logger             = require('../utils/logger');

function getRates(req, res, next) {
  try {
    const db    = getDB();
    const rooms = db.all('rooms');
    res.json(rooms.map(r => ({ room_id: r.id, room_name: r.name, weekday_price: r.weekday_price, weekend_price: r.weekend_price })));
  } catch (err) { next(err); }
}

function updateRate(req, res, next) {
  try {
    const { weekday_price, weekend_price } = req.body;
    const db = getDB();
    db.updateById('rooms', req.params.roomId, {
      weekday_price: parseFloat(weekday_price),
      weekend_price: parseFloat(weekend_price),
    });
    logger.info('Rate updated', { room: req.params.roomId, by: req.user.id });
    res.json({ message: 'Rate updated' });
  } catch (err) { next(err); }
}

function getSeasons(req, res, next) {
  try {
    res.json(getDB().all('seasons'));
  } catch (err) { next(err); }
}

function createSeason(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const { name, start_date, end_date, modifier_percent } = clean;
    if (!name || !start_date || !end_date || !modifier_percent)
      return res.status(400).json({ error: 'All season fields are required' });

    const db     = getDB();
    const season = db.insert('seasons', { name, start_date, end_date, modifier_percent: parseFloat(modifier_percent) });
    logger.info('Season created', { id: season.id, name, by: req.user.id });
    res.status(201).json({ id: season.id, message: 'Season created' });
  } catch (err) { next(err); }
}

function deleteSeason(req, res, next) {
  try {
    getDB().deleteById('seasons', req.params.id);
    res.json({ message: 'Season removed' });
  } catch (err) { next(err); }
}

function updateSeason(req, res, next) {
  try {
    const { sanitizeObject } = require('../utils/sanitize');
    const clean = sanitizeObject(req.body);
    const { name, start_date, end_date, modifier_percent } = clean;
    if (!name || !start_date || !end_date || modifier_percent === undefined)
      return res.status(400).json({ error: 'All season fields are required' });

    const db = getDB();
    const season = db.findById('seasons', req.params.id);
    if (!season) return res.status(404).json({ error: 'Season not found' });

    db.updateById('seasons', req.params.id, {
      name,
      start_date,
      end_date,
      modifier_percent: parseFloat(modifier_percent),
    });
    res.json({ message: 'Season updated' });
  } catch (err) { next(err); }
}

function getPromos(req, res, next) {
  try {
    res.json(getDB().all('promos'));
  } catch (err) { next(err); }
}

function createPromo(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const { code, discount_type, discount_value, valid_until, max_uses } = clean;
    if (!code || !discount_type || !discount_value)
      return res.status(400).json({ error: 'Code, type, and value are required' });

    const db    = getDB();
    const promo = db.insert('promos', {
      code: code.toUpperCase(),
      discount_type,
      discount_value: parseFloat(discount_value),
      valid_until: valid_until || null,
      max_uses: max_uses ? parseInt(max_uses) : null,
      uses_count: 0,
      is_active: true,
    });
    logger.info('Promo created', { code, by: req.user.id });
    res.status(201).json({ message: 'Promo code created', id: promo.id });
  } catch (err) { next(err); }
}

function togglePromo(req, res, next) {
  try {
    const db    = getDB();
    const promo = db.findById('promos', req.params.id);
    if (!promo) return res.status(404).json({ error: 'Promo not found' });
    db.updateById('promos', req.params.id, { is_active: !promo.is_active });
    res.json({ message: 'Promo toggled' });
  } catch (err) { next(err); }
}

function validatePromo(req, res, next) {
  try {
    const code  = (req.body.code || '').toUpperCase().trim();
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const db    = getDB();
    const today = new Date().toISOString().split('T')[0];
    const promo = db.findOne('promos', p =>
      p.code === code &&
      p.is_active &&
      (!p.valid_until || p.valid_until >= today) &&
      (!p.max_uses || p.uses_count < p.max_uses)
    );

    if (!promo) return res.status(404).json({ error: 'Invalid or expired promo code' });
    res.json({ valid: true, discount_type: promo.discount_type, discount_value: promo.discount_value });
  } catch (err) { next(err); }
}

module.exports = { getRates, updateRate, getSeasons, createSeason, deleteSeason, updateSeason, getPromos, createPromo, togglePromo, validatePromo };
