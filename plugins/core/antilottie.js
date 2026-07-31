import fs from 'fs'
import path from 'path'

const SETTINGS_FILE = './lib/database/antilottie.json'

const getSettings = () => {
    if (!fs.existsSync('./lib/database')) {
        fs.mkdirSync('./lib/database', { recursive: true })
    }
    if (!fs.existsSync(SETTINGS_FILE)) {
        fs.writeFileSync(SETTINGS_FILE, '{}', 'utf-8')
    }
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    } catch {
        return {}
    }
}

const saveSettings = (data) => {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export default {
    name: 'antilottie',
    category: 'core',
    command: ['antilottie'],
    alias: ['als'],
    settings: {
        owner: false,
        private: false,
        group: true,
        admin: true,
        botAdmin: false,
        loading: false
    },

    run: async (conn, m, { isAdmin, isBotAdmin }) => {
        if (!m.isGroup) return m.reply('Fitur ini hanya dapat digunakan di dalam grup.')
        if (!isAdmin) return m.reply('Hanya admin grup yang dapat menggunakan perintah ini.')

        const action = (m.text || '').toLowerCase().trim()
        const settings = getSettings()

        if (action === 'on') {
            settings[m.chat] = true
            saveSettings(settings)
            return m.reply(
                'ANTILOTTIE\n' +
                '──────────────────\n' +
                'Status : [ ON ]\n' +
                'Fitur aktif, sticker lottie akan otomatis dihapus\n' +
                '──────────────────\n' +
                (isBotAdmin ? 'Bot adalah admin ✓' : '⚠️ Bot bukan admin, tidak bisa menghapus')
            )
        } else if (action === 'off') {
            settings[m.chat] = false
            saveSettings(settings)
            return m.reply(
                'ANTILOTTIE\n' +
                '──────────────────\n' +
                'Status : [ OFF ]\n' +
                'Fitur dinonaktifkan'
            )
        } else {
            const status = settings[m.chat] === true ? 'ON' : 'OFF'
            return m.reply(
                'ANTILOTTIE\n' +
                '──────────────────\n' +
                'Status : [ ' + status + ' ]\n' +
                '──────────────────\n' +
                'Gunakan:\n' +
                '.antilottie on - Aktifkan\n' +
                '.antilottie off - Nonaktifkan\n' +
                '──────────────────\n' +
                (isBotAdmin ? 'Bot adalah admin ✓' : '⚠️ Bot bukan admin')
            )
        }
    },

    on: async (conn, m, { isBotAdmin }) => {
        if (!m || !m.isGroup) return
        if (m.fromMe) return

        const settings = getSettings()
        if (settings[m.chat] !== true) return

        if (m.type === 'lottieStickerMessage' || m.message?.lottieStickerMessage) {
            if (!isBotAdmin) return

            try {
                await conn.sendMessage(m.chat, {
                    delete: {
                        remoteJid: m.chat,
                        fromMe: false,
                        id: m.key.id,
                        participant: m.sender
                    }
                })
            } catch (e) {
                console.error('Gagal hapus lottie sticker:', e.message)
            }
        }
    }
}