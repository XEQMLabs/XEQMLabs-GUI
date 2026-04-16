<template>
  <q-page class="network-stats-page">
    <div class="header row items-center justify-center q-pt-md q-pb-md">
      <h5 class="q-my-none">{{ $t("titles.networkStats") }}</h5>
    </div>

    <div class="q-pa-md">
      <div class="row q-mb-md items-center">
        <div class="col">
          <q-card>
            <q-card-section>
              <div class="text-h6">Total Service Nodes</div>
              <div class="text-h4 text-primary">{{ totalNodes }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <q-card>
        <q-card-section>
          <div class="row items-center justify-between q-mb-md">
            <div class="text-h6">Service Nodes</div>
            <q-btn
              flat
              dense
              round
              icon="refresh"
              :loading="loading"
              @click="refreshNodes"
            >
              <q-tooltip>{{ $t("buttons.refresh") }}</q-tooltip>
            </q-btn>
          </div>

          <q-table
            :rows="serviceNodes"
            :columns="columns"
            row-key="service_node_pubkey"
            :loading="loading"
            v-model:pagination="pagination"
            :rows-per-page-options="[10, 25, 50, 100]"
            flat
            dense
          >
            <template v-slot:body-cell-pubkey="props">
              <q-td :props="props">
                <div class="ellipsis" style="max-width: 200px;">
                  {{ props.value }}
                </div>
                <q-tooltip>{{ props.value }}</q-tooltip>
              </q-td>
            </template>

            <template v-slot:body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="props.value === 'ACTIVE' ? 'positive' : 'warning'"
                  :label="props.value"
                />
              </q-td>
            </template>

            <template v-slot:body-cell-registration_height="props">
              <q-td :props="props">
                {{ props.value.toLocaleString() }}
              </q-td>
            </template>

            <template v-slot:body-cell-last_uptime_proof="props">
              <q-td :props="props">
                {{ formatDate(props.value) }}
              </q-td>
            </template>

            <template v-slot:body-cell-total_contributed="props">
              <q-td :props="props">
                {{ formatStakedAmount(props.row) }}
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script>
import { mapState } from "vuex";

export default {
  name: "NetworkStats",
  data() {
    return {
      loading: false,
      pagination: {
        rowsPerPage: 25,
        sortBy: "registration_height",
        descending: true
      },
      columns: [
        {
          name: "pubkey",
          label: "Service Node Key",
          field: "service_node_pubkey",
          align: "left",
          sortable: true
        },
        {
          name: "operator_address",
          label: "Operator Address",
          field: "operator_address",
          align: "left",
          sortable: true
        },
        {
          name: "status",
          label: "Status",
          field: row => row.active_state,
          align: "center",
          sortable: true
        },
        {
          name: "total_contributed",
          label: "Staked Amount",
          field: row => {
            // Use total_contributed for sorting
            return row.total_contributed || 0;
          },
          align: "right",
          sortable: true
        },
        {
          name: "registration_height",
          label: "Reg Height",
          field: "registration_height",
          align: "right",
          sortable: true
        },
        {
          name: "last_uptime_proof",
          label: "Last Uptime Proof",
          field: "last_uptime_proof",
          align: "center",
          sortable: true
        },
        {
          name: "public_ip",
          label: "IP Address",
          field: row =>
            row.public_ip
              ? `${row.public_ip}:${row.storage_port || "N/A"}`
              : "N/A",
          align: "left",
          sortable: false
        }
      ]
    };
  },
  computed: {
    ...mapState({
      serviceNodesRaw: state => state.gateway.daemon.service_nodes.nodes || [],
      netType: state => state.gateway.app.config.app?.net_type || "mainnet"
    }),
    // Legacy network uses 1e4 (4 decimal places), new mainnet/testnet use 1e9
    atomicDivisor() {
      return this.netType === "legacy" ? 1e4 : 1e9;
    },
    serviceNodes() {
      const now = Math.floor(Date.now() / 1000);
      const uptimeProofWindow = 7200; // 2 hours: node is "active" if it proved recently
      return this.serviceNodesRaw.map(node => {
        const isActive =
          node.active === true ||
          (node.last_uptime_proof &&
            node.last_uptime_proof > 0 &&
            now - node.last_uptime_proof < uptimeProofWindow);
        return {
          ...node,
          active: isActive,
          active_state: isActive ? "ACTIVE" : "INACTIVE"
        };
      });
    },
    totalNodes() {
      return this.serviceNodes.length;
    }
  },
  mounted() {
    this.refreshNodes();
  },
  methods: {
    refreshNodes() {
      this.loading = true;
      this.$gateway.send("daemon", "update_service_nodes");
      // Wait a moment for the update to complete
      setTimeout(() => {
        this.loading = false;
      }, 1000);
    },
    formatDate(timestamp) {
      if (!timestamp) return "N/A";
      const date = new Date(timestamp * 1000);
      return date.toLocaleString();
    },
    formatStakedAmount(node) {
      // Calculate staked amount and total requirement
      const staked = node.total_contributed || 0;
      const stakingRequirement = node.staking_requirement || 0;

      // Convert from atomic units to XEQM (legacy uses 1e4, mainnet uses 1e9)
      const stakedXEQM = Math.round(staked / this.atomicDivisor);
      const requiredXEQM = Math.round(stakingRequirement / this.atomicDivisor);

      // Return format: "staked/required" (e.g., "10/100" or "100/100")
      if (stakingRequirement === 0) {
        return `${stakedXEQM}/?`;
      }

      return `${stakedXEQM}/${requiredXEQM}`;
    }
  }
};
</script>

<style lang="scss">
.network-stats-page {
  .header {
    h5 {
      font-weight: 500;
      color: rgba(255, 255, 255, 0.92);
    }
  }

  .q-card {
    background: #0c1218;
    border: 1px solid rgba(0, 212, 255, 0.1);
    border-radius: 12px;

    .text-h6 {
      color: rgba(255, 255, 255, 0.6);
      font-weight: 500;
    }

    .text-h4 {
      font-family: "JetBrains Mono", monospace;
      font-weight: 600;
    }
  }

  // Table styling
  .q-table {
    background: transparent;
    color: rgba(255, 255, 255, 0.92);

    // Header
    thead tr th {
      background: #080c12;
      color: rgba(255, 255, 255, 0.6);
      font-weight: 600;
      border-bottom: 1px solid rgba(0, 212, 255, 0.2);
    }

    // Body rows
    tbody tr {
      background: #0c1218;

      &:hover {
        background: #101820;
      }

      td {
        color: rgba(255, 255, 255, 0.85);
        border-bottom: 1px solid rgba(0, 212, 255, 0.05);
        font-family: "JetBrains Mono", monospace;
        font-size: 12px;
      }
    }

    // Pagination
    .q-table__bottom {
      background: #080c12;
      color: rgba(255, 255, 255, 0.6);
      border-top: 1px solid rgba(0, 212, 255, 0.1);

      .q-table__control {
        color: rgba(255, 255, 255, 0.6);
      }
    }
  }

  // Refresh button
  .q-btn {
    color: #00d4ff;

    &:hover {
      background: rgba(0, 212, 255, 0.1);
    }
  }
}
</style>
