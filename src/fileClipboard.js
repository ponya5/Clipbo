const { execFile } = require('child_process');

const MAC_SCRIPT = `on run argv
  set fileList to {}
  repeat with filePath in argv
    set end of fileList to (POSIX file (filePath as text))
  end repeat
  set the clipboard to fileList
end run`;
const WINDOWS_SCRIPT = "Set-Clipboard -LiteralPath ($env:CLIPBO_PATHS -split '\\|')";

function runCommand(executable, args, environment) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { env: { ...process.env, ...environment }, windowsHide: true }, (error) =>
      error ? reject(error) : resolve());
  });
}

/** Puts real files on the clipboard so they paste as files (not as text). */
async function writeFilesToClipboard(filePaths, platform = process.platform) {
  if (platform === 'darwin') {
    await runCommand('osascript', ['-e', MAC_SCRIPT, ...filePaths], {});
  } else if (platform === 'win32') {
    await runCommand('powershell', ['-NoProfile', '-Command', WINDOWS_SCRIPT], {
      CLIPBO_PATHS: filePaths.join('|')
    });
  }
}

module.exports = { writeFilesToClipboard };
