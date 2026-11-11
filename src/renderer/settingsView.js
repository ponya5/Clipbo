import { el } from './dom.js';

/** Settings and About. Not a list, so it renders into the overlay area. */
export class SettingsView {
  constructor({ overlayElement, api, onModeChange }) {
    this.api = api;
    this.overlayElement = overlayElement;
    this.onModeChange = onModeChange;
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
    this.overlayElement.replaceChildren(
      el('div', { className: 'settings' },
        el('h3', { text: 'General' }),
        ...settingsData.fields.map((field) => this.buildSelectRow(field)),
        this.buildLaunchAtLoginRow(settingsData.launchAtLogin),
        el('h3', { text: 'Vault backup' }),
        this.buildBackupRow(),
        el('h3', { text: 'About' }),
        this.buildAbout(appInfo)));
    this.onModeChange();
  }

  buildSelectRow(field) {
    const select = el('select');
    field.options.forEach((option) => {
      select.append(el('option', { text: option.label, attributes: { value: String(option.value) } }));
    });
    select.value = String(field.value);
    select.addEventListener('change', () => this.api.settings.set(field.name, Number(select.value)));
    return el('label', { className: 'setting-row' }, el('span', { text: field.label }), select);
  }

  buildLaunchAtLoginRow(isEnabled) {
    const checkbox = el('input', { attributes: { type: 'checkbox' } });
    checkbox.checked = isEnabled;
    checkbox.style.width = 'auto';
    checkbox.addEventListener('change', () => this.api.settings.setLaunchAtLogin(checkbox.checked));
    return el('label', { className: 'setting-row' }, el('span', { text: 'Launch at login' }), checkbox);
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
