import { notrack } from '#scrape/notrack.js'

export default {
  name: 'wormgpt',
  category: 'ai',
  command: ['worm', 'wormgpt'],
  alias: [],

  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {
    const query = (m.text || '').trim()

    if (!query) {
      return m.reply(`Contoh:\n${m.prefix}WormGpt pertanyaan kamu`)
    }

    try {
      const result = await notrack(query)
      return m.reply(result.jawaban)
    } catch (e) {
      console.error('[WormGpt]', e)
      return m.reply('Gagal mendapat respons dari WormGpt: ' + e.message)
    }
  }
}