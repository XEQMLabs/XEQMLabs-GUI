export default [
  {
    path: "/",
    component: () => import("layouts/init/loading.vue"),
    children: [
      {
        path: "",
        component: () => import("pages/init/index.vue")
      },
      {
        path: "/quit",
        component: () => import("pages/init/quit.vue")
      }
    ]
  },
  {
    path: "/welcome",
    component: () => import("layouts/init/welcome.vue"),
    children: [
      {
        path: "",
        component: () => import("pages/init/welcome.vue")
      }
    ]
  },
  {
    path: "/wallet-select",
    component: () => import("layouts/wallet-select/main.vue"),
    children: [
      {
        path: "",
        name: "wallet-select",
        component: () => import("pages/wallet-select/index.vue")
      },
      {
        path: "create",
        name: "wallet-create",
        component: () => import("pages/wallet-select/create.vue")
      },
      {
        path: "restore",
        name: "wallet-restore",
        component: () => import("pages/wallet-select/restore.vue")
      },
      {
        path: "import-view-only",
        name: "wallet-import-view-only",
        component: () => import("pages/wallet-select/import-view-only.vue")
      },
      {
        path: "import",
        name: "wallet-import",
        component: () => import("pages/wallet-select/import.vue")
      },
      {
        path: "created",
        name: "wallet-created",
        component: () => import("pages/wallet-select/created.vue")
      },
      {
        path: "import-old-gui",
        name: "wallet-import-old-gui",
        component: () => import("pages/wallet-select/import-old-gui.vue")
      }
    ]
  },
  {
    path: "/wallet",
    component: () => import("layouts/wallet/main.vue"),
    children: [
      {
        path: "",
        component: () => import("pages/wallet/txhistory.vue")
      },
      {
        path: "receive",
        component: () => import("pages/wallet/receive.vue")
      },
      {
        path: "send",
        component: () => import("pages/wallet/send.vue")
      },
      {
        path: "addressbook",
        component: () => import("pages/wallet/addressbook.vue")
      },
      {
        path: "servicenode",
        component: () => import("pages/wallet/service-node.vue")
      },
      {
        path: "network-stats",
        component: () => import("pages/wallet/network-stats.vue")
      },
      {
        path: "ons",
        component: () => import("pages/wallet/ons.vue")
      },
      {
        path: "advanced",
        component: () => import("pages/wallet/advanced.vue")
      }
    ]
  },

  {
    path: "/:pathMatch(.*)*",
    component: () => import("pages/404.vue")
  }
];
