
import axios from "axios";
import fs from "fs";

class AskMe {
  constructor() {
    this.askmeUrl = "https://askme.matlubapps.com/ask-me";
    this.askmeKey = "ak8asda9$5kpq";
    this.askmeModel = "gpt_4__1_nano";
    this.ai4chatUrl = "https://yw85opafq6.execute-api.us-east-1.amazonaws.com/default/boss_mode_15aug";
    this.history = [];
    this.systemPrompt = "Kamu adalah AI assistant yang membantu dalam bahasa Indonesia. Jawab dengan singkat, jelas, dan informatif.";
  }

  async resolveMedia(input) {
    if (!input) return "";
    if (Buffer.isBuffer(input)) return input.toString("base64");
    if (typeof input === "string") {
      if (input.startsWith("http://") || input.startsWith("https://")) {
        const { data } = await axios.get(input, { responseType: "arraybuffer", timeout: 30000 });
        return Buffer.from(data).toString("base64");
      }
      if (input.startsWith("data:")) return input.split(",")[1];
      if (fs.existsSync(input)) return fs.readFileSync(input).toString("base64");
      return input;
    }
    return "";
  }

  async chatImage(prompt, image) {
    const b64 = await this.resolveMedia(image);
    this.history.push({ role: "user", content: prompt, data: b64 });

    const { data } = await axios.post(this.askmeUrl, {
      history: this.history,
      isPremium: false,
      modelname: this.askmeModel,
    }, {
      headers: { "Content-Type": "application/json", key: this.askmeKey },
      timeout: 60000,
    });

    const reply = data.msg || data.text;
    if (!reply) throw new Error("Empty response from server");

    this.history.push({ role: "assistant", content: reply, data: "" });
    return { code: 200, msg: reply, source: "askme" };
  }

  async chatText(prompt) {
    const context = this.history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");
    const fullPrompt = context ? `${context}\nuser: ${prompt}` : prompt;

    const { data } = await axios.get(this.ai4chatUrl, {
      params: {
        text: fullPrompt,
        country: "Asia",
        user_id: "askme_user_" + Math.random().toString(36).slice(2, 10)
      },
      headers: {
        Origin: "https://www.ai4chat.co",
        Referer: "https://www.ai4chat.co/"
      },
      timeout: 30000,
    });

    const reply = typeof data === "string" ? data : (data.msg || data.text || data.result);
    if (!reply) throw new Error("Empty response from server");

    this.history.push({ role: "user", content: prompt });
    this.history.push({ role: "assistant", content: reply });

    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }

    return { code: 200, msg: reply, source: "ai4chat" };
  }

  async chat(prompt, { model, image } = {}) {
    if (image) {
      return this.chatImage(prompt || "deskripsikan gambar ini", image);
    }
    return this.chatText(prompt);
  }

  clearHistory() {
    this.history = [];
  }
}

export default AskMe;