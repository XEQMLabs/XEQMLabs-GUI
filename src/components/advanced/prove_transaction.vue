<template>
  <div class="prove-transaction">
    <div class="q-pa-md">
      <div class="q-mb-lg tab-desc">
        {{ $t("strings.proveTransactionDescription") }}
      </div>
      <div>
        <OxenField
          :label="$t('fieldLabels.transactionId')"
          :error="v$.txid.$error"
        >
          <q-input
            v-model.trim="txid"
            :dark="theme == 'dark'"
            :placeholder="$t('placeholders.pasteTransactionId')"
            borderless
            dense
            @blur="v$.txid.$touch"
          />
        </OxenField>
        <OxenField
          class="q-mt-md"
          label="RECEIVING ADDRESS"
          :error="v$.address.$error"
        >
          <q-input
            v-model.trim="address"
            :dark="theme == 'dark'"
            :placeholder="$t('placeholders.recipientWalletAddress')"
            borderless
            dense
            @blur="v$.address.$touch"
          />
        </OxenField>
        <OxenField class="q-mt-md" :label="$t('fieldLabels.message')" optional>
          <q-input
            v-model.trim="message"
            :dark="theme == 'dark'"
            :placeholder="$t('placeholders.proveOptionalMessage')"
            borderless
            dense
          />
        </OxenField>
        <div class="buttons submit-button">
          <q-btn
            color="primary"
            :label="$t('buttons.generate')"
            :loading="status.code === 1"
            :disable="status.code === 1"
            @click="generate"
          />
          <q-btn
            v-if="canClear"
            color="accent"
            :label="$t('buttons.clear')"
            @click="clear"
          />
          <q-btn
            v-if="status.state.signature"
            color="secondary"
            :label="$t('buttons.copySignature')"
            @click="copy"
          />
        </div>
      </div>
      <div v-if="status.state.signature" class="signature-wrapper">
        <div class="txid q-mb-sm">
          <div class="title">{{ $t("strings.transactionID") }}</div>
          <div>{{ status.state.txid }}</div>
        </div>
        <div
          class="title q-mt-md"
          style="font-weight: 600; color: rgba(255,255,255,0.7);"
        >
          Transaction Proof
        </div>
        <p class="signature">
          {{ status.state.signature }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";
import { address } from "src/validators/common";
import OxenField from "components/oxen_field";

export default {
  setup() { return { v$: useVuelidate() }; },
  name: "ProveTransaction",
  components: {
    OxenField
  },
  data() {
    return {
      txid: "",
      address: "",
      message: "",
      txidCheckTimer: null,
      confirmationPollTimer: null
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      status: state => state.gateway.prove_transaction_status,
      confirmationStatus: state => state.gateway.tx_confirmation_status,
      canClear() {
        return this.txid !== "" || this.address !== "" || this.message !== "";
      }
    }),
    canGenerate() {
      const s = this.confirmationStatus;
      if (this.txid.trim().length < 64) return true; // No TXID entered yet — don't block
      // Only allow generate when we have explicitly confirmed 50+ — block everything else
      return s.code === 2 && s.confirmations >= 50;
    },
    proveTxStatusCode() {
      return this.status ? this.status.code : 0;
    }
  },
  watch: {
    "$route.query": {
      handler() {
        this.resetAndApplyQuery();
      },
      deep: true
    },
    txid(val) {
      this.stopConfirmationPoll();
      clearTimeout(this.txidCheckTimer);
      this.$store.commit("gateway/set_tx_confirmation_status", { code: 0, confirmations: null, message: "" });
      if (val.trim().length < 64) return;
      this.txidCheckTimer = setTimeout(() => {
        this.checkConfirmations();
        this.startConfirmationPoll();
      }, 600);
    },
    proveTxStatusCode(code, oldCode) {
      if (code === oldCode) return;
      switch (code) {
        case -1:
          this.$q.notify({
            type: "negative",
            timeout: 3000,
            message: this.status.message || ""
          });
          break;
      }
    }
  },
  mounted() {
    this.resetAndApplyQuery();
  },
  activated() {
    this.resetAndApplyQuery();
  },
  beforeUnmount() {
    this.stopConfirmationPoll();
    clearTimeout(this.txidCheckTimer);
  },
  validations: {
    txid: { required },
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
  },
  methods: {
    checkConfirmations() {
      this.$gateway.send("wallet", "get_tx_confirmations", { txid: this.txid.trim() });
    },
    startConfirmationPoll() {
      this.stopConfirmationPoll();
      this.confirmationPollTimer = setInterval(() => {
        if (this.txid.trim().length < 64) return this.stopConfirmationPoll();
        const s = this.confirmationStatus;
        // Stop polling once we have 50+ confirmations or got an error
        if (s.code === -1 || (s.code === 2 && s.confirmations >= 50)) return this.stopConfirmationPoll();
        this.checkConfirmations();
      }, 10000);
    },
    stopConfirmationPoll() {
      clearInterval(this.confirmationPollTimer);
      this.confirmationPollTimer = null;
    },
    resetAndApplyQuery() {
      this.stopConfirmationPoll();
      clearTimeout(this.txidCheckTimer);
      this.txid = "";
      this.address = "";
      this.message = "";
      this.v$.$reset();
      this.$store.commit("gateway/set_tx_confirmation_status", { code: 0, confirmations: null, message: "" });
      this.$store.commit("gateway/set_prove_transaction_status", {
        code: 0,
        message: "",
        i18n: "",
        state: {}
      });
      const query = this.$route.query;
      if (query && query.txid) {
        this.txid = query.txid;
      }
    },
    generate() {
      this.v$.txid.$touch();
      this.v$.address.$touch();

      if (this.v$.txid.$error) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.enterTransactionId")
        });
        return;
      }

      if (this.v$.address.$error) {
        const msg =
          this.address === ""
            ? "Please enter the receiving wallet address"
            : this.$t("notification.errors.invalidAddress");
        this.$q.notify({
          type: "negative",
          timeout: 2000,
          message: msg
        });
        return;
      }

      this.$gateway.send("wallet", "prove_transaction", {
        txid: this.txid.trim(),
        address: this.address.trim(),
        message: this.message.trim()
      });
    },
    clear() {
      this.txid = "";
      this.address = "";
      this.message = "";
      this.v$.$reset();
    },
    copy() {
      window.electronAPI.copyToClipboard(this.status.state.signature);
      this.$q.notify({
        type: "positive",
        timeout: 1000,
        message: this.$t("notification.positive.signatureCopied")
      });
    },
  }
};
</script>

<style lang="scss">
.signature-wrapper {
  margin-top: 12px;
}

.prove-transaction {
  .description {
    white-space: pre-line;
  }
  .buttons {
    .q-btn:not(:first-child) {
      margin-left: 8px;
    }
  }
  .signature {
    flex: 1;
    word-break: break-all;
    word-wrap: break-word;
    -webkit-user-select: all;
    user-select: all;
    padding: 8px;
  }
}
</style>
