import crypto from 'crypto';
import https from 'https';
import JSZip from 'jszip';

function toBuffer(value) {
    if (Buffer.isBuffer(value)) return value;
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
    if (typeof value === 'string') return Buffer.from(value, 'base64');
    throw new Error('Format buffer tidak dikenali');
}

function toStoredBuffer(buffer) {
    return Buffer.from(buffer).toString('base64');
}

function getStickerStore(sender) {
    if (!global.db) global.db = {};
    if (!global.db.data) global.db.data = {};
    if (!global.db.data.sticker) global.db.data.sticker = {};
    if (!global.db.data.sticker[sender]) global.db.data.sticker[sender] = [];

    const list = global.db.data.sticker[sender];

    for (const item of list) {
        if (typeof item.buffer !== 'string') {
            item.buffer = toStoredBuffer(toBuffer(item.buffer));
        }
    }

    return list;
}

function sha256Of(stickerMessage) {
    return Buffer.from(stickerMessage.fileSha256).toString('hex');
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

function isWebP(buffer) {
    return buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP';
}

function isAnimatedWebP(buffer) {
    if (!isWebP(buffer)) return false;

    let offset = 12;

    while (offset < buffer.length - 8) {
        const chunk = buffer.toString('ascii', offset, offset + 4);
        const size = buffer.readUInt32LE(offset + 4);

        if (chunk === 'VP8X' && (buffer[offset + 8] & 0x02)) return true;
        if (chunk === 'ANIM' || chunk === 'ANMF') return true;

        offset += 8 + size + (size % 2);
    }

    return false;
}

function classifySticker(buffer, stickerMessage) {
    if (stickerMessage.isLottie) {
        return { ext: 'json', mimetype: 'application/json', isAnimated: true, isLottie: true };
    }

    return { ext: 'webp', mimetype: 'image/webp', isAnimated: isAnimatedWebP(buffer), isLottie: false };
}

async function makeTrayWebp(buffer) {
    const sharpMod = await import('sharp').catch(() => null);
    if (!sharpMod?.default) throw new Error('Install sharp dulu: npm i sharp');

    return await sharpMod.default(buffer, { animated: false })
        .resize(252, 252, { fit: 'cover' })
        .webp()
        .toBuffer();
}

async function makeBlankTrayWebp() {
    const sharpMod = await import('sharp').catch(() => null);
    if (!sharpMod?.default) throw new Error('Install sharp dulu: npm i sharp');

    return await sharpMod.default({
        create: {
            width: 252,
            height: 252,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .webp()
        .toBuffer();
}

async function makeThumbnailJpeg(buffer) {
    const sharpMod = await import('sharp').catch(() => null);
    if (!sharpMod?.default) throw new Error('Install sharp dulu: npm i sharp');

    return await sharpMod.default(buffer)
        .resize(252, 252, { fit: 'cover' })
        .jpeg()
        .toBuffer();
}

async function uploadToServer(conn, buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
    const expanded = Buffer.from(
        crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112),
    );

    const iv = expanded.subarray(0, 16);
    const cipherKey = expanded.subarray(16, 48);
    const macKey = expanded.subarray(48, 80);

    const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

    const mac = crypto
        .createHmac('sha256', macKey)
        .update(iv)
        .update(encrypted)
        .digest()
        .subarray(0, 10);

    const encBuffer = Buffer.concat([encrypted, mac]);

    const fileSha256 = sha256(buffer);
    const fileEncSha256 = sha256(encBuffer);

    const iq = await conn.query({
        tag: 'iq',
        attrs: {
            id: conn.generateMessageTag?.() ?? Date.now().toString(),
            to: 's.whatsapp.net',
            type: 'set',
            xmlns: 'w:m',
        },
        content: [{ tag: 'media_conn', attrs: {} }],
    });

    const mediaConn = iq.content?.find(v => v.tag === 'media_conn');
    if (!mediaConn) throw new Error('media_conn tidak ditemukan');

    const auth = mediaConn.attrs?.auth;
    if (!auth) throw new Error('auth media_conn tidak ditemukan');

    const hosts = (mediaConn.content || [])
        .filter(v => v.tag === 'host')
        .map(v => v.attrs?.hostname)
        .filter(Boolean);

    if (!hosts.length) throw new Error('host upload tidak ditemukan');

    const token = encodeURIComponent(
        fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''),
    );

    let lastError;

    for (const host of hosts) {
        try {
            const json = await new Promise((resolve, reject) => {
                const url = new URL(
                    `https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`,
                );

                const req = https.request(
                    {
                        hostname: url.hostname,
                        port: 443,
                        path: url.pathname + url.search,
                        method: 'POST',
                        headers: {
                            Origin: 'https://web.whatsapp.com',
                            Referer: 'https://web.whatsapp.com/',
                            'Content-Type': 'application/octet-stream',
                            'Content-Length': encBuffer.length,
                        },
                    },
                    (res) => {
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
                    },
                );

                req.on('error', reject);
                req.write(encBuffer);
                req.end();
            });

            const directPath = json.direct_path ?? json.directPath ?? json.url ?? json.path;
            if (!directPath) throw new Error('directPath tidak ditemukan');

            return {
                mediaKey,
                fileLength: buffer.length,
                fileSha256,
                fileEncSha256,
                directPath,
                ...json,
            };
        } catch (e) {
            lastError = e;
        }
    }

    throw lastError ?? new Error('Semua host upload gagal');
}

async function sendCustomStickerPack(conn, m, pack) {
    const zip = new JSZip();
    const stickersMetadata = [];
    const hydrated = pack.map(item => ({ ...item, buffer: toBuffer(item.buffer) }));

    for (const item of hydrated) {
        const fileName = `${toB64Url(sha256(item.buffer))}.${item.ext}`;

        zip.file(fileName, item.buffer);

        stickersMetadata.push({
            fileName,
            isAnimated: item.isAnimated,
            emojis: [''],
            accessibilityLabel: '',
            isLottie: item.isLottie,
            mimetype: item.mimetype,
        });
    }

    const trayIconFileName = 'tray_icon.webp';
    const traySource = hydrated.find(v => !v.isLottie)?.buffer;

    const trayBuffer = traySource
        ? await makeTrayWebp(traySource)
        : await makeBlankTrayWebp();

    zip.file(trayIconFileName, trayBuffer);

    const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });

    const packUpload = await uploadToServer(conn, archive, {
        hkdf: 'WhatsApp Sticker Pack Keys',
        mediaPath: '/mms/sticker-pack',
    });

    const thumbnailBuffer = await makeThumbnailJpeg(trayBuffer);

    const thumbUpload = await uploadToServer(conn, thumbnailBuffer, {
        hkdf: 'WhatsApp Sticker Pack Thumbnail Keys',
        mediaPath: '/mms/thumbnail-sticker-pack',
        mediaKey: packUpload.mediaKey,
    });

    await conn.relayMessage(
        m.chat,
        {
            messageContextInfo: {
                messageSecret: crypto.randomBytes(32),
            },
            stickerPackMessage: {
                stickerPackId: 'Pack_' + crypto.randomBytes(8).toString('hex'),
                name: 'sbyuxD',
                publisher: 'sbyuxD',
                packDescription: 'Stiker pack dibuat menggunakan sbyuxD Bot',

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
                imageDataHash: thumbUpload.fileSha256.toString('base64'),
            },
        },
        {
            quoted: m,
        },
    );
}

