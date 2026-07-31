import { watchFile, unwatchFile } from "fs";
import { fileURLToPath } from "url";
import log from "#lib/system/logger.js";
import { LanguageManager } from "#lib/system/LanguageManager.js";

global.PAIRING_NUMBER = xxxxx;

global.ownerNumber = ["xxxxx", "xxxxx", "xxxxx"];

global.IS_PUBLIC = false;

global.telegram = {
  token: "7283623395:xxxxx",
  chatId: "xxxxx"
};

global.githubToken = "xxxxx";
global.vercelToken = "xxxxx";
global.netlifyToken = "xxxxx";

global.uploaderConfig = {
  owner: "bayuasli",
  branch: "main",
  repos: ["sbyuxd-uploader"]
};

const langManager = new LanguageManager("en");
langManager.setLanguage("en");
global.lang = langManager;

global.mess = {
  wait: lang.get("mess.wait"),
  owner: lang.get("mess.owner"),
  group: lang.get("mess.group"),
  admin: lang.get("mess.admin"),
  botAdmin: lang.get("mess.botAdmin"),
  private: lang.get("mess.private"),
};

global.stickpack = '\n'.repeat(20)
global.stickauth = "sbyuxD\n\n[ Develop ] ";
global.title = "sbyuxD !";
global.body = "#–시간 Z3PHWOLF !";
global.thumbnailUrl = "https://raw.githubusercontent.com/bayuasli/sbyuxd-uploader/main/uploads/0875d7-1784786862439.jpg";
global.thumbnailDir = "#lib/media";

const file = fileURLToPath(import.meta.url);
watchFile(file, () => {
  unwatchFile(file);
  log.info("config.js reloaded");
  import(`${file}?update=${Date.now()}`);
});