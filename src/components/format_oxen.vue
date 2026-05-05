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
    atomicDivisor() {
      return 1e9;
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
