const { Menu } = require('electron');

function buildTrayMenu({ isRecordingPaused, launchAtLogin, hotkeyLabel, actions }) {
  return Menu.buildFromTemplate([
    { label: `Open Clipbo  (${hotkeyLabel})`, click: actions.openPanel },
    { label: 'Settings & About…', click: actions.openSettings },
    { type: 'separator' },
    {
      label: 'Pause Recording',
      type: 'checkbox',
      checked: isRecordingPaused,
      click: (menuItem) => actions.setRecordingPaused(menuItem.checked)
    },
    { label: 'Clear History (keeps pinned)', click: actions.clearHistory },
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
