const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    isGroup: {
      type: Boolean,
      default: true,
    },
    avatar: {
      type: String,
      default: 'https://example.com/default-group.jpg',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);
