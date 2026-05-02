const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const upload    = require('../middleware/uploadHandler');
const {
  getRooms, getRoom, createRoom, updateRoom,
  uploadPhoto, deletePhoto, deleteRoom
} = require('../controllers/roomController');

// Public
router.get('/',        getRooms);
router.get('/:id',     getRoom);

// Protected
router.post('/',                auth, roleGuard('admin'), createRoom);
router.put('/:id',              auth, roleGuard('admin','manager'), updateRoom);
router.delete('/:id',           auth, roleGuard('admin'), deleteRoom);

// Photos — set upload folder then handle file
router.post('/:id/photos', auth, roleGuard('admin','manager'), (req, res, next) => {
  req.uploadFolder = 'rooms';
  next();
}, upload.single('photo'), uploadPhoto);

router.delete('/:id/photos',    auth, roleGuard('admin','manager'), deletePhoto);

module.exports = router;
