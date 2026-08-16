# Contributing

## Workflow

`master` is protected — direct pushes aren't allowed. All changes go
through a pull request:

1. Fork the repo (or create a branch, if you have write access).
2. Make your change.
3. Open a PR against `master`.
4. CI (`test (20.x)` and `test (22.x)`) must pass before it can merge.

## Getting set up

```bash
npm install
cp .env.example .env
npm run hash-password -- "your-password-here"   # paste into .env as ADMIN_PASSWORD_HASH_B64
# also set SESSION_SECRET, and point STORAGE_ROOT at an existing directory
npm run dev
```

See the [README](README.md) for the full environment variable reference
and how uploads/security checks work.

## Before opening a PR

```bash
npm test
```

Add or update tests for any behavior change — see `test/` for existing
patterns (route tests build a full app with `buildApp()` and hit it via
`app.inject()`; see `test/files.test.js`).

There's no linter or formatter configured currently — just match the
style of the surrounding code.

## PR guidelines

- Keep PRs focused on one change; unrelated cleanup makes review harder.
- Explain *why* in the PR description, not just what changed.
- If you're touching `src/fs/safePath.js`, upload validation, or auth,
  call that out explicitly — those are the security-sensitive paths
  (see the "Security notes" section in the README) and get closer
  scrutiny.
- Large/breaking changes (new auth model, multi-user support, etc.) are
  easier to land if discussed in an issue first.
