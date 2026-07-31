
import AskMe from '#lib/scrape/askme.js';

const askMe = new AskMe();

export default {
  name: 'askme',
  category: 'ai',
  command: ['askme', 'ai'],
  alias: ['tanya', 'ask'],
  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {
    try {
      let image = null;
      let prompt = m.text || '';

      const quoted = m.isQuoted ? m.quoted : null;
      
      if (quoted && quoted.isMedia) {
        const mime = quoted.msg?.mimetype || '';
        if (mime.startsWith('image/')) {
          const buffer = await quoted.download();
          image = buffer;
        }
      }

      if (!prompt && !image) {
        return m.reply(
          'Askme AI\n' +
          'Usage: .askme <question>\n' +
          'Image: .askme <question> - reply image'
        );
      }

      const result = await askMe.chat(prompt || 'deskripsikan gambar ini', { image });

      const responseText = result.msg.length > 4096 
        ? result.msg.slice(0, 4096) + '\n\n... (pesan terpotong)'
        : result.msg;

      return m.reply(responseText);

    } catch (err) {
      console.error('AskMe Error:', err);
      return m.reply('Error: ' + err.message);
    }
  }
};