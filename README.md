# XEQM GUI

Official desktop GUI wallet for **XEQMLabs (XEQM)**. Ships with the bundled `xeqm-d` / `xeqm-rpc` / `xeqm-wallet` core binaries — no external setup required.

For documentation and support: **[t.me/XEQCommunity](https://t.me/XEQCommunity)**

---

## Downloads

Grab the latest release from the [Releases page](https://github.com/EquilibriaHorizon/XEQMLabs-GUI/releases).

| Platform | File |
|----------|------|
| Windows x64 | `.exe` installer |
| Linux x64 | `.AppImage` |
| macOS Apple Silicon | `.dmg` |

Each release also has a `.sha256` file alongside it. Verify before installing if you care about supply-chain integrity.

---

## Install

### Windows

1. Download `XEQM-GUI-<version>-win.exe`
2. Create a dedicated folder for the wallet (e.g. `C:\XEQM`)
3. Save and run the installer from that folder
4. Launch from the Start menu or Desktop shortcut

No additional dependencies required — the installer is self-contained.

### Linux

1. Download `XEQM-GUI-<version>-linux.AppImage`
2. Install runtime dependencies (one-time setup):

   ```bash
   sudo apt-get update
   sudo apt-get install -y \
     libboost-all-dev \
     libsodium23 \
     libfuse2t64 \
     libzmq5 \
     libzstd1 \
     libhidapi-libusb0 \
     libhidapi-hidraw0 \
     libusb-1.0-0
   ```

   On older Ubuntu (22.04 and below), use `libfuse2` instead of `libfuse2t64`.

3. Make the AppImage executable and run it:

   ```bash
   chmod +x XEQM-GUI-<version>-linux.AppImage
   ./XEQM-GUI-<version>-linux.AppImage
   ```

   Or right-click → **Properties** → check **Allow executing file as program**, then double-click.

4. If it fails to launch with a sandbox error, run with `--no-sandbox`:

   ```bash
   ./XEQM-GUI-<version>-linux.AppImage --no-sandbox
   ```

### macOS (Apple Silicon)

1. Download `XEQM-GUI-<version>-mac.dmg`
2. Open the .dmg and drag **XEQM GUI** to your Applications folder
3. Double-click to launch

The macOS build is **codesigned and notarized** — no Homebrew or library installs are needed. All required dylibs are bundled inside the `.app`.

#### If the app won't open

If you see "app is damaged" or "app cannot be opened because it is from an unidentified developer", run this once in Terminal:

```bash
xattr -cr "/Applications/XEQM GUI.app"
```

Then double-click the app again. This clears the quarantine attribute that macOS sometimes applies to downloaded apps even when they are signed.

---

## Features

- Create, restore, and import wallets (25-word seed, wallet file, view-only)
- Send and receive XEQM with QR code support
- Service node staking and management
- Real-time network statistics and explorer integration
- Transaction history with proof generation and verification
- Address book
- Mainnet and Testnet support
- Automatic wallet backup to a configurable location

## Networks

- **Mainnet** — Live XEQM network (default)
- **Testnet** — Development and testing

Switch network from the wallet-select screen or Network Settings.

---

## Where things live

| What | Location |
|------|----------|
| Wallet files | `wallets/<network>/` inside the app's install folder |
| Configuration | `data/` inside the app's install folder |
| Daemon blockchain | `data/lmdb/` (mainnet), `data/testnet/lmdb/` (testnet) |
| Auto-backup target | configurable in **Network Settings → Wallet Backup Path** |
| Logs | `wallets/<network>/logs/` and `data/logs/` |

---

## ⚠️ Back up your seed and wallet files

**Back up your 25-word seed phrase before installing, reinstalling, or moving install location.** If you lose the seed, your funds cannot be recovered.

Wallet files live in the app's install folder. Reinstalling or installing to a different folder may overwrite them. **We are not responsible for lost seeds, wallet files, or funds resulting from overwriting, reinstall, or user error.**

Use the in-app **Wallet Backup Path** (Network Settings) to mirror your wallet folder elsewhere. Keep your own off-machine backup of either that folder or your seed regardless.

---

## Development

### Prerequisites

- Node.js >= 20.x
- npm >= 10.x

### Setup

```bash
git clone https://github.com/EquilibriaHorizon/XEQMLabs-GUI.git
cd XEQMLabs-GUI
npm install
```

### Daemon binaries

The release workflow pulls binaries automatically from the [core repo's latest release](https://github.com/EquilibriaHorizon/equilibria-core/releases). For local development you'll need to populate `bin/` manually:

1. Download the platform-appropriate archive from the [core releases](https://github.com/EquilibriaHorizon/equilibria-core/releases) (e.g. `XEQM-core-*-windows-x86_64-*.zip`)
2. Extract it
3. Copy `xeqm-d`, `xeqm-rpc`, `xeqm-wallet` (with `.exe` on Windows) into `bin/` at the repo root
4. On macOS, also copy the `libs/` folder alongside the binaries

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

### Code quality

```bash
npm run lint    # ESLint
npm run format  # Prettier
npm run ready   # Both
```

### Releasing

The release workflow is triggered manually or by pushing a `v*` tag.

1. Make sure the desired core binaries are published in the [core repo releases](https://github.com/EquilibriaHorizon/equilibria-core/releases)
2. Go to **Actions → Release GUI Wallets → Run workflow**
3. Enter the GUI version (e.g. `2.0.5`)
4. Optionally pin a specific `core_release` tag (default: latest published core release)
5. Wait for all 3 platform jobs + the publish job to complete

The workflow downloads the matching core archive at build time and bakes it into each installer — no binaries are committed to this repo.

---

## Stack

- [Quasar 2](https://quasar.dev/) (Vue 3 + Vite)
- [Electron 33](https://www.electronjs.org/)
- [Vuex 4](https://vuex.vuejs.org/)
- [electron-builder](https://www.electron.build/) for packaging

---

## Support

- **Telegram:** [t.me/XEQCommunity](https://t.me/XEQCommunity)

## License

BSD 3-Clause. See [LICENSE](LICENSE) for details.
