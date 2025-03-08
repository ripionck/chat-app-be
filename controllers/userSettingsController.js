const UserSettings = require('../models/UserSettings');

// Get user settings
const getUserSettings = async (req, res) => {
  try {
    let settings = await UserSettings.findOne({ userId: req.user._id });

    if (!settings) {
      // Create default settings if not found
      settings = await UserSettings.create({
        userId: req.user._id,
      });
    }

    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user settings
const updateUserSettings = async (req, res) => {
  try {
    const {
      notificationPreferences,
      privacySettings,
      themePreference,
      language,
    } = req.body;

    const settings = await UserSettings.findOne({ userId: req.user._id });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }

    // Update settings
    if (notificationPreferences) {
      settings.notificationPreferences = {
        ...settings.notificationPreferences,
        ...notificationPreferences,
      };
    }

    if (privacySettings) {
      settings.privacySettings = {
        ...settings.privacySettings,
        ...privacySettings,
      };
    }

    if (themePreference) {
      settings.themePreference = themePreference;
    }

    if (language) {
      settings.language = language;
    }

    await settings.save();

    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUserSettings,
  updateUserSettings,
};
