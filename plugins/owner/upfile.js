import fs from 'fs'
import path from 'path'

export default {
  name: "upfile",
  category: "owner",
  command: ["upf", "upfile"],
  alias: [],
  
  settings: {
    owner: true,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m, { quoted }) => {
    const targetPath = m.text?.trim()

    if (!targetPath) {
      return m.reply(
        'Reply pesan/teks yang mau disimpan, lalu kirim path tujuan.\n\n' +
        'Contoh:\n' +
        '.upf lib/serialize.js'
      )
    }

    if (!m.isQuoted) {
      return m.reply('Reply ke pesan yang mau disimpan.')
    }

    const root = process.cwd()
    const cleanPath = targetPath.startsWith('./') ? targetPath.slice(2) : targetPath
    const fullPath = path.resolve(root, cleanPath)

    if (!fullPath.startsWith(root)) {
      return m.reply('Path tidak valid, harus di dalam folder project.')
    }

    let code = ''
    
    try {
      if (m.quoted.msg && m.quoted.msg.message) {
        const msgObj = m.quoted.msg.message
        const contentType = Object.keys(msgObj)[0]
        
        if (contentType === 'conversation') {
          code = msgObj.conversation || ''
        } else if (contentType === 'extendedTextMessage') {
          code = msgObj.extendedTextMessage.text || ''
        } else if (contentType === 'imageMessage') {
          code = msgObj.imageMessage.caption || ''
        } else if (contentType === 'documentMessage') {
          code = msgObj.documentMessage.caption || ''
        } else if (contentType === 'videoMessage') {
          code = msgObj.videoMessage.caption || ''
        } else if (contentType === 'audioMessage') {
          code = msgObj.audioMessage.caption || ''
        } else {
          code = m.quoted.body || m.quoted.text || ''
        }
      } else {
        code = m.quoted.body || m.quoted.text || ''
      }
      
      if (!code || code.trim() === '') {
        return m.reply("Tidak ada teks/kode yang ditemukan dalam pesan yang di-reply")
      }

      if (code.startsWith('```') && code.endsWith('```')) {
        code = code.slice(3, -3).trim()
      }
      
      if (code.startsWith('`') && code.endsWith('`')) {
        code = code.slice(1, -1).trim()
      }
      
      const lines = code.split('\n')
      if (lines.length > 0 && lines[0].startsWith('```')) {
        lines.shift()
      }
      if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) {
        lines.pop()
      }
      code = lines.join('\n').trim()
      
    } catch (err) {
      console.error('Extract code error:', err)
      code = m.quoted.body || m.quoted.text || ''
    }
    
    if (!code || code.trim() === '') {
      return m.reply("Tidak ada teks/kode yang ditemukan dalam pesan yang di-reply")
    }

    const dir = path.dirname(fullPath)
    const fileName = path.basename(fullPath)
    const exists = fs.existsSync(fullPath)

    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(fullPath, code, 'utf-8')

      if (exists) {
        return m.reply(
          `📁 File *${fileName}* sudah ada di path *./${cleanPath}*\n` +
          `⚠️ File akan di-replace/timpa.\n` +
          `✅ File berhasil disimpan ke *./${cleanPath}*`
        )
      } else {
        return m.reply(
          `📁 File *${fileName}* berhasil dibuat di path *./${cleanPath}*`
        )
      }
      
    } catch (err) {
      return m.reply('❌ Gagal menyimpan file: ' + err.message)
    }
  }
}