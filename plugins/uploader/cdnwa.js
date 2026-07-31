export default {
  name: "cdnwa",
  category: "uploader",
  command: ["cdnwa"],
  alias: ["cds"],

  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {
    if (!m.quoted?.isMedia) return m.reply("Reply gambar yang mau diupload ke CDN WhatsApp")
    if (!m.quoted.msg.mimetype?.startsWith("image/")) return m.reply("Media yang direply harus berupa gambar")

    const { prepareWAMessageMedia } = await import("@whiskeysockets/baileys")
    const buffer = await m.quoted.download()

    const media = await prepareWAMessageMedia(
      { image: buffer },
      { upload: conn.waUploadToServer }
    )

    await m.reply(JSON.stringify(media, null, 2))
  }
}