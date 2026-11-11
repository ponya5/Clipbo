# Contributing

Thanks for helping improve Clipbo!

1. Fork the repository and create a branch.
2. `npm install`, then `npm start` to run the app.
3. Keep changes small and focused; add or update tests in `test/` where it makes sense.
4. Run `npm test` before opening a pull request.
5. Describe what changed and why.

Please report security problems privately (see [SECURITY.md](SECURITY.md)).

## Dependency note

Clipbo is pinned to Electron 43. Electron 44 replaced the synchronous main-process
`clipboard` API (including image support) with an async, web-style API, so upgrading
beyond 43 requires migrating `src/clipboardMonitor.js` first.
