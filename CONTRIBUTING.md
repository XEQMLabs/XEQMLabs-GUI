# Contributing to XEQ GUI Wallet

Thank you for your interest in contributing to the XEQ GUI Wallet! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs if applicable**
- **Include your system information** (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Pull Requests

1. **Fork the repository** and create your branch from `development` (not `master`)
2. **Make your changes** following our coding standards
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Ensure your code follows the existing style** (run `npm run lint` and `npm run format`)
6. **Write clear commit messages**
7. **Submit a pull request** to the `development` branch

#### Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the CHANGELOG.md with details of changes
3. The PR will be reviewed by maintainers
4. Once approved, it will be merged into the development branch
5. After testing in development, changes will be merged to master for release

## Development Setup

### Prerequisites

- Node.js 14.11.0 (use `nvm use 14.11.0`)
- npm 5.6.0 or higher
- Git

### Setup Instructions

1. Clone the repository:

```bash
git clone https://github.com/DomXEQ/New-XEQ-GUI.git
cd New-XEQ-GUI
```

2. Install dependencies:

```bash
npm install
```

3. Copy required binaries to the `bin/` directory (see README.md for details)

4. Run the development server:

```bash
npm run dev
```

### Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` to check for linting errors
- Run `npm run format` to format code
- Run `npm run ready` to run both lint and format

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:

```
Add service node registration feature

This commit adds the ability to register new service nodes directly
from the GUI wallet interface.

Fixes #123
```

## Adding Language Support

See the README.md for detailed instructions on adding new language support.

## Testing

Before submitting a pull request, please ensure:

- [ ] Code follows the existing style
- [ ] All linting checks pass (`npm run lint`)
- [ ] Code is properly formatted (`npm run format`)
- [ ] Manual testing has been performed
- [ ] No console errors or warnings
- [ ] Documentation has been updated if needed

## Questions?

If you have questions about contributing, please:

1. Check existing issues and pull requests
2. Open a new issue with the `question` label
3. Reach out via Telegram: [t.me/XEQCommunity](https://t.me/XEQCommunity)

Thank you for contributing to XEQ GUI!
