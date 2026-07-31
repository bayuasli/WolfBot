
import { themeManager } from '#lib/system/theme-manager.js';
import { prepareWAMessageMedia } from 'baileys';

export default {
  name: 'theme-manager',
  category: 'core',
  command: ['theme', 'settheme'],
  alias: ['th'],
  settings: {
    owner: true,
    loading: false
  },

  run: async (conn, m) => {
    const args = m.args || [];
    const subCmd = args[0]?.toLowerCase();
    const value = args.slice(1).join(' ');

    if (!subCmd) {
      const config = themeManager.getData();
      return m.reply(
        'THEME MANAGER\n\n' +
        'Panduan Lengkap:\n\n' +
        '1. SET FAVICON / ICON\n' +
        '   Reply gambar dengan perintah:\n' +
        '   .theme icon\n' +
        '   Atau kirim URL gambar:\n' +
        '   .theme icon https://example.com/icon.jpg\n\n' +
        '2. SET TITLE\n' +
        '   .theme title Z3PHWOLF BOT\n\n' +
        '3. SET DESCRIPTION\n' +
        '   .theme desc WhatsApp Bot Multi-Device\n\n' +
        '4. SET URL\n' +
        '   .theme url https://github.com/bayuasli\n\n' +
        '5. RESET KE DEFAULT\n' +
        '   .theme reset\n\n' +
        '6. CEK KONFIGURASI SAAT INI\n' +
        '   .theme\n\n' +
        'CURRENT CONFIG:\n' +
        '────────────────\n' +
        'Title : ' + (config.title || 'not set') + '\n' +
        'Desc  : ' + (config.description || 'not set') + '\n' +
        'Url   : ' + (config.url || 'not set') + '\n' +
        'Icon  : ' + (config.favicon ? 'set' : 'not set')
      );
    }

    try {
      let result;

      if (subCmd === 'icon' || subCmd === 'favicon') {
        const quoted = m.isQuoted ? m.quoted : null;
        let imageUrl = value;

        if (quoted && quoted.isMedia) {
          const mime = quoted.msg?.mimetype || '';
          if (mime.startsWith('image/')) {
            const buffer = await quoted.download();
            const { imageMessage } = await prepareWAMessageMedia(
              { image: buffer },
              {
                upload: conn.waUploadToServer,
                mediaTypeOverride: 'thumbnail-link'
              }
            );
            result = await themeManager.setFavicon({
              thumbnailDirectPath: imageMessage.directPath,
              thumbnailSha256: imageMessage.fileSha256,
              thumbnailEncSha256: imageMessage.fileEncSha256,
              mediaKey: imageMessage.mediaKey,
              mediaKeyTimestamp: imageMessage.mediaKeyTimestamp
            });
          } else {
            return m.reply('Reply gambar yang valid');
          }
        } else if (imageUrl && /^https?:\/\//.test(imageUrl)) {
          const { imageMessage } = await prepareWAMessageMedia(
            { image: { url: imageUrl } },
            {
              upload: conn.waUploadToServer,
              mediaTypeOverride: 'thumbnail-link'
            }
          );
          result = await themeManager.setFavicon({
            thumbnailDirectPath: imageMessage.directPath,
            thumbnailSha256: imageMessage.fileSha256,
            thumbnailEncSha256: imageMessage.fileEncSha256,
            mediaKey: imageMessage.mediaKey,
            mediaKeyTimestamp: imageMessage.mediaKeyTimestamp
          });
        } else {
          return m.reply('Reply gambar atau kirim URL gambar\nContoh: .theme icon https://example.com/icon.jpg');
        }

        if (result.error) return m.reply('Error: ' + result.error);
        return m.reply('Success: ' + result.data);
      }

      switch (subCmd) {
        case 'title':
          result = await themeManager.setTitle(value);
          break;
        case 'desc':
        case 'description':
          result = await themeManager.setDescription(value);
          break;
        case 'url':
          result = await themeManager.setUrl(value);
          break;
        case 'reset':
        case 'nuke':
          result = await themeManager.nuke();
          break;
        default:
          return m.reply('Unknown command: ' + subCmd + '\n\nGunakan .theme untuk melihat panduan');
      }

      if (result.error) {
        return m.reply('Error: ' + result.error);
      }

      return m.reply('Success: ' + result.data);

    } catch (err) {
      return m.reply('Error: ' + err.message);
    }
  }
};