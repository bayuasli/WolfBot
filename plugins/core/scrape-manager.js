import fs from 'fs'
import path from 'path'
import { AIRich } from '#helper'

const scrapeDir = path.join(process.cwd(), 'lib/scrape')

function ensureDir() {
  if (!fs.existsSync(scrapeDir)) fs.mkdirSync(scrapeDir, { recursive: true })
}

function sanitizeFilename(name) {
  const base = path.basename(name || '')
  if (!base || base.includes('..') || !base.endsWith('.js')) return null
  return base
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

export default {
  name: 'scrape-manager',
  category: 'core',
  command: ['scr', 'listscrape', 'getscrape', 'dscr'],
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
    ensureDir()

    const cmd = m.prefix + m.command

    if (m.command === 'listscrape') {
      const files = fs.readdirSync(scrapeDir).filter(f => f.endsWith('.js'))

      if (files.length === 0) return m.reply('Belum ada file di lib/scrape.')

      let text = '╭───⊷ *SCRAPE MANAGER* ⊶───╮\n\n'

      for (const file of files) {
        const stat = fs.statSync(path.join(scrapeDir, file))
        text += `• *${file}*\n`
        text += `  ↳ ${formatBytes(stat.size)} · diubah ${new Date(stat.mtime).toLocaleString('id-ID')}\n`
      }

      text += `\nTotal: ${files.length} file\n`
      text += '\n╰────────────────────────╯'

      return m.reply(text)
    }

    if (m.command === 'scr') {
      const rawBody = m.body || ''
      const breakIndex = rawBody.indexOf('\n')
      const firstLine = breakIndex === -1 ? rawBody : rawBody.slice(0, breakIndex)
      const restBody = breakIndex === -1 ? '' : rawBody.slice(breakIndex + 1)

      const firstLineParts = firstLine.trim().split(/\s+/)
      const filename = sanitizeFilename(firstLineParts[1])

      if (!filename) {
        return m.reply(
          `Format tidak valid.\n\nContoh:\n${cmd} nama.js\n<kode di sini>\n\n` +
          `Atau reply dokumen .js / pesan teks berisi kode dengan caption:\n${cmd} nama.js`
        )
      }

      let code = restBody.trim()

      if (!code && m.quoted?.isMedia) {
        const mimetype = m.quoted.msg?.mimetype || ''
        if (!/text|javascript|json/i.test(mimetype)) {
          return m.reply('Dokumen yang direply harus berupa file teks/.js.')
        }
        const buffer = await m.quoted.download()
        code = buffer.toString('utf-8')
      } else if (!code && m.quoted?.body) {
        code = m.quoted.body
      }

      if (!code) {
        return m.reply('Kode tidak boleh kosong. Sertakan kode langsung, atau reply file/teks.')
      }

      const filePath = path.join(scrapeDir, filename)
      const isUpdate = fs.existsSync(filePath)

      fs.writeFileSync(filePath, code, 'utf-8')

      return m.reply(
        `${isUpdate ? 'Diperbarui' : 'Disimpan'}: *${filename}*\n` +
        `Ukuran: ${formatBytes(Buffer.byteLength(code))}\n` +
        `Baris: ${code.split('\n').length}\n` +
        `Path: lib/scrape/${filename}\n` +
        `Import: #scrape/${filename}`
      )
    }

    if (m.command === 'dscr') {
      const filename = sanitizeFilename((m.text || '').trim())
      if (!filename) return m.reply(`Contoh:\n${cmd} nama.js`)

      const filePath = path.join(scrapeDir, filename)
      if (!fs.existsSync(filePath)) return m.reply(`File *${filename}* tidak ditemukan.`)

      fs.unlinkSync(filePath)
      return m.reply(`File *${filename}* berhasil dihapus.`)
    }

    if (m.command === 'getscrape') {
      const filename = sanitizeFilename((m.text || '').trim())
      if (!filename) return m.reply(`Contoh:\n${cmd} nama.js`)

      const filePath = path.join(scrapeDir, filename)
      if (!fs.existsSync(filePath)) return m.reply(`File *${filename}* tidak ditemukan.`)

      const code = fs.readFileSync(filePath, 'utf-8')
      const stat = fs.statSync(filePath)

      return new AIRich(conn)
        .setTitle(`📄 ${filename}`)
        .setFooter(`${formatBytes(stat.size)} · lib/scrape/${filename}`)
        .addCode('javascript', code)
        .send(m.chat, { quoted: m })
    }
  }
}