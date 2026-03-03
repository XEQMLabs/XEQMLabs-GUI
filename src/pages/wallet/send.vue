<template>
  <q-page class="send">
    <template v-if="view_only">
      <div class="q-pa-md">
        {{ $t("strings.viewOnlyMode") }}
      </div>
    </template>
    <template v-else>
      <div class="q-pa-md">
        <div class="row gutter-md">
          <!-- Amount -->
          <div class="col-12 amount">
            <OxenField
              :label="$t('fieldLabels.amount')"
              :error="v$.newTx.amount.$error"
            >
              <q-input
                v-model="newTx.amount"
                type="number"
                min="0"
                :max="unlocked_balance / atomicDivisor"
                placeholder="0"
                borderless
                dense
                @blur="v$.newTx.amount.$touch"
              />
              <q-btn
                color="primary"
                @click="newTx.amount = unlocked_balance / atomicDivisor"
              >
                {{ $t("buttons.all") }}
              </q-btn>
            </OxenField>
          </div>

          <!-- Priority hidden - only slow/safe tx type available on current mainnet -->
          <div class="col-6 priority" style="display: none;">
            <OxenField :label="$t('fieldLabels.priority')">
              <q-select
                v-model="newTx.priority"
                emit-value
                map-options
                :options="priorityOptions"
                borderless
                dense
              />
            </OxenField>
          </div>
        </div>

        <!-- Address -->
        <div class="col q-mt-sm">
          <OxenField
            :label="$t('fieldLabels.address')"
            :error="v$.newTx.address.$error"
          >
            <q-input
              v-model.trim="newTx.address"
              :placeholder="address_placeholder"
              borderless
              dense
              @blur="v$.newTx.address.$touch"
            />
            <q-btn color="primary" to="addressbook">
              {{ $t("buttons.contacts") }}
            </q-btn>
          </OxenField>
        </div>

        <!-- Notes -->
        <div class="col q-mt-sm">
          <OxenField :label="$t('fieldLabels.notes')" optional>
            <q-input
              v-model="newTx.note"
              class="full-width text-area-oxen"
              type="textarea"
              :placeholder="$t('placeholders.transactionNotes')"
              borderless
              dense
            />
          </OxenField>
        </div>

        <q-checkbox
          v-model="newTx.address_book.save"
          :label="$t('strings.saveToAddressBook')"
        />
        <div v-if="newTx.address_book.save">
          <OxenField :label="$t('fieldLabels.name')" optional>
            <q-input
              v-model="newTx.address_book.name"
              :placeholder="$t('placeholders.addressBookName')"
              borderless
              dense
            />
          </OxenField>
          <OxenField class="q-mt-sm" :label="$t('fieldLabels.notes')" optional>
            <q-input
              v-model="newTx.address_book.description"
              type="textarea"
              class="full-width text-area-oxen"
              rows="2"
              :placeholder="$t('placeholders.additionalNotes')"
              borderless
              dense
            />
          </OxenField>
        </div>
        <!-- div required so the button falls below the checkbox -->
        <div>
          <q-btn
            class="send-btn"
            :disable="!is_able_to_send"
            color="primary"
            :label="$t('buttons.send')"
            @click="send()"
          />
        </div>
      </div>
      <ConfirmTransactionDialog
        :show="confirmTransaction"
        :amount="confirmFields.totalAmount"
        :is-blink="confirmFields.isBlink"
        :send-to="confirmFields.destination"
        :fee="confirmFields.totalFees"
        :on-confirm-transaction="onConfirmTransaction"
        :on-cancel-transaction="onCancelTransaction"
      />
      <q-inner-loading :showing="tx_status.sending">
        <q-spinner color="primary" size="30" />
      </q-inner-loading>
    </template>
  </q-page>
</template>

<script>
import { mapState } from "vuex";
import { useVuelidate } from "@vuelidate/core";
import { required, decimal } from "@vuelidate/validators";
import { address, greater_than_zero } from "src/validators/common";
import OxenField from "components/oxen_field";
import WalletPassword from "src/mixins/wallet_password";
import ConfirmDialogMixin from "src/mixins/confirm_dialog_mixin";
import ConfirmTransactionDialog from "components/confirm_tx_dialog";
import objectAssignDeep from "object-assign-deep";

