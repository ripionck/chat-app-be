const express = require('express');
const {
  getUserProfile,
  updateUserProfile,
  updateUserStatus,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.put('/status', protect, updateUserStatus);

module.exports = router;
