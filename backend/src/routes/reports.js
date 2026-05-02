const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { getSummary, getOccupancy, getBookingSources } = require('../controllers/reportController');

router.get('/summary',   auth, roleGuard('admin','manager'), getSummary);
router.get('/occupancy', auth, roleGuard('admin','manager'), getOccupancy);
router.get('/sources',   auth, roleGuard('admin','manager'), getBookingSources);

module.exports = router;
