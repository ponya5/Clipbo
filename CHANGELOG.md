# Changelog

## 1.6.0

- Vault list: copy secret and copy username/email buttons on every entry row.
- Installing a newer version replaces the old one instead of creating a duplicate; a newer launch takes over from an older running instance.
- Windows: one-click per-user installer that upgrades in place (portable build removed).
- macOS: `npm run install:mac` builds and replaces the copy in Applications.

## 1.5.3

- Vault entry form: copy buttons next to the username/email field and the secret. Copying a secret honours the clear-after timer and is not recorded in history.

## 1.5.0

- README rewritten with screenshots, shortcuts and a vault security section.
- Fix: Change master password crashed (buttons were added to the wrong form); the edit form now has Delete and View.
- Fix: Enter on the delete confirmation cancels (it used to confirm); focus stays inside the dialog.
- Vault files pasted to the clipboard are cleared on your timer and their temporary decrypted copies are deleted.
- Safer moves and backups: multi-file moves are all or nothing, empty files work, export never deletes your own files, file keys never reach the window.
- Release workflow recognises existing drafts; update errors are logged once.

## 1.4.0

- Fix: deleting a vault entry (and clearing history) did nothing because the native confirm dialog made the pop-up hide itself. Confirmation is now shown inside the app.

## 1.3.0

- Vault rows have Edit, Delete and (for files) View buttons; the edit form can delete the entry; Mod+Y views attachments.
- Clear button (🧹) in History; pinned items are kept.

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
