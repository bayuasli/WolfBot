import os from 'os'
import { execSync } from 'child_process'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

function getMemInfo() {
  try {
    const lines = execSync('cat /proc/meminfo').toString().split('\n')
    const get = key => {
      const line = lines.find(l => l.startsWith(key))
      return line ? parseInt(line.split(/\s+/)[1]) * 1024 : 0
    }
    return {
      total: get('MemTotal'),
      free: get('MemFree'),
      available: get('MemAvailable'),
      buffers: get('Buffers'),
      cached: get('Cached:'),
      swapTotal: get('SwapTotal'),
      swapFree: get('SwapFree'),
      swapCached: get('SwapCached'),
      shmem: get('Shmem'),
      sreclaimable: get('SReclaimable')
    }
  } catch {
    const total = os.totalmem()
    const free = os.freemem()
    return { total, free, available: free, buffers: 0, cached: 0, swapTotal: 0, swapFree: 0, swapCached: 0, shmem: 0, sreclaimable: 0 }
  }
}

function getProcessMemory() {
  const mem = process.memoryUsage()
  return {
    rss: mem.rss,
    heapTotal: mem.heapTotal,
    heapUsed: mem.heapUsed,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers
  }
}

function bar(used, total, len = 15) {
  const pct = Math.min(used / total, 1)
  const filled = Math.round(pct * len)
  return `[${'█'.repeat(filled)}${'░'.repeat(len - filled)}] ${(pct * 100).toFixed(1)}%`
}

export default {
  name: 'memory',
  category: 'info',
  command: ['memory', 'mem', 'mem'],
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
    const sys = getMemInfo()
    const proc = getProcessMemory()

    const used = sys.total - sys.available
    const cached = sys.cached + sys.sreclaimable - sys.shmem
    const swapUsed = sys.swapTotal - sys.swapFree

    await m.reply(
      `*Memory Info*\n` +
      `${'─'.repeat(22)}\n\n` +

      `*System RAM*\n` +
      `› Total     : ${formatBytes(sys.total)}\n` +
      `› Used      : ${formatBytes(used)}\n` +
      `› Free      : ${formatBytes(sys.free)}\n` +
      `› Available : ${formatBytes(sys.available)}\n` +
      `› Buffers   : ${formatBytes(sys.buffers)}\n` +
      `› Cached    : ${formatBytes(cached)}\n` +
      `${bar(used, sys.total)}\n\n` +

      `*Swap*\n` +
      `› Total     : ${formatBytes(sys.swapTotal)}\n` +
      `› Used      : ${formatBytes(swapUsed)}\n` +
      `› Free      : ${formatBytes(sys.swapFree)}\n` +
      `› Cached    : ${formatBytes(sys.swapCached)}\n` +
      `${sys.swapTotal > 0 ? bar(swapUsed, sys.swapTotal) : '[tidak tersedia]'}\n\n` +

      `*Process (Bot)*\n` +
      `› RSS         : ${formatBytes(proc.rss)}\n` +
      `› Heap Total  : ${formatBytes(proc.heapTotal)}\n` +
      `› Heap Used   : ${formatBytes(proc.heapUsed)}\n` +
      `› External    : ${formatBytes(proc.external)}\n` +
      `› ArrayBuffers: ${formatBytes(proc.arrayBuffers)}\n` +
      `${bar(proc.heapUsed, proc.heapTotal)}\n\n` +

      `${'─'.repeat(22)}\n` +
      `_CPU: ${os.cpus().length} Core | ${os.cpus()[0]?.model?.trim()}_`
    )
  }
}