import { Toolkit } from '#helper';

export default {
  name: 'cdnwa2',
  category: 'uploader',
  command: ['cdnwa2', 'urlwa'],
  alias: ['tourlwa'],

  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m, { downloadM, ctx }) => {
    const isMedia = m.isMedia || m.isQuoted && m.quoted.isMedia
    if (!isMedia) {
      return m.reply('Reply or send a media file with this command')
    }

    try {
      const buffer = await downloadM()
      if (!buffer || buffer.length === 0) {
        return m.reply('Failed to download media buffer')
      }

      const cdnUrl = await Toolkit.toUrl(conn, buffer)
      return m.reply(cdnUrl)
    } catch (error) {
      console.error(error)
      return m.reply('Error processing media upload to WhatsApp CDN')
    }
  }
}