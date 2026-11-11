import { HistoryView } from './historyView.js';
import { VaultView } from './vaultView.js';
import { SettingsView } from './settingsView.js';
import { commandKeyLabel, hasCommandKey, digitIndex } from './keyboard.js';
import { el } from './dom.js';

const api = window.clipbo;
const searchInput = document.getElementById('search');
const listElement = document.getElementById('list');
const overlayElement = document.getElementById('overlay');
const hintsElement = document.getElementById('hints');
const versionElement = document.getElementById('version');
const tabButtons = [...document.querySelectorAll('.tab')];

const historyView = new HistoryView({
  listElement,
  api,
  saveTextToVault: (text) => {
    vaultView.setDraftPassword(text);
    switchTab('vault');
  }
});
const vaultView = new VaultView({ listElement, overlayElement, api, onModeChange: refreshChrome });
const settingsView = new SettingsView({ overlayElement, api, onModeChange: refreshChrome });
const views = { history: historyView, vault: vaultView, settings: settingsView };
let activeTabName = 'history';

const activeView = () => views[activeTabName];

/** Keeps search box, list/overlay visibility and footer hints in sync with the active view. */
function refreshChrome() {
  const view = activeView();
  const isListMode = view.isListMode();

  searchInput.placeholder = view.searchPlaceholder;
  searchInput.hidden = !isListMode;
  listElement.hidden = !isListMode;
  overlayElement.hidden = isListMode;
  tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === activeTabName));

  hintsElement.replaceChildren(...view.hints.map(([keys, label]) =>
    el('span', { className: 'hint' },
      el('kbd', { text: keys.replace('Mod', commandKeyLabel) }),
      ` ${label}`)));

  if (isListMode) searchInput.focus();
}

async function switchTab(tabName) {
  activeTabName = tabName;
  searchInput.value = '';
  activeView().onSearch('');
  refreshChrome();
  await activeView().activate();
  refreshChrome();
}

function isTypingInFormField(event) {
  return event.target instanceof HTMLInputElement && event.target !== searchInput;
}

function handleKeyDown(event) {
  const view = activeView();

  if (event.key === 'Escape') {
    if (activeTabName === 'settings') {
      switchTab('history');
      return;
    }
    if (!view.onEscape()) api.hidePanel();
    return;
  }

  if (hasCommandKey(event) && event.key === ',') {
    event.preventDefault();
    switchTab('settings');
    return;
  }

  if (event.key === 'Tab' && activeTabName !== 'settings' && !isTypingInFormField(event)) {
    event.preventDefault();
    switchTab(activeTabName === 'history' ? 'vault' : 'history');
    return;
  }

  if (view.isListMode()) handleListKey(event, view);
}

function handleListKey(event, view) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    view.list.move(event.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    view.onEnter(event);
    return;
  }
  const quickPickIndex = digitIndex(event);
  if (hasCommandKey(event) && quickPickIndex >= 0) {
    event.preventDefault();
    view.onQuickPick(quickPickIndex);
    return;
  }
  if (view.onShortcut(event)) event.preventDefault();
}

async function refreshActiveView() {
  await activeView().activate();
  refreshChrome();
}

tabButtons.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
searchInput.addEventListener('input', () => activeView().onSearch(searchInput.value));
document.addEventListener('keydown', handleKeyDown);

api.onPanelShown((requestedTab) => {
  if (requestedTab && requestedTab !== activeTabName) {
    switchTab(requestedTab);
    return;
  }
  searchInput.value = '';
  activeView().onSearch('');
  refreshActiveView();
});
api.onHistoryChanged(() => {
  if (activeTabName === 'history') activeView().activate();
});
api.onVaultLocked(() => {
  if (activeTabName === 'vault') refreshActiveView();
});

api.app.info().then((appInfo) => {
  versionElement.textContent = `v${appInfo.version}`;
});
switchTab('history');
