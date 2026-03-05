<template>
  <q-page>
    <!-- Restart overlay to hide content flash -->
    <div v-if="isRestarting" class="restart-overlay">
      <q-spinner-dots color="white" size="40px" />
      <div class="q-mt-md">Restarting...</div>
    </div>

    <!-- Current Network Mode Banner (deferred so config is settled and list doesn't glitch) -->
    <q-banner
      v-if="showNetworkBanner"
      :class="networkBannerClass"
      class="q-mb-xs network-mode-banner compact"
    >
      <template v-slot:avatar>
        <q-icon :name="networkIcon" size="xs" />
      </template>
      <div class="row items-center justify-between">
        <div>
          <strong style="font-size: 13px;">{{ networkDisplayName }}</strong>
          <div v-if="currentNetType === 'mainnet'" class="text-caption">
            Mainnet is not yet live. Wallets work offline only.
          </div>
          <div v-else-if="currentNetType === 'legacy'" class="text-caption">
            Original XEQ network with working remote nodes.
          </div>
          <div v-else-if="currentNetType === 'testnet'" class="text-caption">
            Test network for development. Coins have no value.
          </div>
        </div>
        <q-select
          v-model="selectedNetwork"
          :options="networkOptions"
          dense
          outlined
          class="network-selector"
          emit-value
          map-options
          @update:model-value="onNetworkChange"
        />
      </div>
    </q-banner>

    <q-banner
      v-if="appStatus.code === 8"
      class="bg-grey-8 text-white q-mb-sm"
      icon="wifi_off"
    >
      Offline mode: daemon unreachable. You can create a new wallet and get your address,
      but syncing will not work until a node is connected.
    </q-banner>
    <q-list class="wallet-list" link no-border :dark="theme == 'dark'">
      <template v-if="current_network_wallets.length">
        <div class="header row justify-between items-center">
          <div class="header-title">
            {{ $t("titles.yourWallets") }}
          </div>
          <q-btn
            v-if="wallets.list.length"
            class="add"
            icon="add"
            size="md"
            color="primary"
          >
            <q-menu class="header-popover" :content-class="'header-popover'">
              <q-list separator>
                <q-item
                  v-for="action in actions"
                  :key="action.name"
                  clickable
                  @click="action.handler"
                >
                  <q-item-section>
                    {{ action.name }}
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="hr-separator" />

        <WalletListItem
          v-for="wallet in current_network_wallets"
          :key="`${wallet.net_type}-${wallet.address}-${wallet.name}`"
          :wallet="wallet"
          :open-wallet="openWallet"
        />

        <q-separator />
      </template>
      <template v-else>
        <q-item
          v-for="action in actions"
          :key="action.name"
          clickable
          v-ripple
          @click="action.handler"
        >
          <q-item-section>
            {{ action.name }}
          </q-item-section>
        </q-item>
      </template>
    </q-list>
  </q-page>
</template>

<script>
import { mapState } from "vuex";
import WalletListItem from "components/wallet_list_item";

export default {
  components: {
    WalletListItem
  },
  data() {
    return {
      selectedNetwork: null,
      isRestarting: false,
      showNetworkBanner: false,
      networkOptions: [
        { label: "Legacy Mainnet", value: "legacy", icon: "history", description: "Original XEQ network" },
        { label: "Mainnet (Offline)", value: "mainnet", icon: "public", description: "New mainnet - not yet live" },
        { label: "Testnet", value: "testnet", icon: "science", description: "Test network" }
      ]
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      appStatus: state => state.gateway.app.status,
      wallets: state => state.gateway.wallets,
      wallet_list: state => state.gateway.wallets.list,
      status: state => state.gateway.wallet.status,
      currentNetType: state => state.gateway.app.config.app?.net_type || "legacy",
      hardware_wallets() {
        return this.wallet_list.filter(w => w.hardware_wallet);
      },
      regular_wallets() {
        return this.wallet_list.filter(w => !w.hardware_wallet);
      },
      current_network_wallets() {
        if (this.currentNetType === "testnet") {
          return this.wallet_list.filter(w => w.net_type === "testnet");
        }
        if (this.currentNetType === "legacy") {
          return this.wallet_list.filter(w => w.net_type === "legacy");
        }
        return this.wallet_list.filter(w => w.net_type === "mainnet" || !w.net_type);
      },
      networkBannerClass() {
        switch (this.currentNetType) {
          case "testnet":
            return "bg-warning text-dark";
          case "legacy":
            return "bg-purple text-white";
          default:
            return "bg-positive text-dark";
        }
      },
      networkIcon() {
        switch (this.currentNetType) {
          case "testnet":
            return "science";
          case "legacy":
            return "history";
          default:
            return "public";
        }
      },
      networkDisplayName() {
        switch (this.currentNetType) {
          case "testnet":
            return "Testnet";
          case "legacy":
            return "Legacy Mainnet";
          default:
            return "Mainnet (Offline)";
        }
      },
      actions() {
        let createLabel = "Create New Wallet (Offline)";
        if (this.currentNetType === "testnet" || this.currentNetType === "legacy") {
          createLabel = "Create New Wallet";
        }
        const actions = [
          {
            name: createLabel,
            handler: this.createNewWallet
          },
          {
            name: this.$t("titles.wallet.restoreFromSeed"),
            handler: this.restoreWallet
          },
          {
            name: this.$t("titles.wallet.importFromFile"),
            handler: this.importWallet
          }
        ];

        if (this.wallets.directories.length > 0) {
          actions.push({
            name: this.$t("titles.wallet.importFromOldGUI"),
            handler: this.importOldGuiWallets
          });
        }

        return actions;
      }
    }),
    statusCode() {
      return this.status ? this.status.code : 1;
    }
  },
  created() {
    console.log("[wallet-select] created() - currentNetType:", this.currentNetType);
    console.log("[wallet-select] created() - config.app:", JSON.stringify(this.$store.state.gateway.app.config.app, null, 2));
    this.$gateway.send("wallet", "list_wallets");
  },
  mounted() {
    // Defer showing the network banner so backend config has been applied and
    // the dropdown doesn't glitch/reorder when net_type settles
    this._networkBannerTimer = setTimeout(() => {
      this.showNetworkBanner = true;
      this.selectedNetwork = this.currentNetType;
    }, 120);
  },
  beforeUnmount() {
    if (this._networkBannerTimer) clearTimeout(this._networkBannerTimer);
  },
  watch: {
    currentNetType: {
      handler(val) {
        if (this.showNetworkBanner) this.selectedNetwork = val;
      }
    },
    statusCode(code, oldCode) {
      if (code === oldCode) return;
      switch (code) {
        case 0: // Wallet loaded
          this.$q.loading.hide();
          this.$router.replace({ path: "/wallet" });
          break;
        case -1: // Error
        case -22:
          this.$q.loading.hide();
          this.$q.notify({
            type: "negative",
            timeout: 1000,
            message: this.status.message || ""
          });
          this.$store.commit("gateway/set_wallet_data", {
            status: {
              code: 1 // Reset to 1 (ready for action)
            }
          });
          break;
      }
    }
  },
  methods: {
    getNetworkLabel(net) {
      switch (net) {
        case "testnet":
          return "Testnet";
        case "legacy":
          return "Legacy Mainnet";
        default:
          return "Mainnet";
      }
    },
    onNetworkChange(targetNetwork) {
      if (targetNetwork === this.currentNetType) {
        return;
      }
      this.switchNetworkAndRestart(targetNetwork);
    },
    switchNetworkAndRestart(targetNetwork) {
      console.log("[wallet-select] switchNetworkAndRestart called, target:", targetNetwork);
      const networkLabel = this.getNetworkLabel(targetNetwork);
      this.$q.dialog({
        title: `Switch to ${networkLabel}?`,
        message: `This will save the network setting and restart the application to switch to ${networkLabel} mode.`,
        ok: {
          label: "Switch & Restart",
          color: "primary"
        },
        cancel: {
          flat: true,
          label: "Cancel"
        }
      }).onOk(() => {
        console.log("[wallet-select] User confirmed switch to:", targetNetwork);
        // Show restart overlay immediately
        this.isRestarting = true;
        // Save the new network config
        console.log("[wallet-select] Sending quick_save_config with net_type:", targetNetwork);
        this.$gateway.send("core", "quick_save_config", {
          app: { net_type: targetNetwork }
        });
        // Trigger restart after a short delay to allow config to save
        setTimeout(() => {
          console.log("[wallet-select] Triggering app restart...");
          this.$router.replace({ path: "/quit" });
          window.electronAPI.confirmClose(true);
        }, 500);
      }).onCancel(() => {
        // Reset dropdown to current network if cancelled
        this.selectedNetwork = this.currentNetType;
      });
    },
    openWallet(wallet) {
      const walletNetType = wallet.net_type || "mainnet";

      // Check if wallet network matches current network
      if (walletNetType !== this.currentNetType) {
        const walletNetLabel = this.getNetworkLabel(walletNetType);
        const currentNetLabel = this.getNetworkLabel(this.currentNetType);

        this.$q.dialog({
          title: "Network Mismatch",
          message: `This is a ${walletNetLabel} wallet, but the app is currently in ${currentNetLabel} mode. You need to switch networks to open this wallet.`,
          ok: {
            label: `Switch to ${walletNetLabel} & Restart`,
            color: "primary"
          },
          cancel: {
            flat: true,
            label: "Cancel"
          }
        }).onOk(() => {
          // Show restart overlay immediately
          this.isRestarting = true;
          // Save the new network config and restart
          this.$gateway.send("core", "quick_save_config", {
            app: { net_type: walletNetType }
          });
          setTimeout(() => {
            this.$router.replace({ path: "/quit" });
            window.electronAPI.confirmClose(true);
          }, 500);
        });
        return;
      }

      const doOpenWallet = (password) => {
        this.$q.loading.show({ delay: 0 });
        this.$gateway.send("wallet", "open_wallet", {
          name: wallet.name,
          password: password
        });
      };

      if (wallet.password_protected !== false) {
        this.$q
          .dialog({
            title: this.$t("dialog.password.title"),
            message: this.$t("dialog.password.message"),
            prompt: {
              model: "",
              type: "password"
            },
            ok: {
              label: this.$t("dialog.buttons.open"),
              color: "primary"
            },
            cancel: {
              flat: true,
              label: this.$t("dialog.buttons.cancel")
            },
            color: "#1F1C47",
            persistent: true
          })
          .onOk(password => {
            doOpenWallet(password);
          })
          .onCancel(() => {})
          .onDismiss(() => {});
      } else {
        doOpenWallet("");
      }
    },
    createNewWallet() {
      this.$router.replace({ name: "wallet-create" });
    },
    restoreWallet() {
      this.$router.replace({ name: "wallet-restore" });
    },
    restoreViewWallet() {
      this.$router.replace({ name: "wallet-import-view-only" });
    },
    importWallet() {
      this.$router.replace({ name: "wallet-import" });
    },
    importOldGuiWallets() {
      this.$router.replace({ name: "wallet-import-old-gui" });
    },
    importLegacyWallet() {
      this.$router.replace({ name: "wallet-import-legacy" });
    }
  }
};
</script>

