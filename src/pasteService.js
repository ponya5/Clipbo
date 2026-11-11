const { execFile } = require('child_process');

const PASTE_COMMANDS = {
  darwin: [
    'osascript',
    ['-e', 'tell application "System Events" to keystroke "v" using command down']
  ],
  win32: [
    'powershell',
    [
      '-NoProfile',
      '-WindowStyle', 'Hidden',
      '-Command',
      "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"
    ]
  ]
};

/**
 * Sends the paste shortcut to whichever app currently has focus.
 * On macOS this needs Accessibility permission; failures are ignored because
 * the text is already on the clipboard and can be pasted manually.
 */
function pasteIntoFocusedApp() {
  const pasteCommand = PASTE_COMMANDS[process.platform];
  if (!pasteCommand) return;
  const [executable, args] = pasteCommand;
  execFile(executable, args, { windowsHide: true }, () => {});
}

module.exports = { pasteIntoFocusedApp };
