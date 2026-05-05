<template>
  <div class="tx-list">
    <template v-if="tx_list_paged.length === 0">
      <p class="q-pa-md q-mb-none tab-desc">
        {{ $t("strings.noTransactionsFound") }}
      </p>
    </template>

    <template v-else>
      <q-infinite-scroll ref="scroller" @load="loadMore">
        <q-list
          link
          no-border
          :dark="theme == 'dark'"
          class="oxen-list tx-list"
        >
          <q-item
            v-for="(tx, i) in tx_list_paged"
            :key="tx ? `${tx.txid || i}-${(tx.type != null ? tx.type : '')}-${i}` : `tx-${i}`"
            class="oxen-list-item transaction"
            :class="'tx-' + (tx && tx.type != null ? tx.type : '')"
            @click="details(tx)"
          >
            <q-item-section class="type">
              <div>{{ typeToString(tx.type) }}</div>
            </q-item-section>
            <q-item-label class="main">
              <q-item-label class="amount">
                <FormatOxen :amount="tx.amount || 0" />
              </q-item-label>
              <q-item-label caption class="txid-row">
                <span class="txid-text">{{ tx.txid }}</span>
                <q-btn
                  flat
                  dense
                  round
                  size="xs"
                  icon="content_copy"
                  class="copy-txid-btn"
                  @click.stop="copyTxId(tx.txid)"
                >
                  <q-tooltip>Copy Transaction ID</q-tooltip>
                </q-btn>
              </q-item-label>
            </q-item-label>
            <q-item-section class="meta">
              <q-item-label>
                <timeago
                  :datetime="tx.timestamp * 1000"
                  :auto-update="60"
                />
              </q-item-label>
              <q-item-label caption>{{ formatHeight(tx) }}</q-item-label>
            </q-item-section>
            <ContextMenu
              :menu-items="menuItems"
              @copyTxId="copyTxId(tx.txid)"
              @showDetails="details(tx)"
              @openExplorer="openExplorer(tx.txid)"
            />
          </q-item>
        </q-list>
      </q-infinite-scroll>
    </template>

    <TxDetails ref="txDetails" />
  </div>
</template>

<script>
import { mapState } from "vuex";
import TxDetails from "components/tx_details";
import FormatOxen from "components/format_oxen";
import ContextMenu from "components/menus/contextmenu";

