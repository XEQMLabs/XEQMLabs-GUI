<template>
  <div class="troubleshooting-panel q-pa-md">
    <div class="row items-center q-mb-sm">
      <div class="col text-weight-bold" style="font-size: 14px; color: #ccc;">
        SESSION LOG
        <span style="font-size: 11px; color: #888; margin-left: 8px;">
          ({{ filteredLogs.length }} entries)
        </span>
      </div>
      <q-btn-toggle
        v-model="levelFilter"
        toggle-color="primary"
        color="accent"
        size="sm"
        dense
        :options="filterOptions"
        class="q-mr-sm"
      />
      <q-btn
        flat
        dense
        size="sm"
        icon="content_copy"
        color="grey"
        @click="copyLogs"
      >
        <q-tooltip>Copy all logs to clipboard</q-tooltip>
      </q-btn>
    </div>

    <div
      ref="logContainer"
      class="log-container"
      @scroll="onScroll"
    >
      <q-btn
        v-if="userScrolled"
        flat
        dense
        size="xs"
        icon="arrow_downward"
        label="Jump to bottom"
        color="primary"
        class="jump-btn"
        @click="jumpToBottom"
      />
      <div v-if="filteredLogs.length === 0" class="log-empty">
        No log entries yet. Errors and events will appear here as they occur.
      </div>
      <div
        v-for="(entry, idx) in filteredLogs"
        :key="idx"
        class="log-entry"
        :class="'log-' + entry.level"
      >
        <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
        <span class="log-level">{{ entry.level.toUpperCase() }}</span>
        <span class="log-source">[{{ entry.source }}]</span>
        <span class="log-msg">{{ entry.message }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";

export default {
  name: "SettingsTroubleshooting",
  data() {
    return {
      levelFilter: "all",
      userScrolled: false
    };
  },
  computed: {
    ...mapState({
      session_logs: state => state.gateway.session_logs
    }),
    filterOptions() {
      return [
        { label: "All", value: "all" },
        { label: "Errors", value: "error" },
        { label: "Warnings", value: "warn" },
        { label: "Info", value: "info" }
      ];
    },
    filteredLogs() {
      if (this.levelFilter === "all") return this.session_logs;
      if (this.levelFilter === "error") {
        return this.session_logs.filter(e => e.level === "error");
      }
      if (this.levelFilter === "warn") {
        return this.session_logs.filter(
          e => e.level === "warn" || e.level === "error"
        );
      }
      return this.session_logs.filter(e => e.level === this.levelFilter);
    }
  },
  watch: {
    filteredLogs() {
      if (this.userScrolled) return;
      this.$nextTick(() => {
        const el = this.$refs.logContainer;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  },
  methods: {
    formatTime(ts) {
      const d = new Date(ts);
      return (
        d.toLocaleTimeString("en-US", { hour12: false }) +
        "." +
        String(d.getMilliseconds()).padStart(3, "0")
      );
    },
    onScroll() {
      const el = this.$refs.logContainer;
      if (!el) return;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      this.userScrolled = !atBottom;
    },
    jumpToBottom() {
      const el = this.$refs.logContainer;
      if (el) el.scrollTop = el.scrollHeight;
      this.userScrolled = false;
    },
    copyLogs() {
      const text = this.filteredLogs
        .map(
          e =>
            `${this.formatTime(e.timestamp)} ${e.level.toUpperCase()} [${
              e.source
            }] ${e.message}`
        )
        .join("\n");
      window.electronAPI.copyToClipboard(text || "No logs to copy");
      this.$q.notify({
        type: "positive",
        timeout: 1500,
        message: "Logs copied to clipboard"
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.troubleshooting-panel {
  height: 100%;
}

.log-container {
  background: #0d0d0d;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 10px 12px;
  font-family: "Consolas", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.6;
  height: calc(100vh - 180px);
  overflow-y: auto;
  overflow-x: hidden;
  word-break: break-word;
}

.jump-btn {
  position: sticky;
  top: 4px;
  float: right;
  z-index: 10;
  background: rgba(18, 159, 202, 0.15);
  border: 1px solid rgba(18, 159, 202, 0.4);
  border-radius: 4px;
}

.log-empty {
  color: #555;
  font-style: italic;
  padding: 20px 0;
  text-align: center;
}

.log-entry {
  padding: 1px 0;
}

.log-time {
  color: #666;
  margin-right: 6px;
}

.log-level {
  font-weight: bold;
  margin-right: 6px;
  display: inline-block;
  min-width: 42px;
}

.log-source {
  color: #888;
  margin-right: 6px;
}

.log-msg {
  color: #ccc;
}

.log-error .log-level {
  color: #ff5252;
}
.log-error .log-msg {
  color: #ff8a80;
}

.log-warn .log-level {
  color: #ffab40;
}
.log-warn .log-msg {
  color: #ffd180;
}

.log-info .log-level {
  color: #69f0ae;
}
.log-info .log-msg {
  color: #ccc;
}
</style>
