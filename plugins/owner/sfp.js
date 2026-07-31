import fs from 'fs'
import path from 'path'
import { Button } from '#helper';

function extractFirstCommand(code) {
  const arrMatch = code.match(/command:\s*\[([^\]]+)\]/)
  if (arrMatch) {
    const firstStr = arrMatch[1].match(/['"`]([^'"`]+)['"`]/)
    if (firstStr) return firstStr[1]
  }
  const singleMatch = code.match(/command:\s*['"`]([^'"`]+)['"`]/)
  if (singleMatch) return singleMatch[1]
  return null
}

export default {
  name: 'sfp',
  category: 'owner',
  command: ['sfp', 'addpl'],

  settings: {
    owner: true,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m, { quoted }) => {
    const code = quoted?.body || quoted?.msg?.text || quoted?.text || ''
    if (!code) return m.reply('Balas pesan berisi kode plugin!')

    let filename, subfolder

    if (m.text?.trim()) {
      const args = m.text.trim().split(/\s+/)
      if (args.length < 2) return m.reply(`Format manual: ${m.cmd} folder namaFile`)
      subfolder = args[0]
      filename = args[1].endsWith('.js') ? args[1] : `${args[1]}.js`
    } else {
      const nameMatch = code.match(/name:\s*['"`]([^'"`]+)['"`]/)
      const categoryMatch = code.match(/category:\s*['"`]([^'"`]+)['"`]/)

      if (nameMatch && categoryMatch) {
        filename = `${nameMatch[1]}.js`
        subfolder = categoryMatch[1]
      } else {
        return m.reply(`Tidak ditemukan name/category di kode. Gunakan manual:\n${m.cmd} folder namaFile`)
      }
    }

    const fullPath = path.join('./plugins', subfolder)
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true })

    const filePath = path.join(fullPath, filename)
    fs.writeFileSync(filePath, code)

    const firstCommand = extractFirstCommand(code)

    const caption =
      `✅ Plugin tersimpan!\n\n` +
      `Nama     : ${filename}\n` +
      `Kategori : ${subfolder}\n` +
      `Path     : ${filePath}\n` +
      `> note        : plugin otomatis di-reload beberapa detik kemudian...`

    if (firstCommand) {
      return new Button(conn)
        .setBody(caption)
        .addReply('Tes Plugin', `${m.prefix || '.'}${firstCommand}`)
        .send(m.chat, { quoted: m })
    }

    return m.reply(caption)
  }
}