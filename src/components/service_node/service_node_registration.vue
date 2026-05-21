<template>
  <div class="service-node-registration">
    <div class="q-pa-md">
      <div class="tab-desc q-mb-lg">
        Submit a service node registration to the network. Paste the
        <b>register_service_node</b> command you generated on your service
        node's daemon — this wallet will pay the operator stake
        (200,000 XEQM for solo, 100,000 XEQM for pool) and lock it as
        collateral against the node's public key.
        <br /><br />
        You only need this tab if you operate a service node and this is
        the wallet holding the operator stake. The registration command
        itself is generated on the SN box — see the operator setup guide
        for the daemon-side commands.
      </div>
      <OxenField
        :label="$t('fieldLabels.serviceNodeCommand')"
        :error="v$.registration_string.$error"
      >
        <q-input
          v-model.trim="registration_string"
          type="textarea"
          class="full-width text-area-oxen"
          placeholder="register_service_node ..."
          borderless
          dense
          @blur="v$.registration_string.$touch"
          @paste="onPaste"
        />
      </OxenField>
      <q-btn
        class="register-button"
        color="primary"
        :label="$t('buttons.registerServiceNode')"
        :disabled="registration_status.sending"
        @click="register()"
      />
    </div>

    <q-inner-loading :showing="registration_status.sending">
      <q-spinner color="primary" size="30" />
    </q-inner-loading>
  </div>
</template>

<script>
import { mapState } from "vuex";
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";
import OxenField from "components/oxen_field";
import WalletPassword from "src/mixins/wallet_password";

export default {
  setup() { return { v$: useVuelidate() }; },
  name: "ServiceNodeRegistration",
  components: {
    OxenField
  },
  mixins: [WalletPassword],
  data() {
    return {
      registration_string: ""
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      registration_status: state => state.gateway.service_node_status.registration
    }),
    registrationStatusCode() {
      return this.registration_status ? this.registration_status.code : 0;
    }
  },
  validations: {
    registration_string: { required }
  },
  watch: {
    registrationStatusCode(code, oldCode) {
      if (code === oldCode) return;
      switch (code) {
        case 0:
          this.$q.notify({
            type: "positive",
            timeout: 1000,
            message: this.registration_status.message || ""
          });
          this.v$.$reset();
          this.registration_string = "";
          break;
        case -1:
          this.$q.notify({
            type: "negative",
            timeout: 3000,
            message: this.registration_status.message || ""
          });
          break;
      }
    }
  },
  methods: {
    async register() {
      this.v$.registration_string.$touch();

      if (this.v$.registration_string.$error) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.invalidServiceNodeCommand")
        });
        return;
      }

      let passwordDialog = await this.showPasswordConfirmation({
        title: this.$t("dialog.registerServiceNode.title"),
        noPasswordMessage: this.$t("dialog.registerServiceNode.message"),
        ok: {
          label: this.$t("dialog.registerServiceNode.ok"),
          color: "primary"
        },
        dark: this.theme == "dark",
        color: this.theme == "dark" ? "white" : "dark"
      });
      passwordDialog
        .onOk(password => {
          password = password || "";
          this.$store.commit("gateway/set_snode_status", {
            registration: {
              code: 1,
              message: "Registering...",
              sending: true
            }
          });
          this.$gateway.send("wallet", "register_service_node", {
            password,
            string: this.registration_string.trim()
          });
        })
        .onDismiss(() => {})
        .onCancel(() => {});
    },
    onPaste() {
      this.$nextTick(() => {
        this.registration_string = this.registration_string.trim();
      });
    }
  }
};
</script>

<style lang="scss">
.register-button {
  margin-top: 6px;
}
</style>
