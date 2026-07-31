export default {
  name: 'groupmanager',
  category: 'group',
  command: ['dem', 'prom', 'add', 'dor', 'close', 'open'],
  alias: [],

  settings: {
    owner: false,
    private: false,
    group: true,
    admin: true,
    botAdmin: true,
    loading: false
  },

  run: async (conn, m, { metadata }) => {
    function resolveTarget(user) {
      return metadata.participants.find(p =>
        p.phoneNumber === user || p.id === user || conn.getJid(p.id) === user
      )
    }

    if (m.command === 'dem' || m.command === 'prom' || m.command === 'dor') {
      let user = ''
      if (m.isQuoted) user = m.quoted.sender
      else if (m.mentions?.[0]) user = m.mentions[0]
      else if (m.text) user = conn.getJid(m.text.replace(/[^0-9]/g, '') + '@s.whatsapp.net')

      if (!user) return m.reply('Reply / tag member yang dituju')

      const target = resolveTarget(user)
      if (!target) return m.reply('Target tidak berada dalam Grup !')

      const actionMap = { dem: 'demote', prom: 'promote', dor: 'remove' }
      const labelMap = { dem: 'demote', prom: 'promote', dor: 'kick' }
      const action = actionMap[m.command]

      try {
        await conn.groupParticipantsUpdate(m.chat, [target.id], action)
        return m.reply(`Berhasil ${labelMap[m.command]}`)
      } catch (e) {
        return m.reply(`Gagal ${labelMap[m.command]}: ` + e.message)
      }
    }

    if (m.command === 'add') {
      const numbers = (m.text || '').match(/\d{8,15}/g)
      if (!numbers || numbers.length === 0) return m.reply('Masukkan nomor yang ingin ditambahkan.\nContoh: .add 628123456789')

      const jids = numbers.map(n => n + '@s.whatsapp.net')

      try {
        const result = await conn.groupParticipantsUpdate(m.chat, jids, 'add')

        const text = result.map(r => {
          const status = r.status === '200' ? '✅ Berhasil' : `❌ Gagal (${r.status})`
          return `${r.jid.split('@')[0]}: ${status}`
        }).join('\n')

        return m.reply(text || 'Berhasil menambahkan member.')
      } catch (e) {
        return m.reply('Gagal menambahkan member: ' + e.message)
      }
    }

    if (m.command === 'close' || m.command === 'open') {
      const setting = m.command === 'close' ? 'announcement' : 'not_announcement'
      const label = m.command === 'close' ? 'ditutup (hanya admin yang bisa chat)' : 'dibuka (semua member bisa chat)'

      try {
        await conn.groupSettingUpdate(m.chat, setting)
        return m.reply(`Grup berhasil ${label}.`)
      } catch (e) {
        return m.reply('Gagal mengubah pengaturan grup: ' + e.message)
      }
    }
  }
}