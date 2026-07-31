import { ButtonV2 } from '#helper';

const modes = ['biasa', 'kontak', 'payment', 'loc', 'catalog', 'signup'];

export default {
  name: 'setreply',
  category: 'owner',
  command: ['setreply'],
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
    const mode = m.args[0]?.toLowerCase();
    const current = global.replyType || 'biasa';

    if (!mode) {
      const sections = [{
        title: 'Mode Reply',
        highlight_label: 'Pilih Mode',
        rows: modes.map(item => ({
          header: '',
          title: item.charAt(0).toUpperCase() + item.slice(1),
          description: item === current ? 'Mode aktif' : 'Ganti ke mode ' + item,
          id: '.setreply ' + item
        }))
      }];

      return new ButtonV2(conn)
        .setTitle('Set Reply Mode')
        .setSubtitle('Mode aktif: ' + current)
        .setBody('Pilih mode reply di bawah ini:')
        .setFooter(global.body || 'sbyuxD')
        .setThumbnail(global.thumbnailUrl)
        .addRawButton({
          buttonText: { displayText: '📋 Pilih Mode Reply' },
          buttonId: 'setreply_select',
          type: 1,
          nativeFlowInfo: {
            name: 'single_select',
            paramsJson: JSON.stringify({
              title: 'Pilih Mode Reply',
              sections: sections
            })
          }
        })
        .send(m.chat, { quoted: m });
    }

    if (!modes.includes(mode)) {
      return m.reply('Mode *' + mode + '* tidak tersedia.\n\nPilihan: ' + modes.join(', '));
    }

    if (mode === current) {
      return m.reply('Mode reply sudah *' + mode + '*.');
    }

    global.replyType = mode;
    return m.reply('Mode reply diubah ke *' + mode + '*.');
  }
};