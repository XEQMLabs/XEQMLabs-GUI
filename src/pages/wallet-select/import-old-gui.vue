<template>
  <q-page>
    <div class="q-mx-md import-old-gui">
      <q-list class="wallet-list">
        <q-item
          v-for="state in directory_state"
          :key="state.directory"
          :class="{ selected: state.selected }"
        >
          <q-item-section>
            <div class="row items-center">
              <q-item-label class="items-center">
                <q-checkbox v-model="state.selected" dark color="dark" />
              </q-item-label>
              <q-item-label
                class="wallet-name"
                @click="state.selected = !state.selected"
              >
                {{ state.directory }}
              </q-item-label>
            </div>
          </q-item-section>

          <q-item-section side>
            <q-select
              v-model="state.type"
              hide-underline
              dark
              class="q-ma-none full-width nettype-select"
              :options="selectOptions"
              emit-value
              map-options
            />
          </q-item-section>
        </q-item>
      </q-list>

      <q-btn
        color="primary"
        class="submit-button"
        :label="($t('buttons.importWallet').split(' | ')[1] || $t('buttons.importWallet')).trim()"
        :disable="selectedWallets.length === 0"
        @click="import_wallets"
      />
    </div>
  </q-page>
</template>

<script>
import { mapState } from "vuex";

export default {
  data() {
    return {
      directory_state: []
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      directories: state => state.gateway.wallets.directories,
      old_gui_import_status: state => state.gateway.old_gui_import_status,
      selectOptions: () => [
        {
          label: "Main",
          value: "mainnet"
        },
        {
          label: "Staging",
          value: "stagenet"
        },
        {
          label: "Test",
          value: "testnet"
        }
      ],
      selectedWallets() {
        return this.directory_state.filter(s => s.selected);
      }
    }),
    oldGuiImportStatusCode() {
      return this.old_gui_import_status ? this.old_gui_import_status.code : -1;
    }
  },
  watch: {
    directories: {
      handler() {
        this.populate_state();
      },
      deep: true
    },
    oldGuiImportStatusCode(code, oldCode) {
      if (code === oldCode) return;

      const { failed_wallets } = this.old_gui_import_status;

      // Imported
      if (code === 0) {
        this.$q.loading.hide();
        if (failed_wallets.length === 0) {
          this.$router.replace({ path: "/wallet-select" });
        } else {
          failed_wallets.forEach(wallet => {
            this.$q.notify({
              type: "negative",
              timeout: 3000,
              message:
                this.$t("notification.errors.failedWalletImport") +
                `: ${wallet}`
            });
          });
        }
      }
    }
  },
  created() {
    this.$gateway.send("wallet", "list_wallets");
    this.populate_state();
  },
  methods: {
    populate_state() {
      // Keep any directories that intersect
      const new_state = this.directory_state.filter(state =>
        this.directories.includes(state.directory)
      );

      // Add in new directories
      this.directories
        .filter(dir => !new_state.find(state => state.directory === dir))
        .forEach(directory => {
          new_state.push({
            directory,
            selected: false,
            type: "mainnet"
          });
        });

      // Sort them
      this.directory_state = new_state.sort(function(a, b) {
        return a.directory.localeCompare(b.directory);
      });
    },
    import_wallets() {
      this.$q.loading.show({
        delay: 0
      });
      this.$gateway.send("wallet", "copy_old_gui_wallets", {
        wallets: this.selectedWallets
      });
    },
    cancel() {
      this.$router.replace({ path: "/wallet-select" });
    }
  }
};
</script>

<style lang="scss">
.import-old-gui {
  .wallet-list {
    .q-item {
      margin: 10px 0px;
      margin-bottom: 0px;
      padding: 14px;
      border-radius: 3px;

      .wallet-name {
        padding-left: 24px;
        font-size: 18px;
      }
    }
  }
}
</style>
