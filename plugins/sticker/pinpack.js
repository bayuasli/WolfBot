import axios from 'axios';
import crypto from 'crypto';
import https from 'https';
import JSZip from 'jszip';

async function searchPinterest(query) {
  const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?data=${encodeURIComponent(JSON.stringify({ options: { query } }))}`;
  const res = await axios.head(url, {
    headers: {
      'screen-dpr': '4',
      'x-pinterest-pws-handler': 'www/search/[scope].js',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    timeout: 15000,
    validateStatus: () => true
  });

  const linkHeader = res.headers['link'] || '';
  return [...linkHeader.matchAll(/<(https:\/\/i\.pinimg\.com\/[^>]+)>/g)].map(m => m[1]);
}

async function toStickerBuffer(buffer) {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

function toB64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function uploadToServer(conn, buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
  const expanded = Buffer.from(
    crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112)
  );

  const iv = expanded.subarray(0, 16);
  const cipherKey = expanded.subarray(16, 48);
  const macKey = expanded.subarray(48, 80);

  const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const mac = crypto.createHmac('sha256', macKey).update(iv).update(encrypted).digest().subarray(0, 10);
  const encBuffer = Buffer.concat([encrypted, mac]);

  const fileSha256 = sha256(buffer);
  const fileEncSha256 = sha256(encBuffer);

  const iq = await conn.query({
    tag: 'iq',
    attrs: {
      id: conn.generateMessageTag?.() ?? Date.now().toString(),
      to: 's.whatsapp.net',
      type: 'set',
      xmlns: 'w:m'
    },
    content: [{ tag: 'media_conn', attrs: {} }]
  });

  const mediaConn = iq.content?.find(v => v.tag === 'media_conn');
  if (!mediaConn) throw new Error('media_conn tidak ditemukan');

  const auth = mediaConn.attrs?.auth;
  if (!auth) throw new Error('auth tidak ditemukan');

  const hosts = (mediaConn.content || [])
    .filter(v => v.tag === 'host')
    .map(v => v.attrs?.hostname)
    .filter(Boolean);

  if (!hosts.length) throw new Error('host upload tidak ditemukan');

  const token = encodeURIComponent(toB64Url(fileEncSha256));
  let lastError;

  for (const host of hosts) {
    try {
      const json = await new Promise((resolve, reject) => {
        const url = new URL(`https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`);
        const req = https.request({
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            Origin: 'https://web.whatsapp.com',
            Referer: 'https://web.whatsapp.com/',
            'Content-Type': 'application/octet-stream',
            'Content-Length': encBuffer.length
          }
        }, (res) => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(new Error(`Upload gagal ${res.statusCode}: ${body}`));
            }
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error(`Response bukan JSON: ${body}`));
            }
          });
        });
        req.on('error', reject);
        req.write(encBuffer);
        req.end();
      });

      const directPath = json.direct_path ?? json.directPath ?? json.url ?? json.path;
      if (!directPath) throw new Error('directPath tidak ditemukan');
      return { mediaKey, fileLength: buffer.length, fileSha256, fileEncSha256, directPath, ...json };
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError ?? new Error('Semua host gagal');
}

async function makeTrayWebp(buffer) {
  const sharp = (await import('sharp')).default;
  return sharp(buffer, { animated: false })
    .resize(252, 252, { fit: 'cover' })
    .webp()
    .toBuffer();
}

async function makeBlankTrayWebp() {
  const sharp = (await import('sharp')).default;
  return sharp({
    create: {
      width: 252,
      height: 252,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .webp()
    .toBuffer();
}

async function makeThumbnailJpeg(buffer) {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .resize(252, 252, { fit: 'cover' })
    .jpeg()
    .toBuffer();
}

async function sendStickerPack(conn, m, pack, packNumber = 1, totalPacks = 1) {
  const zip = new JSZip();
  const stickersMetadata = [];

  for (const item of pack) {
    const fileName = toB64Url(sha256(item.buffer)) + '.webp';
    zip.file(fileName, item.buffer);
    stickersMetadata.push({
      fileName,
      isAnimated: false,
      emojis: [''],
      accessibilityLabel: '',
      isLottie: false,
      mimetype: 'image/webp'
    });
  }

  const trayIconFileName = 'tray_icon.webp';
  const traySource = pack[0]?.buffer;
  const trayBuffer = traySource ? await makeTrayWebp(traySource) : await makeBlankTrayWebp();
  zip.file(trayIconFileName, trayBuffer);

  const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
  const packUpload = await uploadToServer(conn, archive, {
    hkdf: 'WhatsApp Sticker Pack Keys',
    mediaPath: '/mms/sticker-pack'
  });
  const thumbnailBuffer = await makeThumbnailJpeg(trayBuffer);
  const thumbUpload = await uploadToServer(conn, thumbnailBuffer, {
    hkdf: 'WhatsApp Sticker Pack Thumbnail Keys',
    mediaPath: '/mms/thumbnail-sticker-pack',
    mediaKey: packUpload.mediaKey
  });

  const packLabel = totalPacks > 1 ? ' (' + packNumber + '/' + totalPacks + ')' : '';

  await conn.relayMessage(m.chat, {
    messageContextInfo: { messageSecret: crypto.randomBytes(32) },
    stickerPackMessage: {
      stickerPackId: 'Pack_' + crypto.randomBytes(8).toString('hex'),
      name: global.stickpack || 'Sticker Pack',
      publisher: global.stickauth || 'sbyuxD',
      packDescription: 'Sticker pack - ' + pack.length + ' stickers',
      stickers: stickersMetadata,
      fileLength: packUpload.fileLength,
      fileSha256: packUpload.fileSha256,
      fileEncSha256: packUpload.fileEncSha256,
      mediaKey: packUpload.mediaKey,
      directPath: packUpload.directPath,
      mediaKeyTimestamp: Math.floor(Date.now() / 1000),
      stickerPackSize: packUpload.fileLength,
      stickerPackOrigin: 2,
      trayIconFileName,
      thumbnailDirectPath: thumbUpload.directPath,
      thumbnailSha256: thumbUpload.fileSha256,
      thumbnailEncSha256: thumbUpload.fileEncSha256,
      thumbnailHeight: 252,
      thumbnailWidth: 252,
      imageDataHash: thumbUpload.fileSha256.toString('base64')
    }
  }, { quoted: m });
}

export default {
  name: 'pinpack',
  category: 'sticker',
  command: ['pinpack'],
  alias: [],
  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m, { Func }) => {
    try {
      const query = m.text.trim();
      if (!query) {
        return m.reply('Usage: .pinpack <keyword>\nContoh: .pinpack meme');
      }

      await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

      const results = await searchPinterest(query);
      if (!results.length) {
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply('Tidak ada hasil ditemukan.');
      }

      const urls = results.slice(0, 50);
      const pack = [];
      let success = 0;

      for (const url of urls) {
        try {
          const buffer = await Func.getBuffer(url);
          const sticker = await toStickerBuffer(buffer);
          pack.push({ buffer: sticker });
          success++;
        } catch {
          continue;
        }
        if (pack.length >= 50) break;
      }

      if (!pack.length) {
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply('Gagal membuat sticker dari gambar.');
      }

      const MAX_PACK_SIZE = 50;
      const totalPacks = Math.ceil(pack.length / MAX_PACK_SIZE);

      for (let i = 0; i < totalPacks; i++) {
        const start = i * MAX_PACK_SIZE;
        const end = Math.min(start + MAX_PACK_SIZE, pack.length);
        const packSlice = pack.slice(start, end);
        await sendStickerPack(conn, m, packSlice, i + 1, totalPacks);
        await new Promise(r => setTimeout(r, 2000));
      }

      await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

    } catch (e) {
      await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
      await m.reply('Error: ' + e.message);
    }
  }
};