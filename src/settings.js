const { JsonFileStore } = require('./jsonFileStore');

const MODIFIER_KEYS = ['CommandOrControl', 'Command', 'Control', 'Alt', 'Super'];
const ACCELERATOR_KEY_PATTERN = /^([A-Z0-9]|F([1-9]|1[0-2])|Space)$/;

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

function numberOptions(values, describeValue) {
  return values.map((value) => ({ value, label: describeValue(value) }));
}

function select(name, label, defaultValue, options) {
  return { name, label, type: 'select', defaultValue, options };
}

function toggle(name, label, defaultValue) {
  return { name, label, type: 'boolean', defaultValue };
}

/**
 * Every user-changeable setting. `type` decides how it is validated and shown.
 * For timer settings, 0 means "never".
 */
const SETTING_SECTIONS = [
  {
    title: 'Shortcut',
    fields: [{ name: 'hotkey', label: 'Open Clipbo', type: 'shortcut', defaultValue: 'CommandOrControl+Shift+V' }]
  },
  {
    title: 'General',
    fields: [
      toggle('autoPaste', 'Paste automatically after selecting', true),
      toggle('recordingPaused', 'Pause clipboard recording', false),
      toggle('captureImages', 'Save copied images', true),
      toggle('captureFiles', 'Save copied files and videos', true),
      select('maxHistorySize', 'History size', 50, numberOptions([30, 50, 100, 200], (size) => `${size} items`))
    ]
  },
  {
    title: 'Pop-up',
    fields: [
      select('popupPosition', 'Show pop-up', 'center', [
        { value: 'center', label: 'In the center of the screen' },
        { value: 'mouse', label: 'Next to the mouse cursor' }
      ]),
      select('popupSize', 'Pop-up size', 'normal', [
        { value: 'compact', label: 'Compact' },
        { value: 'normal', label: 'Normal' },
        { value: 'large', label: 'Large' }
      ]),
      toggle('hideOnBlur', 'Close when clicking outside', true)
    ]
  },
  {
    title: 'Thumbnails',
    fields: [
      select('thumbnailSize', 'Thumbnail size', 'medium', [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' }
      ]),
      select('thumbnailFit', 'Thumbnail style', 'contain', [
        { value: 'contain', label: 'Show whole image' },
        { value: 'cover', label: 'Fill and crop' }
      ])
    ]
  },
  {
    title: 'Vault',
    fields: [
      select('vaultAutoLockMinutes', 'Auto-lock after', 15, numberOptions([1, 5, 15, 30, 60, 0], describeMinutes)),
      select('secretClearSeconds', 'Clear copied secrets after', 30, numberOptions([10, 30, 60, 120, 0], describeSeconds)),
      toggle('lockVaultOnSleep', 'Lock when the computer sleeps', true),
      select('generatorLength', 'Generated password length', 24, numberOptions([16, 24, 32, 48], (length) => `${length} characters`))
    ]
  }
];

const ALL_FIELDS = SETTING_SECTIONS.flatMap((section) => section.fields);
const DEFAULT_SETTINGS = Object.fromEntries(ALL_FIELDS.map((field) => [field.name, field.defaultValue]));

/** A shortcut needs one real modifier (not only Shift) so it can never hijack normal typing. */
function isValidAccelerator(accelerator) {
  if (typeof accelerator !== 'string') return false;
  const parts = accelerator.split('+');
  const key = parts.pop();
  const hasMainModifier = parts.some((part) => MODIFIER_KEYS.includes(part));
  const onlyKnownModifiers = parts.every((part) => [...MODIFIER_KEYS, 'Shift'].includes(part));
  return hasMainModifier && onlyKnownModifiers && ACCELERATOR_KEY_PATTERN.test(key);
}

function isValueAllowed(field, value) {
  if (field.type === 'select') return field.options.some((option) => option.value === value);
  if (field.type === 'boolean') return typeof value === 'boolean';
  return isValidAccelerator(value);
}

class Settings {
  constructor(dataDirectory) {
    this.store = new JsonFileStore(dataDirectory, 'settings.json', DEFAULT_SETTINGS);
    this.values = { ...DEFAULT_SETTINGS, ...this.store.load() };
  }

  get(name) {
    return this.values[name];
  }

  set(name, value) {
    const field = ALL_FIELDS.find((candidate) => candidate.name === name);
    if (!field || !isValueAllowed(field, value)) throw new Error(`Invalid value for ${name}`);
    this.values[name] = value;
    this.store.save(this.values);
  }

  /** Sections with each field's current value, ready for display. */
  describeSections() {
    return SETTING_SECTIONS.map((section) => ({
      title: section.title,
      fields: section.fields.map((field) => ({ ...field, value: this.values[field.name] }))
    }));
  }
}

module.exports = { Settings, isValidAccelerator, DEFAULT_SETTINGS };
