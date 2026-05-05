<template>
  <div class="column wallet-info" v-if="info">
    <div class="row justify-between items-center wallet-header">
      <div class="title">{{ info.name }}</div>
      <WalletSettings />
    </div>
    <div class="wallet-content oxen-navy">
      <div class="row justify-center">
        <div class="funds column items-center">
          <div class="balance">
            <q-btn-toggle
              v-model="balancestakeselector"
              toggle-color="primary"
              color="accent"
              :options="[
                {
                  label: $t('strings.xeqmBalance'),
                  value: 'balance'
                },
                {
                  label: $t('strings.stake'),
                  value: 'stake'
                }
              ]"
            />
            <div class="value row items-center justify-center">
              <span><FormatOxen :amount="info.balance"/></span>
              <q-btn
                flat
                dense
                round
                icon="refresh"
                size="sm"
                color="white"
                class="q-ml-sm"
                :disable="!is_wallet_open"
                @click="rescanWallet"
              >
                <q-tooltip>{{ $t("menuItems.rescanWallet") }}</q-tooltip>
              </q-btn>
            </div>
            <div v-if="balancestakeselector === 'balance' && xeqm_price > 0" class="usd-value">
              <q-icon name="attach_money" size="13px" />{{ usdValue }}
            </div>
          </div>
          <div v-if="balancestakeselector != 'stake'" class="row unlocked">
            <span
              >{{ $t("strings.xeqmUnlockedShort") }}:
              <FormatOxen :amount="info.unlocked_balance"
            /></span>
            <span v-if="fundsLocked" class="lock-indicator">
              <q-icon name="lock_clock" size="14px" />
              {{ lockMessage }}
            </span>
          </div>
          <div v-if="balancestakeselector == 'stake'" class="row unlocked">
            <span v-if="info.accrued_balance > 0"
              >{{ $t("strings.xeqmAccumulatedRewards") }}:
              <FormatOxen :amount="info.accrued_balance" />•
              {{ $t("strings.nextPayout") }}:
              <FormatNextPayout
                :payout-block="info.accrued_balance_next_payout"
                :current-block="info.height"
              />
            </span>
            <span v-if="info.accrued_balance == 0">
              No accumulated rewards from staking
            </span>
          </div>
        </div>
      </div>
      <div class="wallet-address row justify-center items-center">
        <div class="address">{{ info.address }}</div>
        <CopyIcon :content="info.address" />
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";
import FormatOxen from "components/format_oxen";
import FormatNextPayout from "components/format_next_payout";
import WalletSettings from "components/menus/wallet_settings";
import CopyIcon from "components/icons/copy_icon";
export default {
  name: "WalletDetails",
  components: {
    FormatOxen,
    FormatNextPayout,
    WalletSettings,
    CopyIcon
  },
  data() {
    return {
      balancestakeselector: "balance"
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      info: state => state.gateway.wallet.info,
      daemon_height: state => state.gateway.daemon.info.height,
      tx_list: state => state.gateway.wallet.transactions.tx_list,
      xeqm_price: state => state.gateway.app.xeqm_price,
      net_type: state => state.gateway.app.config?.app?.net_type,
      is_wallet_open: state =>
        state.gateway.wallet.info && state.gateway.wallet.info.name
    }),
    usdValue() {
      if (this.xeqm_price === null || this.xeqm_price === undefined) return "≈ ---";
      const xeqm = (this.info?.balance || 0) / 1e4;
      const usd = xeqm * this.xeqm_price;
      return `≈ ${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    },
    fundsLocked() {
      return (
        this.info.balance > 0 && this.info.unlocked_balance < this.info.balance
      );
    },
    lockMessage() {
      if (!this.fundsLocked) return "";
      const height = this.daemon_height || this.info.height;
      if (!height) return "Unlocking...";

      // Find most recent outgoing/pending TX with < 10 confirmations
      const outTypes = ["out", "pending", "stake"];
      const list = this.tx_list || [];
      const recentLockedTx = list
        .filter(tx => tx && outTypes.includes(tx.type))
        .filter(tx => tx.height > 0 && height - tx.height < 10)
        .sort((a, b) => b.height - a.height)[0];

      if (recentLockedTx) {
        const confirmations = Math.max(0, height - recentLockedTx.height);
        const blocksLeft = Math.max(0, 10 - confirmations);
        if (blocksLeft <= 0) return "Unlocking...";
        const minsLeft = blocksLeft * 2;
        return `~${blocksLeft} block${
          blocksLeft === 1 ? "" : "s"
        } (~${minsLeft} min)`;
      }

      // Pending TX not yet in a block
      const pendingTx = (this.tx_list || []).find(
        tx => tx && (tx.type === "pending" || tx.type === "pool")
      );
      if (pendingTx) return "Pending confirmation...";

      return "Unlocking...";
    }
  },
  methods: {
    rescanWallet() {
      this.$q
        .dialog({
          title: this.$t("dialog.rescan.title"),
          message: this.$t("dialog.rescan.message"),
          ok: {
            label: this.$t("dialog.rescan.ok"),
            color: "primary"
          },
          cancel: {
            flat: true,
            label: this.$t("buttons.cancel")
          }
        })
        .onOk(() => {
          this.$gateway.send("wallet", "rescan_blockchain");
        })
        .onDismiss(() => {})
        .onCancel(() => {});
    }
  }
};
</script>

<style lang="scss">
.wallet-info {
  .wallet-header {
    padding: 0.8rem 1.5rem;
    background: #080c12;
    border-bottom: 1px solid rgba(0, 212, 255, 0.1);
    .title {
      font-weight: 600;
      color: rgba(255, 255, 255, 0.92);
    }
  }

  .wallet-content {
    text-align: center;
    padding: 2em;
    background: linear-gradient(180deg, #080c12 0%, #030508 100%);

    .balance {
      .q-btn-toggle {
        padding: 2px;
        border-radius: 4px;

        .q-btn {
          padding: 1px 8px !important;
          min-height: 18px !important;
          font-size: 10px !important;
        }
      }

      .usd-value {
        font-size: 13px;
        font-family: "JetBrains Mono", monospace;
        color: rgba(0, 212, 255, 0.65);
        margin-top: 2px;
        letter-spacing: 0.02em;
      }
      .text {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.6);
      }
      .value {
        font-size: 35px;
        font-family: "JetBrains Mono", monospace;
        color: rgba(255, 255, 255, 0.92);

        .q-btn {
          opacity: 0.7;
          transition: opacity 0.2s;
          color: #00d4ff;

          &:hover {
            opacity: 1;
          }

          &[disabled] {
            opacity: 0.3;
          }
        }
      }
    }

    .wallet-address {
      margin-top: 12px;
      padding: 12px;
      background: rgba(0, 212, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.1);
      border-radius: 8px;

      .address {
        overflow: hidden;
        text-overflow: ellipsis;
        margin: 4px 0;
        font-family: "JetBrains Mono", monospace;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);
      }
      .q-btn {
        margin-left: 8px;
        color: #00d4ff;
      }
    }

    .unlocked {
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.6);
      font-family: "JetBrains Mono", monospace;
      align-items: center;

      .lock-indicator {
        margin-left: 10px;
        padding: 2px 8px;
        background: rgba(255, 170, 0, 0.12);
        border: 1px solid rgba(255, 170, 0, 0.3);
        border-radius: 4px;
        font-size: 11px;
        color: #ffaa00;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        animation: lockPulse 2s ease-in-out infinite;

        .q-icon {
          color: #ffaa00;
        }
      }
    }

    @keyframes lockPulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }
  }
}
</style>
