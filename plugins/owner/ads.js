import {
  generateWAMessageFromContent,
  getContentType,
  downloadMediaMessage,
  extractMessageContent
} from 'baileys';
import sharp from 'sharp';
import crypto from 'crypto';
import axios from 'axios';

const settings = {
  title: 'Ad',
  body: 'sbyuxD !',
  defaultText: 'hY\n> pesan ini dikirim oleh Z3PH https://t.me/Z3PHRINE',
  image: 'https://raw.githubusercontent.com/bayuasli/sbyuxd-uploader/main/uploads/0875d7-1784786862439.jpg',
  sourceUrl: 'https://t.me/Z3PHRINE',
  sourceType: 'ad',
  sourceApp: 'sbyuxDapp',
  renderLargerThumbnail: true,
  showAdAttribution: true,
  containsAutoReply: true,
  automatedGreetingMessageShown: true,
  clickToWhatsappCall: true,
  adContextPreviewDismissed: false
};

export default {
  name: 'ads',
  category: 'owner',
  command: ['ads'],
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
    const text = m.text?.trim() || settings.defaultText;

    let thumbnailBuffer = null;

    const message = extractMessageContent(m.message);
    const type = getContentType(message);
    const quoted = message?.[type]?.contextInfo?.quotedMessage;

    if (quoted) {
      const quotedMessage = extractMessageContent(quoted);
      const quotedType = getContentType(quotedMessage);

      if (quotedType === 'imageMessage' || quotedType === 'videoMessage') {
        try {
          thumbnailBuffer = await downloadMediaMessage(
            { message: quoted },
            'buffer',
            {},
            {
              logger: conn.logger,
              reuploadRequest: conn.updateMediaMessage
            }
          );
        } catch {}
      }
    } else if (type === 'imageMessage' || type === 'videoMessage') {
      try {
        thumbnailBuffer = await downloadMediaMessage(
          m,
          'buffer',
          {},
          {
            logger: conn.logger,
            reuploadRequest: conn.updateMediaMessage
          }
        );
      } catch {}
    }

    if (!thumbnailBuffer) {
      try {
        const { data } = await axios.get(settings.image, {
          responseType: 'arraybuffer'
        });
        thumbnailBuffer = Buffer.from(data);
      } catch {}
    }

    const externalAdReply = {
      title: settings.title,
      body: settings.body,
      mediaType: 1,
      renderLargerThumbnail: settings.renderLargerThumbnail,
      showAdAttribution: settings.showAdAttribution,
      sourceUrl: settings.sourceUrl,
      sourceType: settings.sourceType,
      sourceApp: settings.sourceApp,
      mediaUrl: settings.image,
      thumbnailUrl: settings.image,
      originalImageUrl: settings.image,
      sourceId: Math.floor(Math.random() * 100000000000000).toString(),
      ctwaClid: crypto.randomBytes(32).toString('base64'),
      ref: crypto.randomBytes(8).toString('hex'),
      greetingMessageBody: text,
      containsAutoReply: settings.containsAutoReply,
      automatedGreetingMessageShown: settings.automatedGreetingMessageShown,
      clickToWhatsappCall: settings.clickToWhatsappCall,
      adContextPreviewDismissed: settings.adContextPreviewDismissed
    };

    if (thumbnailBuffer) {
      try {
        externalAdReply.thumbnail = (
          await sharp(thumbnailBuffer)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 40 })
            .toBuffer()
        ).toString('base64');
      } catch {}
    }

    const messageContent = generateWAMessageFromContent(
      m.chat,
      {
        extendedTextMessage: {
          text,
          contextInfo: {
            externalAdReply
          }
        }
      },
      {
        userJid: conn.user.id
      }
    );

    await conn.relayMessage(m.chat, messageContent.message, {
      messageId: messageContent.key.id
    });

    await conn.sendMessage(m.chat, {
      react: {
        text: '✅',
        key: m.key
      }
    });
  }
};