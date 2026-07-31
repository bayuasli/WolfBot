import {
  areJidsSameUser,
  delay,
  downloadMediaMessage,
  extractMessageContent,
  jidNormalizedUser,
  getDevice,
  generateMessageIDV2,
  generateWAMessage,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto
} from 'baileys';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import Func from '#lib/system/function.js';

const messId = generateMessageIDV2().slice(0, 4);

function getMessageById(conn, chat, id) {
  const msgs = conn.messages?.get(chat) || [];
  return msgs.find(m => m.id === id) || null;
}

async function getThumbnail() {
  try {
    const dir = path.join(process.cwd(), 'lib/media');
    
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .sort(); 

      if (files.length > 0) {
        const randomFile = files[Math.floor(Math.random() * files.length)];
        return fs.readFileSync(path.join(dir, randomFile));
      }
    }
  } catch (err) {
    console.error('Gagal memuat thumbnail random:', err.message);
  }
  return await Func.getBuffer(global.thumbnailUrl);
}

export function Client(conn) {
  const client = Object.defineProperties(conn, {
    getJid: {
      value(sender) {
        sender = jidNormalizedUser(sender);
        conn.isLid ??= new Map();
        if (conn.isLid.has(sender)) return conn.isLid.get(sender);
        if (!sender.endsWith('@lid')) return sender;
        for (const chat of Object.values(conn.chats)) {
          if (!chat?.participants) continue;
          const user = chat.participants.find(p => p.lid === sender || p.id === sender);
          if (user) {
            const jid = user?.phoneNumber || user?.jid || user?.id;
            conn.isLid.set(sender, jid);
            return jid;
          }
        }
        return sender;
      }
    },

    sendButton: {
      async value(jid, content = {}, options = {}) {
        let header = {};
        let mime = null;

        if (content.image) mime = 'image';
        else if (content.video) mime = 'video';
        else if (content.document) mime = 'document';

        if (mime) {
          const media = await prepareWAMessageMedia(
            { [mime]: content[mime] },
            { upload: conn.waUploadToServer }
          );
          header = {
            hasMediaAttachment: true,
            [`${mime}Message`]: media[`${mime}Message`]
          };
        }

        const msg = generateWAMessageFromContent(
          jid,
          {
            interactiveMessage: {
              header: { title: content.title || '', ...header },
              body: { text: content.body || content.text || content.caption || '' },
              footer: { text: content.footer || '' },
              nativeFlowMessage: {
                buttons: content.buttons || [],
                ...content
              },
              ...content
            }
          },
          { userJid: conn.user?.id, ...options }
        );

        await conn.relayMessage(jid, msg.message, {
          messageId: msg.key.id,
          additionalNodes: [
            {
              tag: 'biz',
              attrs: {},
              content: [
                {
                  tag: 'interactive',
                  attrs: { type: 'native_flow', v: '1' },
                  content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
                }
              ]
            }
          ]
        });

        return msg;
      }
    },

    getName: {
      value(jid) {
        jid = conn.getJid(jid);
        if (jid.endsWith('@g.us')) {
          return conn.chats[jid]?.subject;
        } else {
          for (const msgs of conn.messages.values()) {
            const msg = msgs.find(m => m.sender === jid);
            if (msg?.pushname) return msg.pushname;
          }
        }
        return jid.split('@')[0];
      }
    },

    parseMention: {
      value(text) {
        return (
          [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net') || []
        );
      }
    },

    getFile: {
      async value(PATH, saveToFile = false) {
        let filename;
        const data = Buffer.isBuffer(PATH)
          ? PATH
          : PATH instanceof ArrayBuffer
          ? Buffer.from(PATH)
          : /^data:.*?\/.*?;base64,/i.test(PATH)
          ? Buffer.from(PATH.split(',')[1], 'base64')
          : /^https?:\/\//.test(PATH)
          ? await Func.getBuffer(PATH)
          : fs.existsSync(PATH)
          ? ((filename = PATH), fs.readFileSync(PATH))
          : typeof PATH === 'string'
          ? Buffer.from(PATH)
          : Buffer.alloc(0);

        if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer');
        const type = (await fileTypeFromBuffer(data)) || { mime: 'application/octet-stream', ext: 'bin' };

        if (data && saveToFile && !filename) {
          filename = path.join(process.cwd(), `tmp/${Date.now()}.${type.ext}`);
          await fs.promises.writeFile(filename, data);
        }

        return { filename, ...type, data, deleteFile() { return filename && fs.promises.unlink(filename); } };
      },
      enumerable: true
    },

    downloadMediaMessage: {
      async value(message, filename) {
        const media = await downloadMediaMessage(message, 'buffer', {}, {
          logger: pino({
            timestamp: () => `,"time":"${new Date().toJSON()}"`,
            level: 'fatal'
          }).child({ class: 'hisoka' }),
          reuploadRequest: conn.updateMediaMessage
        });

        if (filename) {
          const mime = await fileTypeFromBuffer(media);
          const filePath = path.join(process.cwd(), `${filename}.${mime.ext}`);
          await fs.promises.writeFile(filePath, media);
          return filePath;
        }

        return media;
      },
      enumerable: true
    },

    sendAlbumMessage: {
      async value(jid, medias, options = {}) {
        const userJid = conn.user?.id || conn.authState?.creds?.me?.id;
        if (!Array.isArray(medias) || medias.length < 2) throw new Error('Album minimal berisi 2 media.');

        const validMedias = medias.filter(media => media.image || media.video);
        if (validMedias.length < 2) throw new Error('Album minimal berisi 2 media (image/video) yang valid.');

        const time = options.delay || 5000;
        if (options.quoted) options.ephemeralExpiration = options.quoted.expiration || 0;
        delete options.delay;

        const album = await generateWAMessageFromContent(jid, {
          albumMessage: {
            expectedImageCount: validMedias.filter(m => m.image).length,
            expectedVideoCount: validMedias.filter(m => m.video).length,
            ...options
          }
        }, { userJid, ...options });

        await conn.relayMessage(jid, album.message, { messageId: album.key.id });

        for (const media of validMedias) {
          let msg;
          if (media.image) {
            msg = await generateWAMessage(jid, { image: media.image, ...media, ...options }, {
              userJid,
              upload: async (r, o) => conn.waUploadToServer(r, o),
              ...options
            });
          } else if (media.video) {
            msg = await generateWAMessage(jid, { video: media.video, ...media, ...options }, {
              userJid,
              upload: async (r, o) => conn.waUploadToServer(r, o),
              ...options
            });
          }

          msg.message.messageContextInfo = {
            messageAssociation: {
              associationType: 1,
              parentMessageKey: album.key
            }
          };

          await conn.relayMessage(jid, msg.message, { messageId: msg.key.id });
          await delay(time);
        }
        return album;
      }
    },

    sendSticker: {
      async value(jid, filePath, m, options = {}) {
        const { data, mime } = await conn.getFile(filePath);
        if (data.length === 0) throw new TypeError('File tidak ditemukan');
        const exif = { packName: options.packname || global.stickpack, packPublish: options.packpublish || global.stickauth };
        const sticker = await (await import('#lib/exif.js')).writeExif({ mimetype: mime, data }, exif);
        return conn.sendMessage(jid, { sticker }, { quoted: m, ephemeralExpiration: m?.expiration });
      }
    },

    sendGroupV4Invite: {
      async value(groupJid, participant, inviteCode, inviteExpiration, groupName, caption, jpegThumbnail, options = {}) {
        const msg = generateWAMessageFromContent(participant, {
          groupInviteMessage: {
            inviteCode,
            inviteExpiration: parseInt(inviteExpiration) || Date.now() + 3 * 86400000,
            groupJid,
            groupName,
            jpegThumbnail,
            caption
          }
        }, { userJid: conn.user.id, ...options });

        await conn.relayMessage(participant, msg.message, { messageId: msg.key.id });
        return msg;
      },
      enumerable: true
    }
  });
  return client;
}

export default async function serialize(conn, msg) {
  if (!msg) return;
  const m = {};
  m.message = parseMessage(msg.message);

  if (msg.key) {
    m.key = msg.key;
    m.id = m.key.id;
    m.device = getDevice(m.id);
    m.isBot = m.id.startsWith(messId);
    m.isBot = m.id.startsWith(messId);
m.isBaileys = m.id?.startsWith('BAE5') && m.id?.length === 16 || false;
    m.chat = conn.getJid(m.key.remoteJid);
    m.isGroup = m.chat.endsWith('@g.us');
    m.sender = conn.getJid(m.key.participantAlt || m.key.participantPn || m.key.participant || m.chat);
    m.fromMe = m.key.fromMe || areJidsSameUser(m.sender, jidNormalizedUser(conn.user?.id));
  }

  m.pushname = msg.pushName;
  m.timesTamp = msg.messageTimestamp;

  if (m.message) {
    m.type = getContentType(m.message);
    m.msg = parseMessage(m.message[m.type]) || m.message[m.type];
    m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath;
    const mention = [...(m.msg?.contextInfo?.mentionedJid || []), ...(m.msg?.contextInfo?.groupMentions?.map(v => v.groupJid) || [])];
    m.mentions = mention.map(jid => conn.getJid(jid));
    m.body = m.msg?.text || m.msg?.conversation || m.msg?.caption || m.message?.conversation || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || m.msg?.name || '';

    m.prefix = '';
    m.args = m.body.trim().split(/ +/).slice(1);
    m.text = m.args.join(' ');
    m.command = m.body.trim().split(/ +/).shift() || '';
    m.cmd = m.command;

    m.expiration = m.msg?.contextInfo?.expiration || 0;
    if (m.isMedia) m.download = () => conn.downloadMediaMessage(m);
    m.isQuoted = false;

    if (m.msg?.contextInfo?.quotedMessage) {
      m.isQuoted = true;
      m.quoted = {};
      m.quoted.message = parseMessage(m.msg?.contextInfo?.quotedMessage);
      if (m.quoted.message) {
        m.quoted.type = getContentType(m.quoted.message) || Object.keys(m.quoted.message)[0];
        m.quoted.msg = parseMessage(m.quoted.message[m.quoted.type]) || m.quoted.message[m.quoted.type];
        m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath;
        m.quoted.key = {
          remoteJid: m.msg?.contextInfo?.remoteJid || m.chat,
          participant: jidNormalizedUser(m.msg?.contextInfo?.participant),
          fromMe: areJidsSameUser(conn.getJid(m.msg?.contextInfo?.participant), jidNormalizedUser(conn.user?.id)),
          id: m.msg?.contextInfo?.stanzaId
        };
        m.quoted.id = m.msg?.contextInfo?.stanzaId;
        m.quoted.device = getDevice(m.quoted.id);
        m.quoted.chat = /g\.us|status/.test(m.msg?.contextInfo?.remoteJid) ? m.quoted.key.participant : m.quoted.key.remoteJid;
        m.quoted.fromMe = m.quoted.key.fromMe;
        m.quoted.sender = conn.getJid(m.msg?.contextInfo?.participant || m.quoted.chat);
        const mentionQuoted = [...(m.quoted.msg?.contextInfo?.mentionedJid || []), ...(m.quoted.msg?.contextInfo?.groupMentions?.map(v => v.groupJid) || [])];
        m.quoted.mentions = mentionQuoted.map(jid => conn.getJid(jid));
        m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || '';
        m.quoted.args = m.quoted.body.trim().split(/ +/).slice(1);
        m.quoted.text = m.quoted.args.join(' ');
        if (m.quoted.isMedia) m.quoted.download = () => conn.downloadMediaMessage(m.quoted);
      }
    }
  }

  m.getQuotedMessage = async () => {
    if (!m.quoted?.id) return null;
    const cached = getMessageById(conn, m.chat, m.quoted.id);
    if (cached) return cached;
    try {
      const msg = await conn.loadMessage?.(m.chat, m.quoted.id);
      if (msg) return await serialize(conn, msg);
    } catch {}
    return null;
  };

  const ownerNumber = global.ownerNumber?.[0] || '628895307489';
  const ownername = global.namebot || 'Z3PHWFOLF ?';

m.reply = async (text, options = {}) => {
    try {
      const replyType = global.replyType || 'biasa';
    
      const thumbnail = await getThumbnail(); 

      const contactQuoted = {
        key: {
          participant: '0@s.whatsapp.net',
          ...(m.chat ? { remoteJid: 'status@broadcast' } : {})
        },
        message: {
          contactMessage: {
            displayName: ownername,
            vcard: 'BEGIN:VCARD\nVERSION:3.0\nN:XL;' + ownername + ';;;\nFN:' + ownername + '\nitem1.TEL;waid=' + ownerNumber + ':' + ownerNumber + '\nitem1.X-ABLabel:Mobile\nEND:VCARD',
            sendEphemeral: true
          }
        }
      };

      if (replyType === 'biasa') {
        if (typeof text === 'string') {
          return conn.sendMessage(m.chat, { text, ...options }, { quoted: m, ephemeralExpiration: m.expiration, ...options });
        } else if (typeof text === 'object') {
          return conn.sendMessage(m.chat, { ...text, ...options }, { quoted: m, ephemeralExpiration: m.expiration, ...options });
        }
      }

      await conn.sendPresenceUpdate('available', m.chat);
      await conn.readMessages([m.key]);
      await conn.sendPresenceUpdate('composing', m.chat);

      if (replyType === 'kontak') {
        const sendMsg = typeof text === 'string' ? { text } : { ...text };
        return conn.sendMessage(
          m.chat,
          {
            ...sendMsg,
            contextInfo: {
              mentionedJid: typeof text === 'string' ? [...conn.parseMention(text)] : [],
              forwardingScore: 999,
              isForwarded: true,
              externalAdReply: {
                title: global.title || 'sbyuxD',
                body: global.body || 'sbyuxD',
                mediaType: 1, 
                previewType: 'PHOTO',
                renderLargerThumbnail: false,
                thumbnail: thumbnail, 
                sourceUrl: 'https://about-sbyuxd.vercel.app'
              }
            },
            ...options
          },
          { quoted: contactQuoted, ephemeralExpiration: m.expiration, ...options }
        );
      }

      if (replyType === 'loc') {
        const msg = generateWAMessageFromContent(m.chat, {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadataVersion: 2,
                deviceListMetadata: {},
                externalAdReply: {
                  title: global.title || 'sbyuxD',
                  body: global.body || 'sbyuxD',
                  thumbnail: thumbnail,
                  mediaType: 1,
                  sourceUrl: 'https://about-sbyuxd.vercel.app',
                  renderLargerThumbnail: true
                }
              },
              liveLocationMessage: {
                degreesLatitude: 35.676570,
                degreesLongitude: 139.762148,
                caption: typeof text === 'string' ? text : '',
                sequenceNumber: 999,
                timeOffset: 999999999
              }
            }
          }
        }, { quoted: contactQuoted });
        return conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
      }

      if (replyType === 'payment') {
        return conn.relayMessage(m.chat, {
          requestPaymentMessage: {
            currencyCodeIso4217: 'USD',
            amount1000: '100',
            requestFrom: m.sender,
            noteMessage: {
              extendedTextMessage: {
                text: typeof text === 'string' ? text : '',
                contextInfo: {
                  externalAdReply: {
                    showAdAttribution: true
                  }
                }
              }
            }
          }
        }, { messageId: m.key.id });
      }
if (replyType === 'ct') {
  const content = typeof text === 'object' ? JSON.stringify(text, null, 2) : (text || 'Selesai.');
  const mentions = options.mentions || [...String(content).matchAll(/@(\d+)/g)].map(v => v[1] + '@s.whatsapp.net');
  const messageId = generateMessageIDV2();

  const { imageMessage: i } = await prepareWAMessageMedia(
    { image: { url: global.thumbnailUrl || 'https://raw.githubusercontent.com/bayuasli/sbyuxd-uploader/main/uploads/0875d7-1784786862439.jpg' } },
    {
      upload: conn.waUploadToServer,
      mediaTypeOverride: 'thumbnail-link'
    }
  );

  let faviconData = {};
  try {
    const { imageMessage: fav } = await prepareWAMessageMedia(
      { image: { url: 'https://raw.githubusercontent.com/bayuasli/sbyuxd-uploader/main/uploads/c20531-1785158744898.png' } },
      {
        upload: conn.waUploadToServer,
        mediaTypeOverride: 'thumbnail-link'
      }
    );
    faviconData = {
      faviconMMSMetadata: {
        thumbnailDirectPath: fav.directPath,
        thumbnailSha256: fav.fileSha256,
        thumbnailEncSha256: fav.fileEncSha256,
        mediaKey: fav.mediaKey,
        mediaKeyTimestamp: fav.mediaKeyTimestamp,
        thumbnailHeight: 48,
        thumbnailWidth: 48
      }
    };
  } catch (e) {
    console.log('Favicon error:', e.message);
  }

  const message_obj = {
    extendedTextMessage: {
      title: global.title || 'sbyuxD',
      description: global.body || 'sbyuxD',
      text: 'https://sbyuxd.dev\n' + content,
      matchedText: 'https://sbyuxd.dev',
      previewType: 'NONE',
      inviteLinkGroupTypeV2: 'DEFAULT',
      thumbnailDirectPath: i.directPath,
      thumbnailSha256: i.fileSha256,
      thumbnailEncSha256: i.fileEncSha256,
      mediaKey: i.mediaKey,
      mediaKeyTimestamp: i.mediaKeyTimestamp,
      thumbnailWidth: i.width,
      thumbnailHeight: i.height,
      jpegThumbnail: 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAQAAAAnOwc2AAAADElEQVR4nGNgGG4AAADSAAFQmYCvAAAAAElFTkSuQmCC',
      contextInfo: {
        mentionedJid: mentions,
        expiration: m.expiration || 0,
        stanzaId: m.key.id,
        participant: m.sender,
        quotedMessage: m.message
      },
      ...faviconData
    }
  };

  const wamc = proto.Message.fromObject(message_obj);
  await conn.relayMessage(m.chat, wamc, { messageId });
  return { key: { remoteJid: m.chat, fromMe: true, id: messageId }, message: message_obj };
}

      if (replyType === 'catalog') {
        return conn.relayMessage(m.chat, {
          orderMessage: {
            orderId: 'Z3PH',
            thumbnail: thumbnail,
            itemCount: 1,
            status: 1,
            surface: 1,
            message: typeof text === 'string' ? text : '',
            orderTitle: global.title || 'sbyuxD',
            token: 'bxx-sbyuxd',
            totalAmount1000: '1',
            totalCurrencyCode: 'USD',
            messageVersion: 1,
            contextInfo: {
              externalAdReply: {
                title: global.title || 'sbyuxD',
                body: global.body || 'sbyuxD',
                thumbnail: thumbnail,
                mediaType: 1,
                renderLargerThumbnail: false,
                showAdAttribution: false,
                sourceUrl: 'https://about-sbyuxd.vercel.app'
              }
            }
          }
        }, { messageId: m.key.id });
      }

            if (replyType === 'signup') {
        return conn.relayMessage(m.chat, {
          viewOnceMessage: {
            message: {
              interactiveMessage: {
                header: { title: 'Z3PH', hasMediaAttachment: false },
                body: { text: typeof text === 'string' ? text : '' },
                footer: { text: 'sbyuxD !' },
                nativeFlowMessage: {
                  buttons: [
                    { name: 'inapp_signup', buttonParamsJson: '{}' }
                  ],
                  messageParamsJson: '{}'
                }
              }
            }
          }
        }, {
          messageId: m.key.id,
          quoted: contactQuoted,
          additionalNodes: [{
            tag: 'biz',
            attrs: {},
            content: [{
              tag: 'interactive',
              attrs: { type: 'native_flow', v: '1' },
              content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
            }]
          }]
        });
      }

      const sendMsgDefault = typeof text === 'string' ? { text } : { ...text };
      return conn.sendMessage(
        m.chat,
        {
          ...sendMsgDefault,
          contextInfo: {
            mentionedJid: typeof text === 'string' ? [...conn.parseMention(text)] : [],
            forwardingScore: 999,
            isForwarded: true,
            externalAdReply: {
              title: global.title || 'sbyuxD',
              body: global.body || 'sbyuxD',
              mediaType: 1,
              previewType: 'PHOTO',
              renderLargerThumbnail: false,
              thumbnail: thumbnail, 
              sourceUrl: 'https://about-sbyuxd.vercel.app'
            }
          },
          ...options
        },
        { quoted: contactQuoted, ephemeralExpiration: m.expiration, ...options }
      );

    } catch (err) {
      console.error('Reply error:', err);
    } finally {
      Promise.race([
        conn.sendPresenceUpdate('unavailable', m.chat),
        new Promise(r => setTimeout(r, 3000))
      ]).catch(() => {});
    }
  };

  return m;
}

function parseMessage(content) {
  content = extractMessageContent(content);
  if (content && content.viewOnceMessageV2Extension) content = content.viewOnceMessageV2Extension.message;
  if (content && content.protocolMessage && content.protocolMessage.type === 14) {
    const type = getContentType(content.protocolMessage);
    content = content.protocolMessage[type];
  }
  if (content && content.message) {
    const type = getContentType(content.message);
    content = content.message[type];
  }
  return content;
}

const getContentType = content => {
  if (content) {
    const keys = Object.keys(content);
    const key = keys.find(k => (k === 'conversation' || k.endsWith('Message') || k.includes('V2') || k.includes('V3')) && k !== 'senderKeyDistributionMessage');
    return key;
  }
};