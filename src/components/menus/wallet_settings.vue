<template>
  <div class="wallet-settings">
    <!-- Testnet Connect/Disconnect Button -->
    <q-btn
      v-if="isTestnet"
      :class="daemon_connected ? 'disconnect-btn' : ''"
      :color="daemon_connected ? '' : 'primary'"
      size="md"
      :loading="daemon_connecting"
      :disable="daemon_connecting"
      class="daemon-toggle-btn q-mr-sm"
      @click="toggleDaemonConnection"
    >
      <q-icon :name="daemon_connected ? 'power_off' : 'power'" class="q-mr-xs" />
      {{ daemon_connected ? 'Disconnect' : 'Connect' }}
    </q-btn>

    <q-btn
      icon-right="more_vert"
      :label="$t('buttons.settings')"
      size="md"
      flat
      style="cursor: pointer"
    >
      <q-menu ref="settingsMenu" anchor="bottom right" self="top right">
        <q-list separator class="menu-list">
          <q-item
            clickable
            v-ripple
            @click="closeMenu(), openNetworkSettings()"
          >
            <q-item-label header>Network Settings</q-item-label>
          </q-item>
          <q-item
            clickable
            v-ripple
            :class="{ 'text-grey-6': !is_ready }"
            @click="is_ready && (closeMenu(), getPrivateKeys())"
          >
            <q-item-label header>{{
              $t("menuItems.showPrivateKeys")
            }}</q-item-label>
          </q-item>
          <q-item
            clickable
            v-ripple
            :class="{ 'text-grey-6': !is_ready }"
            @click="is_ready && (closeMenu(), showModal('change_password'))"
          >
            <q-item-label header>{{
              $t("menuItems.changePassword")
            }}</q-item-label>
          </q-item>
          <q-item
            clickable
            v-ripple
            :class="{ 'text-grey-6': !is_ready }"
            @click="is_ready && (closeMenu(), showModal('export_transfers'))"
          >
            <q-item-label header>{{
              $t("menuItems.exportTransfers")
            }}</q-item-label>
          </q-item>
          <q-item
            clickable
            v-ripple
            :class="{ 'text-grey-6': !is_ready }"
            @click="is_ready && (closeMenu(), sweepAllWarning())"
          >
            <q-item-label header>Sweep All</q-item-label>
          </q-item>
          <q-item
            clickable
            v-ripple
            :class="{ 'text-grey-6': !is_ready }"
            @click="is_ready && (closeMenu(), showModal('rescan'))"
          >
            <q-item-label header>{{
              $t("menuItems.rescanWallet")
            }}</q-item-label>
          </q-item>
          <!-- Refresh RPC Connection hidden in v2.0 — sync fix makes it unnecessary
          <q-item
            v-close-popup
            clickable
            v-ripple
            @click="refreshWalletConnection()"
          >
            <q-item-label header>{{
              $t("menuItems.refreshConnection") || "Refresh RPC Connection"
            }}</q-item-label>
          </q-item>
          -->
          <q-item
            clickable
            v-ripple
            :class="{ 'text-grey-6': !is_ready }"
            @click="is_ready && (closeMenu(), showModal('key_image'))"
          >
            <q-item-label header>{{
              $t("menuItems.manageKeyImages")
            }}</q-item-label>
          </q-item>
          <q-item
            clickable
            v-ripple
            :class="{ 'text-grey-6': !is_ready }"
            @click="is_ready && (closeMenu(), deleteWallet())"
          >
            <q-item-label header>{{
              $t("menuItems.deleteWallet")
            }}</q-item-label>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <!-- Modals -->
    <!-- PRIVATE KEY MODAL -->
    <q-dialog
      v-model="modals.private_keys.visible"
      minimized
      @hide="closePrivateKeys()"
    >
      <div class="modal private-key-modal">
        <div class="modal-header">{{ $t("titles.privateKeys") }}</div>
        <div class="q-ma-md">
          <template v-if="secret.mnemonic">
            <h6 class="q-mb-xs q-mt-lg">
              {{ $t("strings.seedWords") }}
            </h6>
            <div class="row">
              <div class="col">
                {{ secret.mnemonic }}
              </div>
              <div class="col-auto">
                <q-btn
                  class="copy-btn"
                  color="primary"
                  padding="xs"
                  size="sm"
                  icon="file_copy"
                  @click="copyPrivateKey('mnemonic', $event)"
                >
                  <q-tooltip
                    anchor="center left"
                    self="center right"
                    :offset="[5, 10]"
                  >
                    {{ $t("menuItems.copySeedWords") }}
                  </q-tooltip>
                </q-btn>
              </div>
            </div>
          </template>

          <template v-if="secret.view_key != secret.spend_key">
            <h6 class="q-mb-xs">{{ $t("strings.viewKey") }}</h6>
            <div class="row">
              <div class="col" style="word-break:break-all;">
                {{ secret.view_key }}
              </div>
              <div class="col-auto">
                <q-btn
                  class="copy-btn"
                  color="primary"
                  padding="xs"
                  size="sm"
                  icon="file_copy"
                  @click="copyPrivateKey('view_key', $event)"
                >
                  <q-tooltip
                    anchor="center left"
                    self="center right"
                    :offset="[5, 10]"
                  >
                    {{ $t("menuItems.copyViewKey") }}
                  </q-tooltip>
                </q-btn>
              </div>
            </div>
          </template>

          <template v-if="!/^0*$/.test(secret.spend_key)">
            <h6 class="q-mb-xs">{{ $t("strings.spendKey") }}</h6>
            <div class="row">
              <div class="col" style="word-break:break-all;">
                {{ secret.spend_key }}
              </div>
              <div class="col-auto">
                <q-btn
                  class="copy-btn"
                  color="primary"
                  padding="xs"
                  size="sm"
                  icon="file_copy"
                  @click="copyPrivateKey('spend_key', $event)"
                >
                  <q-tooltip
                    anchor="center left"
                    self="center right"
                    :offset="[5, 10]"
                  >
                    {{ $t("menuItems.copySpendKey") }}
                  </q-tooltip>
                </q-btn>
              </div>
            </div>
          </template>

          <div class="q-mt-lg">
            <q-btn
              color="primary"
              :label="$t('buttons.close')"
              @click="hideModal('private_keys')"
            />
          </div>
        </div>
      </div>
    </q-dialog>

    <!-- RESCAN MODAL -->
    <q-dialog v-model="modals.rescan.visible" minimized>
      <div class="modal rescan-modal">
        <div class="a-ma-lg modal-header">{{ $t("titles.rescanWallet") }}</div>
        <div class="q-ma-md">
          <p>{{ $t("strings.rescanModalDescription") }}</p>

          <div class="q-mt-lg">
            <q-radio
              v-model="modals.rescan.type"
              val="full"
              :label="$t('fieldLabels.rescanFullBlockchain')"
            />
          </div>
          <div class="q-mt-sm">
            <q-radio
              v-model="modals.rescan.type"
              val="spent"
              :label="$t('fieldLabels.rescanSpentOutputs')"
            />
          </div>

          <div class="q-mt-xl text-right">
            <q-btn
              flat
              class="q-mr-sm"
              :label="$t('buttons.close')"
              @click="hideModal('rescan')"
            />
            <q-btn
              color="primary"
              :label="$t('buttons.rescan')"
              @click="rescanWallet()"
            />
          </div>
        </div>
      </div>
    </q-dialog>

    <!-- KEY IMAGE MODAL -->
    <q-dialog
      v-model="modals.key_image.visible"
      class="key-image-modal"
      minimized
    >
      <div class="modal key-image-modal">
        <div class="modal-header">
          <!-- Export/Import key images -->
          {{
            $t("dialog.keyImages.title", {
              type: $t(
                `dialog.keyImages.${modals.key_image.type.toLowerCase()}`
              )
            })
          }}
        </div>
        <div class="q-ma-md">
          <div class="row q-mb-md">
            <div class="q-mr-xl">
              <q-radio
                v-model="modals.key_image.type"
                val="Export"
                :label="$t('dialog.keyImages.export')"
              />
            </div>
            <div>
              <q-radio
                v-model="modals.key_image.type"
                val="Import"
                :label="$t('dialog.keyImages.import')"
              />
            </div>
          </div>

          <template v-if="modals.key_image.type == 'Export'">
            <OxenField
              class="q-mt-lg"
              :label="$t('fieldLabels.keyImages.exportDirectory')"
              disable-hover
            >
              <q-input
                v-model="modals.key_image.export_path"
                disable
                borderless
              />
              <input
                id="keyImageExportPath"
                ref="keyImageExportSelect"
                class="image-path"
                type="file"
                webkitdirectory
                directory
                hidden
                @change="setKeyImageExportPath"
              />
              <q-btn color="primary" @click="selectKeyImageExportPath">{{
                $t("buttons.browse")
              }}</q-btn>
            </OxenField>
          </template>
          <template v-if="modals.key_image.type == 'Import'">
            <OxenField
              class="q-mt-lg"
              :label="$t('fieldLabels.keyImages.importFile')"
              disable-hover
            >
              <q-input
                v-model="modals.key_image.import_path"
                disable
                borderless
              />
              <input
                id="keyImageImportPath"
                ref="keyImageImportSelect"
                type="file"
                class="image-path"
                hidden
                @change="setKeyImageImportPath"
              />
              <q-btn color="primary" @click="selectKeyImageImportPath">{{
                $t("buttons.browse")
              }}</q-btn>
            </OxenField>
          </template>

          <div class="q-mt-lg text-right">
            <q-btn
              flat
              class="q-mr-sm"
              :label="$t('buttons.close')"
              @click="hideModal('key_image')"
            />
            <q-btn
              color="primary"
              :label="$t('buttons.' + modals.key_image.type.toLowerCase())"
              @click="doKeyImages()"
            />
          </div>
        </div>
      </div>
    </q-dialog>

    <!-- CHANGE PASSWORD MODAL -->
    <q-dialog
      v-model="modals.change_password.visible"
      minimized
      @hide="clearChangePassword()"
    >
      <div class="modal password-modal">
        <div class="modal-header">{{ $t("titles.changePassword") }}</div>
        <div class="q-ma-md">
          <q-input
            v-model="modals.change_password.old_password"
            type="password"
            :label="$t('fieldLabels.oldPassword')"
          />
          <q-input
            v-model="modals.change_password.new_password"
            type="password"
            :label="$t('fieldLabels.newPassword')"
          />

          <q-input
            v-model="modals.change_password.new_password_confirm"
            type="password"
            :label="$t('fieldLabels.confirmNewPassword')"
          />

          <div class="q-mt-xl text-right">
            <q-btn
              flat
              class="q-mr-sm"
              :label="$t('buttons.close')"
              @click="hideModal('change_password')"
            />
            <q-btn
              color="primary"
              :label="$t('buttons.change')"
              @click="doChangePassword()"
            />
          </div>
        </div>
      </div>
    </q-dialog>
    <!-- EXPORT TRANSFERS MODAL -->
    <q-dialog
      v-model="modals.export_transfers.visible"
      class="export-transfers-modal"
      minimized
    >
      <div class="modal export-transfers-modal">
        <div class="modal-header">
          <!-- Export Transfers as CSV -->
          {{ $t("dialog.exportTransfers.title") }}
        </div>
        <div class="q-ma-md">
          <template>
            <OxenField
              class="q-mt-lg"
              :label="$t('fieldLabels.exportTransfers.exportDirectory')"
              disable-hover
            >
              <q-input
                v-model="modals.export_transfers.export_path"
                disable
                borderless
              />
              <input
                id="exportTransfersExportPath"
                ref="exportTransfersExportSelect"
                class="export-transfers-path"
                type="file"
                webkitdirectory
                directory
                hidden
                @change="setExportTransfersExportPath"
              />
              <q-btn color="primary" @click="selectExportTransfersExportPath">{{
                $t("buttons.browse")
              }}</q-btn>
            </OxenField>
          </template>

          <div class="q-mt-lg text-right">
            <q-btn
              flat
              class="q-mr-sm"
              :label="$t('buttons.close')"
              @click="hideModal('export_transfers')"
            />
            <q-btn
              color="primary"
              :label="$t('buttons.export')"
              @click="doExportTransfers()"
            />
          </div>
        </div>
      </div>
    </q-dialog>

    <!-- SWEEP ALL confirm dialog -->
    <ConfirmTransactionDialog
      :show="confirmSweepAll"
      :amount="confirmFields.totalAmount"
      :is-blink="confirmFields.isBlink"
      :send-to="confirmFields.destination"
      :fee="confirmFields.totalFees"
      :on-confirm-transaction="onConfirmSweep"
      :on-cancel-transaction="onCancelSweep"
    />
    <q-inner-loading :showing="sweep_all_status.sending">
      <q-spinner color="primary" size="30" />
    </q-inner-loading>
  </div>
