import { el } from './dom.js';
import { toAccelerator, formatAccelerator } from './shortcut.js';

/** Settings and About. Not a list, so it renders into the overlay area. */
export class SettingsView {
  constructor({ overlayElement, api, onModeChange, onSettingsChanged }) {
    this.api = api;
    this.overlayElement = overlayElement;
    this.onModeChange = onModeChange;
    this.onSettingsChanged = onSettingsChanged;
  }

  searchPlaceholder = '';
  hints = [['Esc', 'back'], ['Tab', 'next control']];

  isListMode() {
    return false;
  }

  onSearch() {}

  onEscape() {
    return false;
  }

  async activate() {
    const [settingsData, appInfo] = await Promise.all([this.api.settings.getAll(), this.api.app.info()]);
    const sections = settingsData.sections.map((section) => this.buildSection(section, settingsData));
    this.overlayElement.replaceChildren(
      el('div', { className: 'settings' },
        ...sections,
        el('h3', { text: 'Vault backup' }),
        this.buildBackupRow(),
        el('h3', { text: 'About' }),
        this.buildAbout(appInfo)));
    this.onModeChange();
  }

  buildSection(section, settingsData) {
    const rows = section.fields.map((field) => this.buildFieldRow(field, settingsData));
    if (section.title === 'General') rows.unshift(this.buildLaunchAtLoginRow(settingsData.launchAtLogin));
    return el('section', { className: 'settings-section' }, el('h3', { text: section.title }), ...rows);
  }

  buildFieldRow(field, settingsData) {
    if (field.type === 'select') return this.buildSelectRow(field);
    if (field.type === 'boolean') return this.buildToggleRow(field);
    return this.buildShortcutRow(field, settingsData.hotkeyLabel);
  }

  async saveSetting(name, value) {
    const result = await this.api.settings.set(name, value);
    if (result.ok) await this.onSettingsChanged();
    return result;
  }

  buildSelectRow(field) {
    const select = el('select');
    field.options.forEach((option) => {
      select.append(el('option', { text: option.label, attributes: { value: String(option.value) } }));
    });
    select.value = String(field.value);
    select.addEventListener('change', () => {
      const chosenOption = field.options.find((option) => String(option.value) === select.value);
      this.saveSetting(field.name, chosenOption.value);
    });
    return el('label', { className: 'setting-row' }, el('span', { text: field.label }), select);
  }

  buildToggleRow(field) {
    const checkbox = el('input', { className: 'toggle', attributes: { type: 'checkbox' } });
    checkbox.checked = field.value;
    checkbox.addEventListener('change', () => this.saveSetting(field.name, checkbox.checked));
    return el('label', { className: 'setting-row' }, el('span', { text: field.label }), checkbox);
  }

  buildLaunchAtLoginRow(isEnabled) {
    const checkbox = el('input', { className: 'toggle', attributes: { type: 'checkbox' } });
    checkbox.checked = isEnabled;
    checkbox.addEventListener('change', () => this.api.settings.setLaunchAtLogin(checkbox.checked));
    return el('label', { className: 'setting-row' }, el('span', { text: 'Launch at login' }), checkbox);
  }

  /** Click, then press the new combination. Esc cancels. */
  buildShortcutRow(field, currentLabel) {
    const message = el('div', { className: 'error' });
    const recorder = el('button', { className: 'shortcut', text: currentLabel, attributes: { type: 'button' } });

    const finishRecording = (label) => {
      recorder.classList.remove('recording');
      recorder.textContent = label;
      recorder.removeEventListener('keydown', handleKey, true);
      recorder.removeEventListener('blur', cancelRecording);
    };
    const cancelRecording = () => finishRecording(currentLabel);

    const handleKey = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') return cancelRecording();
      const accelerator = toAccelerator(event);
      if (!accelerator) return;

      const result = await this.saveSetting(field.name, accelerator);
      message.textContent = result.ok ? '' : result.message;
      if (result.ok) currentLabel = formatAccelerator(accelerator);
      finishRecording(currentLabel);
    };

    recorder.addEventListener('click', () => {
      message.textContent = '';
      recorder.classList.add('recording');
      recorder.textContent = 'Press the new shortcut…';
      recorder.addEventListener('keydown', handleKey, true);
      recorder.addEventListener('blur', cancelRecording);
    });

    return el('div', {},
      el('div', { className: 'setting-row' }, el('span', { text: field.label }), recorder),
      message);
  }

  buildBackupRow() {
    return el('div', { className: 'setting-row' },
      el('span', { text: 'Encrypted backup' }),
      el('span', {},
        el('button', { text: 'Export…', on: { click: () => this.api.backup.exportVault() } }),
        ' ',
        el('button', { text: 'Import…', on: { click: () => this.api.backup.importVault() } })));
  }

  buildAbout(appInfo) {
    const openLink = (label, url) => el('button', {
      className: 'link',
      text: label,
      on: { click: () => this.api.app.openExternal(url) }
    });
    return el('div', { className: 'about' },
      el('div', { className: 'app-name', text: 'Clipbo' }),
      el('div', { text: `Version ${appInfo.version}` }),
      el('div', { text: `Created by ${appInfo.authorName}` }),
      el('div', {}, 'GitHub: ', openLink(appInfo.githubUrl.replace('https://', ''), appInfo.githubUrl)),
      el('div', {}, 'Project: ', openLink(appInfo.projectUrl.replace('https://', ''), appInfo.projectUrl)),
      el('div', { text: 'Released under the MIT License. Your data never leaves your computer.' }));
  }
}
