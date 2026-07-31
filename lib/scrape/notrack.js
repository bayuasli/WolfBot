import crypto from 'crypto'

export async function notrack(query) {
  const sessionId = crypto.randomBytes(8).toString('hex')
  const uid = crypto.randomUUID()

  const payload = JSON.stringify({
    user_input: query,
    mode: 'usual',
    model: 'C',
    persona: 'normal',
    max_turns: 6,
    chat_id: null,
    attachments: [],
    regenerate: false,
    edit: false,
    edit_mid: null
  })

  const res = await fetch('https://notrack.ai/api/dispatch', {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'accept-language': 'id-ID',
      'content-type': 'application/json',
      'cookie': `si_usr_id=${sessionId}; si_ses_id=${sessionId}; uid=${uid}`,
      'origin': 'https://notrack.ai',
      'referer': 'https://notrack.ai/chat',
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36'
    },
    body: payload
  })

  if (!res.ok || !res.body) {
    throw new Error(`WormGpt merespons dengan status ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (jsonStr === '[DONE]') continue

      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed.content) fullText += parsed.content
      } catch {}
    }
  }

  return {
    pertanyaan: query,
    jawaban: fullText.trim() || 'Tidak ada respon yang diterima.'
  }
}