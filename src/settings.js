const { JsonFileStore } = require('./jsonFileStore');

/** 0 means "never" for the two timer settings. */
function describeMinutes(minutes) {
  if (minutes === 0) return 'Never';
  if (minutes === 1) return '1 minute';
  return minutes < 60 ? `${minutes} minutes` : '1 hour';
}

function describeSeconds(seconds) {
  if (seconds === 0) return 'Never';
  if (seconds < 60) return `${seconds} seconds`;
  return seconds === 60 ? '1 minute' : `${seconds / 60} minutes`;
}

function toOptions(values, describeValue) {
  return values.map((value) => ({ value, label: describeValue(value) }));
}

const SETTING_FIELDS = [
  {
    name: 'maxHistorySize',
    label: 'History size',
    defaultValue: 50,
    options: toOptions([30, 50, 100, 200], (size) => `${size} items`)
  },
  {
    name: 'vaultAutoLockMinutes',
    label: 'Auto-lock vault after',
    defaultValue: 15,
    options: toOptions([1, 5, 15, 30, 60, 0], describeMinutes)
  },
  {
    name: 'secretClearSeconds',
    label: 'Clear copied secrets after',
    defaultValue: 30,
    options: toOptions([10, 30, 60, 120, 0], describeSeconds)
  }
];

const DEFAULT_SETTINGS = Object.fromEntries(
  SETTING_FIELDS.map((field) => [field.name, field.defaultValue])
);

class Settings {
  constructor(dataDirectory) {
    this.store = new JsonFileStore(dataDirectory, 'settings.json', DEFAULT_SETTINGS);
    this.values = { ...DEFAULT_SETTINGS, ...this.store.load() };
  }

  get(name) {
    return this.values[name];
  }

  set(name, value) {
    const field = SETTING_FIELDS.find((candidate) => candidate.name === name);
    const isAllowed = field?.options.some((option) => option.value === value);
    if (!isAllowed) throw new Error(`Invalid value for ${name}`);
    this.values[name] = value;
    this.store.save(this.values);
  }

  /** Fields with their current value, ready for display. */
  describeFields() {
    return SETTING_FIELDS.map((field) => ({ ...field, value: this.values[field.name] }));
  }
}

module.exports = { Settings, SETTING_FIELDS };
