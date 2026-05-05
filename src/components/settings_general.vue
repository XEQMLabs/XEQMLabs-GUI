<template>
  <div class="settings-general">
    <!-- Restart overlay to hide content flash -->
    <div v-if="isRestarting" class="restart-overlay">
      <q-spinner-dots color="white" size="40px" />
      <div class="q-mt-md">Restarting...</div>
    </div>

    <!-- Current Network Indicator -->
    <div class="current-network-indicator q-mb-lg q-pa-md" :class="config.app.net_type">
      <div class="row items-center">
        <q-icon :name="networkIcon" size="sm" class="q-mr-sm" />
        <span class="network-label">
          <strong>{{ networkDisplayName }} Settings</strong>
        </span>
      </div>
      <p class="q-mb-none q-mt-sm text-caption">
        To switch networks, go back to the wallet list and use the network dropdown.
      </p>
    </div>

    <!-- Warning messages for network status -->
    <div v-if="config.app.net_type === 'testnet' && !daemon_connected" class="network-warning q-mb-md q-pa-md">
      <q-icon name="info" color="info" size="sm" class="q-mr-sm" />
      <span class="warning-text">
        <strong>Testnet:</strong> Select <strong>Local Node</strong> below and click <strong>Connect</strong> to start your local daemon.
      </span>
    </div>

    <!-- Connection Status and Connect Button -->
    <div class="connection-status q-mb-lg q-pa-md">
      <div class="row items-center justify-between">
        <div class="row items-center">
          <q-icon
            :name="daemon_connected ? 'check_circle' : 'cancel'"
            :color="daemon_connected ? 'positive' : 'grey'"
            size="md"
            class="q-mr-sm"
          />
          <span class="status-text">
            <strong>Status:</strong>
            {{ daemon_connected ? 'Connected' : 'Disconnected' }}
          </span>
        </div>
        <div>
          <q-btn
            v-if="!daemon_connected"
            color="primary"
            :loading="daemon_connecting"
            :disable="daemon_connecting"
            @click="connectDaemon"
          >
            <q-icon name="power" class="q-mr-sm" />
            Connect
          </q-btn>
          <q-btn
            v-else
            color="negative"
            outline
            @click="disconnectDaemon"
          >
            <q-icon name="power_off" class="q-mr-sm" />
            Disconnect
          </q-btn>
        </div>
      </div>
    </div>

    <div class="row justify-between q-mb-md">
      <div>
        <q-radio
          v-model="selectedDaemonType"
          val="local"
          :label="$t('strings.daemon.local.title')"
          @update:model-value="onDaemonTypeChange"
        />
      </div>
      <div>
        <q-radio
          v-model="selectedDaemonType"
          val="remote"
          :label="$t('strings.daemon.remote.title')"
          :disable="config.app.net_type === 'testnet'"
          @update:model-value="onDaemonTypeChange"
        />
      </div>
      <!-- Local + Remote commented out — not needed, confuses users -->
      <!-- <div>
        <q-radio
          v-model="config_daemon.type"
          val="local_remote"
          :label="$t('strings.daemon.localRemote.title')"
        />
      </div> -->
    </div>

    <!-- <p v-if="selectedDaemonType == 'local_remote'" class="tab-desc">
      {{ $t("strings.daemon.localRemote.description") }}
    </p> -->
    <p v-if="selectedDaemonType == 'local'" class="tab-desc">
      {{ $t("strings.daemon.local.description") }}
    </p>
    <p v-if="selectedDaemonType == 'remote'" class="tab-desc">
      {{ $t("strings.daemon.remote.description") }}
    </p>

    <template v-if="selectedDaemonType != 'remote'">
      <div class="row pl-sm">
        <OxenField
          class="col-8"
          :label="$t('fieldLabels.localDaemonIP')"
          disable
        >
          <q-input
            v-model="config_daemon.rpc_bind_ip"
            :placeholder="daemon_defaults.rpc_bind_ip"
            disable
            borderless
            dense
          />
        </OxenField>
        <OxenField
          class="col-4"
          :label="$t('fieldLabels.localDaemonPort') + '(RPC)'"
        >
          <q-input
            v-model="config_daemon.rpc_bind_port"
            :placeholder="toString(daemon_defaults.rpc_bind_port)"
            type="number"
            :decimals="0"
            :step="1"
            min="1024"
            max="65535"
            borderless
            dense
          />
        </OxenField>
      </div>
    </template>

    <template v-if="selectedDaemonType != 'local'">
      <div class="row q-mt-md pl-sm">
        <OxenField class="col-8" :label="$t('fieldLabels.remoteNodeHost')">
          <q-input
            v-model="config_daemon.remote_host"
            :placeholder="daemon_defaults.remote_host"
            borderless
            dense
          />
          <!-- Remote node presets for mainnet -->
          <q-btn-dropdown
            v-if="config.app.net_type === 'mainnet' && remotes && remotes.length > 0"
            class="remote-dropdown"
            flat
            label="Presets"
          >
            <q-list>
              <q-item
                v-for="option in remotes"
                :key="option.host"
                v-close-popup
                clickable
                @click="setPreset(option)"
              >
                <q-item-section>
                  <q-item-label>{{ option.host }}:{{ option.port }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </OxenField>
        <OxenField class="col-4" :label="$t('fieldLabels.remoteNodePort')">
          <q-input
            v-model="config_daemon.remote_port"
            :placeholder="toString(daemon_defaults.remote_port)"
            type="number"
            :decimals="0"
            :step="1"
            min="1024"
            max="65535"
            :dark="theme == 'dark'"
            borderless
            dense
          />
        </OxenField>
      </div>
    </template>

    <div class="col q-mt-md pt-sm">
      <OxenField :label="$t('fieldLabels.dataStoragePath')" disable-hover>
        <q-input
          v-model="config.app.data_dir"
          disable
          :dark="theme == 'dark'"
          borderless
          dense
        />
        <input
          id="dataPath"
          ref="fileInputData"
          type="file"
          webkitdirectory
          directory
          hidden
          @change="setDataPath"
        />
        <q-btn
          color="primary"
          :text-color="theme == 'dark' ? 'white' : 'dark'"
          @click="selectPath('data')"
          >{{ $t("buttons.selectLocation") }}</q-btn
        >
      </OxenField>
      <OxenField :label="$t('fieldLabels.walletStoragePath')" disable-hover>
        <q-input
          v-model="config.app.wallet_data_dir"
          disable
          :dark="theme == 'dark'"
          borderless
          dense
        />
        <input
          id="walletPath"
          ref="fileInputWallet"
          type="file"
          webkitdirectory
          directory
          hidden
          @change="setWalletDataPath"
        />
        <q-btn
          color="primary"
          :text-color="theme == 'dark' ? 'white' : 'dark'"
          @click="selectPath('wallet')"
          >{{ $t("buttons.selectLocation") }}</q-btn
        >
      </OxenField>

      <!-- Blockchain Database Directory (read-only, informational) -->
      <div class="blockchain-db-info q-mt-md q-pa-md">
        <div class="row items-center justify-between q-mb-sm">
          <div class="db-info-label">
            <q-icon name="storage" size="sm" class="q-mr-sm" />
            <strong>Blockchain Database Location</strong>
          </div>
          <q-btn
            flat
            dense
            color="primary"
            icon="folder_open"
            label="Open Folder"
            @click="openBlockchainFolder"
          />
        </div>
        <div class="db-path q-pa-sm">
          {{ blockchainDataDir }}
        </div>
        <p class="text-caption q-mb-none q-mt-sm">
          This is where the {{ networkDisplayName }} blockchain data is stored.
          You can delete this folder to resync, or copy in a pre-synced database to speed up initial sync.
        </p>
      </div>

      <!-- Wallet Backup (read-only, informational) -->
      <div class="blockchain-db-info q-mt-md q-pa-md">
        <div class="row items-center justify-between q-mb-sm">
          <div class="db-info-label">
            <q-icon name="backup" size="sm" class="q-mr-sm" />
            <strong>Wallet Backup</strong>
          </div>
          <q-btn
            v-if="walletsBackupPath"
            flat
            dense
            color="primary"
            icon="folder_open"
            label="Open Folder"
            @click="openWalletBackupFolder"
          />
        </div>
        <div class="db-path q-pa-sm">
          {{ walletsBackupPath || '—' }}
        </div>
        <p class="text-caption q-mb-none q-mt-sm">
          Wallet files are automatically copied here (per network). This folder is not removed when you reinstall the app.
          To restore after reinstall, copy files from here into your wallet storage path above.
        </p>
      </div>
    </div>

    <q-expansion-item
      :label="$t('strings.advancedOptions')"
      header-class="q-mt-sm non-selectable row reverse advanced-options-label"
    >
      <div class="row pl-sm q-mt-sm">
        <OxenField
          class="col-6"
          :label="$t('fieldLabels.daemonLogLevel')"
          :disable="is_remote"
        >
          <q-input
            v-model="config_daemon.log_level"
            :placeholder="toString(daemon_defaults.log_level)"
            :disable="is_remote"
            :dark="theme == 'dark'"
            type="number"
            :decimals="0"
            :step="1"
            min="0"
            max="4"
            borderless
            dense
          />
        </OxenField>
        <OxenField class="col-6" :label="$t('fieldLabels.walletLogLevel')">
          <q-input
            v-model="config.wallet.log_level"
            :placeholder="toString(defaults.wallet.log_level)"
            :dark="theme == 'dark'"
            type="number"
            :decimals="0"
            :step="1"
            min="0"
            max="4"
            borderless
            dense
          />
        </OxenField>
      </div>

      <div class="row pl-sm q-mt-md">
        <OxenField
          class="col-3"
          :label="$t('fieldLabels.maxIncomingPeers')"
          :disable="is_remote"
        >
          <q-input
            v-model="config_daemon.in_peers"
            :placeholder="toString(daemon_defaults.in_peers)"
            :disable="is_remote"
            :dark="theme == 'dark'"
            type="number"
            :decimals="0"
            :step="1"
            min="-1"
            max="65535"
            borderless
            dense
          />
        </OxenField>
        <OxenField
          class="col-3"
          :label="$t('fieldLabels.maxOutgoingPeers')"
          :disable="is_remote"
        >
          <q-input
            v-model="config_daemon.out_peers"
            :placeholder="toString(daemon_defaults.out_peers)"
            :disable="is_remote"
            :dark="theme == 'dark'"
            type="number"
            :decimals="0"
            :step="1"
            min="-1"
            max="65535"
            borderless
            dense
          />
        </OxenField>
        <OxenField
          class="col-3"
          :label="$t('fieldLabels.limitUploadRate')"
          :disable="is_remote"
        >
          <q-input
            v-model="config_daemon.limit_rate_up"
            :placeholder="toString(daemon_defaults.limit_rate_up)"
            :disable="is_remote"
            :dark="theme == 'dark'"
            type="number"
            suffix="Kb/s"
            :decimals="0"
            :step="1"
            min="-1"
            max="65535"
            borderless
            dense
          />
        </OxenField>
        <OxenField
          class="col-3"
          :label="$t('fieldLabels.limitDownloadRate')"
          :disable="is_remote"
        >
          <q-input
            v-model="config_daemon.limit_rate_down"
            :placeholder="toString(daemon_defaults.limit_rate_down)"
            :disable="is_remote"
            :dark="theme == 'dark'"
            type="number"
            suffix="Kb/s"
            :decimals="0"
            :step="1"
            min="-1"
            max="65535"
            borderless
            dense
          />
        </OxenField>
      </div>
      <div class="row pl-sm q-mt-md">
        <OxenField
          class="col-3"
          :label="$t('fieldLabels.daemonP2pPort')"
          :disable="is_remote"
        >
          <q-input
            v-model="config_daemon.p2p_bind_port"
            :placeholder="toString(daemon_defaults.p2p_bind_port)"
            :disable="is_remote"
            :dark="theme == 'dark'"
            float-
            type="number"
            :decimals="0"
            :step="1"
            min="1024"
            max="65535"
            borderless
            dense
          />
        </OxenField>
        <OxenField class="col-3" :label="$t('fieldLabels.internalWalletPort')">
          <q-input
            v-model="config.app.ws_bind_port"
            :placeholder="toString(defaults.app.ws_bind_port)"
            :dark="theme == 'dark'"
            float-
            type="number"
            :decimals="0"
            :step="1"
            min="1024"
            max="65535"
            borderless
            dense
          />
        </OxenField>
        <OxenField
          class="col-3"
          :label="$t('fieldLabels.walletRPCPort')"
          :disable="is_remote"
        >
          <q-input
            v-model="config.wallet.rpc_bind_port"
            :placeholder="toString(defaults.wallet.rpc_bind_port)"
            :disable="is_remote"
            :dark="theme == 'dark'"
            float-
            type="number"
            :decimals="0"
            :step="1"
            min="1024"
            max="65535"
            borderless
            dense
          />
        </OxenField>
      </div>
      <!-- Network selector moved to top of page for visibility -->
    </q-expansion-item>
  </div>
</template>

<script>
import { mapState } from "vuex";
import OxenField from "components/oxen_field";
export default {
  name: "SettingsGeneral",
  components: {
    OxenField
  },
  props: {
    randomiseRemote: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data() {
    return {
      select: 0,
      selectedDaemonType: null,
      isRestarting: false
    };
  },
  computed: mapState({
    theme: state => state.gateway.app.config.appearance.theme,
    remotes: state => state.gateway.app.remotes,
    config: state => state.gateway.app.pending_config,
    daemon_connected: state => state.gateway.app.daemon_connected,
    daemon_connecting: state => state.gateway.app.daemon_connecting,
    config_daemon() {
      if (!this.config.daemons || !this.config.app) return {};
      return this.config.daemons[this.config.app.net_type] || {};
    },
    is_remote() {
      return this.config_daemon.type === "remote";
    },
    defaults: state => state.gateway.app.defaults,
    daemon_defaults() {
      if (!this.defaults || !this.defaults.daemons || !this.config.app) return {};
      return this.defaults.daemons[this.config.app.net_type] || {};
    },
    networkIcon() {
      if (!this.config.app) return "public";
      switch (this.config.app.net_type) {
        case "testnet":
          return "science";
        default:
          return "public";
      }
    },
    networkDisplayName() {
      if (!this.config.app) return "Mainnet";
      switch (this.config.app.net_type) {
        case "testnet":
          return "Testnet";
        default:
          return "Mainnet";
      }
    },
    blockchainDataDir() {
      if (!this.config.app || !this.config.app.data_dir) return "";
      const baseDir = this.config.app.data_dir;
      const netType = this.config.app.net_type;
      // Mainnet uses base dir, others use subdirectories
      switch (netType) {
        case "testnet":
          return `${baseDir}/testnet`;
        case "stagenet":
          return `${baseDir}/stagenet`;
        default:
          return baseDir;
      }
    },
    walletsBackupPath() {
      return (this.config.app && this.config.app.wallets_backup_path) || "";
    }
  }),
  mounted() {
    if (!this.config.app || !this.config.daemons) return;

    // Default to local node
    if (this.randomiseRemote) {
      this.config_daemon.type = "local";
    }

    // If someone had local_remote saved, fall back to local
    if (this.config_daemon.type === "local_remote") {
      this.config_daemon.type = "local";
    }

    // Force local for testnet since no remote nodes are available
    if (this.config.app.net_type === "testnet") {
      this.config_daemon.type = "local";
    }

    // Initialize selectedDaemonType to match current config
    this.selectedDaemonType = this.config_daemon.type;
  },
  methods: {
    onDaemonTypeChange(newType) {
      const currentType = this.config_daemon.type;
      if (newType === currentType) {
        return;
      }

      const typeLabel = newType === "local" ? "Local Node" : "Remote Node";
      this.$q.dialog({
        title: `Switch to ${typeLabel}?`,
        message: `This will save the setting and restart the application to switch to ${typeLabel} mode.`,
        ok: {
          label: "Switch & Restart",
          color: "primary"
        },
        cancel: {
          flat: true,
          label: "Cancel"
        }
      }).onOk(() => {
        // Show restart overlay immediately
        this.isRestarting = true;
        // Update the config with the new daemon type
        this.config_daemon.type = newType;
        // Save config and restart
        this.$gateway.send("core", "quick_save_config", {
          app: this.config.app,
          daemons: this.config.daemons
        });
        // Trigger restart after a short delay to allow config to save
        setTimeout(() => {
          this.$router.replace({ path: "/quit" });
          window.electronAPI.confirmClose(true);
        }, 500);
      }).onCancel(() => {
        // Reset radio button to current type if cancelled
        this.selectedDaemonType = currentType;
      });
    },
    selectPath(type) {
      const fileInput = type === "data" ? "fileInputData" : "fileInputWallet";
      this.$refs[fileInput].click();
    },
    setDataPath(file) {
      if (file.target.files && file.target.files.length > 0) {
        this.config.app.data_dir = file.target.files[0].path;
      }
    },
    setWalletDataPath(file) {
      if (file.target.files && file.target.files.length > 0) {
        this.config.app.wallet_data_dir = file.target.files[0].path;
      }
    },
    setPreset(option) {
      if (!option) return;

      const { host, port } = option;
      if (host) this.config_daemon.remote_host = host;
      if (port) this.config_daemon.remote_port = port;
    },
    toString(value) {
      if (!value && typeof value !== "number") return "";
      return String(value);
    },
    connectDaemon() {
      // Save config first, then connect
      this.$gateway.send("core", "quick_save_config", {
        app: this.config.app,
        daemons: this.config.daemons
      });
      this.$gateway.send("core", "connect_daemon");
    },
    disconnectDaemon() {
      this.$gateway.send("core", "disconnect_daemon");
    },
    openBlockchainFolder() {
      if (this.blockchainDataDir) {
        this.$gateway.send("core", "open_folder", { path: this.blockchainDataDir });
      }
    },
    openWalletBackupFolder() {
      if (this.walletsBackupPath) {
        this.$gateway.send("core", "open_folder", { path: this.walletsBackupPath });
      }
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

.settings-general {
  .q-field {
    margin: 20px 0;
  }

  .q-if-disabled {
    cursor: default !important;
    .q-input-target {
      cursor: default !important;
    }
  }

  .current-network-indicator {
    border-radius: 8px;

    &.mainnet {
      background: rgba(0, 255, 136, 0.15);
      border: 1px solid rgba(0, 255, 136, 0.3);

      .network-label {
        color: #00ff88;
      }
    }

    &.testnet {
      background: rgba(255, 167, 38, 0.15);
      border: 1px solid rgba(255, 167, 38, 0.3);

      .network-label {
        color: #FFA726;
      }
    }

    .text-caption {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
    }
  }

  .network-warning {
    background: rgba(255, 193, 7, 0.15);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: 8px;
    display: flex;
    align-items: flex-start;

    .warning-text {
      color: #fff;
      font-size: 14px;
      line-height: 1.5;
    }
  }

  .connection-status {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;

    .status-text {
      color: #fff;
      font-size: 16px;
    }
  }

  .blockchain-db-info {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;

    .db-info-label {
      display: flex;
      align-items: center;
      color: #fff;
    }

    .db-path {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
      color: #ccc;
      word-break: break-all;
    }

    .text-caption {
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }
  }

  .q-item,
  .q-collapsible-sub-item {
    padding: 0;
  }

  .row.pl-sm {
    > * + * {
      padding-left: 16px;
    }
  }

  .col.pt-sm {
    > * + * {
      padding-top: 16px;
    }
  }

  .remote-dropdown {
    padding: 0 !important;
  }
}
</style>
