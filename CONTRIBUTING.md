# Contributing to relay-state

Thank you for your interest in contributing! This document explains how to get
started.

## Development Setup

**Prerequisites:** Node.js 20+ and [Vite+](https://viteplus.dev) (`vp` CLI).

```bash
# 1. Fork and clone the repo
git clone https://github.com/leomendez/relay-state.git
cd relay-state

# 2. Install dependencies
vp install

# 3. Run the test suite
vp test

# 4. Run format, lint, and type checks
vp check
```

## Making Changes

1. Create a branch: `git checkout -b feat/my-feature` or `fix/my-bug`
2. Make your changes in `src/`
3. Add or update tests in `tests/`
4. Run `vp check` and `vp test` — both must pass before opening a PR
5. Update `CHANGELOG.md` under the `[Unreleased]` section

## Commit Style

Use conventional commits:

```
feat: add subscribe timeout option
fix: prevent duplicate events on same-window stores
docs: clarify useSyncExternalStore example
chore: update dependencies
```

## Opening a Pull Request

- Target the `main` branch
- Fill in the pull request template
- Link any related issues with `Closes #<issue>`

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
For security issues, follow the [Security Policy](SECURITY.md) instead.

## Proposing Features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).
Opening an issue to discuss the idea before writing code is encouraged for
larger changes.

## License

By contributing you agree that your contributions will be licensed under the
[MIT License](LICENSE).