export default {
    name: 'stickerpack',
    category: 'sticker',
    command: ['tostickerpack', 'tspk', 'addspk', 'delspk'],
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
        const command = m.command;
        const pack = getStickerStore(m.sender);

        if (command === 'tspk' || command === 'tostickerpack') {
            if (!pack.length) {
                return m.reply('Pack masih kosong, tambahkan dulu dengan .addspk reply sticker');
            }

            try {
                await sendCustomStickerPack(conn, m, pack);
            } catch (e) {
                console.error('[stickerpack]', e);
                return m.reply('Gagal mengirim sticker pack: ' + e.message);
            }
            return;
        }

        const quoted = m.quoted || m;
        const stickerMsg = quoted.msg?.stickerMessage || quoted.message?.stickerMessage;

        if (!stickerMsg) {
            return m.reply('Reply sticker yang mau diproses.');
        }

        const sha256Hex = sha256Of(stickerMsg);

        if (command === 'addspk') {
            if (pack.some(v => v.sha256 === sha256Hex)) {
                return m.reply('Sticker sudah ada di pack.');
            }

            const buffer = await conn.downloadMediaMessage(quoted);

            if (!buffer) {
                return m.reply('Gagal download sticker.');
            }

            const type = classifySticker(buffer, stickerMsg);

            pack.push({ sha256: sha256Hex, buffer: toStoredBuffer(buffer), ...type });

            const label = type.isLottie ? 'lottie' : type.isAnimated ? 'animated' : 'static';

            return m.reply(`Ditambahkan (${label}). Total ${pack.length} sticker di pack.`);
        }

        if (command === 'delspk') {
            const idx = pack.findIndex(v => v.sha256 === sha256Hex);

            if (idx === -1) {
                return m.reply('Sticker tidak ditemukan di pack.');
            }

            pack.splice(idx, 1);

            return m.reply(`Dihapus. Sisa ${pack.length} sticker di pack.`);
        }
    }
};