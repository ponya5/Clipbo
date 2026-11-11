<p align="center">
  <img src="assets/logo.png" width="128" alt="Clipbo logo">
</p>

<h1 align="center">Clipbo</h1>

<p align="center">
  <strong>Your clipboard history and your keys, one shortcut away.</strong><br>
  A fast clipboard manager with an encrypted vault for macOS and Windows.
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Platforms: macOS and Windows" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey.svg">
</p>

## Why Clipbo

You copy something, then copy something else, and the first thing is gone. Clipbo remembers everything you copy, lets you pick it back in a second, and keeps your important keys in a safe place.

- **Never lose a copy.** Text, images, files and videos are saved automatically, with thumbnails and a full preview.
- **Paste in one step.** Open Clipbo, search, select. It pastes into the app you were using.
- **A real vault for your keys.** API keys and passwords you use all the time live in an encrypted vault. They never expire and are never mixed into your history.
- **Private by design.** No accounts, no cloud, no tracking. Nothing leaves your computer.
- **Keyboard-first.** Everything works without touching the mouse.

## Features

**Clipboard history**
- Saves text, images, files and **videos**, with thumbnails
- Quick preview: play a copied video or view an image full size before pasting
- Instant search
- Pin items you always need
- Duplicates are merged, history size is yours to choose

**Encrypted vault**
- Protected by a master password and strong encryption (AES-256)
- Entries stay until you delete them; no automatic expiry
- Name, username, secret and notes for each entry
- Paste a secret, or copy it without pasting
- Built-in password generator
- Secrets are cleared from the clipboard after a time you choose (or never)
- Auto-locks after a time you choose, and when your computer sleeps
- Encrypted backup and restore

**Make it yours (Settings screen)**
- Change the global shortcut by simply pressing the new keys
- Choose how the pop-up appears: centered or next to your mouse, and its size
- Thumbnail size and style
- Paste automatically or just copy, pause recording, choose what gets saved (images, files)
- Vault auto-lock, clipboard clearing, lock on sleep, generated password length

**Everyday comfort**
- Lives in the menu bar or system tray
- Optional launch at login
- Works on macOS (Intel and Apple Silicon) and Windows

## Install

Download the installer for your system from the [Releases](../../releases) page.

- **macOS:** open the `.dmg`, drag Clipbo to Applications, then right-click and choose **Open** the first time. Grant Accessibility permission if you want Clipbo to paste for you.
- **Windows:** run the installer. If SmartScreen warns about an unsigned app, choose **More info → Run anyway**.

## Privacy and security

- Everything is stored locally, in files only your user account can read.
- The vault is fully encrypted and **the master password cannot be recovered**, so keep a backup.
- Clipboard history is stored unencrypted. Put secrets in the vault, not in your history.

Found a security issue? See [SECURITY.md](SECURITY.md).

## Build from source

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start          # run
npm test           # test
npm run build      # build installers into dist/
```

## Contributing

Issues and pull requests are welcome. Please run `npm test` first.

## License

[MIT](LICENSE) © 2026 Daniel Shalom
