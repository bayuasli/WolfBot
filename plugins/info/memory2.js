export default {
  name: "memory2",
  category: "info",
  command: ["ram2","memory2","mem2"],

  run: async (conn, m) => {

    const os = await import("os")

    const format = (b) => (b / 1024 / 1024).toFixed(2) + " MB"

    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem
    const percent = ((usedMem / totalMem) * 100).toFixed(2)

    const mem = process.memoryUsage()

    const cpu1 = process.cpuUsage()
    await new Promise(r => setTimeout(r, 500))
    const cpu2 = process.cpuUsage(cpu1)

    const cpuUser = (cpu2.user / 1000).toFixed(2)
    const cpuSys = (cpu2.system / 1000).toFixed(2)

    const load = os.loadavg()[0].toFixed(2)

    const uptime = process.uptime()
    const up = `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m ${Math.floor(uptime%60)}s`

    let status = "NORMAL"
    if (percent > 80) status = "TINGGI"
    if (percent > 90) status = "KRITIS"

    const text = `
⎯⟢ ⚝ SYSTEM MONITOR ⚝ ⟣⎯

RAM SYSTEM
Total   : ${format(totalMem)}
Used    : ${format(usedMem)}
Free    : ${format(freeMem)}
Usage   : ${percent}%

NODE MEMORY
RSS         : ${format(mem.rss)}
Heap Total  : ${format(mem.heapTotal)}
Heap Used   : ${format(mem.heapUsed)}
External    : ${format(mem.external)}

CPU
User    : ${cpuUser} ms
System  : ${cpuSys} ms
Load    : ${load}

UPTIME
${up}

STATUS
${status}

DEVICE
Platform : ${process.platform}
Node     : ${process.version}
PID      : ${process.pid}
`.trim()

    await m.reply(text)

    if (percent > 90) {
      await m.reply("WARNING: MEMORY KRITIS")
    }

  }
}