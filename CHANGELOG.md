# Changelog

## 1.2.0

- Vault can hold videos, screenshots and files: 🔒 button (or Mod+S) on any History row. Files are encrypted with AES-256-GCM, one key per file.
- Vault backups now include attachments (saved in a `-files` folder next to the backup file).
- New setting: move original files to the Trash after adding them to the vault (on by default).
- Mod+C on a vault attachment copies without pasting.

## 1.1.0

- Move to vault: 🔒 button (or Mod+S) on History text rows; the history copy is deleted once the vault entry is saved.
- Auto-update from GitHub releases (macOS updates require a signed build).
- Error and crash log in the app data folder (`logs/clipbo.log`).
- Skip copies from Windows password managers, as on macOS.

## 1.0.0

- Clipboard history for text, images, files and videos with thumbnails, preview, search, pinning.
- Full settings screen: custom shortcut, pop-up position and size, thumbnail options, paste and capture behaviour, vault options.
- Encrypted vault for passwords and API keys: entries never expire, notes field, copy or paste, generator, change master password, encrypted backup and restore.
- Configurable vault auto-lock (including never) and clipboard clearing (including never); lock on sleep and screen lock; brute-force lockout.
- Global shortcut, keyboard-first navigation, tray menu, launch at login.
- macOS and Windows support.
