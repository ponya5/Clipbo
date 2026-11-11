const MAC_SYMBOLS = { CommandOrControl: '⌘', Command: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧', Super: '⌘' };
const WINDOWS_NAMES = { CommandOrControl: 'Ctrl', Command: 'Win', Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Super: 'Win' };

/** Human-readable shortcut, e.g. "⌘⇧V" on macOS or "Ctrl+Shift+V" on Windows. */
function formatAccelerator(accelerator, platform = process.platform) {
  const parts = accelerator.split('+');
  if (platform === 'darwin') return parts.map((part) => MAC_SYMBOLS[part] ?? part).join('');
  return parts.map((part) => WINDOWS_NAMES[part] ?? part).join('+');
}

module.exports = { formatAccelerator };
