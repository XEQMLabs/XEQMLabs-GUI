<template>
  <div>
    <q-btn class="menu" icon="menu" size="md" flat>
      <q-menu>
        <q-list separator class="menu-list">
          <q-item
            v-if="!disableSwitchWallet"
            v-close-popup
            clickable
            @click="switchWallet"
          >
            <q-item-label header>{{
              $t("menuItems.switchWallet")
            }}</q-item-label>
          </q-item>
          <q-item v-close-popup clickable @click="openSettings">
            <q-item-label header>Network Settings</q-item-label>
          </q-item>
          <q-item v-close-popup clickable @click="showAbout(true)">
            <q-item-label header>{{ $t("menuItems.about") }}</q-item-label>
          </q-item>
          <q-item v-close-popup clickable @click="exit">
            <q-item-label header>{{ $t("menuItems.exit") }}</q-item-label>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
    <SettingsModal ref="settingsModal" />
    <q-dialog ref="aboutModal" minimized>
      <div class="about-modal">
        <img class="q-mb-md" src="XEQMLabs.svg" height="42" />

        <p class="q-my-sm">Wallet Version: v{{ version }}</p>
        <p class="q-my-sm">Daemon Version: v{{ daemonVersion }}</p>
        <p class="q-my-sm">Copyright (c) 2026, XEQMLabs</p>
        <p class="q-my-sm">All rights reserved.</p>

        <div class="q-mt-md q-mb-lg external-links">
          <p>
            <a href="#" @click="openExternal('https://t.me/XEQCommunity')"
              >Telegram</a
            >
            -
            <a
              href="#"
              @click="openExternal('https://github.com/DomXEQ/XEQMLabs-GUI')"
              >Github</a
            >
          </p>
        </div>
        <q-btn color="primary" label="Close" @click="showAbout(false)" />
      </div>
    </q-dialog>
  </div>
</template>

<script>
import { version } from "../../../package.json";
import { mapState } from "vuex";
import SettingsModal from "components/settings";
export default {
  name: "MainMenu",
  components: {
    SettingsModal
  },
  props: {
    disableSwitchWallet: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data() {
    return {
      version: ""
    };
  },
  computed: mapState({
    theme: state => state.gateway.app.config.appearance.theme,
    isRPCSyncing: state => state.gateway.wallet.isRPCSyncing,
    daemon: state => state.gateway.daemon,
    openSettingsRequested: state => state.gateway.app.open_settings_requested,
    daemonVersion() {
      return this.daemon.info.version || "N/A";
    }
  }),
  mounted() {
    this.version = version;
  },
  watch: {
    openSettingsRequested(val) {
      if (val) {
        // Open settings modal
        this.$nextTick(() => {
          this.$refs.settingsModal.isVisible = true;
        });
        // Clear the flag
        this.$store.commit("gateway/set_app_data", {
          open_settings_requested: false
        });
      }
    }
  },
  methods: {
    openExternal(url) {
      this.$gateway.send("core", "open_url", { url });
    },
    showAbout(toggle) {
      if (toggle) this.$refs.aboutModal.show();
      else this.$refs.aboutModal.hide();
    },
    openSettings() {
      this.$refs.settingsModal.isVisible = true;
    },
    switchWallet() {
      // If the rpc is syncing then we want to tell the user to restart
      if (this.isRPCSyncing) {
        this.$gateway.confirmClose(
          this.$t("dialog.switchWallet.restartMessage"),
          true
        );
        return;
      }

      this.$gateway.confirmClose(
        this.$t("dialog.switchWallet.restartWalletMessage"),
        true
      );

      // Allow switching normally because rpc won't be blocked
      // NB: If this is added back, must use the quasar v1 APIs
      /*
      this.$q
        .dialog({
          title: this.$t("dialog.switchWallet.title"),
          message: this.$t("dialog.switchWallet.closeMessage"),
          ok: {
            label: this.$t("dialog.buttons.ok")
          },
          cancel: {
            flat: true,
            label: this.$t("dialog.buttons.cancel"),
            color: this.theme == "dark" ? "white" : "dark"
          }
        })
        .then(() => {
          this.$router.replace({ path: "/wallet-select" });
          this.$gateway.send("wallet", "close_wallet");
          setTimeout(() => {
            // short delay to prevent wallet data reaching the
            // websocket moments after we close and reset data
            this.$store.dispatch("gateway/resetWalletData");
          }, 250);
        })
        .catch(() => {});
       */
    },
    exit() {
      this.$gateway.confirmClose(this.$t("dialog.exit.message"));
    }
  }
};
</script>

<style lang="scss">
.about-modal {
  padding: 25px;
  background: #0c1218;
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;
  text-align: center;

  p {
    color: rgba(255, 255, 255, 0.6);
  }

  .external-links {
    a {
      color: #00d4ff;
      text-decoration: none;

      &:hover,
      &:active {
        text-decoration: underline;
      }

      &:visited {
        color: #00a8cc;
      }
    }
  }
}
</style>
