const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  getRates, updateRate,
  getSeasons, createSeason, deleteSeason, updateSeason,
  getPromos, createPromo, togglePromo, validatePromo
} = require('../controllers/pricingController');

// Public
router.post('/validate-promo',          apiLimiter, validatePromo);

// Protected
router.get('/rates',                    auth, getRates);
router.put('/rates/:roomId',            auth, roleGuard('admin','manager'), updateRate);

router.get('/seasons',                  auth, getSeasons);
router.post('/seasons',                 auth, roleGuard('admin','manager'), createSeason);
router.delete('/seasons/:id',           auth, roleGuard('admin','manager'), deleteSeason);
router.put('/seasons/:id',              auth, roleGuard('admin','manager'), updateSeason);

router.get('/promos',                   auth, getPromos);
router.post('/promos',                  auth, roleGuard('admin','manager'), createPromo);
router.patch('/promos/:id/toggle',      auth, roleGuard('admin','manager'), togglePromo);

module.exports = router;
