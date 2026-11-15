# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
"Report a vulnerability" (private security advisory) option on this repository,
and include steps to reproduce. You can expect an initial response within a few days.

## Design summary

- Vault: AES-256-GCM encryption; key derived from the master password with scrypt (N=32768, r=8, p=1) and a random per-vault salt. Entries are only decrypted in memory while unlocked.
- Vault attachments (screenshots, videos, files): AES-256-GCM, streamed, one random key per file stored inside the encrypted vault. Decrypted copies exist only in a temporary folder that is removed on lock, quit and after the clipboard-clear timer.
- The vault auto-locks after a configurable idle time (default 15 minutes, can be disabled), and on sleep or screen lock.
- Repeated wrong master passwords cause an increasing lockout.
- Copied secrets are cleared from the clipboard after a configurable time (default 30 seconds).
- Data files are created readable only by the current user.
- The UI runs in a sandboxed renderer with context isolation and a strict Content Security Policy; navigation and new windows are blocked.
- Clipboard history is **not** encrypted. See the README for details.
