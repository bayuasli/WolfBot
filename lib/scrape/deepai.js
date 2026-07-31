import crypto from 'crypto';

function generateIslandKey(userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36") {
  let myrandomstr = Math.round((Math.random() * 100000000000)) + "";
  const myhashfunction = (function() {
    const a = [];
    for (let b = 0; 64 > b;)
      a[b] = 0 | 4294967296 * Math.sin(++b % Math.PI);
    return function(input) {
      let d, e, f, g = [d = 1732584193, e = 4023233417, ~d, ~e], h = [], l = unescape(encodeURI(input)) + "\u0080", k = l.length;
      let c = --k / 4 + 2 | 15;
      for (h[--c] = 8 * k; ~k;)
        h[k >> 2] |= l.charCodeAt(k) << 8 * k--;
      for (let b = 0, l = 0; b < c; b += 16) {
        for (k = g; 64 > l; k = [f = k[3], d + ((f = k[0] + [d & e | ~d & f, f & d | ~f & e, d ^ e ^ f, e ^ (d | ~f)][k = l >> 4] + a[l] + ~~h[b | [l, 5 * l + 1, 3 * l + 5, 7 * l][k] & 15]) << (k = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][4 * k + l++ % 4]) | f >>> -k), d, e])
          d = k[1] | 0, e = k[2];
        for (l = 4; l;)
          g[--l] += k[l];
      }
      let result = "";
      for (let l = 0; 32 > l;)
        result += (g[l >> 3] >> 4 * (1 ^ l++) & 15).toString(16);
      return result.split("").reverse().join("");
    };
  })();
  const tryitApiKey = 'tryit-' + myrandomstr + '-' + myhashfunction(userAgent + myhashfunction(userAgent + myhashfunction(userAgent + myrandomstr + 'hackers_become_a_little_stinkier_every_time_they_hack')));
  return tryitApiKey;
}

export async function deepAIChat(messages, options = {}) {
  const model = options.model || 'standard';
  const onChunk = options.onChunk || (() => {});
  const userAgent = options.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
  const key = generateIslandKey(userAgent);
  const sessionUUID = options.sessionUUID || crypto.randomUUID();
  const sensitivityRequestID = options.sensitivityRequestID || crypto.randomUUID();

  const fd = new FormData();
  fd.append('chat_style', 'chat');
  fd.append('model', model);
  fd.append('session_uuid', sessionUUID);
  fd.append('sensitivity_request_id', sensitivityRequestID);
  fd.append('hacker_is_stinky', 'very_stinky');
  fd.append('enabled_tools', JSON.stringify(['image_generator', 'image_editor']));
  fd.append('chatHistory', JSON.stringify(messages));

  const res = await fetch("https://api.deepai.org/hacking_is_a_serious_crime", {
    method: "POST",
    headers: {
      "api-key": key,
      "user-agent": userAgent,
      "referer": "https://deepai.org/chat",
      "origin": "https://deepai.org"
    },
    body: fd
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `HTTP ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.status || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  const reader = res.body;
  const decoder = new TextDecoder("utf-8");
  let fullText = "";

  for await (const chunk of reader) {
    const chunkText = decoder.decode(chunk, { stream: true });
    onChunk(chunkText);
    fullText += chunkText;
  }
  return fullText;
}

export const models = [
  'standard',
  'deepseek-v3.2',
  'gemini-2.5-flash-lite',
  'gemma-4',
  'llama-3.3-70b-instruct',
  'gpt-oss-120b',
  'gpt-5-nano'
];