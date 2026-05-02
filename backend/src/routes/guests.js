// ── routes/guests.js ─────────────────────────────
const express   = require('express');
const gRouter   = express.Router();
const auth      = require('../middleware/auth');
const { getGuests, getGuest, updateGuest } = require('../controllers/guestController');

gRouter.get('/',        auth, getGuests);
gRouter.get('/:id',     auth, getGuest);
gRouter.put('/:id',     auth, updateGuest);

module.exports = gRouter;
