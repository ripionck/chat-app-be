const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

// Create chat room
const createChatRoom = async (req, res) => {
  try {
    const { name, participants } = req.body;

    // Validate if all participants exist
    const users = await User.find({ _id: { $in: participants } });

    if (users.length !== participants.length) {
      return res
        .status(400)
        .json({ message: 'Some participants do not exist' });
    }

    // Always include the creator in participants
    const uniqueParticipants = [
      ...new Set([req.user._id.toString(), ...participants]),
    ];

    const chatRoom = await ChatRoom.create({
      name,
      createdBy: req.user._id,
      participants: uniqueParticipants,
      isGroup: uniqueParticipants.length > 2,
    });

    const populatedChatRoom = await ChatRoom.findById(chatRoom._id)
      .populate('createdBy', 'name profilePicture')
      .populate('participants', 'name profilePicture status');

    // Notify all participants about the new chat room
    uniqueParticipants.forEach((participantId) => {
      if (participantId !== req.user._id.toString()) {
        req.io.to(participantId).emit('newChatRoom', populatedChatRoom);
      }
    });

    res.status(201).json(populatedChatRoom);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all chat rooms for a user
const getUserChatRooms = async (req, res) => {
  try {
    const chatRooms = await ChatRoom.find({
      participants: req.user._id,
    })
      .populate('createdBy', 'name profilePicture')
      .populate('participants', 'name profilePicture status')
      .populate('lastMessage');

    res.json(chatRooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single chat room by ID
const getChatRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;

    const chatRoom = await ChatRoom.findById(roomId)
      .populate('createdBy', 'name profilePicture')
      .populate('participants', 'name profilePicture status')
      .populate('lastMessage');

    if (!chatRoom) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is a participant
    if (
      !chatRoom.participants.some(
        (p) => p._id.toString() === req.user._id.toString(),
      )
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to access this chat room' });
    }

    res.json(chatRoom);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add participants to chat room
const addParticipantsToChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { participants } = req.body;

    const chatRoom = await ChatRoom.findById(roomId);

    if (!chatRoom) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is a participant or creator
    if (
      !chatRoom.participants.includes(req.user._id) &&
      chatRoom.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to modify this chat room' });
    }

    // Validate if all new participants exist
    const users = await User.find({ _id: { $in: participants } });

    if (users.length !== participants.length) {
      return res
        .status(400)
        .json({ message: 'Some participants do not exist' });
    }

    // Add new participants
    const currentParticipants = chatRoom.participants.map((p) => p.toString());
    const newParticipants = participants.filter(
      (p) => !currentParticipants.includes(p.toString()),
    );

    if (newParticipants.length === 0) {
      return res
        .status(400)
        .json({ message: 'All users are already participants' });
    }

    chatRoom.participants = [...currentParticipants, ...newParticipants];
    chatRoom.isGroup = chatRoom.participants.length > 2;

    await chatRoom.save();

    const updatedChatRoom = await ChatRoom.findById(roomId)
      .populate('createdBy', 'name profilePicture')
      .populate('participants', 'name profilePicture status')
      .populate('lastMessage');

    // Notify all participants about the updated chat room
    chatRoom.participants.forEach((participantId) => {
      req.io
        .to(participantId.toString())
        .emit('chatRoomUpdated', updatedChatRoom);
    });

    // Notify new participants
    newParticipants.forEach((participantId) => {
      req.io
        .to(participantId.toString())
        .emit('addedToChatRoom', updatedChatRoom);
    });

    res.json(updatedChatRoom);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove participant from chat room
const removeParticipantFromChatRoom = async (req, res) => {
  try {
    const { roomId, userId } = req.params;

    const chatRoom = await ChatRoom.findById(roomId);

    if (!chatRoom) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is the creator or removing themselves
    if (
      chatRoom.createdBy.toString() !== req.user._id.toString() &&
      req.user._id.toString() !== userId
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to remove participants' });
    }

    // Cannot remove the creator
    if (
      userId === chatRoom.createdBy.toString() &&
      userId !== req.user._id.toString()
    ) {
      return res
        .status(400)
        .json({ message: 'Cannot remove the creator of the chat room' });
    }

    // Remove participant
    chatRoom.participants = chatRoom.participants.filter(
      (p) => p.toString() !== userId,
    );

    // If the room has less than 2 participants, delete it
    if (chatRoom.participants.length < 2) {
      await ChatRoom.findByIdAndDelete(roomId);

      // Notify remaining participant
      if (chatRoom.participants.length === 1) {
        req.io
          .to(chatRoom.participants[0].toString())
          .emit('chatRoomDeleted', { roomId });
      }

      return res.json({
        message: 'Chat room deleted due to insufficient participants',
      });
    }

    // Update group status
    chatRoom.isGroup = chatRoom.participants.length > 2;
    await chatRoom.save();

    const updatedChatRoom = await ChatRoom.findById(roomId)
      .populate('createdBy', 'name profilePicture')
      .populate('participants', 'name profilePicture status')
      .populate('lastMessage');

    // Notify all participants about the updated chat room
    chatRoom.participants.forEach((participantId) => {
      req.io
        .to(participantId.toString())
        .emit('chatRoomUpdated', updatedChatRoom);
    });

    // Notify removed participant
    req.io.to(userId).emit('removedFromChatRoom', { roomId });

    res.json(updatedChatRoom);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send message to chat room
const sendMessageToChatRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, attachments } = req.body;

    const chatRoom = await ChatRoom.findById(roomId);

    if (!chatRoom) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is a participant
    if (
      !chatRoom.participants.some(
        (p) => p.toString() === req.user._id.toString(),
      )
    ) {
      return res
        .status(403)
        .json({ message: 'Not authorized to send messages to this chat room' });
    }

    // Create message
    const roomMessage = new Message({
      senderId: req.user._id,
      recipientId: null,
      chatRoomId: roomId,
      content,
      attachments: attachments || [],
      timestamp: Date.now(),
    });

    await roomMessage.save();

    // Update last message in chat room
    chatRoom.lastMessage = roomMessage._id;
    await chatRoom.save();

    const populatedMessage = await Message.findById(roomMessage._id).populate(
      'senderId',
      'name profilePicture',
    );

    // Notify all participants about the new message
    chatRoom.participants.forEach((participantId) => {
      if (participantId.toString() !== req.user._id.toString()) {
        req.io.to(participantId.toString()).emit('newChatRoomMessage', {
          roomId,
          message: populatedMessage,
        });
      }
    });

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get messages for a chat room
const getChatRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    const chatRoom = await ChatRoom.findById(roomId);

    if (!chatRoom) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // Check if user is a participant
    if (
      !chatRoom.participants.some(
        (p) => p.toString() === req.user._id.toString(),
      )
    ) {
      return res
        .status(403)
        .json({
          message: 'Not authorized to access messages in this chat room',
        });
    }

    const messages = await Message.find({
      chatRoomId: roomId,
      deleted: false,
    })
      .sort({ timestamp: 1 })
      .populate('senderId', 'name profilePicture');

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createChatRoom,
  getUserChatRooms,
  getChatRoomById,
  addParticipantsToChatRoom,
  removeParticipantFromChatRoom,
  sendMessageToChatRoom,
  getChatRoomMessages,
};
