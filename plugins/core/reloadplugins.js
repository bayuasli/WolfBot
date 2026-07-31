export default {
  name: 'reloadplugins',
  category: 'core',
  command: ['reload', 'rlp'],
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
    if (!global.pluginLoader) {
      return m.reply('Plugin loader tidak tersedia.')
    }

    const result = await global.pluginLoader.reload()

    if (typeof global.reloadHandler === 'function') {
      await global.reloadHandler()
    }

    let text =
      `PLUGIN BERHASIL DI RELOAD.\n\n` +
      `TOTAL PLUGINS YANG BERHASIL DI RELOAD: ${result.success}\n` +
      `GAGAL RELOAD: ${result.failed}`

    if (result.failed > 0) {
      const list = result.errors.map(f => `• ${f.replace(process.cwd(), '')}`).join('\n')
      text += `\n\nDaftar gagal:\n${list}`
    }

    return m.reply(text)
  }
}