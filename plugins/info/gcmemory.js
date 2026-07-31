function getSize(obj) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function bar(pct, len = 10) {
  const filled = Math.round((pct / 100) * len)
  return `${'▰'.repeat(filled)}${'▱'.repeat(len - filled)}`
}

function medal(i) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return `${i + 1}.`
}

export default {
  name: 'gcmemory',
  category: 'info',
  command: ['gcmemory', 'gcmem', 'memgc'],
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
    const chats = conn.chats || {}
    const groups = Object.entries(chats).filter(([jid]) => jid.endsWith('@g.us'))

    if (!groups.length) return m.reply('Tidak ada data grup.')

    const ranked = groups
      .map(([jid, data]) => ({
        jid,
        name: data.subject || jid.split('@')[0],
        participants: data.participants?.length || 0,
        size: getSize(data)
      }))
      .sort((a, b) => b.size - a.size)

    const totalSize = ranked.reduce((acc, g) => acc + g.size, 0)
    const maxSize = ranked[0].size

    const top = ranked.slice(0, 20)

    let text =
      `╔══〔 *GROUP MEMORY STATS* 〕\n` +
      `║ 📦 Total Grup  : *${ranked.length}*\n` +
      `║ 🧠 Total Memori: *${formatBytes(totalSize)}*\n` +
      `╚══════════════════\n\n`

    for (let i = 0; i < top.length; i++) {
      const g = top[i]
      const pct = (g.size / maxSize) * 100
      const pctOfAll = ((g.size / totalSize) * 100).toFixed(1)

      text +=
        `${medal(i)} *${g.name}*\n` +
        `┃ \`${bar(pct)}\` ${pctOfAll}%\n` +
        `┃ 💾 ${formatBytes(g.size)}  👥 ${g.participants} member\n` +
        `┗━━━━━━━━━━━━━━━━\n`
    }

    if (ranked.length > 20) {
      text += `\n_...dan ${ranked.length - 20} grup lainnya tidak ditampilkan_`
    }

    await m.reply(text.trim())
  }
}