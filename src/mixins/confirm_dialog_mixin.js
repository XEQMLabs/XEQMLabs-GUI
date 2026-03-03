export default {
  computed: {
    // Legacy network uses 1e4 (4 decimal places), new mainnet/testnet use 1e9
    atomicDivisor() {
      const netType = this.$store?.state?.gateway?.app?.config?.app?.net_type || "mainnet";
      return netType === "legacy" ? 1e4 : 1e9;
    }
  },
  methods: {
    buildDialogFields(val) {
      const {
        feeList,
        amountList,
        destinations,
        priority,
        isSweepAll,
        address
      } = val.txData;

      const totalFees = feeList.reduce((a, b) => a + b, 0) / this.atomicDivisor;
      const totalAmount = amountList.reduce((a, b) => a + b, 0) / this.atomicDivisor;
      // If the tx is a sweep all, we're sending to the wallet's primary address
      // a tx can be split, but only sent to one address
      let destination = isSweepAll ? address : destinations[0].address;
      const isBlink = [0, 2, 3, 4, 5].includes(priority) ? true : false;
      const confirmFields = {
        isBlink,
        destination,
        totalAmount,
        totalFees
      };
      return confirmFields;
    }
  }
};
