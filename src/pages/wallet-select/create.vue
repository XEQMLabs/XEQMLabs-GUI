<template>
  <q-page class="create-wallet">
    <!-- Network indicator banner -->
    <q-banner
      v-if="networkType === 'mainnet'"
      class="bg-warning text-dark q-mb-sm"
      icon="info"
    >
      <strong>Creating Mainnet Wallet (Offline)</strong><br />
      Mainnet is not yet live. Your wallet will be ready when the network launches.
    </q-banner>
    <q-banner
      v-else-if="networkType === 'testnet'"
      class="bg-primary text-white q-mb-sm"
      icon="science"
    >
      <strong>Creating Testnet Wallet</strong><br />
      This wallet is for the testnet network.
    </q-banner>

    <div class="fields q-mx-md q-mt-md">
      <OxenField
        :label="$t('fieldLabels.walletName')"
        :error="v$.wallet.name.$error"
      >
        <q-input
          v-model="wallet.name"
          :dark="theme == 'dark'"
          :placeholder="$t('placeholders.walletName')"
          borderless
          dense
          @keyup.enter="create"
          @blur="v$.wallet.name.$touch"
        />
      </OxenField>

      <OxenField :label="$t('fieldLabels.password')" optional>
        <q-input
          v-model="wallet.password"
          type="password"
          :dark="theme == 'dark'"
          :placeholder="$t('placeholders.walletPassword')"
          borderless
          dense
          @keyup.enter="create"
        />
      </OxenField>

      <OxenField :label="$t('fieldLabels.confirmPassword')">
        <q-input
          v-model="wallet.password_confirm"
          type="password"
          :dark="theme == 'dark'"
          borderless
          dense
          @keyup.enter="create"
        />
      </OxenField>

      <q-field class="q-pb-sm">
        <q-checkbox
          v-model="wallet.hardware_wallet"
          :label="$t('strings.hardwareWallet')"
        />
      </q-field>

      <OxenField
        v-if="!wallet.hardware_wallet"
        :label="$t('fieldLabels.seedLanguage')"
      >
        <q-select
          v-model="wallet.language"
          :options="languageOptions"
          :dark="theme == 'dark'"
          borderless
          dense
          emit-value
          map-options
        />
      </OxenField>

      <q-field>
        <q-btn
          color="primary"
          :label="$t('buttons.createWallet')"
          @click="create"
        />
      </q-field>
    </div>
  </q-page>
</template>

<script>
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";
import { mapState } from "vuex";
import OxenField from "components/oxen_field";
export default {
  setup() {
    return { v$: useVuelidate() };
  },
  components: {
    OxenField
  },
  data() {
    const languageOptions = [
      { label: "English", value: "English" },
      { label: "Deutsch", value: "Deutsch" },
      { label: "Español", value: "Español" },
      { label: "Français", value: "Français" },
      { label: "Italiano", value: "Italiano" },
      { label: "Nederlands", value: "Nederlands" },
      { label: "Português", value: "Português" },
      { label: "Русский", value: "Русский" },
      { label: "日本語", value: "日本語" },
      { label: "简体中文 (中国)", value: "简体中文 (中国)" },
      { label: "Esperanto", value: "Esperanto" },
      { label: "Lojban", value: "Lojban" }
    ];
    return {
      wallet: {
        name: "",
        language: languageOptions[0].value,
        password: "",
        password_confirm: "",
        hardware_wallet: false
      },
      languageOptions
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      status: state => state.gateway.wallet.status,
      networkType: state => state.gateway.app.config.app?.net_type ||
                           state.gateway.app.pending_config?.app?.net_type ||
                           "mainnet"
    }),
    statusCode() {
      return this.status ? this.status.code : 1;
    }
  },
  watch: {
    statusCode(code, oldCode) {
      if (code === oldCode) return;
      switch (code) {
        case 1:
          break;
        case 0:
          this.$q.loading.hide();
          this.$router.replace({
            path: "/wallet-select/created"
          });
          break;
        default:
          this.$q.loading.hide();
          this.$q.notify({
            type: "negative",
            timeout: 1000,
            message: this.status.message || ""
          });
          break;
      }
    }
  },
  validations: {
    wallet: {
      name: { required }
    }
  },
  methods: {
    createWallet() {
      this.$q.loading.show({
        delay: 0
      });
      this.$gateway.send("wallet", "create_wallet", this.wallet);
    },
    create() {
      this.v$.wallet.$touch();

      if (this.v$.wallet.$error) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.enterWalletName")
        });
        return;
      }
      if (this.wallet.password != this.wallet.password_confirm) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.passwordNoMatch")
        });
        return;
      }

      // Warn user if no password is set
      if (!this.wallet.password) {
        const passwordPromise = this.$q.dialog({
          title: this.$t("dialog.noPassword.title"),
          message: this.$t("dialog.noPassword.message"),
          ok: {
            label: this.$t("dialog.noPassword.ok")
          },
          cancel: {
            flat: true,
            label: this.$t("dialog.buttons.cancel")
          },
          color: "primary"
        });
        passwordPromise
          .onOk(() => {
            this.createWallet();
          })
          .onDismiss(() => {})
          .onCancel(() => {});
      } else {
        this.createWallet();
      }
    },
    cancel() {
      this.$router.replace({ path: "/wallet-select" });
    }
  }
};
</script>

<style lang="scss"></style>
