import fs from 'fs';
import path from 'path';
import { AIRich } from '#helper';

export default {
  name: 'getplugin',
  category: 'owner',
  command: ['gp', 'getplugin'],
  alias: ['gplugin'],

  settings: {
    owner: true,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {
    if (!m.text) {
      return m.reply(
        '📦 Ambil Plugin\n\n' +
        'Cara penggunaan:\n' +
        '• .gp tools/ping\n' +
        '• .gp bxx\n' +
        '• .gp ai/chatgpt'
      );
    }

    const input = m.text.trim();
    const baseDir = path.join(process.cwd(), 'plugins');
    let filePath = null;
    let pluginName = input;

    if (input.includes('/')) {
      filePath = path.join(baseDir, input + '.js');
      pluginName = input;
    } else {
      const folders = fs.readdirSync(baseDir);
      for (const folder of folders) {
        const possible = path.join(baseDir, folder, input + '.js');
        if (fs.existsSync(possible)) {
          filePath = possible;
          pluginName = folder + '/' + input;
          break;
        }
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return m.reply('❌ Plugin tidak ditemukan: ' + input);
    }

    const code = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const linesCount = code.split('\n').length;
    const fileSize = stats.size;

    const sizeText = fileSize < 1024 ? fileSize + ' B' :
                    fileSize < 1024 * 1024 ? (fileSize / 1024).toFixed(1) + ' KB' :
                    (fileSize / (1024 * 1024)).toFixed(1) + ' MB';

    const parts = pluginName.split('/');
    const folder = parts.length > 1 ? parts[0] : 'plugins';
    const fileName = parts.length > 1 ? parts[1] : pluginName;

    try {
      await new AIRich(conn)
        .setTitle('sbyuxD')
        .setFooter('© sbyuxD')
        .addSuggest('GetPlugin')
        .addSuggest(['plugins', folder, fileName])
        .addTip('📄 ' + pluginName + '.js | ' + linesCount + ' lines | ' + sizeText)
        .addProduct({
          title: pluginName + '.js',
          brand: 'sbyuxD Bot',
          price: 'Rp 0',
          sale_price: 'Rp 0',
          url: 'https://wa.me/6288228819127',
          image: 'https://img2.pixhost.to/images/9241/748114493_sbyuxd.jpg'
        })
        .addCode('javascript', code)
        .send(m.chat, { quoted: m });
    } catch (err) {
      console.error('[getplugin]', err);
      m.reply('❌ Gagal mengirim plugin: ' + err.message);
    }
  }
};