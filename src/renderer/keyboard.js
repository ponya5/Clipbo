const isMac = window.clipbo.platform === 'darwin';

export const commandKeyLabel = isMac ? '⌘' : 'Ctrl';

/** Cmd on macOS, Ctrl on Windows. */
export function hasCommandKey(event) {
  return isMac ? event.metaKey : event.ctrlKey;
}

export function isBackspaceOrDelete(event) {
  return event.key === 'Backspace' || event.key === 'Delete';
}

/** Returns 0-8 for the Digit1-Digit9 keys, otherwise -1. */
export function digitIndex(event) {
  const match = /^Digit([1-9])$/.exec(event.code);
  return match ? Number(match[1]) - 1 : -1;
}
