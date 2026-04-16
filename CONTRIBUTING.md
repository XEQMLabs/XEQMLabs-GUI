# Contributing to XEQM GUI

Thanks for your interest in contributing. This guide covers the workflow and standards for the project.

## Getting Started

1. Fork the repository and create a branch from `main`
2. Install dependencies: `npm install`
3. Place daemon binaries in `bin/` (see [README](README.md))
4. Run the dev server: `npm run dev`

## Code Style

- ESLint and Prettier enforce formatting
- Run `npm run ready` before submitting (runs both lint and format)
- Follow the existing patterns in the codebase
- No trailing whitespace, consistent indentation

## Commit Messages

Use imperative mood, present tense. Keep the subject line under 72 characters.

```
Add service node registration feature

Adds the ability to register new service nodes directly
from the GUI wallet interface.

Fixes #123
```

## Pull Requests

1. One logical change per PR
2. Test your changes manually (build and run the wallet)
3. Update documentation if your change affects user-facing behavior
4. Ensure `npm run ready` passes with no errors
5. Target the `main` branch

## Reporting Bugs

Open a GitHub issue with:

- Steps to reproduce
- Expected vs. actual behavior
- OS and Node.js version
- Screenshots if applicable

## Questions

- Open an issue with the `question` label
- Telegram: [t.me/XEQCommunity](https://t.me/XEQCommunity)
