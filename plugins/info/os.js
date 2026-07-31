import os from 'os'

export default {
  name: "os",
  category: "info",
  command: ["ping", "os"],
  settings: {
    owner: false,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {

    const start = process.hrtime()
    const used = process.memoryUsage()

    const cpus = os.cpus()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()

    const diff = process.hrtime(start)
    const latency = (diff[0] * 1e9 + diff[1]) / 1e6

    const cpuInfo = cpus[0]

    const cpuUsage = Object.keys(cpuInfo.times)
      .map(type => {
        const percent = (100 * cpuInfo.times[type]) / Object.values(cpuInfo.times).reduce((a, b) => a + b, 0)
        return `${type.padEnd(6)} : ${percent.toFixed(2)}%`
      })
      .join('\n')

    const memoryUsage = Object.keys(used)
      .map(key => `${key.padEnd(12)} : ${(used[key] / 1024 / 1024).toFixed(2)} MB`)
      .join('\n')

    const uptime = process.uptime()
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)

    const respon = `
Kecepatan Respon : ${latency.toFixed(2)} ms

Waktu Berjalan   : ${hours}h ${minutes}m ${seconds}s

Info Server
RAM              : ${((totalMem - freeMem) / 1024 / 1024).toFixed(2)} MB / ${(totalMem / 1024 / 1024).toFixed(2)} MB

NodeJS Memory Usage
${memoryUsage}

CPU
${cpuInfo.model}
${cpuUsage}
`.trim()

    await m.reply(respon)
  }
}