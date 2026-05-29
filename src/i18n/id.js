export default {
  buttons: {
    // All button text is uppercased in the gui
    advanced: "LANJUTAN",
    transactions: "TRANSAKSI",
    all: "SEMUA",
    back: "KEMBALI",
    browse: "TELUSURI",
    cancel: "BATAL",
    change: "UBAH",
    check: "PERIKSA",
    clear: "BERSIHKAN",
    close: "TUTUP",
    contacts: "KONTAK",
    copyAddress: "SALIN ALAMAT",
    copyData: "SALIN DATA",
    copySignature: "SALIN BUKTI",
    createWallet: "BUAT DOMPET",
    decrypt: "DEKRIPSI",
    delete: "HAPUS",
    edit: "UBAH",
    export: "EKSPOR",
    generate: "BUAT",
    import: "IMPOR",
    importWallet: "IMPOR DOMPET | IMPOR DOMPET",
    ons: "XEQMLABS NAME SERVICE",
    max: "MAKS",
    min: "MIN",
    next: "BERIKUTNYA",
    openWallet: "BUKA DOMPET",
    purchase: "BELI",
    receive: "TERIMA",
    registerServiceNode: "DAFTARKAN NODE LAYANAN",
    renew: "PERPANJANG",
    rescan: "PINDAI ULANG",
    restoreWallet: "PULIHKAN DOMPET",
    save: "SIMPAN",
    saveTxNotes: "SIMPAN CATATAN TX",
    selectLocation: "PILIH LOKASI",
    selectWalletFile: "PILIH BERKAS DOMPET",
    send: "KIRIM",
    sendCoins: "KIRIM KOIN",
    serviceNode: "NODE LAYANAN",
    networkStats: "STATISTIK JARINGAN",
    refresh: "SEGARKAN",
    settings: "PENGATURAN",
    showQRCode: "TAMPILKAN KODE QR",
    showTxDetails: "TAMPILKAN RINCIAN TX",
    sign: "TANDATANGANI",
    stake: "STAKE",
    sweepAll: "SABU BERSIH SEMUA",
    unlock: "Buka Kunci",
    update: "PERBARUI",
    verify: "VERIFIKASI",
    viewOnExplorer: "LIHAT DI EXPLORER"
  },
  dialog: {
    // Generic buttons
    buttons: {
      ok: "OK",
      cancel: "BATAL",
      open: "BUKA"
    },

    // Dialogs
    banPeer: {
      title: "Blokir peer",
      peerDetailsTitle: "Rincian peer",
      message: "Masukkan durasi blokir peer dalam detik.\nBawaan 3600 = 1 jam.",
      ok: "Blokir peer"
    },
    copyAddress: {
      title: "Salin alamat",
      message:
        "Ada ID pembayaran yang terkait dengan alamat ini.\nPastikan untuk menyalin ID pembayaran secara terpisah."
    },
    copyPrivateKeys: {
      // Copy {seedWords/viewKey/spendKey}
      title: "Salin {type}",
      message:
        "Berhati-hatilah kepada siapa Anda mengirimkan kunci privat Anda karena kunci tersebut mengendalikan dana Anda.",
      seedWords: "Kata Sandi Mnemonic (Seed Words)",
      viewKey: "Kunci View (View Key)",
      spendKey: "Kunci Spend (Spend Key)"
    },
    deleteWallet: {
      title: "Hapus dompet",
      message:
        "Apakah Anda benar-benar yakin ingin menghapus dompet Anda?\nPastikan Anda telah mencadangkan kunci privat Anda.\nPROSES INI TIDAK DAPAT DIBATALKAN!",
      ok: "HAPUS"
    },
    exit: {
      title: "Keluar",
      message: "Apakah Anda yakin ingin keluar?",
      ok: "KELUAR"
    },
    exportTransfers: {
      title: "Ekspor Transfer ke CSV",
      message: "Apakah Anda ingin mengekspor transfer?",
      export: "Ekspor"
    },
    keyImages: {
      title: "Gambar kunci {type}",
      message: "Apakah Anda ingin {type} gambar kunci?",
      export: "Ekspor",
      import: "Impor"
    },
    onsUpdate: {
      title: "Perbarui catatan ONS",
      message: "Apakah Anda ingin memperbarui catatan ONS?",
      ok: "PERBARUI"
    },
    noPassword: {
      title: "Kata sandi belum diatur",
      message: "Apakah Anda yakin ingin membuat dompet tanpa kata sandi?",
      ok: "YA"
    },
    password: {
      title: "Kata Sandi",
      message: "Masukkan kata sandi dompet untuk melanjutkan."
    },
    purchase: {
      title: "Beli nama",
      message: "Apakah Anda ingin membeli nama ini?",
      ok: "BELI"
    },
    renew: {
      title: "Perpanjang nama",
      message: "Apakah Anda ingin memperpanjang nama ini?",
      ok: "PERPANJANG"
    },
    registerServiceNode: {
      title: "Daftarkan node layanan",
      message: "Apakah Anda ingin mendaftarkan node layanan?",
      ok: "DAFTARKAN"
    },
    rescan: {
      title: "Pindai ulang dompet",
      message:
        "Peringatan: Beberapa informasi mengenai transaksi sebelumnya\nseperti alamat penerima akan hilang.",
      ok: "PINDAI ULANG"
    },
    restart: {
      title: "Mulai Ulang",
      message: "Perubahan memerlukan mulai ulang. Apakah Anda ingin memulai ulang sekarang?",
      ok: "MULAI ULANG"
    },
    showPrivateKeys: {
      title: "Tampilkan kunci privat",
      message: "Apakah Anda ingin melihat kunci privat Anda?",
      ok: "TAMPILKAN"
    },
    signature: {
      title: "Tanda tangan",
      message:
        "Salin data yang ditandatangani oleh kunci privat alamat utama Anda di bawah ini"
    },
    stake: {
      title: "Stake",
      message: "Apakah Anda ingin melakukan staking?",
      ok: "STAKE"
    },
    sweepAll: {
      title: "Sapu bersih semua",
      message: "Apakah Anda ingin menyapu bersih semua dana?",
      ok: "SAPU BERSIH SEMUA"
    },
    sweepAllWarning: {
      title: "Peringatan sapu bersih semua",
      message:
        "Anda akan menggabungkan semua dana Anda yang belum terpakai dengan mengirimkan transaksi ke diri Anda sendiri, dompet Anda mungkin akan menampilkan saldo 0 untuk sementara waktu, setelah 10 blok dana Anda akan terbuka kembali dan Anda dapat melakukan staking seperti biasa.",
      ok: "LANJUTKAN"
    },
    switchWallet: {
      title: "Ganti dompet",
      closeMessage: "Apakah Anda yakin ingin menutup dompet saat ini?",
      restartMessage:
        "RPC dompet saat ini sedang menyinkronkan. \nJika Anda ingin mengganti dompet, Anda harus memulai ulang aplikasi. \ Anda akan kehilangan progres sinkronisasi dan harus memindai ulang blockchain dari awal.",
      restartWalletMessage:
        "Jika Anda ingin mengganti dompet, Anda harus memulai ulang aplikasi. Apakah Anda yakin ingin menutup dompet saat ini dan memulai ulang?"
    },
    transactionDetails: {
      title: "Rincian transaksi",
      ok: "TUTUP"
    },
    transfer: {
      title: "Transfer",
      message: "Apakah Anda ingin mengirim transaksi ini?",
      ok: "KIRIM"
    },
    confirmTransaction: {
      title: "Konfirmasi transaksi",
      sendTo: "Kirim ke",
      priority: "Prioritas"
    },
    unlockConfirm: {
      title: "Konfirmasi buka kunci",
      ok: "BUKA KUNCI"
    },
    unlockServiceNode: {
      title: "Buka kunci node layanan",
      confirmTitle: "Konfirmasi buka kunci",
      message: "Apakah Anda ingin membuka kunci node layanan?",
      ok: "BUKA KUNCI"
    },
    unlockServiceNodeWarning: {
      title: "Peringatan buka kunci node layanan",
      message:
        "Membuka kunci sebagian stake pada suatu node juga akan membatalkan staking bagi peserta lainnya, jika melakukan staking di node bersama, sebaiknya beri tahu operator dan peserta lain bahwa Anda membatalkan staking.",
      ok: "LANJUTKAN"
    }
  },
  fieldLabels: {
    // Field labels are also all uppercased
    address: "ALAMAT",
    amount: "JUMLAH",
    backupOwner: "PEMILIK CADANGAN",
    confirmPassword: "KONFIRMASI KATA SANDI",
    daemonLogLevel: "TINGKAT LOG DAEMON",
    daemonP2pPort: "PORT P2P DAEMON",
    data: "DATA",
    dataStoragePath: "JALUR PENYIMPANAN DATA (LOKASI BERKAS BLOCKCHAIN)",
    decryptRecord: "DEKRIPSI CATATAN",
    exportTransfers: {
      exportDirectory: "DIREKTORI EKSPOR CSV"
    },
    filter: "FILTER",
    filterTransactionType: "FILTER BERDASARKAN JENIS TRANSAKSI",
    internalWalletPort: "PORT DOMPET INTERNAL",
    keyImages: {
      exportDirectory: "DIREKTORI EKSPOR GAMBAR KUNCI",
      importFile: "BERKAS IMPOR GAMBAR KUNCI"
    },
    limitDownloadRate: "BATASI KECEPATAN UNDUH",
    limitUploadRate: "BATASI KECEPATAN UNGGAH",
    onsType: "JENIS CATATAN ONS",
    localDaemonIP: "IP DAEMON LOKAL",
    localDaemonPort: "PORT DAEMON LOKAL",
    lokinetFullAddress: "ALAMAT LENGKAP LOKINET",
    maxIncomingPeers: "MAKSIMAL PEER MASUK",
    maxOutgoingPeers: "MAKSIMAL PEER KELUAR",
    message: "PESAN",
    mnemonicSeed: "MNEMONIC SEED",
    name: "NAMA",
    newWalletName: "NAMA DOMPET BARU",
    notes: "CATATAN",
    optional: "OPSIONAL",
    owner: "PEMILIK",
    password: "KATA SANDI",
    paymentId: "ID PEMBAYARAN",
    priority: "PRIORITAS",
    remoteNodeHost: "HOST NODE JARAK JAUH (REMOTE)",
    remoteNodePort: "PORT NODE JARAK JAUH (REMOTE)",
    restoreFromBlockHeight: "PULIHKAN DARI KETINGGIAN BLOK",
    restoreFromDate: "PULIHKAN DARI TANGGAL",
    seedLanguage: "BAHASA SEED",
    serviceNodeCommand: "PERINTAH NODE LAYANAN",
    serviceNodeKey: "KUNCI NODE LAYANAN",
    sessionId: "ID SESI",
    signature: "TANDA TANGAN",
    transactionId: "ID TRANSAKSI",
    walletAddress: "ALAMAT DOMPET",
    walletFile: "BERKAS DOMPET",
    walletLogLevel: "TINGKAT LOG DOMPET",
    walletName: "NAMA DOMPET",
    walletRPCPort: "PORT RPC DOMPET",
    walletStoragePath: "JALUR PENYIMPANAN DOMPET",

    // These are specific labels which do not get uppercased
    confirmNewPassword: "Konfirmasi Kata Sandi Baru",
    newPassword: "Kata Sandi Baru",
    oldPassword: "Kata Sandi Lama",
    rescanFullBlockchain: "Pindai ulang seluruh blockchain",
    rescanSpentOutputs: "Pindai ulang output yang terpakai",
    transactionNotes: "Catatan Transaksi",
    chooseNetwork: "Pilih Jaringan",
    network: "Jaringan"
  },
  footer: {
    ready: "SIAP",
    scanning: "MEMINDAI",
    status: "Status",
    syncing: "MENYINKRONKAN...",
    remote: "Jarak Jauh",
    wallet: "Dompet",
    updateRequired: "PERBARUAN DIPERLUKAN"
  },
  menuItems: {
    about: "Tentang",
    changePassword: "Ubah Kata Sandi",
    copyAddress: "Salin alamat",
    copyBackupOwner: "Salin pemilik cadangan",
    copyLokinetAddress: "Salin alamat lokinet",
    copyLokinetName: "Salin nama lokinet",
    copyName: "Salin nama",
    copyOwner: "Salin pemilik",
    copyQR: "Salin kode QR",
    copySeedWords: "Salin seed words",
    copySessionId: "Salin ID sesi",
    copySpendKey: "Salin spend key",
    copyServiceNodeKey: "Salin kunci node layanan",
    copyTransactionId: "Salin ID transaksi",
    copyViewKey: "Salin view key",
    createNewWallet: "Buat dompet baru",
    deleteWallet: "Hapus Dompet",
    exportTransfers: "Ekspor Transfer",
    exit: "Keluar dari Dompet GUI XEQM",
    importOldGUIWallet: "Impor dompet dari GUI lama",
    manageKeyImages: "Kelola Gambar Kunci",
    openWallet: "Buka dompet",
    rescanWallet: "Pindai Ulang Dompet",
    restoreWalletFile: "Pulihkan dompet dari berkas",
    restoreWalletSeed: "Pulihkan dompet dari seed",
    saveQR: "Simpan kode QR ke berkas",
    sendToThisAddress: "Kirim ke alamat ini",
    settings: "Pengaturan",
    showDetails: "Tampilkan rincian",
    showPrivateKeys: "Tampilkan Kunci Privat",
    showQRCode: "Tampilkan Kode QR",
    switchWallet: "Ganti Dompet",
    viewOnExplorer: "Lihat di explorer",
    refreshConnection: "Segarkan Koneksi RPC"
  },
  notification: {
    positive: {
      addressCopied: "Alamat disalin ke papan klip",
      backupOwnerCopied: "Pemilik cadangan disalin ke papan klip",
      bannedPeer: "Memblokir {host} hingga {time}",
      copied: "{item} disalin ke papan klip",
      decryptedONSRecord: "Berhasil mendekripsi Catatan ONS untuk {name}",
      exportTransfers: "Transfer diekspor ke {filename}",
      itemSaved: "{item} disimpan ke {filename}",
      keyImages: {
        exported: "Gambar kunci diekspor ke {filename}",
        imported: "Gambar kunci berhasil diimpor"
      },
      onsRecordUpdated: "Catatan ONS berhasil diperbarui",
      lokinetAddressCopied: "Alamat lengkap lokinet berhasil disalin",
      lokinetNameCopied: "Nama lokinet berhasil disalin",
      passwordUpdated: "Kata sandi diperbarui",
      namePurchased: "Nama berhasil dibeli",
      nameRenewed: "Nama berhasil diperpanjang",
      nameCopied: "Nama disalin ke papan klip",
      ownerCopied: "Pemilik disalin ke papan klip",
      qrCopied: "Kode QR disalin ke papan klip",
      registerServiceNodeSuccess: "Berhasil mendaftarkan node layanan",
      sendSuccess: "Transaksi berhasil dikirim",
      serviceNodeInfoFilled: "Kunci node layanan dan jumlah minimal telah diisi",
      sessionIdCopied: "ID Sesi disalin ke papan klip",
      signatureCopied: "Bukti transaksi disalin ke papan klip",
      signatureVerified: "Tanda tangan terverifikasi",
      stakeSuccess: "Staking berhasil",
      transactionNotesSaved: "Catatan transaksi disimpan",
      walletCopied: "Alamat dompet disalin ke papan klip"
    },
    errors: {
      banningPeer: "Gagal memblokir peer",
      cannotAccessRemoteNode:
        "Tidak dapat mengakses node jarak jauh, silakan coba node jarak jauh lainnya",
      changingPassword: "Gagal mengubah kata sandi",
      copyWalletFail: "Gagal menyalin dompet",
      copyingPrivateKeys: "Gagal menyalin kunci privat",
      dataPathNotFound: "Jalur penyimpanan data tidak ditemukan",
      decryptONSRecord: "Gagal mendekripsi Catatan ONS untuk {name}",
      differentNetType: "Node jarak jauh menggunakan jenis jaringan (nettype) yang berbeda",
      enterSeedWords: "Masukkan seed words",
      enterTransactionId: "Masukkan ID transaksi",
      enterTransactionProof: "Masukkan bukti transaksi",
      enterWalletName: "Masukkan nama dompet",
      enterName: "Masukkan nama",
      errorSavingItem: "Gagal menyimpan {item}",
      exportTransfers: "Gagal mengekspor transfer",
      failedServiceNodeUnlock: "Gagal membuka kunci node layanan",
      failedToSetLanguage: "Gagal mengatur bahasa: {lang}",
      failedWalletImport: "Gagal mengimpor dompet",
      failedWalletOpen: "Gagal membuka dompet. Silakan coba lagi.",
      failedWalletRead: "Gagal membaca dompet",
      internalError: "Kesalahan internal",
      invalidAddress: "Silakan gunakan alamat XEQM yang valid",
      invalidAmount: "Jumlah tidak valid",
      invalidBackupOwner: "Alamat pemilik cadangan tidak valid",
      invalidNameLength: "Panjang nama harus antara 1 hingga 64 karakter",
      invalidNameFormat:
        "Nama hanya boleh berisi alfanumerik, tanda hubung (-), dan garis bawah (_)",
      invalidNameHypenNotAllowed:
        "Nama hanya boleh diawali atau diakhiri dengan alfanumerik atau garis bawah",
      invalidOldPassword: "Kata sandi lama salah",
      invalidOwner: "Alamat pemilik tidak valid",
      invalidPassword: "Kata sandi tidak valid",
      invalidPaymentId: "ID pembayaran tidak valid",
      invalidPrivateViewKey: "Kunci privat view tidak valid",
      invalidPublicAddress: "Alamat publik tidak valid",
      invalidRestoreDate: "Tanggal pemulihan tidak valid",
      invalidRestoreHeight: "Ketinggian pemulihan tidak valid",
      invalidSeedLength: "Panjang kata seed tidak valid",
      invalidServiceNodeCommand:
        "Silakan masukkan perintah pendaftaran node layanan",
      invalidServiceNodeKey: "Kunci node layanan tidak valid",
      invalidSessionId: "ID Sesi tidak valid",
      invalidSignature: "Tanda tangan tidak valid",
      invalidWalletPath: "Jalur dompet tidak valid",
      keyImages: {
        exporting: "Gagal mengekspor gambar kunci",
        reading: "Gagal membaca gambar kunci",
        importing: "Gagal mengimpor gambar kunci"
      },
      negativeAmount: "Jumlah tidak boleh bernilai negatif",
      newPasswordNoMatch: "Kata sandi baru tidak cocok",
      newPasswordSame: "Kata sandi baru harus berbeda dengan kata sandi lama",
      notEnoughBalance: "Saldo yang tidak terkunci tidak mencukupi",
      passwordNoMatch: "Kata sandi tidak cocok",
      remoteCannotBeReached: "Daemon jarak jauh tidak dapat dijangkau",
      selectWalletFile: "Pilih sebuah berkas dompet",
      unknownError: "Terjadi kesalahan yang tidak diketahui",
      walletAlreadyExists: "Dompet dengan nama tersebut sudah ada",
      walletPathNotFound: "Jalur penyimpanan data dompet tidak ditemukan",
      zeroAmount: "Jumlah harus lebih besar dari nol"
    },
    warnings: {
      noExportTransfers: "Tidak ada transfer yang ditemukan untuk diekspor",
      noKeyImageExport: "Tidak ada gambar kunci yang ditemukan untuk diekspor",
      usingLocalNode: "Tidak dapat mengakses node jarak jauh, beralih ke node lokal saja",
      usingRemoteNode: "Daemon tidak ditemukan, menggunakan node jarak jauh"
    }
  },
  placeholders: {
    additionalNotes: "Catatan tambahan",
    addressBookName: "Nama yang memiliki alamat ini",
    addressOfSigner: "Alamat dompet publik dari penandatangan",
    dataToSign: "Data yang ingin Anda tandatangani dengan kunci privat alamat utama Anda",
    filterTx: "Masukkan ID, nama, alamat, atau jumlah",
    hexCharacters: "{count} karakter heksadesimal",
    onsName: "Nama yang akan dibeli melalui XEQMLabs Name Service",
    onsBackupOwner: "Alamat dompet milik pemilik cadangan",
    onsDecryptName: "Nama ONS yang Anda miliki",
    lokinetFullAddress:
      "Alamat lengkap lokinet untuk memetakan nama ONS (tanpa .loki)",
    mnemonicSeed: "25 (atau 24) kata mnemonic seed",
    pasteTransactionId: "Tempel ID transaksi",
    pasteTransactionProof: "Tempel bukti transaksi",
    proveOptionalMessage:
      "Pesan opsional yang digunakan sebagai dasar penandatanganan",
    recipientWalletAddress: "Alamat dompet penerima",
    selectAFile: "Silakan pilih berkas",
    sessionId: "ID Sesi untuk dihubungkan ke XEQMLabs Name Service",
    signature: "Tanda tangan untuk diverifikasi",
    transactionNotes: "Catatan tambahan untuk dilampirkan secara lokal pada transaksi",
    unsignedData: "Data sebagaimana mestinya sebelum ditandatangani",
    walletAddress: "Alamat dompet untuk memetakan nama ONS",
    walletName: "Nama untuk dompet Anda",
    walletPassword: "Kata sandi opsional untuk dompet"
  },
  strings: {
    addAddressBookEntry: "Tambah entri buku alamat",
    addressBookDetails: "Rincian buku alamat",
    addressBookIsEmpty: "Buku alamat kosong",
    addresses: {
      myPrimaryAddress: "Alamat utama saya",
      myUnusedAddresses: "Alamat saya yang belum digunakan",
      myUsedAddresses: "Alamat saya yang telah digunakan",
      primaryAddress: "Alamat utama",
      subAddress: "Sub-alamat",
      subAddressIndex: "Indeks {index}"
    },
    advancedOptions: "Opsi Lanjutan",
    awaitingConfirmation: "Menunggu konfirmasi",
    bannedPeers: {
      title: "Peer yang diblokir (blokir akan dihapus jika dompet dimulal ulang)",
      bannedUntil: "Diblokir hingga {time}"
    },
    blockHeight: "Tinggi Blok",
    cannotSign: "Anda tidak dapat menandatangani menggunakan dompet mode view-only (hanya pantau).",
    checkTransaction: {
      description:
        "Verifikasi bahwa dana telah dibayarkan ke suatu alamat dengan menyediakan ID transaksi, alamat penerima, pesan yang digunakan untuk menandatangani, dan tanda tangan.\nUntuk 'Bukti Belanja' (Spend Proof) Anda tidak perlu menyertakan alamat penerima.",
      infoTitles: {
        confirmations: "Konfirmasi",
        inPool: "Di dalam pool",
        validTransaction: "Transaksi valid",
        received: "Jumlah yang diterima"
      },
      validTransaction: {
        no: "TIDAK",
        yes: "YA"
      }
    },
    closing: "Menutup",
    connectingToBackend: "Menghubungkan ke backend",
    contribution: "Kontribusi",
    contributor: "Kontributor",
    daemon: {
      local: {
        title: "Hanya Daemon Lokal",
        description:
          "Keamanan penuh, dompet akan mengunduh seluruh blockchain. Anda tidak akan dapat bertransaksi hingga sinkronisasi selesai."
      },
      localRemote: {
        title: "Daemon Lokal + Jarak Jauh",
        description:
          "Mulai dengan cepat menggunakan opsi bawaan ini. Dompet akan mengunduh seluruh blockchain, tetapi menggunakan node jarak jauh selama proses sinkronisasi."
      },
      remote: {
        title: "Hanya Daemon Jarak Jauh",
        description:
          "Tingkat keamanan lebih rendah, dompet akan terhubung ke node jarak jauh untuk melakukan semua transaksi."
      }
    },
    destinationUnknown: "Tujuan Tidak Diketahui",
    editAddressBookEntry: "Ubah entri buku alamat",
    expirationHeight: "Tinggi masa kedaluwarsa",
    nextPayout: "Pembayaran berikutnya",
    ons: {
      sessionID: "ID Sesi",
      wallet: "Alamat Dompet",
      lokinetName1Year: "Nama Lokinet 1 tahun",
      lokinetNameXYears: "Nama Lokinet {years} tahun",
      prices: "Harga ONS:"
    },
    onsPurchaseDescription:
      "Beli atau perbarui catatan ONS. Jika Anda membeli nama, diperlukan waktu satu atau dua menit agar nama tersebut muncul dalam daftar.",
    onsDescription:
      "Di sini Anda dapat menemukan semua nama ONS yang dimiliki oleh dompet ini. Mendekripsi catatan yang Anda miliki akan mengembalikan nama dan nilai dari catatan ONS tersebut.",
    hardwareWallet: "Dompet perangkat keras (hardware wallet)",
    hardwareWallets: "Dompet perangkat keras (hardware wallets)",
    loadingSettings: "Memuat pengaturan",
    xeqmBalance: "Saldo",
    lokinetNameDescription:
      "Beli atau perbarui nama di Lokinet. Jika Anda membeli nama, diperlukan waktu satu atau dua menit agar nama tersebut muncul di daftar. Untuk mempelajari lebih lanjut tentang lokinet, kunjungi: ",
    xeqmAccumulatedRewards: "Akumulasi hadiah",
    xeqmUnlockedBalance: "Saldo tidak terkunci",
    xeqmUnlockedShort: "Terbuka",
    me: "Saya",
    noTransactionsFound: "Transaksi tidak ditemukan",
    notes: "Catatan",
    numberOfUnspentOutputs: "Jumlah output yang belum terpakai",
    operator: "Operator",
    paymentID: "ID Pembayaran",
    peerList: "Daftar peer",
    priorityOptions: {
      automatic: "Otomatis",
      slow: "Lambat",
      normal: "Normal",
      fast: "Cepat",
      fastest: "Tercepat",
      blink: "Blink"
    },

    proveTransactionDescription:
      "Buat bukti kriptografis dari suatu transaksi. Tempel ID Transaksi Anda dan alamat penerima di bawah ini, lalu klik Buat.",
    proveTransactionConfirmationNote:
      "Silakan tunggu setidaknya hingga 50 konfirmasi sebelum membuat bukti. Mencoba terlalu cepat dapat menyebabkan kegagalan.",
    readingWalletList: "Membaca daftar dompet",
    recentIncomingTransactionsToAddress:
      "Contoh transaksi masuk ke alamat ini",
    recentTransactionsWithAddress: "Transaksi terakhir dengan alamat ini",
    regularWallets: "Dompet biasa",
    rescanModalDescription:
      "Pilih pemindaian ulang penuh atau pemindaian ulang output yang terpakai saja.",
    saveSeedWarning: "Silakan salin dan simpan ini di lokasi yang aman!",
    saveToAddressBook: "Simpan ke buku alamat",
    seedWords: "Seed words",
    selectLanguage: "Pilih bahasa",
    serviceNodeContributionDescription:
      "Staking berkontribusi pada keamanan jaringan XEQMLabs. Atas kontribusi Anda, Anda akan mendapatkan XEQM. Setelah di-stake, Anda harus menunggu selama 15 atau 30 days agar XEQM Anda dapat dibuka kuncinya, tergantung pada apakah stake dibuka oleh kontributor atau karena node dihapus dari pendaftaran. Untuk mempelajari lebih lanjut tentang staking, silakan kunjungi dokumentasi di",
    serviceNodeRegistrationDescription:
      'Masukkan perintah {registerCommand} yang dihasilkan oleh daemon yang mendaftar untuk menjadi Node Layanan menggunakan perintah "{prepareCommand}"',
    serviceNodeStartStakingDescription:
      "Untuk mulai melakukan staking, silakan kunjungi tab Staking",
    noServiceNodesCurrentlyAvailable:
      "Saat ini tidak ada node layanan yang tersedia untuk kontribusi",
    serviceNodeDetails: {
      contributors: "Kontributor",
      lastRewardBlockHeight: "Tinggi blok hadiah terakhir",
      lastUptimeProof: "Bukti waktu aktif (uptime) terakhir",
      maxContribution: "Kontribusi maks",
      minContribution: "Kontribusi min",
      operatorFee: "Biaya Operator",
      registrationHeight: "Tinggi pendaftaran",
      unlockHeight: "Tinggi buka kunci",
      reserved: "Dipesan",
      serviceNodeKey: "Kunci Node Layanan",
      snKey: "Kunci SN",
      stakingRequirement: "Persyaratan staking",
      totalContributed: "Total kontribusi"
    },
    signAndVerifyDescription:
      "Tandatangani data dengan kunci privat alamat utama Anda atau verifikasi tanda tangan terhadap alamat publik.",
    spendKey: "Spend key",
    stake: "Staking",
    startingDaemon: "Memulai daemon",
    startingWallet: "Memulai dompet",
    switchToDateSelect: "Beralih ke pilihan tanggal",
    switchToHeightSelect: "Beralih ke pilihan ketinggian blok",
    syncingDaemon: "Menyinkronkan Daemon",
    transactionID: "ID Transaksi",
    transactionConfirmed: "terkonfirmasi",
    transactions: {
      amount: "Jumlah",
      description: "Transaksi {type}",
      fee: "Biaya",
      paidBySender: "dibayar oleh pengirim",
      received: "Diterima",
      sent: "Dikirim",
      sentTo: "Transaksi {type} dikirim ke",
      timestamp: "Stempel waktu",
      types: {
        all: "Semua",
        incoming: "Masuk",
        outgoing: "Keluar",
        pending: "Tertunda",
        pendingIncoming: "Masuk tertunda",
        pendingOutgoing: "Keluar tertunda",
        miner: "Penambang (Miner)",
        serviceNode: "Node Layanan",
        governance: "Tata Kelola (Governance)",
        stake: "Stake",
        failed: "Gagal"
      }
    },
    unlockingAtHeight: "Membuka kunci pada ketinggian {number}",
    unspentOutputs: "Output belum terpakai",
    userNotUsedAddress: "Anda belum menggunakan alamat ini",
    userUsedAddress: "Anda telah menggunakan alamat ini",
    viewKey: "View key",
    viewOnlyMode:
      "Mode view-only (hanya pantau). Silakan muat dompet penuh untuk dapat mengirim koin.",
    website: "situs web"
  },
  titles: {
    transactionSent: "Transaksi Dikirim",
    addressBook: "Buku alamat",
    addressDetails: "Rincian alamat",
    advanced: {
      checkTransaction: "PERIKSA TRANSAKSI",
      prove: "BUKTI",
      signAndVerify: "TANDATANGANI/VERIFIKASI",
      sign: "Tandatangani",
      verify: "Verifikasi"
    },
    availableForContribution: "Node layanan yang tersedia untuk kontribusi",
    changePassword: "Ubah kata sandi",
    configure: "Konfigurasi",
    currentlyStakedNodes: "Node yang saat ini di-stake",
    onsRecordDetails: "Rincian catatan ONS",
    onsSessionRecords: "Catatan sesi",
    onsLokinetRecords: "Catatan Lokinet",
    onsWalletRecords: "Catatan dompet",
    privateKeys: "Kunci privat",
    rescanWallet: "Pindai ulang dompet",
    ons: {
      purchase: "BELI",
      myOns: "ONS SAYA"
    },
    serviceNode: {
      registration: "PENDAFTARAN",
      staking: "STAKING",
      myStakes: "STAKE SAYA"
    },

    serviceNodeDetails: "Rincian node layanan",
    networkStats: "Statistik Jaringan",
    totalServiceNodes: "Total Node Layanan",
    activeServiceNodes: "Node Layanan Aktif",
    allServiceNodes: "Semua Node Layanan",
    settings: {
      title: "Pengaturan",
      tabs: {
        general: "Umum",
        language: "Bahasa",
        peers: "Peer",
        troubleshooting: "Pemecahan Masalah"
      }
    },
    transactionDetails: "Rincian transaksi",
    transactions: "Transaksi",
    wallet: {
      createNew: "Buat dompet baru",
      createdOrRestored: "Dompet berhasil dibuat/dipulihkan",
      importFromFile: "Impor dompet dari berkas",
      importFromOldGUI: "Impor dompet dari GUI lama",
      restoreFromSeed: "Pulihkan dompet dari seed",
      restoreViewOnly: "Pulihkan dompet view-only"
    },
    welcome: "Selamat Datang",
    yourWallets: "Dompet Anda"
  }
};
