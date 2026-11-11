const { isValidAccelerator } = require('./settings');

/** Changes a setting and applies its side effects immediately. */
class SettingsController {
  constructor({ settings, historyStore, hotkeyManager, onChanged }) {
    this.settings = settings;
    this.historyStore = historyStore;
    this.hotkeyManager = hotkeyManager;
    this.onChanged = onChanged;
  }

  /** Returns { ok: true } or { ok: false, message }. */
  change(name, value) {
    try {
      if (name === 'hotkey') this.changeHotkey(value);
      else this.settings.set(name, value);
      if (name === 'maxHistorySize') this.historyStore.enforceLimit();
      this.onChanged(name, value);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  /** The shortcut is saved only if the OS lets Clipbo claim it. */
  changeHotkey(accelerator) {
    if (!isValidAccelerator(accelerator)) throw new Error('Use at least one modifier key, such as Ctrl or ⌘');
    if (!this.hotkeyManager.register(accelerator)) {
      throw new Error('That shortcut is already used by another app. Try a different one.');
    }
    this.settings.set('hotkey', accelerator);
  }
}

module.exports = { SettingsController };