</template>

<script>
import objectAssignDeep from "object-assign-deep";
import { mapState } from "vuex";
import WalletPassword from "src/mixins/wallet_password";
import ConfirmDialogMixin from "src/mixins/confirm_dialog_mixin";
import OxenField from "components/oxen_field";
import ConfirmTransactionDialog from "components/confirm_tx_dialog";

// Match the sentinel used by send.vue for the sweep-all status watcher:
// neutral "did something but don't take watcher action" code, so an
// in-progress relay or post-success reset doesn't re-trigger the dialog.
const DO_NOTHING = 10;

export default {
  name: "WalletSettings",
  components: {
    OxenField,
    ConfirmTransactionDialog
  },
  mixins: [WalletPassword, ConfirmDialogMixin],
  data() {
    return {
      modals: {
        private_keys: {
          visible: false
        },
        rescan: {
          visible: false,
          type: "full"
        },
        key_image: {
          visible: false,
          type: "Export",
          export_path: "",
          import_path: ""
        },
        export_transfers: {
          visible: false,
          export_path: ""
        },
        change_password: {
          visible: false,
          old_password: "",
          new_password: "",
          new_password_confirm: ""
        }
      },
      confirmFields: {
        isBlink: false,
        totalAmount: -1,
        destination: "",
        totalFees: 0
      }
    };
  },
  computed: mapState({
    theme: state => state.gateway.app.config.appearance.theme,
    info: state => state.gateway.wallet.info,
    secret: state => state.gateway.wallet.secret,
    wallet_data_dir: state => state.gateway.app.config.app.wallet_data_dir,
    daemon_connected: state => state.gateway.app.daemon_connected,
    daemon_connecting: state => state.gateway.app.daemon_connecting,
    isTestnet: state => state.gateway.app.config.app.net_type === "testnet",
    config: state => state.gateway.app.pending_config,
    sweep_all_status: state => state.gateway.sweep_all_status,
    confirmSweepAll: state => state.gateway.sweep_all_status.code === 1,
    is_ready() {
      return this.$store.getters["gateway/isReady"];
    },
    locale() {
      return this.$q.lang.getLocale();
    }
  }),
  watch: {
    // Sweep All status machine:
    //   code 10 (DO_NOTHING) — in-flight, ignored
    //   code 1 — backend has built the sweep TX; show confirm dialog
    //   code 0 — relay succeeded
    //   code -1 — failed
    "sweep_all_status.code"(code, oldCode) {
      if (code === oldCode) return;
      switch (code) {
        case DO_NOTHING:
          break;
        case 1:
          this.confirmFields = this.buildDialogFields(this.sweep_all_status);
          break;
        case 0:
          this.$q.notify({
            type: "positive",
            timeout: 1500,
            message: this.sweep_all_status.message || "Sweep complete"
          });
          break;
        case -1:
          this.$q.notify({
            type: "negative",
            timeout: 3000,
            message: this.sweep_all_status.message || "Sweep failed"
          });
          break;
      }
    },
    secret: {
      handler(val, old) {
        if (val.view_key == old.view_key) return;
        switch (this.secret.view_key) {
          case "":
            break;
          case -1:
            this.$q.notify({
              type: "negative",
              timeout: 1000,
              message: this.$t(this.secret.mnemonic)
            });
            this.$store.commit("gateway/set_wallet_data", {
              secret: {
                mnemonic: "",
                spend_key: "",
                view_key: ""
              }
            });
            break;
          default:
            this.showModal("private_keys");
            break;
        }
      },
      deep: true
    }
  },
  created() {
    const path = { join: (...parts) => parts.join("/").replace(/[/\\]+/g, "/") };
    this.modals.key_image.export_path = path.join(
      this.wallet_data_dir,
      "images",
      this.info.name
    );
    this.modals.key_image.import_path = path.join(
      this.wallet_data_dir,
      "images",
      this.info.name,
      "key_image_export"
    );
    this.modals.export_transfers.export_path = path.join(
      this.wallet_data_dir,
      "CSV",
      this.info.name
    );
  },
  methods: {
    toggleDaemonConnection() {
      if (this.daemon_connected) {
        this.$gateway.send("core", "disconnect_daemon");
      } else {
        // Save config first, then connect
        if (this.config && this.config.app && this.config.daemons) {
          this.$gateway.send("core", "quick_save_config", {
            app: this.config.app,
            daemons: this.config.daemons,
            wallet: this.config.wallet
          });
        }
        this.$gateway.send("core", "connect_daemon");
      }
    },
    closeMenu() {
      this.$refs.settingsMenu && this.$refs.settingsMenu.hide();
    },
    openNetworkSettings() {
      // Request the main settings modal to open via store
      this.$store.commit("gateway/set_app_data", {
        open_settings_requested: true
      });
    },
    showModal(which) {
      if (!this.is_ready) return;
      this.modals[which].visible = true;
    },
    hideModal(which) {
      this.modals[which].visible = false;
    },
    copyPrivateKey(type, event) {
      event.stopPropagation();
      const path = event.composedPath ? event.composedPath() : event.path || [];
      for (let i = 0; i < path.length; i++) {
        if (path[i].tagName == "BUTTON") {
          path[i].blur();
          break;
        }
      }

      if (this.secret[type] == null) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.copyingPrivateKeys")
        });
        return;
      }

      window.electronAPI.copyToClipboard(this.secret[type]);

      let type_key = "seedWords";
      if (type === "spend_key") {
        type_key = "spendKey";
      } else if (type === "view_key") {
        type_key = "viewKey";
      }
      const type_title = this.$t("dialog.copyPrivateKeys." + type_key);

      this.$q
        .dialog({
          title: this.$t("dialog.copyPrivateKeys.title", {
            type: type_title
          }),
          message: this.$t("dialog.copyPrivateKeys.message"),
          ok: {
            label: this.$t("dialog.buttons.ok"),
            color: "primary"
          }
        })
        .onDismiss(() => null)
        .onCancel(() => null)
        .onOk(() => {
          this.$q.notify({
            type: "positive",
            timeout: 1000,
            message: this.$t("notification.positive.copied", {
              item: this.$t("strings." + type_key)
            })
          });
        });
    },
    async getPrivateKeys() {
      if (!this.is_ready) return;
      let passwordDialog = await this.showPasswordConfirmation({
        title: this.$t("dialog.showPrivateKeys.title"),
        noPasswordMessage: this.$t("dialog.showPrivateKeys.message"),
        ok: {
          label: this.$t("dialog.showPrivateKeys.ok"),
          color: "primary"
        },
        cancel: {
          color: "tertiary",
          flat: true
        },
        color: "white"
      });
      passwordDialog
        .onOk(password => {
          // if no password set
          password = password || "";
          this.$gateway.send("wallet", "get_private_keys", {
            password
          });
        })
        .onDismiss(() => {})
        .onCancel(() => {});
    },
    closePrivateKeys() {
      this.hideModal("private_keys");
      setTimeout(() => {
        this.$store.commit("gateway/set_wallet_data", {
          secret: {
            mnemonic: "",
            spend_key: "",
            view_key: ""
          }
        });
      }, 500);
    },
    rescanWallet() {
      this.hideModal("rescan");
      if (this.modals.rescan.type == "full") {
        this.$q
          .dialog({
            title: this.$t("dialog.rescan.title"),
            message: this.$t("dialog.rescan.message"),
            ok: {
              label: this.$t("dialog.rescan.ok"),
              color: "primary"
            },
            cancel: {
              flat: true,
              label: this.$t("dialog.buttons.cancel")
            }
          })
          .onOk(() => {
            this.$gateway.send("wallet", "rescan_blockchain");
          })
          .onDismiss(() => {})
          .onCancel(() => {});
      } else {
        this.$gateway.send("wallet", "rescan_spent");
      }
    },
    refreshWalletConnection() {
      this.$q.notify({
        type: "info",
        timeout: 2000,
        message: "Refreshing wallet connection..."
      });
      this.$gateway.send("wallet", "refresh_wallet");
    },
    selectKeyImageExportPath() {
      this.$refs.keyImageExportSelect.click();
    },
    setKeyImageExportPath(file) {
      this.modals.key_image.export_path = file.target.files[0].path;
    },
    selectKeyImageImportPath() {
      this.$refs.keyImageImportSelect.click();
    },
    setKeyImageImportPath(file) {
      this.modals.key_image.import_path = file.target.files[0].path;
    },
    selectExportTransfersExportPath() {
      this.$refs.exportTransfersExportSelect.click();
    },
    setExportTransfersExportPath(file) {
      this.modals.export_transfers.export_path = file.target.files[0].path;
    },
    async doKeyImages() {
      this.hideModal("key_image");

      const type = this.$t(
        `dialog.keyImages.${this.modals.key_image.type.toLowerCase()}`
      );

      let passwordDialog = await this.showPasswordConfirmation({
        title: this.$t("dialog.keyImages.title", { type }),
        noPasswordMessage: this.$t("dialog.keyImages.message", {
          type: type.toLocaleLowerCase(this.locale)
        }),
        ok: {
          label: type.toLocaleUpperCase(this.locale),
          color: "primary"
        },
        color: this.theme == "dark" ? "dark" : "white",
        cancel: {
          color: "tertiary",
          flat: true
        }
      });
      passwordDialog
        .onOk(password => {
          // if no password set
          password = password || "";
          if (this.modals.key_image.type == "Export")
            this.$gateway.send("wallet", "export_key_images", {
              password: password,
              path: this.modals.key_image.export_path
            });
          else if (this.modals.key_image.type == "Import")
            this.$gateway.send("wallet", "import_key_images", {
              password: password,
              path: this.modals.key_image.import_path
            });
        })
        .onCancel(() => {})
        .onDismiss(() => {});
    },
    doChangePassword() {
      let old_password = this.modals.change_password.old_password;
      let new_password = this.modals.change_password.new_password;
      let new_password_confirm = this.modals.change_password
        .new_password_confirm;

      if (new_password == old_password) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.newPasswordSame")
        });
      } else if (new_password != new_password_confirm) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.newPasswordNoMatch")
        });
      } else {
        this.hideModal("change_password");
        this.$gateway.send("wallet", "change_wallet_password", {
          old_password,
          new_password
        });
      }
    },
    clearChangePassword() {
      this.modals.change_password.old_password = "";
      this.modals.change_password.new_password = "";
      this.modals.change_password.new_password_confirm = "";
    },
    async doExportTransfers() {
      this.hideModal("export_transfers");

      let passwordDialog = await this.showPasswordConfirmation({
        title: this.$t("dialog.exportTransfers.title"),
        noPasswordMessage: this.$t("dialog.exportTransfers.message"),
        ok: {
          label: "export".toLocaleUpperCase(this.locale),
          color: "primary"
        },
        color: this.theme == "dark" ? "dark" : "white",
        cancel: {
          color: "tertiary",
          flat: true
        }
      });
      passwordDialog
        .onOk(password => {
          // if no password set
          password = password || "";
          this.$gateway.send("wallet", "export_transfers", {
            password: password,
            path: this.modals.export_transfers.export_path
          });
        })
        .onCancel(() => {})
        .onDismiss(() => {});
    },
    deleteWallet() {
      if (!this.is_ready) return;
      this.$q
        .dialog({
          title: this.$t("dialog.deleteWallet.title"),
          message: this.$t("dialog.deleteWallet.message"),
          ok: {
            label: this.$t("dialog.deleteWallet.ok"),
            color: "red"
          },
          cancel: {
            flat: true,
            label: this.$t("dialog.buttons.cancel"),
            color: this.theme == "dark" ? "white" : "dark"
          },
          color: "#1F1C47"
        })
        .onOk(async () => {
          const hasPassword = await this.hasPassword();
          if (hasPassword) {
            this.$q
              .dialog({
                title: this.$t("dialog.deleteWallet.title"),
                message: this.$t("dialog.password.message"),
                prompt: {
                  model: "",
                  type: "password"
                },
                ok: {
                  label: this.$t("dialog.deleteWallet.ok"),
                  color: "negative"
                },
                cancel: {
                  flat: true,
                  label: this.$t("dialog.buttons.cancel"),
                  color: this.theme == "dark" ? "white" : "dark"
                },
                dark: this.theme == "dark",
                color: this.theme == "dark" ? "white" : "dark"
              })
              .onOk(password => {
                password = password || "";
                this.$gateway.send("wallet", "delete_wallet", { password });
              })
              .onDismiss(() => {})
              .onCancel(() => {});
          } else {
            // no password
            let password = "";
            // if there's no password (password is empty string)
            this.$gateway.send("wallet", "delete_wallet", { password });
          }
        })
        .onCancel(() => {})
        .onDismiss(() => {});
    },

    // ── Sweep All ─────────────────────────────────────────────────────────
    // Consolidates every unlocked output in the wallet into a single output
    // sent back to the user's primary address. Useful before staking when
    // the wallet has many small reward-payout outputs. Used to live on the
    // Service Nodes / Staking tab; moved here so users find it under the
    // standard wallet-maintenance actions.
    sweepAllWarning() {
      if (!this.is_ready) return;
      this.$q
        .dialog({
          title: this.$t("dialog.sweepAllWarning.title"),
          message: this.$t("dialog.sweepAllWarning.message"),
          ok: {
            label: this.$t("dialog.sweepAllWarning.ok"),
            color: "primary"
          },
          cancel: {
            flat: true,
            label: this.$t("dialog.buttons.cancel"),
            color: "negative"
          }
        })
        .onOk(() => this.sweepAll())
        .onDismiss(() => {})
        .onCancel(() => {});
    },
    async sweepAll() {
      const { unlocked_balance, address } = this.info;
      // 1 XEQM = 1e9 atomic. Backend re-multiplies and compares to
      // wallet_state.unlocked_balance to confirm sweep semantics.
      const tx = {
        amount: unlocked_balance / 1e9,
        address,
        priority: 0
      };

      const passwordDialog = await this.showPasswordConfirmation({
        title: this.$t("dialog.sweepAll.title"),
        noPasswordMessage: this.$t("dialog.sweepAll.message"),
        ok: {
          label: this.$t("dialog.sweepAll.ok"),
          color: "primary"
        }
      });
      passwordDialog
        .onOk(password => {
          password = password || "";
          this.$store.commit("gateway/set_sweep_all_status", {
            code: DO_NOTHING,
            message: "Sweeping all",
            sending: true
          });
          const payload = objectAssignDeep.noMutate(tx, {
            password,
            isSweepAll: true
          });
          this.$gateway.send("wallet", "transfer", payload);
        })
        .onDismiss(() => {})
        .onCancel(() => {});
    },
    onConfirmSweep() {
      this.$store.commit("gateway/set_sweep_all_status", {
        code: DO_NOTHING,
        message: "Relaying sweep transaction",
        sending: true
      });
      this.$gateway.send("wallet", "relay_tx", {
        isBlink: this.confirmFields.isBlink,
        isSweepAll: true
      });
    },
    onCancelSweep() {
      this.$store.commit("gateway/set_sweep_all_status", {
        code: DO_NOTHING,
        message: "Sweep cancelled",
        sending: false
      });
    }
  }
};
</script>

