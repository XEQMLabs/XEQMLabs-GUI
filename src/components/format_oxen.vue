<template>
  <span> {{ value }} XEQM </span>
</template>

<script>
import { mapState } from "vuex";

export default {
  name: "FormatXEQM",
  props: {
    amount: {
      type: Number,
      required: true
    },
    round: {
      type: Boolean,
      required: false,
      default: false
    },
    rawValue: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  computed: {
    ...mapState({
      netType: state => state.gateway.app.config.app?.net_type || "mainnet"
    }),
    // Legacy network uses 1e4 (4 decimal places), new mainnet/testnet use 1e9
    atomicDivisor() {
      return this.netType === "legacy" ? 1e4 : 1e9;
    },
    value() {
      let value = this.amount / this.atomicDivisor;
      if (this.round) value = value.toFixed(3);
      return this.rawValue ? value : value.toLocaleString();
    }
  }
};
</script>

<style></style>
