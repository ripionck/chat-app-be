const express = require('express');
const {
  getUserSettings,
  updateUserSettings,
} = require('../controllers/userSettingsController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getUserSettings);
router.put('/', protect, updateUserSettings);

module.exports = router;
