<template>
  <q-layout view="hHh Lpr lFf">
    <q-header class="shift-title">
      <MainMenu />
      <q-toolbar-title>
        <div class="flex items-center justify-center" style="margin:8px; margin-left:0">
          <img src="Equilibria.svg" height="32" />
        </div>
      </q-toolbar-title>
    </q-header>

    <q-page-container>
      <WalletDetails />

      <div class="app-content">
        <div class="navigation row items-end">
          <router-link to="/wallet">
            <q-btn class="single-icon" size="md" icon="swap_horiz" />
          </router-link>
          <router-link to="/wallet/send">
            <q-btn
              class="large-btn"
              :label="$t('buttons.send')"
              size="md"
              icon-right="arrow_right_alt"
              align="between"
            />
          </router-link>
          <router-link to="/wallet/receive">
            <q-btn
              class="large-btn"
              :label="$t('buttons.receive')"
              size="md"
              icon-right="save_alt"
              align="between"
            />
          </router-link>
          <router-link to="/wallet/servicenode">
            <q-btn
              class="large-btn"
              :label="$t('buttons.serviceNode')"
              size="md"
              icon-right="router"
              align="between"
            />
          </router-link>
          <router-link to="/wallet/network-stats">
            <q-btn
              class="large-btn"
              :label="$t('buttons.networkStats')"
              size="md"
              icon-right="network_check"
              align="between"
            />
          </router-link>
          <!-- ONS (Equilibria Name Service) hidden - not applicable to XEQ
          <router-link to="/wallet/ons">
            <q-btn
              class="large-btn"
              :label="$t('buttons.ons')"
              size="md"
              icon-right="text_fields"
              align="between"
            />
          </router-link>
          -->
          <router-link to="/wallet/advanced">
            <q-btn
              class="large-btn"
              :label="$t('buttons.advanced')"
              size="md"
              icon-right="verified_user"
              align="between"
            />
          </router-link>
          <router-link to="/wallet/addressbook" class="address">
            <q-btn class="single-icon" size="md" icon="person" />
          </router-link>
        </div>
        <div class="hr-separator" />
        <router-view v-slot="{ Component }">
          <keep-alive :max="10">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>
    </q-page-container>

    <StatusFooter />
  </q-layout>
</template>

<script>
import { openURL } from "quasar";
import { mapState } from "vuex";
import WalletDetails from "components/wallet_details";
import StatusFooter from "components/footer";
import MainMenu from "components/menus/mainmenu";
export default {
  name: "LayoutDefault",
  components: {
    StatusFooter,
    MainMenu,
    WalletDetails
  },
  computed: mapState({
    theme: state => state.gateway.app.config.appearance.theme,
    info: state => state.gateway.wallet.info
  }),
  methods: {
    openURL
  }
};
</script>

<style lang="scss">
.navigation {
  padding: 8px 12px;

  > * {
    margin: 2px 0;
    margin-right: 12px;
  }

  > *:last-child {
    margin-right: 0px;
  }

  .address {
    margin-left: auto;
  }

  .single-icon {
    width: 38px;
    padding: 0;
  }

  a {
    text-decoration: none;
  }

  .large-btn {
    min-width: 160px;
    .q-btn-inner > *:last-child {
      margin-left: auto;
      padding-left: 16px;
    }
  }
}
</style>
