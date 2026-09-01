/**
 * JSON 文件数据仓库：院校表 / 专业动态表 / 需求信号表 / 商机视图
 * 所有数据均带来源链接与抓取时间，保证可回溯原文
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');

const TABLES = ['schools', 'majors', 'signals', 'opportunities'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function tablePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readTable(name) {
  const p = tablePath(name);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`[store] 读取 ${name} 失败:`, e.message);
    return [];
  }
}

function writeTable(name, rows) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(tablePath(name), JSON.stringify(rows, null, 2), 'utf8');
}

/** 简单字符串哈希，用于跨源去重 */
function hash(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function normalizeTitle(title) {
  return String(title || '').replace(/\s+/g, '').toLowerCase();
}

/**
 * 追加信号（跨源去重：标题哈希 + 来源URL）
 * @returns {{added:number, skipped:number}}
 */
function upsertSignals(newSignals) {
  const signals = readTable('signals');
  const seen = new Set(signals.map((s) => s.dedupKey));
  let added = 0;
  let skipped = 0;
  for (const sig of newSignals) {
    const key = hash(normalizeTitle(sig.title) + '|' + (sig.sourceUrl || sig.source || ''));
    sig.dedupKey = key;
    if (!sig.firstSeenAt) sig.firstSeenAt = new Date().toISOString();
    sig.lastSeenAt = new Date().toISOString();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    signals.push(sig);
    added++;
  }
  if (added > 0) writeTable('signals', signals);
  return { added, skipped };
}

/** 保存原始页面快照到 data/raw（仅本地，不推远端） */
function saveRaw(sourceId, url, html) {
  const dir = path.join(DATA_DIR, 'raw', sourceId);
  ensureDir(dir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = `${stamp}_${hash(url)}.html`;
  fs.writeFileSync(path.join(dir, fname), html, 'utf8');
}

module.exports = { ROOT, DATA_DIR, TABLES, readTable, writeTable, upsertSignals, saveRaw, hash, ensureDir };
