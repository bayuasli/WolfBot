import { deepAIChat, models } from '#lib/scrape/deepai.js';

export default {
  name: 'deepai',
  category: 'ai',
  command: ['deepai', 'dai'],
  alias: ['ai'],
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
      if (!m.text) {
        return m.reply(
          'DeepAI Chat\n\n' +
          'Usage: .deepai <question>\n' +
          'Model: ' + models.join(', ') + '\n\n' +
          'Contoh: .deepai apa itu javascript'
        );
      }

      const args = m.text.split(' ');
      let model = 'standard';
      let prompt = m.text;

      if (args.length > 1) {
        const lastArg = args[args.length - 1];
        if (models.includes(lastArg)) {
          model = lastArg;
          prompt = args.slice(0, -1).join(' ');
        }
      }

      const response = await deepAIChat([{ role: 'user', content: prompt }], {
        model: model,
        stream: true
      });

      const responseText = response.length > 4096
        ? response.slice(0, 4096) + '\n\n... (pesan terpotong)'
        : response;

      return m.reply(
        'DeepAI\n' +
        'Model: ' + model + '\n\n' +
        responseText
      );

    } catch (err) {
      console.error('DeepAI Error:', err);
      return m.reply('Error: ' + err.message);
    }
  }
};