const express = require('express');
const {
  createChatRoom,
  getUserChatRooms,
  getChatRoomById,
  addParticipantsToChatRoom,
  removeParticipantFromChatRoom,
  sendMessageToChatRoom,
  getChatRoomMessages,
} = require('../controllers/chatRoomController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, createChatRoom);
router.get('/', protect, getUserChatRooms);
router.get('/:roomId', protect, getChatRoomById);
router.post('/:roomId/participants', protect, addParticipantsToChatRoom);
router.delete(
  '/:roomId/participants/:userId',
  protect,
  removeParticipantFromChatRoom,
);
router.post('/:roomId/messages', protect, sendMessageToChatRoom);
router.get('/:roomId/messages', protect, getChatRoomMessages);

module.exports = router;
