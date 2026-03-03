<template>
  <q-page class="welcome">
    <q-stepper ref="stepper" v-model="step" class="welcome-stepper" flat dark>
      <q-step
        :name="1"
        :title="$t('titles.welcome')"
        :done="step > 1"
        class="first-step"
      >
        <div class="welcome-container">
          <img src="Equilibria.svg" height="100" class="q-mb-md" />
          <div>Wallet Version: v{{ version }}</div>
          <div>Daemon Version: {{ daemonVersion }}</div>
          <LanguageSelect class="q-mt-lg" @select="onLanguageSelected" />
        </div>
      </q-step>

      <q-step :name="2" :title="$t('titles.configure')">
        <SettingsGeneral ref="settingsGeneral" :randomise-remote="true" />
        <div class="q-mt-lg text-center">
          <q-btn
            flat
            icon="bug_report"
            color="grey-6"
            label="Troubleshooting Logs"
            @click="showLogs = true"
          />
        </div>
      </q-step>
    </q-stepper>

    <q-footer class="no-shadow q-pa-sm">
      <div class="row justify-between items-center">
        <q-btn
          flat
          icon="bug_report"
          color="grey-6"
          label="Logs"
          @click="showLogs = true"
        />
        <div v-if="!(step === 1)" class="row">
          <q-btn flat :label="$t('buttons.back')" @click="clickPrev()" />
          <q-btn
            class="q-ml-sm"
            color="primary"
            :label="$t('buttons.next')"
            @click="clickNext()"
          />
        </div>
      </div>
    </q-footer>

    <q-dialog v-model="showLogs" maximized>
      <q-card dark class="bg-dark">
        <q-toolbar class="bg-dark">
          <q-toolbar-title>Troubleshooting</q-toolbar-title>
          <q-btn flat round icon="close" @click="showLogs = false" />
        </q-toolbar>
        <q-card-section>
          <SettingsTroubleshooting />
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script>
import { version } from "../../../package.json";
import { mapState } from "vuex";
import LanguageSelect from "components/language_select";
import SettingsGeneral from "components/settings_general";
import SettingsTroubleshooting from "components/settings_troubleshooting";

export default {
  components: {
    LanguageSelect,
    SettingsGeneral,
    SettingsTroubleshooting
  },
  data() {
    return {
      step: 1,
      version: "",
      showLogs: false
    };
  },
  beforeMount() {
    // Check if step parameter is in route query
    if (this.$route.query.step) {
      this.step = parseInt(this.$route.query.step) || 1;
    }
  },
  computed: mapState({
    theme: state => state.gateway.app.config.appearance.theme,
    pending_config: state => state.gateway.app.pending_config,
    config_daemon() {
      if (!this.pending_config.daemons || !this.pending_config.app) return {};
      return this.pending_config.daemons[this.pending_config.app.net_type] || {};
    },
    daemon: state => state.gateway.daemon,

    // to be fixed
    daemonVersion() {
      const dVersion = this.daemon.info.version;
      return dVersion ? "v" + dVersion : "N/A";
    }
  }),
  mounted() {
    this.version = version;

    // Reset status to allow configuration
    this.$store.commit("gateway/set_app_data", {
      status: {
        code: -1 // Config not found - allows welcome screen to show
      }
    });

    // Ensure that if we navigate back to welcome with step parameter, we show the config step
    if (
      this.$route.query.step === "2" ||
      this.$route.path === "/init/welcome"
    ) {
      this.step = 2;
    }
  },
  methods: {
    clickNext() {
      // if the last step is active, then we want to initialise the config
      if (this.step === 2) {
        this.$gateway.send("core", "save_config_init", this.pending_config);
        this.$router.replace({ path: "/" });
      } else {
        this.$refs.stepper.next();
      }
    },
    clickPrev() {
      this.$refs.stepper.previous();
    },
    onLanguageSelected() {
      // Save default config (local node) and go directly to wallet-select
      // This allows users to create offline wallets without configuring daemon first
      // Mainnet is offline and testnet has no public remote nodes
      this.$gateway.send("core", "save_config_init", this.pending_config);
      this.$router.replace({ path: "/wallet-select" });
    }
  }
};
</script>

<style lang="scss">
.welcome {
  height: 100vh;

  .welcome-stepper {
    height: 100%;
    background: transparent;
  }

  .welcome-container {
    padding-top: 14vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .first-step .q-stepper-step-inner {
    min-height: 250px;
    height: calc(100vh - 102px);
  }
}

.language-item {
  padding: 10px 30px 10px 20px;
  border: 1px solid #ccc;
  cursor: pointer;

  .language-item-circle {
    background: #cc90e2;
    width: 50px;
    height: 50px;
    border-radius: 25px;
    display: inline-block;
    line-height: 50px;
    text-align: center;
    color: white;
    margin-right: 10px;
  }
}

.q-stepper-header {
  min-height: 10vh;
}
</style>
