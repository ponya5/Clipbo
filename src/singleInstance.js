const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/** Sent to an already-running Clipbo so it can tell whether the new launch is a newer install. */
function describeThisInstance() {
  return { version: app.getVersion(), executablePath: process.execPath };
}

function parseVersion(version) {
  return version.split('-')[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(candidateVersion, currentVersion) {
  const candidateParts = parseVersion(candidateVersion);
  const currentParts = parseVersion(currentVersion);
  const length = Math.max(candidateParts.length, currentParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (candidateParts[index] ?? 0) - (currentParts[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

/**
 * True when a second launch is a newer Clipbo build that should take over from this one.
 * The executable must have the same file name as ours, so the message cannot make us start anything else.
 */
function shouldHandOverTo(otherInstance, currentVersion = app.getVersion(), currentExecutable = process.execPath) {
  if (!otherInstance || typeof otherInstance.version !== 'string' || typeof otherInstance.executablePath !== 'string') {
    return false;
  }
  const hasSameExecutableName = path.basename(otherInstance.executablePath) === path.basename(currentExecutable);
  return hasSameExecutableName
    && isNewerVersion(otherInstance.version, currentVersion)
    && fs.existsSync(otherInstance.executablePath);
}

/** Quits this (older) instance and starts the newer one in its place. */
function handOverTo(otherInstance) {
  app.relaunch({ execPath: otherInstance.executablePath, args: [] });
  app.exit(0);
}

module.exports = { describeThisInstance, isNewerVersion, shouldHandOverTo, handOverTo };
