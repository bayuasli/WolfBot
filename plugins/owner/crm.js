import { Button } from '#helper'

function detectAdditionalNodes(targetMessage) {
  const keys = Object.keys(targetMessage)

  if (keys.some(k => k.startsWith('pollCreationMessage'))) {
    return [{ tag: 'meta', attrs: { polltype: 'creation' } }]
  }

  if (keys.includes('eventMessage')) {
    return [{ tag: 'meta', attrs: { event_type: 'creation' } }]
  }

  if (keys.includes('botForwardedMessage')) {
    return [
      { attrs: { biz_bot: '1' }, tag: 'bot' },
      { attrs: {}, tag: 'biz' }
    ]
  }

  const buttons =
    targetMessage.interactiveMessage?.nativeFlowMessage?.buttons ||
    targetMessage.viewOnceMessage?.message?.interactiveMessage?.nativeFlowMessage?.buttons ||
    null

  if (!buttons || !buttons.length) return null

  const buttonNames = [...new Set(buttons.map(b => b.name))]

  if (buttonNames.includes('cta_catalog')) {
    return [{ tag: 'biz', attrs: { native_flow_name: 'catalog_message' } }]
  }

  if (buttonNames.includes('review_and_pay')) {
    return [{ tag: 'biz', attrs: { native_flow_name: 'order_details' } }]
  }

  return [{
    tag: 'biz',
    attrs: {},
    content: [{
      tag: 'interactive',
      attrs: { type: 'native_flow', v: '1' },
      content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
    }]
  }]
}

export default {
  name: 'crm',
  category: 'owner',
  command: ['crm'],

  settings: {
    owner: true,
    private: false,
    group: false,
    admin: false,
    botAdmin: false,
    loading: false
  },

  run: async (conn, m) => {
    if (!m.isQuoted) return m.reply('Reply pesan yang mau diambil datanya.')

    const targetMessage = m.quoted.message
    if (!targetMessage) return m.reply('Gagal mengambil raw message.')

    let raw
    try {
      raw = JSON.stringify(targetMessage, (key, value) => {
        if (Buffer.isBuffer(value)) return { __buf: value.toString('base64') }
        if (value?.type === 'Buffer' && Array.isArray(value.data)) {
          return { __buf: Buffer.from(value.data).toString('base64') }
        }
        return value
      }, 2)
    } catch (err) {
      return m.reply('Gagal serialize raw message: ' + err.message)
    }

    const sizeKb = Buffer.byteLength(raw, 'utf-8') / 1024
    if (sizeKb > 15000) {
      return m.reply(`Raw message terlalu besar (${(sizeKb / 1024).toFixed(1)} MB), proses dibatalkan.`)
    }

    const detectedNodes = detectAdditionalNodes(targetMessage)
    const additionalNodesLine = detectedNodes
      ? `\n  additionalNodes: ${JSON.stringify(detectedNodes, null, 2).replace(/\n/g, '\n  ')},`
      : ''

    const jsContent = `const jid = "${m.chat}";
const rawContent = ${raw};

function reviveBuffers(obj){
  if(obj && typeof obj === 'object'){
    if(obj.__buf){
      return Buffer.from(obj.__buf, 'base64')
    }
    for(let k in obj){
      obj[k] = reviveBuffers(obj[k])
    }
  }
  return obj
}

const content = reviveBuffers(rawContent)

const relayOptions = {
  messageId: "SBYUXD" + Date.now(),${additionalNodesLine}
}

await conn.relayMessage(jid, content, relayOptions)
return relayOptions.messageId
`

    const buffer = Buffer.from(jsContent, 'utf-8')
    const typeName = m.quoted.type || Object.keys(targetMessage)[0] || 'unknown'
    const randomStr = Math.random().toString(36).slice(2, 7)
    const fileName = `${typeName}-${randomStr}.js`

    try {
      await new Button(conn)
        .setDocument(buffer, { mimetype: 'application/javascript', fileName })
        .setBody(
          `relayMessage generated!\n\n` +
          `Jenis   : ${typeName}\n` +
          `Ukuran  : ${sizeKb.toFixed(1)} KB\n` +
          `Nodes   : ${detectedNodes ? (detectedNodes[0].attrs?.native_flow_name || detectedNodes[0].tag) : 'tidak ada'}`
        )
        .addReply('Run', '.run')
        .send(m.chat, { quoted: m })
    } catch (err) {
      return m.reply('Gagal mengirim file: ' + err.message)
    }
  }
}