// the case for doing nothing on a tx_status update
const DO_NOTHING = 10;

export default {
  setup() { return { v$: useVuelidate() }; },
  components: {
    OxenField,
    ConfirmTransactionDialog
  },
  mixins: [WalletPassword, ConfirmDialogMixin],
  data() {
    let priorityOptions = [
      { label: this.$t("strings.priorityOptions.blink"), value: 5 }, // Blink
      { label: this.$t("strings.priorityOptions.slow"), value: 1 } // Slow
    ];
    return {
      newTx: {
        amount: 0,
        address: "",
        priority: 1,
        address_book: {
          save: false,
          name: "",
          description: ""
        }
      },
      priorityOptions: priorityOptions,
      confirmFields: {
        isBlink: false,
        totalAmount: -1,
        destination: "",
        totalFees: 0
      }
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      view_only: state => state.gateway.wallet.info.view_only,
      unlocked_balance: state => state.gateway.wallet.info.unlocked_balance,
      tx_status: state => state.gateway.tx_status,
      netType: state => state.gateway.app.config.app?.net_type || "mainnet",
      is_ready() {
        return this.$store.getters["gateway/isReady"];
      },
      is_able_to_send() {
        return this.$store.getters["gateway/isAbleToSend"];
      },
      address_placeholder(state) {
        const wallet = state.gateway.wallet.info;
        const prefix = (wallet && wallet.address && wallet.address[0]) || "L";
        return `${prefix}..`;
      },
      confirmTransaction: state => state.gateway.tx_status.code === 1
    }),
    // Legacy network uses 1e4 (4 decimal places), new mainnet/testnet use 1e9
    atomicDivisor() {
      return this.netType === "legacy" ? 1e4 : 1e9;
    },
    txStatusCode() {
      return this.tx_status ? this.tx_status.code : DO_NOTHING;
    }
  },
  validations: {
    newTx: {
      amount: {
        required,
        decimal,
        greater_than_zero
      },
      address: {
        required,
        isAddress(value) {
          if (value === "") return true;

          return new Promise(resolve => {
            address(value, this.$gateway)
              .then(() => resolve(true))
              .catch(() => resolve(false));
          });
        }
      }
    }
  },
  watch: {
    txStatusCode(code, oldCode) {
      if (code === oldCode) return;
      switch (code) {
        // the "nothing", so we can update state without doing anything
        // in particular
        case DO_NOTHING:
          break;
        case 1:
          this.buildDialogFieldsSend(this.tx_status);
          break;
        case 0:
          // Show TXID if available
          if (this.tx_status.txid) {
            const sentTxid = this.tx_status.txid;
            const message = this.tx_status.message || "";
            this.$q
              .dialog({
                title:
                  this.$t("titles.transactionSent") || "Transaction Sent",
                message: `
                <div style="text-align: center; margin-bottom: 16px;">
                  <div style="font-size: 14px; color: #00ff88; margin-bottom: 12px;">
                    ✓ ${message}
                  </div>
                  <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Transaction ID
                  </div>
                  <div id="txid-display" style="
                    background: #0a0e14;
                    border: 1px solid rgba(0, 212, 255, 0.2);
                    border-radius: 8px;
                    padding: 12px;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 13px;
                    word-break: break-all;
                    user-select: all;
                    color: rgba(255,255,255,0.92);
                  ">${sentTxid}</div>
                  <div style="
                    margin-top: 14px;
                    padding: 10px;
                    background: rgba(255, 170, 0, 0.08);
                    border: 1px solid rgba(255, 170, 0, 0.25);
                    border-radius: 6px;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.7);
                    line-height: 1.5;
                  ">
                    <strong style="color: #ffaa00;">IMPORTANT:</strong> Save your Transaction ID above. You will need it to generate a proof for the swap portal.<br><br>
                    Your remaining balance will be temporarily locked while the transaction confirms. Funds typically unlock after <span style="color: #ffaa00; font-weight: 600;">~10 blocks (~20 minutes)</span>.
                  </div>
                </div>
              `,
                html: true,
                ok: {
                  label: "COPY TXID & CLOSE",
                  color: "primary"
                }
              })
              .onOk(() => {
                window.electronAPI.copyToClipboard(sentTxid);
                this.$q.notify({
                  type: "positive",
                  timeout: 2000,
                  message: "Transaction ID copied to clipboard"
                });
              });
          } else {
            this.$q.notify({
              type: "positive",
              timeout: 1000,
              message: this.tx_status.message || ""
            });
          }
          this.v$.$reset();
          this.newTx = {
            amount: 0,
            address: "",
            priority: 1,
            address_book: {
              save: false,
              name: "",
              description: ""
            },
            note: ""
          };
          break;
        case -1:
          this.$q.notify({
            type: "negative",
            timeout: 3000,
            message: this.tx_status.message || ""
          });
          break;
      }
    },
    $route(to) {
      if (to.path == "/wallet/send" && to.query.hasOwnProperty("address")) {
        this.autoFill(to.query);
      }
    }
  },
  mounted() {
    if (
      this.$route.path == "/wallet/send" &&
      this.$route.query.hasOwnProperty("address")
    ) {
      this.autoFill(this.$route.query);
    }
  },
  methods: {
    autoFill: function(info) {
      this.newTx.address = info.address;
    },
    buildDialogFieldsSend(txData) {
      // build using mixin method
      this.confirmFields = this.buildDialogFields(txData);
    },
    onConfirmTransaction() {
      // put the loading spinner up
      this.$store.commit("gateway/set_tx_status", {
        code: DO_NOTHING,
        message: "Getting transaction information",
        sending: true
      });
      const { name, description, save } = this.newTx.address_book;
      const addressSave = {
        address: this.newTx.address,
        address_book: {
          description,
          name,
          save
        }
      };

      const note = this.newTx.note;
      const isBlink = this.confirmFields.isBlink;

      const relayTxData = {
        isBlink,
        addressSave,
        note,
        // you may be sending all (which calls sweep_all RPC), but this refers to
        // if the relay is coming from "sweep all" on the SN tab
        isSweepAll: false
      };

      // Commit the transaction
      this.$gateway.send("wallet", "relay_tx", relayTxData);
    },
    onCancelTransaction() {
      this.$store.commit("gateway/set_tx_status", {
        code: DO_NOTHING,
        message: "Cancel the transaction from confirm dialog",
        sending: false
      });
    },

    async send() {
      this.v$.newTx.$touch();

      if (this.newTx.amount < 0) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.negativeAmount")
        });
        return;
      } else if (this.newTx.amount == 0) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.zeroAmount")
        });
        return;
      } else if (this.newTx.amount > this.unlocked_balance / this.atomicDivisor) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.notEnoughBalance")
        });
        return;
      } else if (this.v$.newTx.amount.$error) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.invalidAmount")
        });
        return;
      }

      if (this.v$.newTx.address.$error) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.invalidAddress")
        });
        return;
      }

      // must wait for the dialog to be returned
      let passwordDialog = await this.showPasswordConfirmation({
        title: this.$t("dialog.transfer.title"),
        noPasswordMessage: this.$t("dialog.transfer.message"),
        ok: {
          label: this.$t("dialog.transfer.ok"),
          color: "primary"
        }
      });
      passwordDialog
        .onOk(password => {
          password = password || "";
          this.$store.commit("gateway/set_tx_status", {
            code: DO_NOTHING,
            message: "Getting transaction information",
            sending: true
          });
          const newTx = objectAssignDeep.noMutate(this.newTx, {
            password
          });

          this.$gateway.send("wallet", "transfer", newTx);
        })
        .onDismiss(() => {})
        .onCancel(() => {});
    }
  }
};
</script>

<style lang="scss">
.send {
  .send-btn {
    margin-top: 6px;
    width: 200px;
  }
}

.amount {
  padding-right: 10px;
}

.priority {
  padding-left: 10px;
}
</style>
