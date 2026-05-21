<template>
  <span> {{ value }} </span>
</template>

<script>
export default {
  name: "FormatNextPayout",
  props: {
    payoutBlock: {
      type: Number,
      required: true
    },
    currentBlock: {
      type: Number,
      required: true
    }
  },
  computed: {
    value() {
      if (this.payoutBlock == 0) return "";
      // XEQM mainnet target block time is 1 minute
      // (1440 blocks/day, 60 blocks/hour, 1 block/minute)
      const blocks = this.payoutBlock - this.currentBlock;
      if (blocks > 1440) return (blocks / 1440).toFixed(1) + " days";
      if (blocks > 60) return (blocks / 60).toFixed(1) + " hours";
      return blocks + " minutes";
    }
  }
};
</script>

<style></style>
