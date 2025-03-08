const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

// Send message
const sendMessage = async (req, res) => {
  try {
    const { recipientId, content, attachments } = req.body;

    // Validate recipient
    const recipientExists = await User.findById(recipientId);
    if (!recipientExists) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const message = await Message.create({
      senderId: req.user._id,
      recipientId,
      content,
      attachments: attachments || [],
      timestamp: Date.now(),
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name profilePicture')
      .populate('recipientId', 'name profilePicture');

    // Emit new message event to recipient
    req.io.to(recipientId.toString()).emit('newMessage', populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get messages between two users
const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validate user
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, recipientId: userId },
        { senderId: userId, recipientId: currentUserId },
      ],
      deleted: false,
    })
      .sort({ timestamp: 1 })
      .populate('senderId', 'name profilePicture')
      .populate('recipientId', 'name profilePicture');

    // Mark messages as read
    await Message.updateMany(
      { senderId: userId, recipientId: currentUserId, read: false },
      { $set: { read: true } },
    );

    // Emit read receipt to the other user
    req.io.to(userId).emit('messagesRead', { by: currentUserId });

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get unread message count
const getUnreadMessageCount = async (req, res) => {
  try {
    const unreadCount = await Message.countDocuments({
      recipientId: req.user._id,
      read: false,
    });

    const unreadByUser = await Message.aggregate([
      {
        $match: {
          recipientId: mongoose.Types.ObjectId(req.user._id),
          read: false,
        },
      },
      {
        $group: {
          _id: '$senderId',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'sender',
        },
      },
      {
        $unwind: '$sender',
      },
      {
        $project: {
          senderId: '$_id',
          senderName: '$sender.name',
          profilePicture: '$sender.profilePicture',
          count: 1,
          _id: 0,
        },
      },
    ]);

    res.json({
      totalUnread: unreadCount,
      unreadByUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Not authorized to delete this message' });
    }

    // Soft delete
    message.deleted = true;
    await message.save();

    // Emit message deleted event
    req.io
      .to(message.recipientId.toString())
      .emit('messageDeleted', { messageId });

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  getUnreadMessageCount,
  deleteMessage,
};
