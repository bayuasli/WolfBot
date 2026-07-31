import { sendMixedButton, sendList, sendQuickReply, sendCopyButton } from '#lib/interactive.js'

const BASE = 'https://gomerch.kyuurzy.dev'
const api = (path) => fetch(BASE + path).then(r => r.json())

if (!global.gopaySession) global.gopaySession = new Map()

export default {
  name: 'gopay',
  category: 'payment',
  command: ['gopay'],

  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {
    const sub = m.args[0]?.toLowerCase()
    const session = global.gopaySession.get(m.sender) || {}
    const isLoggedIn = !!session.token

    if (!sub) return sendList(conn, m.chat, {
      title: 'GoPay Manager',
      body: `*GoPay Manager*\n\n*Status:* ${isLoggedIn ? '🟢 Login' : '🔴 Belum login'}\n\nPilih menu di bawah:`,
      footer: global.namebotz || 'Z3PH Bot',
      listTitle: 'Pilih Menu',
      sections: [
        {
          title: '🔐 Autentikasi',
          rows: [
            { title: 'Login', description: 'Masuk ke GoPay via OTP', id: '.gopay login' },
            { title: 'Logout', description: 'Hapus sesi tersimpan', id: '.gopay logout' }
          ]
        },
        {
          title: '💰 Keuangan',
          rows: [
            { title: 'Saldo', description: 'Lihat saldo & payout', id: '.gopay saldo' },
            { title: 'History', description: 'Lihat 5 transaksi terakhir', id: '.gopay history' }
          ]
        },
        {
          title: '📱 QRIS',
          rows: [
            { title: 'Buat QRIS', description: 'Generate QRIS dengan nominal', id: '.gopay qris' },
            { title: 'Cek Status', description: 'Cek apakah QRIS sudah dibayar', id: '.gopay status' }
          ]
        }
      ]
    }, { quoted: m })

    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } })

    try {
      if (sub === 'login') {
        const nomor = m.args[1]
        if (!nomor) return sendMixedButton(conn, m.chat, {
          title: 'GoPay — Login',
          body: '*Format:* .gopay login 08xxxxxxxxxx\n\nOTP akan dikirim ke nomor yang terdaftar di GoPay.',
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { type: 'copy', text: '📋 Contoh', code: '.gopay login 08123456789' }
          ]
        }, { quoted: m })

        const data = await api(`/api/gopay/otp?number=${nomor}`)
        if (!data.success) throw new Error(data.message || 'Gagal kirim OTP')

        global.gopaySession.set(m.sender, { ...session, otp_token: data.otp_token, nomor })
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return sendQuickReply(conn, m.chat, {
          title: 'GoPay — OTP Terkirim',
          body: `*Nomor:* ${nomor}\n\nOTP telah dikirim ke nomor kamu.\nVerifikasi dengan: .gopay verify <otp>`,
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { text: '✅ Sudah dapat OTP', id: '.gopay verify' }
          ]
        }, { quoted: m })
      }

      if (sub === 'verify') {
        const otp = m.args[1]
        if (!otp) return m.reply('*Usage:* .gopay verify <otp>')
        if (!session.otp_token) return m.reply('Login dulu dengan .gopay login <nomor>')

        const data = await api(`/api/gopay/verify?otp=${otp}&otp_token=${session.otp_token}`)
        if (!data.success) throw new Error(data.message || 'OTP salah atau kadaluarsa')

        global.gopaySession.set(m.sender, { ...session, token: data.token, refresh_token: data.refresh_token })
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return sendQuickReply(conn, m.chat, {
          title: 'GoPay — Login Berhasil ✅',
          body: `*Selamat datang!*\n\nSesi tersimpan. Gunakan menu di bawah:`,
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { text: '💰 Cek Saldo', id: '.gopay saldo' },
            { text: '📋 Riwayat', id: '.gopay history' }
          ]
        }, { quoted: m })
      }

      if (sub === 'logout') {
        global.gopaySession.delete(m.sender)
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return sendQuickReply(conn, m.chat, {
          title: 'GoPay — Logout',
          body: 'Sesi berhasil dihapus. Sampai jumpa! 👋',
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { text: '🔐 Login lagi', id: '.gopay login' }
          ]
        }, { quoted: m })
      }

      if (!isLoggedIn) return sendQuickReply(conn, m.chat, {
        title: 'GoPay — Belum Login',
        body: 'Kamu belum login. Login dulu untuk menggunakan fitur ini.',
        footer: global.namebotz || 'Z3PH Bot',
        buttons: [
          { text: '🔐 Login sekarang', id: '.gopay login' }
        ]
      }, { quoted: m })

      if (sub === 'refresh') {
        if (!session.refresh_token) throw new Error('Tidak ada refresh token.')
        const data = await api(`/api/gopay/refresh-token?refresh_token=${session.refresh_token}`)
        if (!data.success) throw new Error(data.message || 'Gagal refresh token')
        global.gopaySession.set(m.sender, { ...session, token: data.token, refresh_token: data.refresh_token })
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return m.reply('*Token berhasil diperbarui.* ✅')
      }

      if (sub === 'saldo') {
        const data = await api(`/api/gopay/payouts?token=${session.token}`)
        if (!data.success) throw new Error(data.message || 'Gagal ambil saldo')

        const info = data.data || {}
        const saldo = info.balance || info.saldo || '-'
        const nama = info.name || info.nama || '-'
        const nomor = info.phone || info.nomor || '-'

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return sendQuickReply(conn, m.chat, {
          title: 'GoPay — Saldo 💰',
          body: `*Informasi Akun*\n\n👤 Nama   : ${nama}\n📱 Nomor  : ${nomor}\n💵 Saldo  : Rp${Number(saldo).toLocaleString('id-ID')}`,
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { text: '📋 Riwayat Transaksi', id: '.gopay history' },
            { text: '📱 Buat QRIS', id: '.gopay qris' }
          ]
        }, { quoted: m })
      }

      if (sub === 'history') {
        const data = await api(`/api/gopay/history?token=${session.token}`)
        if (!data.success) throw new Error(data.message || 'Gagal ambil history')

        const list = (data.data || []).slice(0, 5)
        const text = list.length
          ? list.map((h, i) =>
              `*${i + 1}.* ${h.type || '-'}\n   💵 Rp${Number(h.amount || 0).toLocaleString('id-ID')}\n   📝 ${h.description || '-'}\n   🕐 ${h.created_at || '-'}`
            ).join('\n\n')
          : 'Tidak ada riwayat transaksi.'

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return sendQuickReply(conn, m.chat, {
          title: 'GoPay — Riwayat 📋',
          body: `*5 Transaksi Terakhir*\n\n${text}`,
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { text: '🔄 Refresh', id: '.gopay history' },
            { text: '💰 Cek Saldo', id: '.gopay saldo' }
          ]
        }, { quoted: m })
      }

      if (sub === 'qris') {
        const amount = m.args[1]
        if (!amount) return sendCopyButton(conn, m.chat, {
          title: 'GoPay — Buat QRIS 📱',
          body: '*Format:* .gopay qris <nominal>\n\n_Contoh: .gopay qris 50000_',
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { text: '📋 Copy Contoh', code: '.gopay qris 50000' }
          ]
        }, { quoted: m })

        const data = await api(`/api/gopay/create-qris?amount=${amount}&static_qr=`)
        if (!data.success) throw new Error(data.message || 'Gagal buat QRIS')

        const qrisData = data.qris || data.data || '-'
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return sendMixedButton(conn, m.chat, {
          title: 'GoPay — QRIS Berhasil ✅',
          body: `*QRIS Berhasil Dibuat*\n\n💵 Nominal  : Rp${Number(amount).toLocaleString('id-ID')}\n🕐 Dibuat   : ${data.created_at || '-'}\n\n*QRIS String:*\n${qrisData}`,
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { type: 'copy', text: '📋 Copy QRIS', code: qrisData },
            { type: 'reply', text: '🔍 Cek Status', id: `.gopay status ${amount} ${data.created_at || ''}` }
          ]
        }, { quoted: m })
      }

      if (sub === 'status') {
        const amount = m.args[1]
        const created_at = m.args[2]
        if (!amount || !created_at) return m.reply('*Usage:* .gopay status <nominal> <created_at>')

        const data = await api(`/api/gopay/qris-status?amount=${amount}&created_at=${created_at}&token=${session.token}`)
        if (!data.success) throw new Error(data.message || 'Gagal cek status')

        const status = data.data?.status || 'UNKNOWN'
        const isPaid = status === 'COMPLETED' || status === 'SUCCESS'

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
        return sendQuickReply(conn, m.chat, {
          title: `GoPay — Status ${isPaid ? '✅' : '⏳'}`,
          body: `*Status QRIS*\n\n${isPaid ? '✅ Sudah Dibayar' : '⏳ Belum Dibayar'}\n\n💵 Nominal : Rp${Number(amount).toLocaleString('id-ID')}\n📊 Status  : ${status}`,
          footer: global.namebotz || 'Z3PH Bot',
          buttons: [
            { text: '🔄 Refresh Status', id: `.gopay status ${amount} ${created_at}` },
            { text: '💰 Cek Saldo', id: '.gopay saldo' }
          ]
        }, { quoted: m })
      }

      return sendList(conn, m.chat, {
        title: 'GoPay',
        body: 'Sub-command tidak dikenal. Pilih menu di bawah:',
        footer: global.namebotz || 'Z3PH Bot',
        listTitle: 'Pilih Menu',
        sections: [
          {
            title: '🔐 Autentikasi',
            rows: [
              { title: 'Login', description: 'Masuk ke GoPay', id: '.gopay login' },
              { title: 'Logout', description: 'Keluar dari sesi', id: '.gopay logout' }
            ]
          },
          {
            title: '💰 Keuangan',
            rows: [
              { title: 'Saldo', description: 'Cek saldo GoPay', id: '.gopay saldo' },
              { title: 'History', description: 'Riwayat transaksi', id: '.gopay history' }
            ]
          },
          {
            title: '📱 QRIS',
            rows: [
              { title: 'Buat QRIS', description: 'Generate QRIS', id: '.gopay qris' },
              { title: 'Cek Status', description: 'Status QRIS', id: '.gopay status' }
            ]
          }
        ]
      }, { quoted: m })

    } catch (e) {
      await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
      return sendQuickReply(conn, m.chat, {
        title: 'GoPay — Error ❌',
        body: `*Terjadi kesalahan:*\n${e.message}`,
        footer: global.namebotz || 'Z3PH Bot',
        buttons: [
          { text: '🔄 Coba lagi', id: '.gopay' }
        ]
      }, { quoted: m })
    }
  }
}