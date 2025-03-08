const UserConnection = require('../models/UserConnection');
const User = require('../models/User');

// Send connection request
const sendConnectionRequest = async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate user
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if connection already exists
    const existingConnection = await UserConnection.findOne({
      $or: [
        { userId: req.user._id, friendId: userId },
        { userId: userId, friendId: req.user._id },
      ],
    });

    if (existingConnection) {
      return res.status(400).json({
        message: 'Connection already exists',
        status: existingConnection.status,
      });
    }

    // Create connection request
    const connection = await UserConnection.create({
      userId: req.user._id,
      friendId: userId,
      status: 'pending',
    });

    const populatedConnection = await UserConnection.findById(connection._id)
      .populate('userId', 'name profilePicture')
      .populate('friendId', 'name profilePicture');

    // Notify the user about the connection request
    req.io.to(userId).emit('connectionRequest', {
      connection: populatedConnection,
      from: {
        _id: req.user._id,
        name: req.user.name,
        profilePicture: req.user.profilePicture,
      },
    });

    res.status(201).json(populatedConnection);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Accept connection request
const acceptConnectionRequest = async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await UserConnection.findById(connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found' });
    }

    // Check if user is the recipient of the request
    if (connection.friendId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Not authorized to accept this request' });
    }

    // Check if connection is pending
    if (connection.status !== 'pending') {
      return res
        .status(400)
        .json({ message: `Connection is already ${connection.status}` });
    }

    // Update connection status
    connection.status = 'accepted';
    connection.connectedAt = Date.now();
    await connection.save();

    const populatedConnection = await UserConnection.findById(connectionId)
      .populate('userId', 'name profilePicture')
      .populate('friendId', 'name profilePicture');

    // Notify the requester that their request was accepted
    req.io.to(connection.userId.toString()).emit('connectionAccepted', {
      connection: populatedConnection,
      by: {
        _id: req.user._id,
        name: req.user.name,
        profilePicture: req.user.profilePicture,
      },
    });

    res.json(populatedConnection);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reject connection request
const rejectConnectionRequest = async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await UserConnection.findById(connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found' });
    }

    // Check if user is the recipient of the request
    if (connection.friendId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Not authorized to reject this request' });
    }

    // Check if connection is pending
    if (connection.status !== 'pending') {
      return res
        .status(400)
        .json({ message: `Connection is already ${connection.status}` });
    }

    // Update connection status
    connection.status = 'rejected';
    await connection.save();

    res.json({ message: 'Connection request rejected' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all connections for a user
const getUserConnections = async (req, res) => {
  try {
    const connections = await UserConnection.find({
      $or: [{ userId: req.user._id }, { friendId: req.user._id }],
    })
      .populate('userId', 'name profilePicture status')
      .populate('friendId', 'name profilePicture status');

    const formattedConnections = connections.map((connection) => {
      const isSender =
        connection.userId._id.toString() === req.user._id.toString();
      return {
        _id: connection._id,
        status: connection.status,
        connectedAt: connection.connectedAt,
        friend: isSender ? connection.friendId : connection.userId,
      };
    });

    res.json(formattedConnections);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove connection
const removeConnection = async (req, res) => {
  try {
    const { connectionId } = req.params;

    const connection = await UserConnection.findById(connectionId);

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    // Check if user is part of the connection
    if (
      connection.userId.toString() !== req.user._id.toString() &&
      connection.friendId.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to remove this connection' });
    }

    await UserConnection.findByIdAndDelete(connectionId);

    // Notify the other user
    const otherUserId =
      connection.userId.toString() === req.user._id.toString()
        ? connection.friendId
        : connection.userId;

    req.io.to(otherUserId.toString()).emit('connectionRemoved', {
      connectionId,
      by: req.user._id,
    });

    res.json({ message: 'Connection removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  getUserConnections,
  removeConnection,
};
