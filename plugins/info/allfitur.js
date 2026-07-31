import fs from 'fs/promises';
import path from 'path';

async function countJS(dir) {
  let total = 0;
  const list = await fs.readdir(dir, { withFileTypes: true });

  for (let file of list) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      total += await countJS(fullPath);
    } else if (file.name.endsWith('.js')) {
      total++;
    }
  }

  return total;
}

export default {
  name: 'totafitur',
  category: 'info',
  command: ['allfitur', 'ttf'],
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
    try {
      const pluginPath = path.resolve('./plugins');
      let totalPlugin = 0;

      try {
        totalPlugin = await countJS(pluginPath);
      } catch {}

      m.reply(
        '📦 *TOTAL FITUR BOT*\n\n' +
        '🔌 Total Plugin : ' + totalPlugin + '\n' +
        '✨ Total Semua : ' + totalPlugin
      );

    } catch (e) {
      m.reply('Error: ' + e.message);
    }
  }
};