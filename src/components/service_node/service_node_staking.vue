<template>
  <div class="service-node-staking">
    <div class="q-px-md q-pt-md">
      <p class="tab-desc">
        Contribute to a pool service node. Enter the node's public key
        and the amount of XEQM you want to stake — your funds earn a
        share of that node's block rewards (8.25 XEQM per block won,
        distributed per stake share minus the operator's cut of up to
        10%) while staked. Once contributed, funds are locked until
        the node exits the network: <b>14 days</b> if you (or the
        operator) initiate a voluntary unlock via <b>My Stakes</b>,
        or <b>7 days</b> as a punitive cooldown if the node is
        deregistered for failing quorum tests. Learn more on the
        <span
          style="cursor: pointer; text-decoration: underline;"
          @click="xeqmlabsWebsite"
          >XEQMLabs website</span
        >.
      </p>
      <OxenField
        :label="$t('fieldLabels.serviceNodeKey')"
        :error="v$.service_node.key.$error"
      >
        <q-input
          v-model.trim="service_node.key"
          :dark="theme == 'dark'"
          :placeholder="$t('placeholders.hexCharacters', { count: 64 })"
          borderless
          dense
          @blur="v$.service_node.key.$touch"
        />
      </OxenField>
      <OxenField
        :label="$t('fieldLabels.amount')"
        class="q-mt-md"
        :error="v$.service_node.amount.$error"
      >
        <q-input
          v-model.trim="service_node.amount"
          :dark="theme == 'dark'"
          type="number"
          min="0"
          :max="unlocked_balance / atomicDivisor"
          placeholder="0"
          borderless
          dense
          @blur="v$.service_node.amount.$touch"
        />
        <q-btn
          color="primary"
          :text-color="theme == 'dark' ? 'white' : 'dark'"
          :label="$t('buttons.min')"
          :disable="!areButtonsEnabled()"
          @click="service_node.amount = minStake(service_node.key)"
        />
        <q-btn
          color="primary"
          :text-color="theme == 'dark' ? 'white' : 'dark'"
          :label="$t('buttons.max')"
          :disable="!areButtonsEnabled()"
          @click="service_node.amount = maxStake(service_node.key)"
        />
      </OxenField>
      <div class="submit-button">
        <q-btn
          :disable="!is_able_to_send"
          color="primary"
          :label="$t('buttons.stake')"
          @click="stake()"
        />
      </div>
    </div>
    <ServiceNodeContribute
      :awaiting-service-nodes="awaiting_service_nodes"
      class="contribute"
      @contribute="fillStakingFields"
    />
    <q-inner-loading :showing="stake_status.sending">
      <q-spinner color="primary" size="30" />
    </q-inner-loading>
  </div>
</template>

<script>
import objectAssignDeep from "object-assign-deep";
import { mapState } from "vuex";
import { useVuelidate } from "@vuelidate/core";
import { required, decimal } from "@vuelidate/validators";
import { service_node_key, greater_than_zero } from "src/validators/common";
import OxenField from "components/oxen_field";
import WalletPassword from "src/mixins/wallet_password";
import ServiceNodeContribute from "./service_node_contribute";
import ServiceNodeMixin from "src/mixins/service_node_mixin";

