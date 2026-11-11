const fs = require('fs');
const path = require('path');

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;

/** Persists a JSON value as a file readable only by the current user. */
class JsonFileStore {
  constructor(directory, fileName, defaultValue) {
    this.directory = directory;
    this.filePath = path.join(directory, fileName);
    this.defaultValue = defaultValue;
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch {
      return this.defaultValue;
    }
  }

  /** Writes to a temp file first so a crash can never leave a half-written file. */
  save(value) {
    fs.mkdirSync(this.directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(value), { mode: PRIVATE_FILE_MODE });
    fs.renameSync(temporaryPath, this.filePath);
  }
}

module.exports = { JsonFileStore };
