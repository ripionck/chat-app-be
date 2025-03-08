const mongoose = require('mongoose');

const UserSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    notificationPreferences: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      messageSound: {
        type: Boolean,
        default: true,
      },
      callSound: {
        type: Boolean,
        default: true,
      },
    },
    privacySettings: {
      showLastSeen: {
        type: Boolean,
        default: true,
      },
      showProfilePicture: {
        type: String,
        enum: ['everyone', 'friends', 'none'],
        default: 'everyone',
      },
      readReceipts: {
        type: Boolean,
        default: true,
      },
    },
    themePreference: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    language: {
      type: String,
      default: 'en',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('UserSettings', UserSettingsSchema);
