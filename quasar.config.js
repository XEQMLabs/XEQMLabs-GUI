/* eslint-disable no-template-curly-in-string */
import { configure } from "quasar/wrappers";

const electronExternals = [
  "ws",
  "bunyan",
  "fs-extra",
  "upath",
  "object-assign-deep",
  "promise-queue",
  "portscanner",
  "electron-window-state",
  "electron-updater",
  "semver",
  "got"
];

export default configure(function () {
  return {
    boot: ["i18n", "axios", "store", "vuelidate", "gateway", "timeago"],
    css: ["app.styl"],
    extras: ["material-icons"],

    build: {
      vueRouterMode: "hash",
      target: {
        browser: ["chrome130"]
      },
      extendViteConf(viteConf) {
        viteConf.resolve = viteConf.resolve || {};
        viteConf.resolve.extensions = [
          ".mjs",
          ".js",
          ".ts",
          ".jsx",
          ".tsx",
          ".json",
          ".vue"
        ];
      },
      vitePlugins: []
    },

    devServer: {
      open: false
    },

    framework: {
      components: [
        "QLayout",
        "QHeader",
        "QFooter",
        "QDrawer",
        "QPageContainer",
        "QPage",
        "QToolbar",
        "QToolbarTitle",
        "QTooltip",
        "QField",
        "QInput",
        "QRadio",
        "QOptionGroup",
        "QBtn",
        "QBtnToggle",
        "QIcon",
        "QTabs",
        "QTab",
        "QRouteTab",
        "QBtnDropdown",
        "QMenu",
        "QDialog",
        "QStep",
        "QStepper",
        "QStepperNavigation",
        "QSpinner",
        "QList",
        "QItemLabel",
        "QItem",
        "QSeparator",
        "QItemSection",
        "QSelect",
        "QToggle",
        "QPageSticky",
        "QExpansionItem",
        "QCheckbox",
        "QInnerLoading",
        "QInfiniteScroll",
        "QDate",
        "QTime",
        "QScrollArea",
        "QCard",
        "QCardSection",
        "QCardActions"
      ],
      directives: ["Ripple", "ClosePopup"],
      plugins: ["Notify", "Loading", "LocalStorage", "Dialog"]
    },

    animations: [],

    electron: {
      preloadScripts: ["electron-preload"],

      inspectPort: 5858,

      extendElectronMainConf(esbuildConf) {
        esbuildConf.format = "cjs";
        esbuildConf.external = [
          ...(esbuildConf.external || []),
          ...electronExternals
        ];
      },

      extendElectronPreloadConf(esbuildConf) {
        esbuildConf.external = [
          ...(esbuildConf.external || []),
          ...electronExternals
        ];
      },

      bundler: "builder",

      builder: {
        npmRebuild: false,
        appId: "com.equilibria.xeq-wallet",
        productName: "XEQ GUI",
        copyright: "Copyright © 2026 Equilibria",
        artifactName: "XEQ-GUI-${version}-${os}.${ext}",

        win: {
          target: [
            {
              target: "nsis",
              arch: ["x64"]
            },
            {
              target: "portable",
              arch: ["x64"]
            }
          ],
          icon: "src-electron/icons/icon_512x512.png",
          publisherName: "Equilibria"
        },

        nsis: {
          oneClick: false,
          allowToChangeInstallationDirectory: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          shortcutName: "XEQ GUI"
        },

        portable: {
          artifactName: "XEQ-GUI-${version}-Windows-Portable.exe"
        },

        linux: {
          target: ["AppImage"],
          icon: "src-electron/icons/linux-512x512.png",
          category: "Finance"
        },

        mac: {
          target: ["dmg", "zip"],
          icon: "src-electron/icons/icon.icns",
          category: "public.app-category.finance",
          hardenedRuntime: true,
          gatekeeperAssess: false,
          entitlements: "build/entitlements.mac.plist",
          entitlementsInherit: "build/entitlements.mac.plist"
        },

        dmg: {
          sign: false
        },

        files: [
          "!build/*.js",
          "!.env",
          "!dev-app-update.yml",
          "!downloads/**",
          "!dist/**",
          "!notes.md",
          "!*.md",
          "!wallets/**",
          "!wallets",
          "!**/*.wallet",
          "!**/*.keys",
          "!**/*.address.txt",
          "!data/**"
        ],

        extraResources: ["bin", "bin-legacy"]
      }
    }
  };
});
