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
      console.log(this.payoutBlock);
      console.log(this.currentBlock);
      if (this.payoutBlock == 0) return "";

      let blocks = this.payoutBlock - this.currentBlock;
      console.log(this.currentBlock);

      // XEQM mainnet target block time is 1 minute
      // (1440 blocks/day, 60 blocks/hour, 1 block/minute)
      if (blocks > 1440) return (blocks / 1440).toFixed(1) + " days";
      else if (blocks > 60) return (blocks / 60).toFixed(1) + " hours";
      else return blocks + " minutes";
    }
  }
};
</script>

<style></style>
