const { globalShortcut } = require('electron');

/** Owns the single global shortcut and lets it be changed at runtime. */
class HotkeyManager {
  constructor(onPressed) {
    this.onPressed = onPressed;
    this.currentAccelerator = null;
  }

  /** Returns false (and keeps the previous shortcut) when the shortcut is taken or invalid. */
  register(accelerator) {
    const previousAccelerator = this.currentAccelerator;
    if (previousAccelerator) globalShortcut.unregister(previousAccelerator);
    const isRegistered = this.tryRegister(accelerator);
    if (isRegistered) {
      this.currentAccelerator = accelerator;
      return true;
    }
    this.currentAccelerator = null;
    if (previousAccelerator && this.tryRegister(previousAccelerator)) this.currentAccelerator = previousAccelerator;
    return false;
  }

  tryRegister(accelerator) {
    try {
      return globalShortcut.register(accelerator, this.onPressed);
    } catch {
      return false;
    }
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
  }
}

module.exports = { HotkeyManager };
