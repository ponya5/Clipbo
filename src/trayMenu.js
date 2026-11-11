const { Menu } = require('electron');
const { SETTING_FIELDS } = require('./settings');

function buildFieldSubmenu(field, settings, actions) {
  return field.options.map((option) => ({
    label: option.label,
    type: 'radio',
    checked: option.value === settings.get(field.name),
    click: () => actions.changeSetting(field.name, option.value)
  }));
}

function buildTrayMenu({ settings, launchAtLogin, hotkeyLabel, actions }) {
  const fieldMenus = SETTING_FIELDS.map((field) => ({
    label: field.label,
    submenu: buildFieldSubmenu(field, settings, actions)
  }));

  return Menu.buildFromTemplate([
    { label: `Open Clipbo  (${hotkeyLabel})`, click: actions.openPanel },
    { label: 'Settings & About…', click: actions.openSettings },
    { type: 'separator' },
    { label: 'Clear History (keeps pinned)', click: actions.clearHistory },
    ...fieldMenus,
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: launchAtLogin,
      click: (menuItem) => actions.setLaunchAtLogin(menuItem.checked)
    },
    { type: 'separator' },
    { label: 'Quit Clipbo', click: actions.quit }
  ]);
}

module.exports = { buildTrayMenu };
