import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const rootDir = process.cwd();

function getAllowedPaths() {
  const base = rootDir;
  const allowed = [
    base,
    path.join(base, 'plugins'),
    path.join(base, 'lib'),
    path.join(base, 'helper'),
    path.join(base, 'tmp'),
    path.join(base, 'sessions'),
    path.join(base, 'assets'),
    path.join(base, 'config.js'),
    path.join(base, 'handler.js'),
    path.join(base, 'index.js'),
    path.join(base, 'package.json')
  ];
  return allowed;
}

function isPathAllowed(targetPath) {
  const allowed = getAllowedPaths();
  const normalized = path.resolve(targetPath);
  return allowed.some(allowedPath => {
    return normalized.startsWith(path.resolve(allowedPath));
  });
}

function getFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function getFileIcon(filename) {
  const ext = path.extname(filename).toLowerCase();
  const icons = {
    '.js': '📜',
    '.json': '📋',
    '.html': '🌐',
    '.css': '🎨',
    '.md': '📝',
    '.txt': '📄',
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.gif': '🖼️',
    '.webp': '🖼️',
    '.mp4': '🎬',
    '.mp3': '🎵',
    '.zip': '📦',
    '.rar': '📦',
    '.tar': '📦',
    '.gz': '📦',
    '.exe': '⚙️',
    '.sh': '🐚',
    '.py': '🐍',
    '.yml': '⚡',
    '.yaml': '⚡',
    '.xml': '📰',
    '.sql': '🗄️',
    '.db': '🗄️'
  };
  return icons[ext] || '📁';
}

