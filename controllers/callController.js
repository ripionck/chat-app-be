const Call = require('../models/Call');

// Initiate call
const initiateCall = async (req, res) => {
  try {
    const { receiverId, type } = req.body;

    if (!['audio', 'video'].includes(type)) {
      return res.status(400).json({ message: 'Invalid call type' });
    }

    // Validate receiver
    const receiverExists = await User.findById(receiverId);
    if (!receiverExists) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Create call record
    const call = await Call.create({
      callerId: req.user._id,
      receiverId,
      type,
      status: 'initiated',
      startTime: Date.now(),
    });

    const populatedCall = await Call.findById(call._id)
      .populate('callerId', 'name profilePicture')
      .populate('receiverId', 'name profilePicture');

    // Generate a unique room ID for the call
    const roomId = `call-${call._id}`;

    // Emit call initiation to receiver
    req.io.to(receiverId).emit('incomingCall', {
      call: populatedCall,
      roomId,
      from: {
        _id: req.user._id,
        name: req.user.name,
        profilePicture: req.user.profilePicture,
      },
    });

    res.status(201).json({
      call: populatedCall,
      roomId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Accept call
const acceptCall = async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // Check if user is the receiver
    if (call.receiverId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Not authorized to accept this call' });
    }

    // Check if call is in initiated status
    if (call.status !== 'initiated') {
      return res
        .status(400)
        .json({ message: `Call is already ${call.status}` });
    }

    // Update call status
    call.status = 'ongoing';
    await call.save();

    const populatedCall = await Call.findById(callId)
      .populate('callerId', 'name profilePicture')
      .populate('receiverId', 'name profilePicture');

    // Generate room ID
    const roomId = `call-${call._id}`;

    // Emit call accepted to caller
    req.io.to(call.callerId.toString()).emit('callAccepted', {
      call: populatedCall,
      roomId,
      by: {
        _id: req.user._id,
        name: req.user.name,
        profilePicture: req.user.profilePicture,
      },
    });

    res.json({
      call: populatedCall,
      roomId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reject call
const rejectCall = async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // Check if user is the receiver
    if (call.receiverId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Not authorized to reject this call' });
    }

    // Check if call is in initiated status
    if (call.status !== 'initiated') {
      return res
        .status(400)
        .json({ message: `Call is already ${call.status}` });
    }

    // Update call status
    call.status = 'rejected';
    call.endTime = Date.now();
    call.duration = 0;
    await call.save();

    // Emit call rejected to caller
    req.io.to(call.callerId.toString()).emit('callRejected', {
      callId,
      by: {
        _id: req.user._id,
        name: req.user.name,
      },
    });

    res.json({ message: 'Call rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// End call
const endCall = async (req, res) => {
  try {
    const { callId } = req.params;

    const call = await Call.findById(callId);

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // Check if user is part of the call
    if (
      call.callerId.toString() !== req.user._id.toString() &&
      call.receiverId.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to end this call' });
    }

    // Check if call is ongoing
    if (call.status !== 'ongoing') {
      return res
        .status(400)
        .json({ message: `Call is already ${call.status}` });
    }

    // Update call status
    call.status = 'completed';
    call.endTime = Date.now();

    // Calculate duration in seconds
    const startTime = new Date(call.startTime).getTime();
    const endTime = new Date(call.endTime).getTime();
    call.duration = Math.floor((endTime - startTime) / 1000);

    await call.save();

    // Emit call ended to other participant
    const otherParticipantId =
      call.callerId.toString() === req.user._id.toString()
        ? call.receiverId.toString()
        : call.callerId.toString();

    req.io.to(otherParticipantId).emit('callEnded', {
      callId,
      by: {
        _id: req.user._id,
        name: req.user.name,
      },
      duration: call.duration,
    });

    res.json({
      message: 'Call ended',
      duration: call.duration,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get call history
const getCallHistory = async (req, res) => {
  try {
    const calls = await Call.find({
      $or: [{ callerId: req.user._id }, { receiverId: req.user._id }],
    })
      .sort({ startTime: -1 })
      .populate('callerId', 'name profilePicture')
      .populate('receiverId', 'name profilePicture');

    res.json(calls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getCallHistory,
};