export default {
  setup() { return { v$: useVuelidate() }; },
  name: "ServiceNodeStaking",
  components: {
    OxenField,
    ServiceNodeContribute
  },
  mixins: [WalletPassword, ServiceNodeMixin],
  data() {
    return {
      service_node: {
        key: "",
        amount: 0,
        // the min and max are for that particular SN,
        // start at min/max for the wallet
        minStakeAmount: 0,
        maxStakeAmount: 0
      }
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      unlocked_balance: state => state.gateway.wallet.info.unlocked_balance,
      info: state => state.gateway.wallet.info,
      stake_status: state => state.gateway.service_node_status.stake,
      award_address: state => state.gateway.wallet.info.address,
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
      awaiting_service_nodes(state) {
        const nodes = state.gateway.daemon.service_nodes.nodes;
        const getOurContribution = node =>
          node.contributors.find(
            c => c.address === this.award_address && c.amount > 0
          );
        // a reserved node is one on which someone is a "contributor" of amount = 0
        const reservedForUs = node =>
          node.contributors.find(
            c => c.address === this.award_address && c.amount == 0
          );
        const isAwaitingContribution = node => !node.active && !node.funded;
        const isAwaitingContributionNonReserved = node =>
          node.requested_unlock_height === 0 &&
          isAwaitingContribution(node) &&
          !getOurContribution(node) &&
          this.openForContribution(node) > 0;
        const isAwaitingContributionReserved = node =>
          isAwaitingContribution(node) && reservedForUs(node);

        // we want the reserved nodes sorted by fee at the top
        const awaitingContributionNodesReserved = nodes
          .filter(isAwaitingContributionReserved)
          .map(n => {
            return {
              ...n,
              awaitingContribution: true
            };
          });
        const awaitingContributionNodesNonReserved = nodes
          .filter(isAwaitingContributionNonReserved)
          .map(n => {
            return {
              ...n,
              awaitingContribution: true
            };
          });

        const compareFee = (n1, n2) =>
          this.getFeeDecimal(n1) > this.getFeeDecimal(n2) ? 1 : -1;
        awaitingContributionNodesReserved.sort(compareFee);
        awaitingContributionNodesNonReserved.sort(compareFee);

        const nodesForContribution = [
          ...awaitingContributionNodesReserved,
          ...awaitingContributionNodesNonReserved
        ];
        return nodesForContribution;
      }
    }),
    atomicDivisor() {
      return 1e9;
    },
    stakeStatusCode() {
      return this.stake_status ? this.stake_status.code : 0;
    }
  },
  validations: {
    service_node: {
      key: { required, service_node_key },
      amount: {
        required,
        decimal,
        greater_than_zero
      }
    }
  },
  watch: {
    stakeStatusCode(code, oldCode) {
      if (code === oldCode) return;
      switch (code) {
        case 0:
          this.$q.notify({
            type: "positive",
            timeout: 1000,
            message: this.stake_status.message || ""
          });
          this.v$.$reset();
          this.service_node = {
            key: "",
            amount: 0
          };
          break;
        case -1:
          this.$q.notify({
            type: "negative",
            timeout: 3000,
            message: this.stake_status.message || ""
          });
          break;
      }
    }
  },
  methods: {
    xeqmlabsWebsite() {
      this.$gateway.send("core", "open_url", {
        url: "https://xeqmlabs.com"
      });
    },
    fillStakingFields(key, minContribution) {
      this.service_node.key = key;
      this.service_node.amount = minContribution;
    },
    minStake() {
      const node = this.getNodeWithPubKey();
      return this.getMinContribution(node, this.award_address);
    },
    maxStake() {
      const node = this.getNodeWithPubKey();
      return this.openForContributionOxen(node, this.award_address);
    },
    getFeeDecimal(node) {
      const operatorPortion = node.portions_for_operator;
      return (operatorPortion / 18446744073709551612) * 100;
    },
    getNodeWithPubKey() {
      const key = this.service_node.key;
      const nodeOfKey = this.awaiting_service_nodes.find(
        n => n.service_node_pubkey === key
      );
      if (!nodeOfKey) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.invalidServiceNodeKey")
        });
        return;
      } else {
        return nodeOfKey;
      }
    },
    areButtonsEnabled() {
      // if we can find the service node key in the list of service nodes
      const key = this.service_node.key;
      return !!this.awaiting_service_nodes.find(
        n => n.service_node_pubkey === key
      );
    },
    async stake() {
      this.v$.service_node.$touch();

      if (this.v$.service_node.key.$error) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.invalidServiceNodeKey")
        });
        return;
      }

      if (this.service_node.amount < 0) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.negativeAmount")
        });
        return;
      } else if (this.service_node.amount == 0) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.zeroAmount")
        });
        return;
      } else if (this.service_node.amount > this.unlocked_balance / this.atomicDivisor) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.notEnoughBalance")
        });
        return;
      } else if (this.v$.service_node.amount.$error) {
        this.$q.notify({
          type: "negative",
          timeout: 1000,
          message: this.$t("notification.errors.invalidAmount")
        });
        return;
      }

      let passwordDialog = await this.showPasswordConfirmation({
        title: this.$t("dialog.stake.title"),
        noPasswordMessage: this.$t("dialog.stake.message"),
        ok: {
          label: this.$t("dialog.stake.ok"),
          color: "primary"
        },
        dark: this.theme == "dark",
        color: this.theme == "dark" ? "white" : "dark"
      });
      passwordDialog
        .onOk(password => {
          password = password || "";
          this.$store.commit("gateway/set_snode_status", {
            stake: {
              code: 1,
              message: "Staking...",
              sending: true
            }
          });
          const service_node = objectAssignDeep.noMutate(this.service_node, {
            password,
            destination: this.award_address
          });

          this.$gateway.send("wallet", "stake", service_node);
        })
        .onDismiss(() => {})
        .onCancel(() => {});
    }
  }
};
</script>

<style lang="scss">
.service-node-staking {
  .submit-button {
    .q-btn:not(:first-child) {
      margin-left: 8px;
    }
  }
}
.contribute {
  margin-top: 16px;
  padding-left: 8px;
}
.service-node-stake-tab {
  margin-top: 4px;
  user-select: none;
  .header {
    font-weight: 450;
  }
  .q-item-sublabel,
  .q-list-header {
    font-size: 14px;
  }
}
</style>
