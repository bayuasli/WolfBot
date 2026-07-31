await import('./config.js');

import makeWASocket, {
  Browsers,
  fetchLatestBaileysVersion,
  generateWAMessageFromContent,
  proto
} from 'baileys';

import { Boom } from '@hapi/boom';
import fs from 'fs';
import pino from 'pino';
import serialize, { Client } from '#lib/system/serialize.js';
import log from '#lib/system/logger.js';
import PluginsLoad from '#lib/system/loadPlugins.js';
import sqlAuth from '#lib/system/sqlauth.js';
import printMessage from '#lib/system/print.js';
import { syncFromParticipants } from '#lib/contactstore.js';

const loader = new PluginsLoad('./plugins', { debug: true });
await loader.load();
global.plugins = loader.plugins;
global.pluginLoader = loader;

const MAX_MSG_PER_CHAT = 20;
const MAX_CHATS = 300;
const GC_INTERVAL = 10 * 60 * 1000;

let handler = null;
let gcInterval = null;

async function loadHandler() {
  try {
    handler = (await import(`./handler.js?v=${Date.now()}`)).default;
  } catch (err) {
    log.error('Gagal load handler:', err.message);
  }
}

global.reloadHandler = loadHandler;

await loadHandler();
setInterval(loadHandler, 30000);

function runGC(conn) {
  if (!conn.messages) return;
  for (const [chat, msgs] of conn.messages.entries()) {
    if (msgs.length > MAX_MSG_PER_CHAT) conn.messages.set(chat, msgs.slice(-MAX_MSG_PER_CHAT));
  }
  if (conn.messages.size > MAX_CHATS) {
    const keys = [...conn.messages.keys()];
    for (const key of keys.slice(0, conn.messages.size - MAX_CHATS)) conn.messages.delete(key);
  }
  if (global.gc) global.gc();
}

async function startWA() {
  const { state, saveCreds } = await sqlAuth('./sessions');
  const { version } = await fetchLatestBaileysVersion();

  const conn = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Edge'),
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    getMessage: async key => {
      if (!conn.messages) return undefined;
      const msgs = conn.messages.get(key.remoteJid) || [];
      return msgs.find(x => x.id === key.id)?.message;
    }
  });

  await Client(conn);
  conn.chats ??= {};
  conn.messages = new Map();

  if (gcInterval) clearInterval(gcInterval);
  gcInterval = setInterval(() => runGC(conn), GC_INTERVAL);

  if (!state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await conn.requestPairingCode(PAIRING_NUMBER, 'SIBAYUXD');
        log.info('Pairing Code: ' + code);
      } catch (err) {
        log.error('Gagal ambil pairing code: ' + err);
      }
    }, 3000);
  }

  conn.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection) log.info('Connection Status: ' + connection);

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

      switch (statusCode) {
        case 408:
        case 503:
        case 428:
        case 515:
          await startWA();
          break;

        case 401:
        case 403:
        case 405:
          fs.rmSync('./sessions', { recursive: true, force: true });
          await startWA();
          break;

        default:
          await startWA();
      }
    }

    if (connection === 'open') {
      log.success('Z3PH BOT  CONNECTED SUCCESSFULLY.');
      conn.chats = await conn.groupFetchAllParticipating();

      for (const plugin of Object.values(global.plugins || {})) {
        if (typeof plugin?.onLoad === 'function') {
          plugin.onLoad(conn).catch(err => log.error('onLoad error:', err.message));
        }
      }
    }
  });

  conn.ev.on('creds.update', saveCreds);

  conn.ev.on('group-participants.update', async ({ id, participants, action }) => {
  let metadata = conn.chats[id];

  if (!metadata) {
    try {
      metadata = await conn.groupMetadata(id);
      conn.chats[id] = metadata;
    } catch (e) {
      log.error('Gagal fetch metadata grup:', e.message);
      return;
    }
  }

  switch (action) {
    case 'add':
    case 'revoked_membership_requests':
      for (const jid of participants) {
        if (!metadata.participants.some(p => p.id === jid)) {
          metadata.participants.push({ id: jid, admin: null });
        }
      }
      break;

    case 'demote':
    case 'promote':
      for (const jid of participants) {
        const target = metadata.participants.find(p => p.id === jid);
        if (target) target.admin = action === 'promote' ? 'admin' : null;
      }
      break;

    case 'remove':
      metadata.participants = metadata.participants.filter(p => !participants.includes(p.id));
      break;
  }

  syncFromParticipants(metadata.participants).catch(() => {});
});

conn.ev.on('presence.update', ({ id, presences }) => {
  try {
    const sender = Object.keys(presences)[0] || id;
    const presence = presences[sender]?.lastKnownPresence || 'composing';
    const jid = conn.getJid(sender);
    conn.chats[jid] ??= { id: jid };
    conn.chats[jid].presences = presence;
  } catch (e) {
    log.error('Presence update gagal:', e.message);
  }
});

  conn.ev.on('messages.upsert', async ({ messages }) => {
    const raw = messages[0];
    if (!raw) return;

    if (raw.messageStubType != null) {
      try {
        await conn.sendMessage(raw.key.remoteJid, { react: { text: '👀', key: raw.key } });
      } catch (e) {
        log.error('React notif gagal:', e.message);
      }
    }

    const m = await serialize(conn, raw).catch(() => null);
    if (!m) return;

    conn.messages ??= new Map();
    if (!conn.messages.has(m.chat)) conn.messages.set(m.chat, []);
    const chatMsgs = conn.messages.get(m.chat);
    chatMsgs.push(m);
    if (chatMsgs.length > MAX_MSG_PER_CHAT) chatMsgs.shift();

    const body = (m.body || m.text || '').trim().toLowerCase();

    if (body === 'bot') {
      try {
        const msg = generateWAMessageFromContent(
          m.chat,
          proto.Message.fromObject({
            requestPhoneNumberMessage: { text: 'Bagikan nomor telepon Anda' }
          }),
          { userJid: conn.user.id }
        );
        await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
      } catch (err) {
        log.error('Gagal kirim request phone:', err.message);
      }
      return;
    }

    if (m.chat.endsWith('@broadcast') || m.chat.endsWith('@newsletter')) {
      for (const plugin of Object.values(global.plugins || {})) {
        if (typeof plugin?.on === 'function') {
          plugin.on(conn, m, {}).catch(() => {});
        }
      }
      return;
    }

    if (!m.message || m.isBot) return;
    if (m.type === 'protocolMessage') return;

    try {
      await printMessage(conn, m);
    } catch {}

    try {
      if (handler) await handler(conn, m);
    } catch (err) {
      log.error('Handler error:', err.message);
    }
  });
}

startWA();