<style lang="scss">
.password-modal {
  min-width: 400px;
  background: #0c1218;
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;

  > * {
    color: rgba(255, 255, 255, 0.92);
  }

  .q-input {
    color: rgba(255, 255, 255, 0.92);
  }

  .q-field__label {
    color: rgba(255, 255, 255, 0.6);
  }

  .q-field--focused .q-field__label {
    color: #00d4ff;
  }

  .q-field__native {
    color: rgba(255, 255, 255, 0.92) !important;
  }

  .q-field__bottom,
  .q-field__control::before {
    border-color: rgba(255, 255, 255, 0.3);
  }

  .q-field--focused .q-field__control::after {
    border-color: #00d4ff;
  }
}

.rescan-modal {
  background: #0c1218;
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;

  p {
    color: rgba(255, 255, 255, 0.6);
  }
}

.image-path {
  opacity: 0;
  overflow: hidden;
}

.key-image-modal {
  color: rgba(255, 255, 255, 0.92);
  background: #0c1218;
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;

  label * {
    color: rgba(255, 255, 255, 0.6) !important;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  input {
    overflow: ellipsis;
    color: rgba(255, 255, 255, 0.92);
  }
}

.export-transfers-modal {
  color: rgba(255, 255, 255, 0.92);
  background: #0c1218;
  min-width: 500px;
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;

  label * {
    color: rgba(255, 255, 255, 0.6) !important;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  input {
    overflow: ellipsis;
    color: rgba(255, 255, 255, 0.92);
  }
}

.export-transfers-path {
  opacity: 0;
  overflow: hidden;
}

.private-key-modal {
  background: #0c1218;
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 12px;

  .copy-btn {
    margin-left: 8px;
  }

  h6 {
    color: rgba(255, 255, 255, 0.6);
  }
}

.key-image-modal {
  min-width: 400px;
  width: 45vw;

  .oxen-field {
    flex: 1;
  }
}

.wallet-settings {
  display: flex;
  align-items: center;

  .daemon-toggle-btn {
    font-weight: 500;
    min-width: 130px;
    padding-left: 12px;
    padding-right: 16px;

    &.disconnect-btn {
      background-color: #00d4ff !important;
      color: #000000 !important;
    }
  }
}
</style>
