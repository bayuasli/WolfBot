import axios from 'axios';

async function publicai(q) {
   try {
      if (!q) return { author: 'SbyuXd', status: false, msg: 'Mana pertanyaannya?' };

      const id = (l = 16) => Array.from({ length: l }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
      
      const { data } = await axios.post('https://publicai.co/api/chat', {
         tools: {},
         id: id(),
         messages: [{
            id: id(),
            role: 'user',
            parts: [{ type: 'text', text: q }]
         }],
         trigger: 'submit-message'
      }, {
         headers: {
            'Origin': 'https://publicai.co',
            'Referer': 'https://publicai.co/chat',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
         }
      });

      const res = data.split('\n\n')
         .filter(v => v && !v.includes('[DONE]'))
         .map(v => JSON.parse(v.substring(6)))
         .filter(v => v.type === 'text-delta')
         .map(v => v.delta).join('');

      return {
         author: 'SbyuXd',
         status: true,
         result: res || 'Gagal, tidak ada respon'
      };
   } catch (e) {
      return { author: 'SbyuXd', status: false, msg: e.message };
   }
}

export default {
  name: "publicai",
  category: "ai",
  command: ["pubai", "publicai"],
  alias: ["aipublic"],
  
  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m, context) => {
    const { quoted } = context;
    const text = m.text || (quoted?.text || '');

    if (!text) {
      return m.reply(
        `PUBLIC AI\n\n` +
        `Cara Pakai:\n` +
        `.pubai pertanyaan\n\n` +
        `Contoh:\n` +
        `.pubai apa itu javascript\n` +
        `.pubai cara jadi developer`
      );
    }

    const result = await publicai(text);

    if (!result.status) {
      return m.reply(`Error: ${result.msg}`);
    }

    await m.reply(result.result);
  }
};