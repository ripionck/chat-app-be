const express = require('express');
const {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getCallHistory,
} = require('../controllers/callController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, initiateCall);
router.put('/:callId/accept', protect, acceptCall);
router.put('/:callId/reject', protect, rejectCall);
router.put('/:callId/end', protect, endCall);
router.get('/history', protect, getCallHistory);

module.exports = router;
