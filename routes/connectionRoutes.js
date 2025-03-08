connectionRoutes.js;
const express = require('express');
const {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  getUserConnections,
  removeConnection,
} = require('../controllers/connectionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, sendConnectionRequest);
router.put('/:connectionId/accept', protect, acceptConnectionRequest);
router.put('/:connectionId/reject', protect, rejectConnectionRequest);
router.get('/', protect, getUserConnections);
router.delete('/:connectionId', protect, removeConnection);

module.exports = router;
