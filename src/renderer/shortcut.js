const isMac = window.clipbo.platform === 'darwin';

const MAC_SYMBOLS = { CommandOrControl: '⌘', Command: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧', Super: '⌘' };
const WINDOWS_NAMES = { CommandOrControl: 'Ctrl', Command: 'Win', Control: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Super: 'Win' };

function toAcceleratorKey(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  return code === 'Space' ? 'Space' : null;
}

/**
 * Converts a key press into an Electron accelerator such as "CommandOrControl+Shift+V".
 * Returns null while the press is incomplete (no key, or no real modifier).
 */
export function toAccelerator(event) {
  const key = toAcceleratorKey(event.code);
  if (!key) return null;

  const primaryModifier = isMac ? event.metaKey : event.ctrlKey;
  const modifiers = [];
  if (primaryModifier) modifiers.push('CommandOrControl');
  if (isMac && event.ctrlKey) modifiers.push('Control');
  if (!isMac && event.metaKey) modifiers.push('Super');
  if (event.altKey) modifiers.push('Alt');
  const hasMainModifier = modifiers.length > 0;
  if (event.shiftKey) modifiers.push('Shift');

  return hasMainModifier ? [...modifiers, key].join('+') : null;
}

export function formatAccelerator(accelerator) {
  const parts = accelerator.split('+');
  if (isMac) return parts.map((part) => MAC_SYMBOLS[part] ?? part).join('');
  return parts.map((part) => WINDOWS_NAMES[part] ?? part).join('+');
}
