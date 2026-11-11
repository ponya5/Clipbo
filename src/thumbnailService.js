const { nativeImage } = require('electron');

const THUMBNAIL_SIZE = { width: 320, height: 320 };
const PREVIEW_SIZE = { width: 960, height: 960 };

/** Uses the OS thumbnailer (Quick Look / Explorer), which understands videos and documents. */
async function createFileThumbnail(filePath, size = THUMBNAIL_SIZE) {
  try {
    const image = await nativeImage.createThumbnailFromPath(filePath, size);
    return image.isEmpty() ? null : image.toDataURL();
  } catch {
    return null;
  }
}

function createFilePreview(filePath) {
  return createFileThumbnail(filePath, PREVIEW_SIZE);
}

module.exports = { createFileThumbnail, createFilePreview };