function getDirectoryTree(dir, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return '...';
  
  let tree = '';
  const items = fs.readdirSync(dir);
  const sorted = items.sort((a, b) => {
    const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
    const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  for (const item of sorted) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    const prefix = '  '.repeat(depth) + (depth > 0 ? '├ ' : '');
    
    if (stat.isDirectory()) {
      tree += `${prefix}📁 ${item}/\n`;
      tree += getDirectoryTree(fullPath, depth + 1, maxDepth);
    } else {
      const size = getFileSize(stat.size);
      const icon = getFileIcon(item);
      tree += `${prefix}${icon} ${item} (${size})\n`;
    }
  }
  return tree;
}

export default {
  name: 'file-manager',
  command: ['files', 'filemanager', 'fm', 'fs', 'ls', 'dir', 'cd', 'pwd', 'cat', 'view', 'read', 'edit', 'write', 'delete', 'rm', 'remove', 'rename', 'mv', 'move', 'copy', 'cp', 'mkdir', 'make', 'upload', 'download', 'zip', 'unzip', 'tar', 'search', 'find', 'info', 'stat', 'chmod', 'permission', 'backup', 'restore'],
  alias: ['fm', 'file', 'tree', 'listfile', 'getfile', 'dlfile', 'editfile'],

  settings: {
    owner: true,
    loading: false
  },

  async run(conn, m, ctx) {
    const { args, text, chat, sender } = m;
    const currentDir = global.fileManagerCwd || rootDir;

    const command = m.command;

    if (command === 'fm' || command === 'filemanager' || command === 'files') {
      if (args[0] === 'help' || args[0] === 'h' || !args[0]) {
        return showHelp(conn, m, currentDir);
      }
    }

    switch (command) {
      case 'help':
      case 'h':
        return showHelp(conn, m, currentDir);

      case 'ls':
      case 'dir':
      case 'listfile':
        return await listFiles(conn, m, currentDir, args);

      case 'tree':
        return await showTree(conn, m, currentDir, args);

      case 'cd':
        return await changeDirectory(conn, m, currentDir, args);

      case 'pwd':
        return m.reply(`📂 *Current Directory*\n\`${currentDir}\``);

      case 'cat':
      case 'view':
      case 'read':
        return await viewFile(conn, m, currentDir, text);

      case 'edit':
      case 'write':
        return await editFile(conn, m, currentDir, text, args);

      case 'delete':
      case 'rm':
      case 'remove':
        return await deleteFile(conn, m, currentDir, text);

      case 'rename':
      case 'mv':
      case 'move':
        return await renameFile(conn, m, currentDir, args);

      case 'copy':
      case 'cp':
        return await copyFile(conn, m, currentDir, args);

      case 'mkdir':
      case 'make':
        return await makeDirectory(conn, m, currentDir, text);

      case 'upload':
        return await uploadFile(conn, m, currentDir);

      case 'download':
        return await downloadFile(conn, m, currentDir, text);

      case 'info':
      case 'stat':
        return await fileInfo(conn, m, currentDir, text);

      case 'search':
      case 'find':
        return await searchFiles(conn, m, currentDir, text);

      case 'zip':
        return await zipFiles(conn, m, currentDir, args);

      case 'unzip':
        return await unzipFile(conn, m, currentDir, text);

      case 'backup':
        return await backupFiles(conn, m, currentDir);

      case 'restore':
        return await restoreBackup(conn, m, currentDir, text);

      case 'chmod':
      case 'permission':
        return await changePermission(conn, m, currentDir, args);

      default:
        return;
    }
  }
};

function showHelp(conn, m, dir) {
  const helpText = `╭──「 *FILE MANAGER HELP* 」──╮
│
│  📂 *Current Path:* 
│  ${dir}
│
│  📌 *NAVIGATION*
│  ├  ${m.prefix}ls [path]   - List files/folders
│  ├  ${m.prefix}tree [path] [depth] - Show directory tree
│  ├  ${m.prefix}cd [folder] - Change directory
│  └  ${m.prefix}pwd         - Show current path
│
│  📄 *FILE OPERATIONS*
│  ├  ${m.prefix}cat/read [file] - View file content
│  ├  ${m.prefix}edit [file] [content] - Create/edit file
│  ├  ${m.prefix}delete/rm [file] - Delete file/folder
│  ├  ${m.prefix}rename/mv [src] [dest] - Rename/move
│  ├  ${m.prefix}copy/cp [src] [dest] - Copy file/folder
│  ├  ${m.prefix}mkdir [name] - Create folder
│  ├  ${m.prefix}upload - Upload file from chat
│  ├  ${m.prefix}download [file] - Download file to chat
│  ├  ${m.prefix}info/stat [file] - File information
│  └  ${m.prefix}search/find [keyword] - Search files
│
│  📦 *ARCHIVE*
│  ├  ${m.prefix}zip [name] [files...] - Create zip archive
│  ├  ${m.prefix}unzip [file] - Extract zip archive
│  ├  ${m.prefix}backup - Create full backup
│  └  ${m.prefix}restore [file] - Restore from backup
│
│  🔐 *SYSTEM*
│  └  ${m.prefix}chmod [mode] [file] - Change file permission
│
│  🛡️ *SECURITY NOTES*
│  ├  Only owner can access this feature
│  ├  Restricted paths: plugins, lib, helper, etc.
│  └  All operations are logged
│
│  📝 *EXAMPLES*
│  ├  ${m.prefix}ls plugins
│  ├  ${m.prefix}cd lib/system
│  ├  ${m.prefix}read handler.js
│  ├  ${m.prefix}search function
│  ├  ${m.prefix}zip mybackup plugins lib config.js
│  └  ${m.prefix}backup
│
╰─────────────────────

💡 Use *${m.prefix}fm help* or *${m.prefix}fm* for this menu`;

  return m.reply(helpText);
}

async function listFiles(conn, m, dir, args) {
  try {
    const target = args[0] || '.';
    const fullPath = path.resolve(dir, target);

    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(fullPath)) {
      return m.reply(`❌ Path tidak ditemukan: ${fullPath}`);
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      const info = await getFileInfo(fullPath);
      return m.reply(info);
    }

    const items = fs.readdirSync(fullPath);
    if (items.length === 0) {
      return m.reply(`📂 *${fullPath}*\n\n└ Kosong`);
    }

    let files = [];
    let directories = [];
    let totalSize = 0;

    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      try {
        const itemStat = fs.statSync(itemPath);
        const size = getFileSize(itemStat.size);
        totalSize += itemStat.size;
        const icon = getFileIcon(item);
        const modified = formatDate(itemStat.mtimeMs);
        
        if (itemStat.isDirectory()) {
          directories.push(`📁 ${item}/`);
        } else {
          files.push(`${icon} ${item} (${size})`);
        }
      } catch {}
    }

    const sorted = [...directories, ...files];
    const list = sorted.map((item, i) => `${String(i + 1).padStart(3, ' ')}. ${item}`).join('\n');

    const msg = `📂 *Directory: ${fullPath}*\n` +
      `📊 Items: ${items.length} (${directories.length} dir, ${files.length} files)\n` +
      `💾 Total: ${getFileSize(totalSize)}\n\n` +
      `${list}` +
      `\n\n📌 Gunakan *${m.prefix}cd [folder]* untuk masuk ke folder\n` +
      `📌 Gunakan *${m.prefix}fm help* untuk bantuan`;

    return m.reply(msg);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function showTree(conn, m, dir, args) {
  try {
    const target = args[0] || '.';
    const fullPath = path.resolve(dir, target);
    const depth = parseInt(args[1]) || 3;

    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(fullPath)) {
      return m.reply(`❌ Path tidak ditemukan: ${fullPath}`);
    }

    const tree = getDirectoryTree(fullPath, 0, depth);
    const msg = `🌳 *Directory Tree*\n📂 ${fullPath}\n\n${tree}\n\n📌 Gunakan *${m.prefix}fm help* untuk bantuan`;
    
    if (msg.length > 65536) {
      const filepath = path.join(rootDir, 'tmp', 'tree.txt');
      fs.writeFileSync(filepath, msg);
      await conn.sendMessage(m.chat, { 
        document: fs.readFileSync(filepath),
        mimetype: 'text/plain',
        fileName: 'tree.txt'
      }, { quoted: m });
      fs.unlinkSync(filepath);
      return;
    }

    return m.reply(msg);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function changeDirectory(conn, m, dir, args) {
  try {
    const target = args[0] || '.';
    let fullPath = path.resolve(dir, target);
    
    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(fullPath)) {
      return m.reply(`❌ Path tidak ditemukan: ${fullPath}`);
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      return m.reply(`❌ ${fullPath} bukan folder`);
    }

    global.fileManagerCwd = fullPath;
    return m.reply(`✅ Pindah ke: \`${fullPath}\`\n📌 Gunakan *${m.prefix}ls* untuk melihat isi folder`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function viewFile(conn, m, dir, text) {
  try {
    if (!text) return m.reply(`Masukkan nama file\n📌 Contoh: ${m.prefix}read handler.js`);

    const fullPath = path.resolve(dir, text);
    
    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(fullPath)) {
      return m.reply(`❌ File tidak ditemukan: ${fullPath}`);
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return m.reply('❌ Ini adalah folder, bukan file');
    }

    const size = stat.size;
    if (size > 5 * 1024 * 1024) {
      return m.reply(`❌ File terlalu besar: ${getFileSize(size)}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(fullPath).toLowerCase();
    const langMap = {
      '.js': 'javascript',
      '.json': 'json',
      '.html': 'html',
      '.css': 'css',
      '.md': 'markdown',
      '.txt': 'text',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.xml': 'xml',
      '.sql': 'sql',
      '.py': 'python',
      '.sh': 'bash'
    };

    const lang = langMap[ext] || 'text';
    const maxLines = 200;
    const lines = content.split('\n');
    let display = lines.slice(0, maxLines).join('\n');
    if (lines.length > maxLines) {
      display += `\n... (${lines.length - maxLines} more lines)`;
    }

    const info = `📄 *File: ${path.basename(fullPath)}*\n` +
      `📂 Path: \`${fullPath}\`\n` +
      `📊 Size: ${getFileSize(size)}\n` +
      `📝 Lines: ${lines.length}\n` +
      `📌 Type: ${lang.toUpperCase()}\n` +
      `🕐 Modified: ${formatDate(stat.mtimeMs)}\n\n` +
      '```' + lang + '\n' + display + '\n```';

    if (info.length > 65536) {
      const filepath = path.join(rootDir, 'tmp', 'view.txt');
      fs.writeFileSync(filepath, content);
      await conn.sendMessage(m.chat, { 
        document: fs.readFileSync(filepath),
        mimetype: 'text/plain',
        fileName: path.basename(fullPath)
      }, { quoted: m });
      fs.unlinkSync(filepath);
      return;
    }

    return m.reply(info);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function editFile(conn, m, dir, text, args) {
  try {
    if (!text) return m.reply(`Format: ${m.prefix}edit [nama_file] [konten]\n📌 Contoh: ${m.prefix}edit test.txt Hello World`);

    const parts = text.split(/\s+/);
    const filename = parts[0];
    const content = parts.slice(1).join(' ');

    if (!content) return m.reply('Masukkan konten file');

    const fullPath = path.resolve(dir, filename);
    
    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return m.reply('❌ Ini adalah folder, bukan file');
      }
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    return m.reply(`✅ File berhasil disimpan: \`${fullPath}\`\n📝 Size: ${getFileSize(content.length)}`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function deleteFile(conn, m, dir, text) {
  try {
    if (!text) return m.reply(`Masukkan nama file/folder\n📌 Contoh: ${m.prefix}delete test.txt`);

    const fullPath = path.resolve(dir, text);
    
    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(fullPath)) {
      return m.reply(`❌ Path tidak ditemukan: ${fullPath}`);
    }

    const stat = fs.statSync(fullPath);
    const name = path.basename(fullPath);

    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      return m.reply(`✅ Folder berhasil dihapus: ${name}`);
    } else {
      fs.unlinkSync(fullPath);
      return m.reply(`✅ File berhasil dihapus: ${name}`);
    }
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function renameFile(conn, m, dir, args) {
  try {
    if (args.length < 2) {
      return m.reply(`Format: ${m.prefix}mv [sumber] [tujuan]\n📌 Contoh: ${m.prefix}mv old.txt new.txt`);
    }

    const source = args[0];
    const destination = args.slice(1).join(' ');

    const sourcePath = path.resolve(dir, source);
    const destPath = path.resolve(dir, destination);

    if (!isPathAllowed(sourcePath) || !isPathAllowed(destPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(sourcePath)) {
      return m.reply(`❌ Sumber tidak ditemukan: ${sourcePath}`);
    }

    if (fs.existsSync(destPath)) {
      return m.reply(`❌ Tujuan sudah ada: ${destPath}`);
    }

    fs.renameSync(sourcePath, destPath);
    return m.reply(`✅ Berhasil direname:\n📂 \`${source}\` → \`${destination}\``);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function copyFile(conn, m, dir, args) {
  try {
    if (args.length < 2) {
      return m.reply(`Format: ${m.prefix}cp [sumber] [tujuan]\n📌 Contoh: ${m.prefix}cp file.txt backup.txt`);
    }

    const source = args[0];
    const destination = args.slice(1).join(' ');

    const sourcePath = path.resolve(dir, source);
    const destPath = path.resolve(dir, destination);

    if (!isPathAllowed(sourcePath) || !isPathAllowed(destPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(sourcePath)) {
      return m.reply(`❌ Sumber tidak ditemukan: ${sourcePath}`);
    }

    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      fs.cpSync(sourcePath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }

    return m.reply(`✅ Berhasil di-copy:\n📂 \`${source}\` → \`${destination}\``);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function makeDirectory(conn, m, dir, text) {
  try {
    if (!text) return m.reply(`Masukkan nama folder\n📌 Contoh: ${m.prefix}mkdir newfolder`);

    const fullPath = path.resolve(dir, text);
    
    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (fs.existsSync(fullPath)) {
      return m.reply(`❌ Path sudah ada: ${fullPath}`);
    }

    fs.mkdirSync(fullPath, { recursive: true });
    return m.reply(`✅ Folder berhasil dibuat: \`${fullPath}\``);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function uploadFile(conn, m, dir) {
  try {
    const quoted = m.isQuoted ? m.quoted : m;
    if (!quoted.isMedia) {
      return m.reply(`Reply/kirim file yang ingin diupload\n📌 Kirim file dengan caption atau reply file`);
    }

    const filePath = await conn.downloadMediaMessage(quoted);
    const filename = quoted.msg?.fileName || `file_${Date.now()}`;
    const ext = path.extname(filename) || '.bin';
    const fullPath = path.resolve(dir, filename);

    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    fs.writeFileSync(fullPath, filePath);
    const size = getFileSize(filePath.length);

    return m.reply(`✅ File berhasil diupload:\n📄 ${filename}\n📂 \`${fullPath}\`\n💾 ${size}`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function downloadFile(conn, m, dir, text) {
  try {
    if (!text) return m.reply(`Masukkan nama file\n📌 Contoh: ${m.prefix}download handler.js`);

    const fullPath = path.resolve(dir, text);
    
    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(fullPath)) {
      return m.reply(`❌ File tidak ditemukan: ${fullPath}`);
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return m.reply('❌ Ini adalah folder, bukan file');
    }

    const data = fs.readFileSync(fullPath);
    const type = await fileTypeFromBuffer(data) || { mime: 'application/octet-stream' };
    const name = path.basename(fullPath);

    await conn.sendMessage(m.chat, {
      document: data,
      mimetype: type.mime,
      fileName: name
    }, { quoted: m });

    return m.reply(`✅ File berhasil dikirim:\n📄 ${name}\n💾 ${getFileSize(stat.size)}`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function fileInfo(conn, m, dir, text) {
  try {
    if (!text) return m.reply(`Masukkan nama file/folder\n📌 Contoh: ${m.prefix}info handler.js`);

    const fullPath = path.resolve(dir, text);
    
    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(fullPath)) {
      return m.reply(`❌ Path tidak ditemukan: ${fullPath}`);
    }

    const info = await getFileInfo(fullPath);
    return m.reply(info);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function getFileInfo(fullPath) {
  const stat = fs.statSync(fullPath);
  const name = path.basename(fullPath);
  const dir = path.dirname(fullPath);
  const isDir = stat.isDirectory();
  const icon = getFileIcon(name);
  const size = getFileSize(stat.size);

  let msg = `📊 *File Info*\n\n` +
    `📌 Name: ${name}\n` +
    `📂 Path: \`${fullPath}\`\n` +
    `📁 Type: ${isDir ? 'Directory' : 'File'}\n` +
    `💾 Size: ${size}\n` +
    `🕐 Created: ${formatDate(stat.birthtimeMs)}\n` +
    `🕐 Modified: ${formatDate(stat.mtimeMs)}\n` +
    `🕐 Accessed: ${formatDate(stat.atimeMs)}\n`;

  if (!isDir) {
    const ext = path.extname(name);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n').length;
    msg += `📝 Lines: ${lines}\n`;
    msg += `📌 Extension: ${ext || 'No extension'}\n`;
  } else {
    const items = fs.readdirSync(fullPath);
    const dirs = items.filter(item => fs.statSync(path.join(fullPath, item)).isDirectory());
    const files = items.filter(item => !fs.statSync(path.join(fullPath, item)).isDirectory());
    msg += `📁 Subdirectories: ${dirs.length}\n`;
    msg += `📄 Files: ${files.length}\n`;
    msg += `📦 Total Items: ${items.length}\n`;
  }

  return msg;
}

async function searchFiles(conn, m, dir, text) {
  try {
    if (!text) return m.reply(`Masukkan kata kunci pencarian\n📌 Contoh: ${m.prefix}search function`);

    const results = [];
    const pattern = new RegExp(text, 'i');

    function search(directory, depth = 0) {
      if (depth > 5) return;
      try {
        const items = fs.readdirSync(directory);
        for (const item of items) {
          try {
            const itemPath = path.join(directory, item);
            if (!isPathAllowed(itemPath)) continue;
            
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
              search(itemPath, depth + 1);
            } else if (pattern.test(item)) {
              results.push({
                name: item,
                path: itemPath,
                size: getFileSize(stat.size),
                modified: formatDate(stat.mtimeMs)
              });
            }
          } catch {}
        }
      } catch {}
    }

    search(dir);

    if (results.length === 0) {
      return m.reply(`🔍 Tidak ditemukan file dengan kata: "${text}"`);
    }

    let msg = `🔍 *Hasil Pencarian: "${text}"*\n\n`;
    const maxResults = 20;
    const display = results.slice(0, maxResults);

    for (const result of display) {
      const icon = getFileIcon(result.name);
      msg += `${icon} ${result.name}\n`;
      msg += `   📂 ${result.path}\n`;
      msg += `   💾 ${result.size} | 🕐 ${result.modified}\n\n`;
    }

    if (results.length > maxResults) {
      msg += `... dan ${results.length - maxResults} file lainnya`;
    }

    return m.reply(msg);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function zipFiles(conn, m, dir, args) {
  try {
    if (!args || args.length === 0) {
      return m.reply(`Format: ${m.prefix}zip [nama_output] [file/folder1] [file/folder2] ...\n📌 Contoh: ${m.prefix}zip backup plugins lib handler.js`);
    }

    const outputName = args[0];
    const sources = args.slice(1);

    if (sources.length === 0) {
      return m.reply('Masukkan minimal satu file/folder untuk di-zip');
    }

    const outputPath = path.resolve(dir, outputName + '.zip');
    if (!isPathAllowed(outputPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const stream = fs.createWriteStream(outputPath);
    await new Promise((resolve, reject) => {
      archive.pipe(stream);

      for (const source of sources) {
        const sourcePath = path.resolve(dir, source);
        if (!fs.existsSync(sourcePath)) {
          reject(new Error(`Source tidak ditemukan: ${source}`));
          return;
        }
        const stat = fs.statSync(sourcePath);
        const name = path.basename(sourcePath);
        if (stat.isDirectory()) {
          archive.directory(sourcePath, name);
        } else {
          archive.file(sourcePath, { name });
        }
      }

      archive.finalize();
      stream.on('close', resolve);
      stream.on('error', reject);
      archive.on('error', reject);
    });

    const stat = fs.statSync(outputPath);
    await conn.sendMessage(m.chat, {
      document: fs.readFileSync(outputPath),
      mimetype: 'application/zip',
      fileName: outputName + '.zip'
    }, { quoted: m });

    fs.unlinkSync(outputPath);
    return m.reply(`✅ Zip berhasil dibuat: ${outputName}.zip (${getFileSize(stat.size)})`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function unzipFile(conn, m, dir, text) {
  try {
    if (!text) return m.reply(`Masukkan nama file zip\n📌 Contoh: ${m.prefix}unzip backup.zip`);

    const zipPath = path.resolve(dir, text);
    if (!isPathAllowed(zipPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(zipPath)) {
      return m.reply(`❌ File zip tidak ditemukan: ${zipPath}`);
    }

    const extractDir = path.join(dir, path.basename(text, '.zip'));
    if (!isPathAllowed(extractDir)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    fs.mkdirSync(extractDir, { recursive: true });

    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('finish', resolve)
        .on('error', reject);
    });

    const items = fs.readdirSync(extractDir);
    return m.reply(`✅ Unzip berhasil:\n📂 ${extractDir}\n📦 ${items.length} items diekstrak`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function backupFiles(conn, m, dir) {
  try {
    const backupName = `backup_${Date.now()}`;
    const backupPath = path.join(rootDir, 'tmp', backupName + '.tar.gz');
    
    if (!isPathAllowed(backupPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    await m.reply('📦 *Membuat backup...*');

    const items = ['plugins', 'lib', 'helper', 'config.js', 'handler.js', 'index.js', 'package.json'];
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: { level: 9 }
    });

    const stream = fs.createWriteStream(backupPath);
    await new Promise((resolve, reject) => {
      archive.pipe(stream);

      for (const item of items) {
        const itemPath = path.join(rootDir, item);
        if (fs.existsSync(itemPath)) {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            archive.directory(itemPath, item);
          } else {
            archive.file(itemPath, { name: item });
          }
        }
      }

      archive.finalize();
      stream.on('close', resolve);
      stream.on('error', reject);
      archive.on('error', reject);
    });

    const stat = fs.statSync(backupPath);
    await conn.sendMessage(m.chat, {
      document: fs.readFileSync(backupPath),
      mimetype: 'application/gzip',
      fileName: backupName + '.tar.gz'
    }, { quoted: m });

    fs.unlinkSync(backupPath);
    return m.reply(`✅ Backup berhasil: ${backupName}.tar.gz (${getFileSize(stat.size)})`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function restoreBackup(conn, m, dir, text) {
  try {
    if (!text) return m.reply(`Masukkan nama file backup\n📌 Contoh: ${m.prefix}restore backup_1234567890.tar.gz`);

    const backupPath = path.resolve(dir, text);
    if (!isPathAllowed(backupPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(backupPath)) {
      return m.reply(`❌ File backup tidak ditemukan: ${backupPath}`);
    }

    const extractDir = path.join(rootDir, 'tmp', 'restore_' + Date.now());
    fs.mkdirSync(extractDir, { recursive: true });

    await new Promise((resolve, reject) => {
      fs.createReadStream(backupPath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('finish', resolve)
        .on('error', reject);
    });

    const items = fs.readdirSync(extractDir);
    for (const item of items) {
      const src = path.join(extractDir, item);
      const dest = path.join(rootDir, item);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      fs.cpSync(src, dest, { recursive: true });
    }

    fs.rmSync(extractDir, { recursive: true, force: true });
    return m.reply(`✅ Restore berhasil!\n📦 ${items.length} items direstore\n🔄 Restart bot untuk menerapkan perubahan`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}

async function changePermission(conn, m, dir, args) {
  try {
    if (args.length < 2) {
      return m.reply(`Format: ${m.prefix}chmod [mode] [file/folder]\n📌 Contoh: ${m.prefix}chmod 755 handler.js`);
    }

    const mode = args[0];
    const target = args.slice(1).join(' ');
    const fullPath = path.resolve(dir, target);

    if (!isPathAllowed(fullPath)) {
      return m.reply('❌ Akses ditolak: path tidak diizinkan');
    }

    if (!fs.existsSync(fullPath)) {
      return m.reply(`❌ Path tidak ditemukan: ${fullPath}`);
    }

    const modeNum = parseInt(mode, 8);
    if (isNaN(modeNum)) {
      return m.reply('❌ Mode tidak valid. Gunakan format octal (contoh: 755)');
    }

    fs.chmodSync(fullPath, modeNum);
    return m.reply(`✅ Permission berhasil diubah:\n📂 ${fullPath}\n🔐 Mode: ${mode}`);
  } catch (err) {
    return m.reply(`❌ Error: ${err.message}`);
  }
}