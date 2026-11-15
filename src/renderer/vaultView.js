import { el } from './dom.js';
import { confirmAction } from './confirm.js';
import { ListController } from './listController.js';
import { commandKeyLabel, hasCommandKey, isBackspaceOrDelete } from './keyboard.js';

const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
const QUICK_PICK_COUNT = 9;

function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes || 1) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

function generatePassword(length) {
  const randomValues = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(randomValues, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('');
}

const LIST_HINTS = [
  ['↑ ↓', 'navigate'],
  ['Enter', 'paste secret'],
  ['Mod+C', 'copy secret'],
  ['Shift+Enter', 'paste username'],
  ['Mod+N', 'new'],
  ['Mod+E', 'edit'],
  ['Mod+Y', 'view file'],
  ['Mod+⌫', 'delete'],
  ['Mod+M', 'master password'],
  ['Mod+L', 'lock']
];
const FORM_HINTS = [['Enter / Mod+Enter', 'save'], ['Esc', 'back']];
const GATE_HINTS = [['Enter', 'continue'], ['Tab', 'history']];

/** Modes: loading | setup | locked | list | form | changePassword */
export class VaultView {
  constructor({ listElement, overlayElement, api, notify, showPreview, onModeChange, getGeneratorLength }) {
    this.api = api;
    this.notify = notify;
    this.showPreview = showPreview;
    this.getGeneratorLength = getGeneratorLength;
    this.overlayElement = overlayElement;
    this.onModeChange = onModeChange;
    this.query = '';
    this.entries = [];
    this.mode = 'loading';
    this.pendingDraftPassword = null;
    this.list = new ListController(
      listElement,
      (entry, index) => this.buildRow(entry, index),
      (entry) => this.useEntry(entry.id, 'pastePassword')
    );
  }

  searchPlaceholder = 'Search vault…';

  get hints() {
    if (this.mode === 'list') return LIST_HINTS;
    return ['form', 'changePassword'].includes(this.mode) ? FORM_HINTS : GATE_HINTS;
  }

  isListMode() {
    return this.mode === 'list';
  }

  /** Called from History (Mod+S) to store copied text as a new secret. */
  setDraftPassword(password, onSaved = null) {
    this.pendingDraftPassword = password;
    this.onDraftSaved = onSaved;
  }

  async activate() {
    const status = await this.api.vault.status();
    if (!status.exists) return this.showGate('setup');
    if (!status.unlocked) return this.showGate('locked');
    await this.showList();
    if (this.pendingDraftPassword !== null) {
      this.showForm({ password: this.pendingDraftPassword }, this.onDraftSaved);
    }
    this.pendingDraftPassword = null;
    this.onDraftSaved = null;
  }

  onSearch(query) {
    this.query = query.toLowerCase();
    this.list.resetSelection();
    this.applyFilter();
  }

  onEnter(event) {
    const entry = this.list.selectedItem;
    if (entry) this.useEntry(entry.id, event.shiftKey ? 'pasteUsername' : 'pastePassword');
  }

  onQuickPick(index) {
    const entry = this.list.itemAt(index);
    if (entry) this.useEntry(entry.id, 'pastePassword');
  }

  onEscape() {
    if (!['form', 'changePassword'].includes(this.mode)) return false;
    this.showList();
    return true;
  }

  /** Returns true when the shortcut was handled. */
  onShortcut(event) {
    if (!hasCommandKey(event) || this.mode !== 'list') return false;
    const entry = this.list.selectedItem;
    const key = event.key.toLowerCase();

    if (key === 'n') {
      this.showForm({});
      return true;
    }
    if (key === 'm') {
      this.showChangePassword();
      return true;
    }
    if (key === 'l') {
      this.api.vault.lock();
      return true;
    }
    if (!entry) return false;
    if (key === 'c' && !window.getSelection().toString()) {
      this.useEntry(entry.id, 'copyPassword');
      return true;
    }
    if (key === 'y' && entry.attachment) {
      this.viewEntry(entry);
      return true;
    }
    if (key === 'e') {
      this.editEntry(entry.id);
      return true;
    }
    if (isBackspaceOrDelete(event)) {
      this.deleteEntry(entry);
      return true;
    }
    return false;
  }

  // ---- list mode ----

  async showList() {
    this.entries = await this.api.vault.list();
    this.setMode('list');
    this.applyFilter();
  }

  applyFilter() {
    const matchingEntries = this.entries.filter((entry) =>
      `${entry.title} ${entry.username}`.toLowerCase().includes(this.query));
    const emptyMessage = this.query
      ? 'No matches'
      : `Your vault is empty. Press ${commandKeyLabel}+N to add an API key or password.`;
    this.list.setItems(matchingEntries, emptyMessage);
  }

  buildRow(entry, index) {
    const content = el('div', { className: 'content' },
      el('div', { className: 'entry-title', text: entry.title }),
      el('div', { className: 'entry-username', text: this.describeEntry(entry) }));
    const badge = index < QUICK_PICK_COUNT ? el('span', { className: 'badge', text: String(index + 1) }) : '';
    const actions = el('div', { className: 'meta' },
      ...(entry.attachment ? [this.buildActionButton('👁', 'View', () => this.viewEntry(entry))] : []),
      this.buildActionButton('✏️', 'Edit', () => this.editEntry(entry.id)),
      this.buildActionButton('🗑', 'Delete', () => this.deleteEntry(entry)),
      ...(entry.attachment ? [] : [el('span', { text: '••••••••' })]));
    return el('li', { className: 'row' }, badge, content, actions);
  }

  describeEntry({ username, attachment }) {
    if (!attachment) return username || '—';
    const icon = { image: '🖼', video: '🎬' }[attachment.kind] ?? '📄';
    return `${icon} ${attachment.name} · ${formatSize(attachment.sizeBytes)}`;
  }

  buildActionButton(icon, label, onClick) {
    return el('button', {
      className: 'vault-button',
      text: icon,
      attributes: { type: 'button', title: label, 'aria-label': label },
      on: { click: (event) => { event.stopPropagation(); onClick(); } }
    });
  }

  async viewEntry(entry) {
    const previewData = await this.api.vault.preview(entry.id);
    if (previewData) this.showPreview(previewData);
  }

  async useEntry(entryId, action) {
    const result = await this.api.vault.use(entryId, action);
    if (result && !result.ok) this.notify(result.message);
  }

  async editEntry(entryId) {
    const entry = await this.api.vault.get(entryId);
    this.showForm(entry);
  }

  async deleteEntry(entry) {
    if (!await confirmAction(`Delete "${entry.title}" from the vault? This cannot be undone.`)) return;
    await this.api.vault.remove(entry.id);
    await this.showList();
  }

  // ---- gate (create master password / unlock) ----

  showGate(mode) {
    this.setMode(mode);
    const isSetup = mode === 'setup';
    const passwordInput = this.buildInput('password', 'Master password');
    const confirmInput = this.buildInput('password', 'Confirm master password');
    const errorMessage = el('div', { className: 'error' });

    const form = el('form', { className: 'gate' },
      el('div', { className: 'lock-icon', text: '🔒' }),
      el('h2', { text: isSetup ? 'Create your vault' : 'Vault is locked' }),
      el('p', {
        text: isSetup
          ? 'Choose a master password (8+ characters). It encrypts everything and cannot be recovered. Entries stay in the vault until you delete them.'
          : 'Enter your master password to unlock.'
      }),
      passwordInput,
      ...(isSetup ? [confirmInput] : []),
      errorMessage,
      el('button', { className: 'primary', text: isSetup ? 'Create vault' : 'Unlock', attributes: { type: 'submit' } }));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (isSetup && passwordInput.value !== confirmInput.value) {
        errorMessage.textContent = 'Passwords do not match';
        return;
      }
      const failureMessage = isSetup
        ? await this.createVault(passwordInput.value)
        : await this.unlockVault(passwordInput.value);
      if (failureMessage) errorMessage.textContent = failureMessage;
    });

    this.overlayElement.replaceChildren(form);
    passwordInput.focus();
  }

  async createVault(masterPassword) {
    const result = await this.api.vault.create(masterPassword);
    if (!result.ok) return result.message;
    await this.activate();
    return null;
  }

  async unlockVault(masterPassword) {
    const result = await this.api.vault.unlock(masterPassword);
    if (result.ok) {
      await this.activate();
      return null;
    }
    if (result.reason === 'lockout') {
      return `Too many attempts. Try again in ${Math.ceil(result.retryAfterMs / 1000)} seconds.`;
    }
    return 'Wrong master password';
  }

  // ---- change master password ----

  showChangePassword() {
    this.setMode('changePassword');
    const currentInput = this.buildInput('password', 'Current master password');
    const newInput = this.buildInput('password', 'New master password (8+ characters)');
    const confirmInput = this.buildInput('password', 'Confirm new master password');
    const errorMessage = el('div', { className: 'error' });

    const form = el('form', { className: 'entry-form' },
      el('h2', { text: 'Change master password' }),
      currentInput, newInput, confirmInput, errorMessage,
      el('div', { className: 'form-actions' },
        el('button', { text: 'Cancel', attributes: { type: 'button' }, on: { click: () => this.showList() } }),
        el('button', { className: 'primary', text: 'Change', attributes: { type: 'submit' } })));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (newInput.value !== confirmInput.value) {
        errorMessage.textContent = 'New passwords do not match';
        return;
      }
      const result = await this.api.vault.changeMasterPassword(currentInput.value, newInput.value);
      if (!result.ok) {
        errorMessage.textContent = result.message;
        return;
      }
      await this.showList();
    });

    this.overlayElement.replaceChildren(form);
    currentInput.focus();
  }

  // ---- add / edit form ----

  showForm({ id = null, title = '', username = '', password = '', notes = '', attachment = null }, onSaved = null) {
    this.setMode('form');
    const titleInput = this.buildInput('text', 'Name (e.g. OpenAI API key)', title);
    const usernameInput = this.buildInput('text', 'Username, email or label (optional)', username);
    const passwordInput = this.buildInput('password', 'Secret (password or key)', password);
    const notesInput = el('textarea', { attributes: { placeholder: 'Notes (optional), e.g. where it is used', rows: '3' } });
    notesInput.value = notes;

    const toggleButton = el('button', {
      text: 'Show',
      attributes: { type: 'button' },
      on: {
        click: () => {
          const shouldReveal = passwordInput.type === 'password';
          passwordInput.type = shouldReveal ? 'text' : 'password';
          toggleButton.textContent = shouldReveal ? 'Hide' : 'Show';
        }
      }
    });
    const generateButton = el('button', {
      text: 'Generate',
      attributes: { type: 'button' },
      on: {
        click: () => {
          passwordInput.value = generatePassword(this.getGeneratorLength());
          passwordInput.type = 'text';
          toggleButton.textContent = 'Hide';
        }
      }
    });

    const form = el('form', { className: 'entry-form' },
      el('h2', { text: id ? 'Edit entry' : 'New entry' }),
      titleInput,
      usernameInput,
      ...(attachment
        ? [el('div', { className: 'image-label', text: this.describeEntry({ attachment }) })]
        : [el('div', { className: 'password-row' }, passwordInput, toggleButton, generateButton)]),
      notesInput,
      el('div', { className: 'form-actions' },
        ...(id ? [el('button', { className: 'danger', text: 'Delete', attributes: { type: 'button' }, on: { click: () => this.deleteEntry({ id, title }) } })] : []),
        ...(attachment ? [el('button', { text: 'View', attributes: { type: 'button' }, on: { click: () => this.viewEntry({ id }) } })] : []),
        el('button', { text: 'Cancel', attributes: { type: 'button' }, on: { click: () => this.showList() } }),
        el('button', { className: 'primary', text: 'Save', attributes: { type: 'submit' } })));

    form.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && hasCommandKey(event)) form.requestSubmit();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!titleInput.value.trim() || (!passwordInput.value && !attachment)) return;
      await this.api.vault.save({
        id,
        title: titleInput.value.trim(),
        username: usernameInput.value.trim(),
        password: passwordInput.value,
        notes: notesInput.value
      });
      if (onSaved) await onSaved();
      await this.showList();
    });

    this.overlayElement.replaceChildren(form);
    (title && !attachment ? passwordInput : titleInput).focus();
  }

  // ---- helpers ----

  buildInput(type, placeholder, value = '') {
    return el('input', { attributes: { type, placeholder, value, autocomplete: 'off', spellcheck: 'false' } });
  }

  setMode(mode) {
    this.mode = mode;
    this.onModeChange();
  }
}
