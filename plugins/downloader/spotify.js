import { search, getDownloadLinks } from '#scrape/spotify.js'
import { Button } from '#helper'

const searchCache = new Map()

async function fetchBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Gagal mengunduh audio dari Spotidown.')
  return Buffer.from(await res.arrayBuffer())
}

export default {
  name: 'spotify',
  category: 'downloader',
  command: ['spotify', 'spotifydl', 'sp', 'spdl'],
  alias: [],

  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {
    if (m.command === 'spotify' || m.command === 'spotifydl' || m.command === 'sp') {
      const input = (m.text || '').trim()
      if (!input) return m.reply(`Contoh:\n${m.prefix}spotify judul lagu\natau\n${m.prefix}spotify https://open.spotify.com/track/xxxxx`)

      const { tracks, sessionCookie } = await search(input)
      if (tracks.length === 0) return m.reply('Track tidak ditemukan.')

      const top = tracks.slice(0, 8)
      searchCache.set(m.sender, { top, sessionCookie })

      const btn = new Button(conn)
        .setTitle('Hasil Pencarian Spotify')
        .setBody(`Ditemukan ${top.length} track untuk "${input}"`)
        .setFooter('Spotidown')
        .addSelection('Pilih Track', {})
        .makeSection('Hasil Pencarian')

      top.forEach((track, i) => {
        const meta = track.metadata
        btn.makeRow(
          '',
          meta.name || 'Unknown',
          `${meta.artist || '-'}${meta.album ? ` · ${meta.album}` : ''}`,
          `${m.prefix}spotifyget ${i + 1}`
        )
      })

      return btn.send(m.chat, { quoted: m })
    }

    if (m.command === 'spotifyget') {
      const idx = parseInt(m.text) - 1
      const cached = searchCache.get(m.sender)

      if (!cached) return m.reply('Sesi pencarian sudah habis, cari ulang dengan `.spotify <judul>`.')
      const track = cached.top[idx]
      if (isNaN(idx) || !track) return m.reply('Pilihan tidak valid.')

      const links = await getDownloadLinks(track.form, cached.sessionCookie)
      if (!links.mp3) return m.reply('Gagal mendapat link download untuk track ini.')

      const meta = track.metadata
      const title = meta.name || 'Spotify Track'
      const artist = meta.artist || 'Unknown'

      await m.reply(
        `*SPOTIFY*\n\n` +
        `Judul: ${title}\n` +
        `Artist: ${artist}\n` +
        `Album: ${meta.album || '-'}\n\n` +
        `Mengunduh...`
      )

      const audioBuffer = await fetchBuffer(links.mp3)

      await conn.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`
      }, { quoted: m })
    }
  }
}