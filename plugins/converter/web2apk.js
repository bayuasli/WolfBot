import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://webappcreator.amethystlab.org'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': BASE_URL,
  'Referer': BASE_URL + '/'
}

function generatePackageName(appName) {
  const cleaned = appName.toLowerCase().replace(/[^a-z0-9]/g, '')
  return `com.${cleaned}.app`
}

async function buildApk(websiteUrl, appName, iconBuffer, packageName, versionName = '1.0.0', versionCode = 1) {
  const tmpDir = './tmp'
  fs.mkdirSync(tmpDir, { recursive: true })
  const iconPath = path.join(tmpDir, `icon-${Date.now()}.jpg`)
  fs.writeFileSync(iconPath, iconBuffer)

  try {
    const form = new FormData()
    form.append('websiteUrl', websiteUrl)
    form.append('appName', appName)
    form.append('icon', fs.createReadStream(iconPath))
    form.append('packageName', packageName || generatePackageName(appName))
    form.append('versionName', versionName)
    form.append('versionCode', String(versionCode))

    const { data } = await axios.post(`${BASE_URL}/api/build-apk`, form, {
      headers: { ...HEADERS, ...form.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })

    if (data.success) data.fullDownloadUrl = `${BASE_URL}${data.downloadUrl}`
    return data
  } finally {
    fs.unlinkSync(iconPath)
  }
}

export default {
  name: 'web2apk',
  category: 'converter',
  command: ['toapp', 'web2apk'],
  alias: [],

  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m, { downloadM, quoted }) => {
    if (!m.isQuoted || !/image/.test((quoted.msg || quoted).mimetype || '')) {
      return m.reply(
        `*Web to APK*\n\nFormat: reply foto lalu\n.toapp <url> | <nama app> | <package> | <versi>\n\nContoh:\n.toapp https://youtube.com | YouTube Pro | com.yt.pro | 1.0.0`
      )
    }

    const args = m.text?.split('|').map(s => s.trim()) || []
    const [url, appName, packageName, versionName = '1.0.0'] = args

    if (!url || !appName) return m.reply('Format: .toapp <url> | <nama app> | <package> | <versi>')

    await m.reply('Membangun APK, mohon tunggu...')

    try {
      const iconBuffer = await downloadM()
      const result = await buildApk(url, appName, iconBuffer, packageName, versionName)

      if (!result.success) return m.reply('Gagal build APK: ' + (result.message || 'Unknown error'))

      await m.reply(`Berhasil build, mengunduh APK...`)

      const apkRes = await axios.get(result.fullDownloadUrl, { responseType: 'arraybuffer' })
      const apkBuffer = Buffer.from(apkRes.data)
      const fileName = `${appName.replace(/\s+/g, '_')}-${versionName}.apk`

      await conn.sendMessage(m.chat, {
        document: apkBuffer,
        mimetype: 'application/vnd.android.package-archive',
        fileName,
        caption:
          `*${appName}*\n\n` +
          `› Package : ${packageName || generatePackageName(appName)}\n` +
          `› Versi   : ${versionName}\n` +
          `› URL     : ${url}`
      }, { quoted: m })
    } catch (e) {
      m.reply('Gagal: ' + e.message)
    }
  }
}