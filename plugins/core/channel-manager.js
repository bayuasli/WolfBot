export default {
  name: 'channel-manager',
  category: 'channel',
  command: ['ch', 'sl', 'saluran', 'channel'],
  alias: [],
  settings: {
    owner: true,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {
    const sub = (m.args[0] || '').toLowerCase()
    const rest = m.args.slice(1).join(' ')
    const prefix = m.prefix

    if (!sub) {
      return m.reply(
        `CHANNEL MANAGER\n\n` +
        `• ${prefix}ch create nama|deskripsi (reply gambar opsional)\n` +
        `• ${prefix}ch info link_channel\n` +
        `• ${prefix}ch subs link_channel\n` +
        `• ${prefix}ch follow link_channel\n` +
        `• ${prefix}ch unfollow link_channel\n` +
        `• ${prefix}ch mute link_channel\n` +
        `• ${prefix}ch unmute link_channel\n` +
        `• ${prefix}ch setname link_channel|nama baru\n` +
        `• ${prefix}ch setdesc link_channel|deskripsi baru\n` +
        `• ${prefix}ch setpic link_channel (reply gambar)\n` +
        `• ${prefix}ch delpic link_channel\n` +
        `• ${prefix}ch react link_channel|messageId|emoji\n` +
        `• ${prefix}ch fetch link_channel|count\n` +
        `• ${prefix}ch admincount link_channel\n` +
        `• ${prefix}ch transfer link_channel|newOwnerJid\n` +
        `• ${prefix}ch demote link_channel|adminJid\n` +
        `• ${prefix}ch delete link_channel`
      )
    }

    try {
      const getChannelId = async (input) => {
        if (!input) return null
        if (input.includes('https://whatsapp.com/channel/')) {
          const code = input.split('https://whatsapp.com/channel/')[1]
          const metadata = await conn.newsletterMetadata('invite', code)
          return metadata?.id || null
        }
        return input
      }

      if (sub === 'create') {
        const [name, description] = rest.split('|').map(s => s?.trim())
        if (!name) return m.reply(`Format: ${prefix}ch create nama|deskripsi`)

        let picture = null
        if (m.isQuoted && m.quoted.isMedia) {
          picture = await m.quoted.download()
        }

        const result = await conn.newsletterCreate(name, description || '')
        
        let channelId = result?.id || result?.newsletterId || result?.jid || null
        
        if (!channelId && result?.inviteCode) {
          const info = await conn.newsletterMetadata('invite', result.inviteCode)
          channelId = info?.id || null
        }

        return m.reply(
          `Channel berhasil dibuat.\n` +
          `Nama: ${name}\n` +
          `JID: ${channelId || 'Tidak diketahui'}\n` +
          `Invite Link: https://whatsapp.com/channel/${result?.inviteCode || '-'}`
        )
      }

      if (sub === 'info') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch info link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        const metadata = await conn.newsletterMetadata('jid', jid)
        if (!metadata) return m.reply('Channel tidak ditemukan')

        return m.reply(
          `INFO CHANNEL\n\n` +
          `Nama: ${metadata?.name || '-'}\n` +
          `Deskripsi: ${metadata?.description || '-'}\n` +
          `Subscriber: ${metadata?.subscribers || metadata?.subscriberCount || '-'}\n` +
          `Verified: ${metadata?.verification || '-'}\n` +
          `ID: ${metadata?.id || jid}`
        )
      }

      if (sub === 'subs') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch subs link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        const subscribers = await conn.newsletterSubscribers(jid)
        return m.reply(`Jumlah subscriber: ${subscribers?.subscribersCount || subscribers || '-'}`)
      }

      if (sub === 'follow') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch follow link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterFollow(jid)
        return m.reply('Berhasil follow channel.')
      }

      if (sub === 'unfollow') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch unfollow link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterUnfollow(jid)
        return m.reply('Berhasil unfollow channel.')
      }

      if (sub === 'mute') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch mute link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterMute(jid)
        return m.reply('Channel berhasil dimute.')
      }

      if (sub === 'unmute') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch unmute link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterUnmute(jid)
        return m.reply('Channel berhasil diunmute.')
      }

      if (sub === 'setname') {
        const parts = rest.split('|').map(s => s?.trim())
        if (parts.length < 2) return m.reply(`Format: ${prefix}ch setname link_channel|nama baru`)

        const input = parts[0]
        const name = parts.slice(1).join('|')

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterUpdateName(jid, name)
        return m.reply(`Nama channel berhasil diubah menjadi: ${name}`)
      }

      if (sub === 'setdesc') {
        const parts = rest.split('|').map(s => s?.trim())
        if (parts.length < 2) return m.reply(`Format: ${prefix}ch setdesc link_channel|deskripsi baru`)

        const input = parts[0]
        const description = parts.slice(1).join('|')

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterUpdateDescription(jid, description)
        return m.reply('Deskripsi channel berhasil diubah.')
      }

      if (sub === 'setpic') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch setpic link_channel (reply gambar)`)
        if (!m.isQuoted || !m.quoted.isMedia) return m.reply('Reply gambar untuk dijadikan foto channel.')

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        const buffer = await m.quoted.download()
        await conn.newsletterUpdatePicture(jid, buffer)
        return m.reply('Foto channel berhasil diperbarui.')
      }

      if (sub === 'delpic') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch delpic link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterRemovePicture(jid)
        return m.reply('Foto channel berhasil dihapus.')
      }

      if (sub === 'react') {
        const parts = rest.split('|').map(s => s?.trim())
        if (parts.length < 3) return m.reply(`Format: ${prefix}ch react link_channel|messageId|emoji`)

        const input = parts[0]
        const messageId = parts[1]
        const emoji = parts[2]

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterReactMessage(jid, messageId, emoji)
        return m.reply('Berhasil react pesan channel.')
      }

      if (sub === 'fetch') {
        const parts = rest.split('|').map(s => s?.trim())
        if (parts.length < 1) return m.reply(`Format: ${prefix}ch fetch link_channel|count`)

        const input = parts[0]
        const count = parseInt(parts[1]) || 10

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        const messages = await conn.newsletterFetchMessages(jid, count)

        if (!messages?.length) return m.reply('Tidak ada pesan ditemukan.')

        const text = messages.slice(0, 10).map((msg, i) =>
          `${i + 1}. ${msg.message?.extendedTextMessage?.text || msg.message?.conversation || '(media)'}`
        ).join('\n')

        return m.reply(`PESAN TERBARU CHANNEL\n\n${text}`)
      }

      if (sub === 'admincount') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch admincount link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        const count = await conn.newsletterAdminCount(jid)
        return m.reply(`Jumlah admin: ${count?.adminCount || count || '-'}`)
      }

      if (sub === 'transfer') {
        const parts = rest.split('|').map(s => s?.trim())
        if (parts.length < 2) return m.reply(`Format: ${prefix}ch transfer link_channel|newOwnerJid`)

        const input = parts[0]
        const newOwnerJid = parts[1]

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterChangeOwner(jid, newOwnerJid)
        return m.reply('Kepemilikan channel berhasil dipindahkan.')
      }

      if (sub === 'demote') {
        const parts = rest.split('|').map(s => s?.trim())
        if (parts.length < 2) return m.reply(`Format: ${prefix}ch demote link_channel|adminJid`)

        const input = parts[0]
        const adminJid = parts[1]

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterDemote(jid, adminJid)
        return m.reply('Admin berhasil didemote.')
      }

      if (sub === 'delete') {
        const input = rest.trim()
        if (!input) return m.reply(`Format: ${prefix}ch delete link_channel`)

        let jid = await getChannelId(input)
        if (!jid) return m.reply('Channel tidak ditemukan')

        await conn.newsletterDelete(jid)
        return m.reply('Channel berhasil dihapus.')
      }

      return m.reply(`Subcommand tidak dikenal. Ketik ${prefix}ch untuk lihat daftar perintah.`)
    } catch (e) {
      console.error('[channelmanager]', e)
      return m.reply('Gagal: ' + e.message)
    }
  }
}