<style lang="scss">
.restart-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: white;
  font-size: 16px;
}

.network-mode-banner {
  &.compact {
    padding: 2px 10px;
    min-height: unset;

    .q-banner__content {
      padding: 0;
    }

    .q-banner__avatar {
      min-width: 20px;
      padding-right: 6px;

      .q-icon {
        font-size: 16px;
      }
    }
  }

  .q-banner__avatar {
    align-self: center;
    padding-top: 0;
  }

  .text-caption {
    font-size: 10px;
    opacity: 0.85;
    margin-top: 1px;
  }

  .network-selector {
    min-width: 140px;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 4px;

    .q-field__control {
      color: inherit;
      min-height: 28px;
      font-size: 13px;
    }
  }

  &.bg-purple {
    background-color: #9c27b0 !important;
  }
}

.wallet-list {
  .wallet-icon {
    font-size: 3rem;
  }

  .header {
    margin: 0 16px;
    padding: 6px;
    min-height: 36px;

    .header-title {
      font-size: 14px;
      font-weight: 500;
    }

    .add {
      width: 38px;
      padding: 0;
    }
  }
  .wallet-name {
    font-size: 1.1rem;
  }
  .q-item {
    margin: 10px 16px;
    margin-bottom: 0px;
    padding: 14px;
    border-radius: 3px;
  }

}
</style>
