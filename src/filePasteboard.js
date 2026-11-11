const { fileURLToPath } = require('url');

const MAC_FILE_URL_FORMAT = 'public.file-url';
const MAC_FILE_LIST_FORMAT = 'NSFilenamesPboardType';
const WINDOWS_FILE_NAME_FORMAT = 'FileNameW';

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** macOS stores a copied multi-file selection as an XML property list of paths. */
function parseMacFileList(buffer) {
  const xml = buffer.toString('utf8');
  const arrayMatch = /<array>([\s\S]*?)<\/array>/.exec(xml);
  if (!arrayMatch) return [];
  return [...arrayMatch[1].matchAll(/<string>([\s\S]*?)<\/string>/g)].map((match) => decodeXmlEntities(match[1]));
}

function parseFileUrl(buffer) {
  const url = buffer.toString('utf8').replace(/\0/g, '').trim();
  if (!url.startsWith('file://')) return [];
  try {
    return [fileURLToPath(url)];
  } catch {
    return [];
  }
}

/** Windows exposes the first copied file as a null-terminated UTF-16 string. */
function parseWindowsFileName(buffer) {
  const path = buffer.toString('utf16le').replace(/\0.*$/s, '');
  return path ? [path] : [];
}

function readMacPaths(clipboard) {
  const fromFileList = parseMacFileList(clipboard.readBuffer(MAC_FILE_LIST_FORMAT));
  if (fromFileList.length) return fromFileList;
  return parseFileUrl(clipboard.readBuffer(MAC_FILE_URL_FORMAT));
}

/** Paths of files currently copied in Finder / Explorer, or an empty list. */
function readCopiedFilePaths(clipboard, platform = process.platform) {
  if (platform === 'darwin') return readMacPaths(clipboard);
  if (platform === 'win32') return parseWindowsFileName(clipboard.readBuffer(WINDOWS_FILE_NAME_FORMAT));
  return [];
}

module.exports = { readCopiedFilePaths, parseMacFileList, parseFileUrl, parseWindowsFileName };
