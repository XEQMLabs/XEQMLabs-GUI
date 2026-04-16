# XEQM GUI

Desktop GUI wallet for XEQMLabs (XEQM). Ships with bundled daemon binaries and pre-configured remote nodes -- no external setup required.

## Downloads

Grab the latest release from the [Releases](https://github.com/DomXEQ/XEQMLabs-GUI/releases) page.

| Platform | Format |
|----------|--------|
| Windows  | `.exe` installer |
| Linux    | `.AppImage` |
| macOS    | `.dmg` disk image |

## Features

- Create, restore, and import wallets (seed, file, view-only)
- Send and receive XEQM with QR code support
- Service node staking and management
- Real-time network statistics
- Transaction history with proof generation and verification
- Address book
- Mainnet and Testnet support
- Automatic wallet backup

## Development

### Prerequisites

- Node.js >= 20.x
- npm >= 10.x
- Platform daemon binaries in `bin/` (see below)

### Setup

```bash
git clone https://github.com/DomXEQ/XEQMLabs-GUI.git
cd XEQMLabs-GUI
npm install
```

### Daemon Binaries

Place the following binaries in the `bin/` directory before running:

- `xeq-d` (daemon)
- `xeq-wallet-rpc` (wallet RPC server)
- `xeq-wallet-cli` (optional, CLI wallet)

On Windows, use the `.exe` variants. Pre-built binaries are available from the [core releases](https://github.com/DomXEQ/equilibria-core/releases).

### Run

```bash
npm run dev
```

### Build

```bash
npm run build:win    # Windows
npm run build:linux  # Linux
npm run build:mac    # macOS
npm run build:all    # Windows + Linux
```

### Code Quality

```bash
npm run lint         # ESLint
npm run format       # Prettier
npm run ready        # Both
```

## Stack

- [Quasar 2](https://quasar.dev/) (Vue 3 + Vite)
- [Electron 33](https://www.electronjs.org/)
- [Vuex 4](https://vuex.vuejs.org/) state management
- [electron-builder](https://www.electron.build/) for packaging

## Support

- **Telegram:** [t.me/XEQCommunity](https://t.me/XEQCommunity)

## License

BSD 3-Clause. See [LICENSE](LICENSE) for details.
