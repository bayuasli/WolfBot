import { bratVid } from "brat-canvas/video"
import { spawn } from "child_process"
import fs from "fs"

export default {
  name: "bratvid",
  category: "sticker",
  command: ["bratvid", "bratvd"],

  run: async (conn, m) => {
    if (!m.text) return m.reply("masukkan teks")

    let mp4 = await bratVid(m.text, {
      fast: true,
      outputFormat: "mp4"
    })

    let input = "./tmp_" + Date.now() + ".mp4"
    let output = input + ".webp"

    fs.writeFileSync(input, mp4)

    await new Promise((resolve, reject) => {
      spawn("ffmpeg", [
        "-y",
        "-i", input,
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15",
        "-vcodec", "libwebp",
        "-loop", "0",
        "-preset", "default",
        "-an",
        "-vsync", "0",
        output
      ])
      .on("close", resolve)
      .on("error", reject)
    })

    let webp = fs.readFileSync(output)

    await conn.sendMessage(
      m.chat,
      { sticker: webp },
      { quoted: m }
    )

    fs.unlinkSync(input)
    fs.unlinkSync(output)
  }
}
