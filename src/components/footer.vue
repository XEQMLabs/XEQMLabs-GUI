<template>
  <q-footer class="status-footer">
    <div class="status-line row items-center">
      <div class="status row items-center">
        <span class="network-indicator" :class="netType">{{ networkDisplayName }}</span>
        <span class="status-separator">|</span>
        <span>{{ $t("footer.status") }}:</span>
        <span v-if="syncStatusMessage" class="status-text syncing">
          {{ syncStatusMessage }}
        </span>
        <span v-else-if="isRefreshing" class="status-text syncing">
          {{ wallet.status.message }}
        </span>
        <span v-else-if="status === 'offline'" class="status-text offline">
          Ready - Offline
        </span>
        <span v-else class="status-text" :class="[status]">{{
          $t(`footer.${status}`)
        }}</span>
      </div>
      <div class="row">
        <template v-if="!daemon_connected">
          <div>Daemon: 0 / 0 (0%)</div>
          <div>{{ $t("footer.wallet") }}: 0 / 0 (0%)</div>
        </template>
        <template v-else>
          <template v-if="config_daemon.type !== 'remote'">
            <div>
              Daemon: {{ daemon_sync_height }} /
              {{ target_height }} ({{ daemon_local_pct }}%)
            </div>
          </template>

          <template v-if="config_daemon.type !== 'local'">
            <div>{{ $t("footer.remote") }}: {{ daemon.info.height || 0 }}</div>
          </template>

          <div>
            {{ $t("footer.wallet") }}: {{ wallet.info.height || 0 }} /
            {{ target_height }} ({{ wallet_pct }}%)
          </div>
        </template>
      </div>
    </div>
    <div class="status-bars" :class="[status]">
      <div :style="{ width: daemon_pct + '%' }"></div>
      <div :style="{ width: wallet_pct + '%' }"></div>
    </div>
  </q-footer>
</template>

<script>
import { mapState } from "vuex";

export default {
  name: "StatusFooter",
  data() {
    return {};
  },
  computed: mapState({
    config: state => state.gateway.app.config,
    daemon: state => state.gateway.daemon,
    wallet: state => state.gateway.wallet,
    update_required: state => state.gateway.update_required,
    daemon_connected: state => state.gateway.app.daemon_connected,

    netType() {
      return this.config.app?.net_type || "mainnet";
    },
    networkDisplayName() {
      switch (this.netType) {
        case "testnet":
          return "Testnet";
        default:
          return "Mainnet";
      }
    },
    config_daemon() {
      return this.config.daemons[this.config.app.net_type];
    },
    target_height() {
      if (!this.daemon_connected) return 0;
      if (this.config_daemon.type === "local")
        return Math.max(
          this.daemon.info.height || 0,
          this.daemon.info.target_height || 0
        );
      else return this.daemon.info.height || 0;
    },
    daemon_sync_height() {
      if (!this.daemon_connected) return 0;
      // Use height_without_bootstrap if available and > 0, otherwise use height
      const hwb = this.daemon.info.height_without_bootstrap || 0;
      const h = this.daemon.info.height || 0;
      return hwb > 0 ? hwb : h;
    },
    daemon_pct() {
      if (!this.daemon_connected) return 0;
      if (this.config_daemon.type === "local") return this.daemon_local_pct;
      return 0;
    },
    daemon_local_pct() {
      if (!this.daemon_connected) return 0;
      if (this.config_daemon.type === "remote") return 0;
      if (!this.target_height) return 0;
      let pct = (
        (100 * this.daemon_sync_height) /
        this.target_height
      ).toFixed(1);
      if (
        pct == 100.0 &&
        this.daemon_sync_height < this.target_height
      )
        return 99.9;
      else return pct;
    },
    wallet_pct() {
      if (!this.daemon_connected || !this.target_height) return 0;
      let pct = ((100 * (this.wallet.info.height || 0)) / this.target_height).toFixed(
        1
      );
      if (pct == 100.0 && (this.wallet.info.height || 0) < this.target_height)
        return 99.9;
      else return pct;
    },
    isRPCSyncing() {
      return this.wallet.isRPCSyncing || false;
    },
    isRefreshing() {
      const msg = this.wallet.status.message;
      return (
        msg &&
        msg !== "OK" &&
        (msg.toLowerCase().includes("refreshing") ||
          msg.toLowerCase().includes("syncing wallet"))
      );
    },
    // Detect if wallet is significantly behind daemon and actively syncing
    isSyncingBehind() {
      if (!this.daemon_connected || !this.target_height) return false;
      const walletHeight = this.wallet.info.height || 0;
      const blocksBehing = this.target_height - walletHeight;
      // If more than 10 blocks behind, consider it syncing
      return blocksBehing > 10;
    },
    syncStatusMessage() {
      if (!this.daemon_connected) return "";
      if (this.isRPCSyncing || this.isSyncingBehind) {
        const walletHeight = this.wallet.info.height || 0;
        const pct = this.wallet_pct;
        if (walletHeight === 0) {
          return "Connecting to network...";
        }
        return `Syncing wallet... ${pct}%`;
      }
      return "";
    },
    status() {
      // If daemon is not connected, show offline status
      if (!this.daemon_connected) {
        return "offline";
      }

      // Show syncing if RPC is syncing or wallet is significantly behind
      if (this.isRefreshing || this.isRPCSyncing || this.isSyncingBehind) {
        return "syncing";
      }

      // Check if wallet is fully synced (at 100%)
      const walletIsFullySynced =
        this.wallet.info.height >= this.target_height - 1;
      const walletPctNum = parseFloat(this.wallet_pct);

      // Priority: Show sync status based on wallet sync percentage
      // If wallet is at 100%, show READY
      // If wallet is under 100%, show SYNCING
      if (walletIsFullySynced || walletPctNum >= 100) {
        return "ready";
      } else {
        // Wallet is syncing (under 100%)
        return "syncing";
      }
    }
  })
};
</script>

<style lang="scss">
.status-footer {
  .network-indicator {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 3px;
    margin-right: 4px;

    &.mainnet {
      background-color: rgba(0, 255, 136, 0.2);
      color: #00ff88;
    }

    &.testnet {
      background-color: rgba(255, 167, 38, 0.2);
      color: #FFA726;
    }

  }

  .status-separator {
    margin: 0 8px;
    opacity: 0.5;
  }
}
</style>
