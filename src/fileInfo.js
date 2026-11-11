const fs = require('fs');
const path = require('path');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.wmv', '.mpg', '.mpeg']);

function isVideoPath(filePath) {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Summary stored in history for a set of copied files. */
function describeFiles(filePaths) {
  const [firstPath] = filePaths;
  const name = filePaths.length === 1 ? path.basename(firstPath) : `${path.basename(firstPath)} + ${filePaths.length - 1} more`;
  return {
    kind: filePaths.length === 1 && isVideoPath(firstPath) ? 'video' : 'file',
    name,
    sizeBytes: filePaths.reduce((total, filePath) => total + readFileSize(filePath), 0)
  };
}

function readFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function allFilesExist(filePaths) {
  return filePaths.every((filePath) => fs.existsSync(filePath));
}

module.exports = { isVideoPath, describeFiles, allFilesExist };
