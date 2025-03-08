const express = require('express');
const {
  sendMessage,
  getMessages,
  getUnreadMessageCount,
  deleteMessage,
} = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, sendMessage);
router.get('/user/:userId', protect, getMessages);
router.get('/unread', protect, getUnreadMessageCount);
router.delete('/:messageId', protect, deleteMessage);

module.exports = router;
