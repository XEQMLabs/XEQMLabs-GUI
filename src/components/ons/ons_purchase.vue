<template>
  <div class="ons-purchase">
    <div class="q-mb-lg q-px-md q-pt-md">
      <div class="tab-desc">
        {{ $t("strings.onsPurchaseDescription") }}
      </div>
      <div class="prices">
        {{ $t("strings.ons.prices") }}
        <table>
          <tr>
            <td>{{ $t("strings.ons.sessionID") }}:</td>
            <td>7 XEQM</td>
          </tr>
          <tr>
            <td>{{ $t("strings.ons.wallet") }}:</td>
            <td>7 XEQM</td>
          </tr>
          <tr>
            <td>{{ $t("strings.ons.lokinetName1Year") }}:</td>
            <td>7 XEQM</td>
          </tr>
          <tr>
            <td>{{ $t("strings.ons.lokinetNameXYears", { years: 2 }) }}:</td>
            <td>14 XEQM</td>
          </tr>
          <tr>
            <td>{{ $t("strings.ons.lokinetNameXYears", { years: 5 }) }}:</td>
            <td>28 XEQM</td>
          </tr>
          <tr>
            <td>{{ $t("strings.ons.lokinetNameXYears", { years: 10 }) }}:</td>
            <td>42 XEQM</td>
          </tr>
        </table>
      </div>
      <ONSInput ref="input" />
    </div>
  </div>
</template>

<script>
import ONSInput from "./ons_input";
export default {
  name: "ONSPurchase",
  components: {
    ONSInput
  },
  methods: {
    startUpdating(record) {
      this.$refs.input.startUpdating(record);
    },
    startRenewing(record) {
      this.$refs.input.startRenewing(record);
    }
  }
};
</script>
<style lang="scss">
.ons-purchase {
  .description {
    white-space: pre-line;
    // oxen-navy
    color: #1f1c47;
  }

  .prices {
    // oxen-navy
    margin-top: 20px;
    color: #1f1c47;
  }
}
</style>