export default {
  name: "TxList",
  components: {
    TxDetails,
    FormatOxen,
    ContextMenu
  },
  props: {
    limit: {
      type: Number,
      required: false,
      default: -1
    },
    type: {
      type: String,
      required: false,
      default: "all"
    },
    filter: {
      type: String,
      required: false,
      default: ""
    },
    toOutgoingAddress: {
      type: String,
      required: false,
      default: ""
    },
    toIncomingAddressIndex: {
      type: Number,
      required: false,
      default: -1
    }
  },
  data() {
    const menuItems = [
      { action: "showDetails", i18n: "menuItems.showDetails" },
      { action: "copyTxId", i18n: "menuItems.copyTransactionId" },
      { action: "openExplorer", i18n: "menuItems.viewOnExplorer" }
    ];
    return {
      page: 0,
      tx_list_filtered: [],
      tx_list_paged: [],
      menuItems
    };
  },
  computed: {
    ...mapState({
      theme: state => state.gateway.app.config.appearance.theme,
      current_height: state => state.gateway.daemon.info.height,
      wallet_height: state => state.gateway.wallet.info.height,
      netType: state => state.gateway.app.config.app?.net_type || "mainnet",
      tx_list_raw: state =>
        (state.gateway &&
          state.gateway.wallet &&
          state.gateway.wallet.transactions &&
          state.gateway.wallet.transactions.tx_list) ||
        [],
      address_book: state =>
        (state.gateway &&
          state.gateway.wallet &&
          state.gateway.wallet.address_list &&
          state.gateway.wallet.address_list.address_book) ||
        []
    }),
    atomicDivisor() {
      return 1e9;
    },
    tx_list() {
      const list = this.tx_list_raw || [];
      return Array.isArray(list) ? list : [];
    }
  },
  watch: {
    wallet_height: {
      handler(val, old) {
        if (val == old) return;
        this.filterTxList();
        this.pageTxList();
      }
    },
    tx_list: {
      handler(val, old) {
        const prev = old || [];
        const curr = val || [];
        if (curr.length === prev.length) {
          const changed = curr.filter(
            (v, i) => v && prev[i] && v.note !== prev[i].note
          );
          if (changed.length === 0) return;
        }
        this.filterTxList();
        this.pageTxList();
      }
    },
    type: {
      handler(val, old) {
        if (val == old) return;
        if (this.$refs.scroller) {
          this.$refs.scroller.stop();
          this.page = 0;
          this.$refs.scroller.reset();
          this.$refs.scroller.resume();
        }
        this.filterTxList();
        this.pageTxList();
      }
    },
    filter: {
      handler(val, old) {
        if (val == old) return;
        if (this.$refs.scroller) {
          this.$refs.scroller.stop();
          this.page = 0;
          this.$refs.scroller.reset();
          this.$refs.scroller.resume();
        }
        this.filterTxList();
        this.pageTxList();
      }
    }
  },
  created() {
    this.filterTxList();
    this.pageTxList();
  },
  methods: {
    typeToString(value) {
      switch (value) {
        case "in":
          return this.$t("strings.transactions.received");
        case "out":
          return this.$t("strings.transactions.sent");
        case "failed":
          return this.$t("strings.transactions.types.failed");
        case "pending":
        case "pool":
          return this.$t("strings.transactions.types.pending");
        case "miner":
          return this.$t("strings.transactions.types.miner");
        case "snode":
          return this.$t("strings.transactions.types.serviceNode");
        case "gov":
          return this.$t("strings.transactions.types.governance");
        case "stake":
          return this.$t("strings.transactions.types.stake");
        default:
          return "-";
      }
    },
    filterTxList() {
      const list = this.tx_list || [];
      const all_in = ["in", "pool", "miner", "snode", "gov"];
      const all_out = ["out", "pending", "stake"];
      const all_pending = ["pending", "pool"];
      this.tx_list_filtered = list.filter(tx => {
        if (!tx || tx.txid == null) return false;
        let valid = true;
        if (this.type === "all_in" && !all_in.includes(tx.type)) {
          return false;
        }

        if (this.type === "all_out" && !all_out.includes(tx.type)) {
          return false;
        }

        if (this.type === "all_pending" && !all_pending.includes(tx.type)) {
          return false;
        }

        if (!this.type.startsWith("all") && this.type !== tx.type) {
          valid = false;
          return valid;
        }

        if (this.filter !== "") {
          valid = this.txContains(tx, this.filter);
          return valid;
        }

        if (this.toOutgoingAddress !== "") {
          if (tx.hasOwnProperty("destinations")) {
            valid = tx.destinations.filter(destination => {
              return destination.address === this.toOutgoingAddress;
            }).length;
          } else {
            valid = false;
          }
          return valid;
        }

        if (this.toIncomingAddressIndex !== -1) {
          valid =
            tx.hasOwnProperty("subaddr_index") &&
            tx.subaddr_index.minor == this.toIncomingAddressIndex;
          return valid;
        }

        return valid;
      });
    },
    txContains(tx, value) {
      // The tx can be searchable using:
      // id, address, notes, amount, recipient name
      const fields = [tx.txid, tx.note];

      const formattedAmount = tx.amount / this.atomicDivisor;
      fields.push(String(formattedAmount));

      // Get all addresses and names and add them on
      const destinations = (tx.destinations || []).map(d => d.address);
      const addresses = [tx.address, ...destinations];
      const contacts = addresses
        .map(this.getContact)
        .filter(c => !!c)
        .map(c => c.name);
      fields.push(...addresses, ...contacts);

      return !!fields.find(f => f.toLowerCase().includes(value.toLowerCase()));
    },
    getContact(address) {
      return this.address_book.find(book => book.address === address);
    },
    pageTxList() {
      this.tx_list_paged = this.tx_list_filtered.slice(
        0,
        this.limit !== -1 ? this.limit : this.page * 24 + 24
      );
    },
    loadMore: function(index, done) {
      this.page = index;
      if (
        this.limit !== -1 ||
        this.tx_list_filtered.length < this.page * 24 + 24
      ) {
        this.$refs.scroller.stop();
      }
      this.pageTxList();
      this.$nextTick(() => {
        done();
      });
    },
    details(tx) {
      this.$refs.txDetails.tx = tx;
      this.$refs.txDetails.txNotes = tx.note;
      this.$refs.txDetails.isVisible = true;
    },
    formatHeight(tx) {
      let height = tx.height;
      let confirms = Math.max(0, this.wallet_height - height);
      if (height == 0) return this.$t("strings.transactions.types.pending");
      if (confirms < Math.max(10, tx.unlock_time - height))
        return (
          this.$t("strings.blockHeight") +
          `: ${height} (${confirms} confirm${confirms == 1 ? "" : "s"})`
        );
      else
        return (
          this.$t("strings.blockHeight") +
          `: ${height} (${this.$t("strings.transactionConfirmed")})`
        );
    },
    copyTxId(txid) {
      window.electronAPI.copyToClipboard(txid);
      this.$q.notify({
        type: "positive",
        timeout: 1000,
        message: this.$t("notification.positive.copied", {
          item: "Txid"
        })
      });
    },
    openExplorer(txid) {
      this.$gateway.send("core", "open_explorer", {
        type: "tx",
        id: txid
      });
    }
  }
};
</script>

<style lang="scss">
.tx-list {
  .oxen-list-item {
    padding-top: 0;
    padding-bottom: 0;
  }
  .transaction {
    .main {
      margin: 0;
      padding: 8px 10px;
      div {
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .q-item-label[caption] {
        font-family: "JetBrains Mono", monospace;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
      }

      .txid-row {
        display: flex;
        align-items: center;
        gap: 4px;

        .txid-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .copy-txid-btn {
          opacity: 0.4;
          min-height: 20px;
          min-width: 20px;
          font-size: 10px;
          transition: opacity 0.2s;

          &:hover {
            opacity: 1;
            color: #00d4ff;
          }
        }
      }
    }

    .type {
      min-width: 100px;
      max-width: 100px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.6);
      div {
        margin-right: 8px;
      }
    }

    .amount {
      font-family: "JetBrains Mono", monospace;
      font-weight: 500;
    }

    .meta {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);

      .q-item-label[caption] {
        font-family: "JetBrains Mono", monospace;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
      }
    }
  }
}
</style>
